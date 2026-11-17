import { data } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import {
  comments,
  courses,
  lessons,
  modules,
  users,
  UserRole,
} from "~/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  coursePermissions,
  type CourseRef,
} from "~/modules/permissions/course-permissions.server";
import type { Person } from "~/modules/permissions/person.server";
import type { RenderedComment } from "~/components/comment-thread";
import { renderComment } from "~/lib/comment-markdown.server";
import {
  createComment,
  deleteComment,
  editComment,
} from "~/lib/comments.server";
import { defaultNotifications } from "~/lib/notifications.server";
import { markdown, type Markdown } from "~/lib/text";
import { parseFormData } from "~/lib/validation";

const createCommentSchema = z.object({
  intent: z.literal("create-comment"),
  body: z.string(),
  parentId: z.coerce.number().int().optional(),
});

const editCommentSchema = z.object({
  intent: z.literal("edit-comment"),
  commentId: z.coerce.number().int(),
  body: z.string(),
});

const deleteCommentSchema = z.object({
  intent: z.literal("delete-comment"),
  commentId: z.coerce.number().int(),
});

type CommentAuthor = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isInstructor: boolean;
  isPlatformAdmin: boolean;
};

type ThreadComment = {
  id: number;
  body: Markdown;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  author: CommentAuthor;
  replies: ThreadComment[];
};

function getCourseForLesson(lessonId: number) {
  return db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
}

function getCommentById(commentId: number) {
  return db.select().from(comments).where(eq(comments.id, commentId)).get();
}

export function getLessonThread(lessonId: number): ThreadComment[] {
  const course = getCourseForLesson(lessonId);
  if (!course) return [];

  const rows = db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      authorId: users.id,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.lessonId, lessonId))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();

  const toThreadComment = (row: (typeof rows)[number]): ThreadComment => {
    const deleted = row.deletedAt !== null;
    return {
      id: row.id,
      body: deleted ? markdown("") : row.body,
      createdAt: row.createdAt,
      editedAt: deleted ? null : row.editedAt,
      deleted,
      author: {
        id: row.authorId,
        name: row.authorName,
        avatarUrl: row.authorAvatarUrl,
        isInstructor: row.authorId === course.instructorId,
        isPlatformAdmin: row.authorRole === UserRole.Admin,
      },
      replies: [],
    };
  };

  const topLevel: ThreadComment[] = [];
  const byId = new Map<number, ThreadComment>();

  for (const row of rows) {
    if (row.parentId !== null) continue;
    const comment = toThreadComment(row);
    byId.set(comment.id, comment);
    topLevel.push(comment);
  }

  for (const row of rows) {
    if (row.parentId === null || row.deletedAt !== null) continue;
    byId.get(row.parentId)?.replies.push(toThreadComment(row));
  }

  // A deleted question with no replies left has nothing worth showing.
  return topLevel.filter((c) => !c.deleted || c.replies.length > 0);
}

/**
 * Renders every comment body to sanitised HTML, preserving the reply nesting.
 * Comments are untrusted input, so this must be renderComment — never
 * renderMarkdown, which lets raw HTML through for trusted lesson content.
 */
export async function renderThread(
  nodes: ThreadComment[]
): Promise<RenderedComment[]> {
  return Promise.all(
    nodes.map(async (node) => ({
      ...node,
      bodyHtml: node.deleted ? "" : await renderComment(node.body),
      replies: await renderThread(node.replies),
    }))
  );
}

/**
 * Handles the create, edit and delete comment intents for a lesson. The caller
 * has already checked the view capability.
 */
export async function handleCommentIntent(
  intent: "create-comment" | "edit-comment" | "delete-comment",
  formData: FormData,
  {
    person,
    ref,
    lessonId,
  }: { person: Person; ref: CourseRef; lessonId: number }
) {
  const currentUserId = person.id;

  try {
    if (intent === "create-comment") {
      const parsed = parseFormData(formData, createCommentSchema);
      if (!parsed.success) {
        return { ok: false, error: "Enter a comment before posting." };
      }
      const created = await createComment(
        db,
        currentUserId,
        lessonId,
        parsed.data.parentId ?? null,
        parsed.data.body,
        new Date(),
        await defaultNotifications()
      );
      if (!created.ok) return created;
      return { ok: true };
    }

    if (intent === "edit-comment") {
      const parsed = parseFormData(formData, editCommentSchema);
      if (!parsed.success) {
        return { ok: false, error: "Enter a comment before saving." };
      }
      // Scope the id to this lesson so a comment elsewhere can't be reached
      // by posting its id to this route.
      const existing = getCommentById(parsed.data.commentId);
      if (!existing || existing.lessonId !== lessonId) {
        throw data("Comment not found", { status: 404 });
      }
      const edited = editComment(
        db,
        parsed.data.commentId,
        currentUserId,
        parsed.data.body,
        new Date()
      );
      if (!edited.ok) return edited;
      return { ok: true };
    }

    const parsed = parseFormData(formData, deleteCommentSchema);
    if (!parsed.success) {
      return { ok: false, error: "Could not delete that comment." };
    }
    const existing = getCommentById(parsed.data.commentId);
    if (!existing || existing.lessonId !== lessonId) {
      throw data("Comment not found", { status: 404 });
    }
    // Anyone who can view may delete their own posts; moderating someone
    // else's takes the manage capability.
    const decisions = coursePermissions.decide(person, ref);
    const canModerate = decisions.found && decisions.manage.allowed;
    const deleted = await deleteComment(
      db,
      parsed.data.commentId,
      currentUserId,
      canModerate,
      new Date(),
      await defaultNotifications()
    );
    if (!deleted.ok) return deleted;
    return { ok: true };
  } catch (error) {
    // Service validation failures are user-correctable; anything thrown as a
    // Response (404 above) should keep bubbling.
    if (error instanceof Error) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
