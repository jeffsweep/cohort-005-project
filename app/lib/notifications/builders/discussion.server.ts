import { and, eq, lt } from "drizzle-orm";
import {
  comments,
  courses,
  lessons,
  modules,
  users,
  UserRole,
} from "~/db/schema";
import type { Send } from "../send";
import {
  actorNameOf,
  displayName,
  excludingActor,
  italic,
  recipientOf,
  type Db,
} from "./shared.server";

/**
 * A comment was posted on a lesson's discussion. Builds whichever of
 * `question-asked`, `question-answered` and `comment-replied` it causes.
 */
export function buildCommentPosted(
  db: Db,
  event: { commentId: number }
): Send[] {
  const comment = db
    .select()
    .from(comments)
    .where(eq(comments.id, event.commentId))
    .get();
  if (!comment) return [];

  const place = db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      courseSlug: courses.slug,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, comment.lessonId))
    .get();
  const author = userById(db, comment.userId);
  if (!place || !author) return [];

  const actorName = actorNameOf(author);
  const lesson = italic(place.lessonTitle);
  const urlOf = (commentId: number) =>
    `/courses/${place.courseSlug}/lessons/${place.lessonId}#comment-${commentId}`;

  const isStaff = (person: { id: number; role: UserRole }) =>
    person.role === UserRole.Admin || person.id === place.instructorId;

  if (comment.parentId === null) {
    // Only a Student's top-level comment is a Discussion Question.
    if (isStaff(author)) return [];
    const instructor = userById(db, place.instructorId);
    if (!instructor) return [];
    return excludingActor(
      [
        {
          workflow: "question-asked",
          recipient: recipientOf(instructor),
          dedupKey: `question-asked:${comment.id}`,
          data: {
            actorName,
            message: `${displayName(actorName)} posted in the discussion on ${lesson}`,
            url: urlOf(comment.id),
          },
        },
      ],
      author.id
    );
  }

  const parent = db
    .select()
    .from(comments)
    .where(eq(comments.id, comment.parentId))
    .get();
  const parentAuthor = parent && userById(db, parent.userId);
  if (!parent || !parentAuthor) return [];

  // Replies before this one, by staff. Deleted ones count: their author was
  // already told the question was answered.
  const earlierStaffReply = db
    .select({ id: comments.id, userId: comments.userId, role: users.role })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.parentId, parent.id), lt(comments.id, comment.id)))
    .all()
    .some((reply) => isStaff({ id: reply.userId, role: reply.role }));

  const answersQuestion =
    isStaff(author) && !isStaff(parentAuthor) && !earlierStaffReply;

  if (answersQuestion) {
    return excludingActor(
      [
        {
          workflow: "question-answered",
          recipient: recipientOf(parentAuthor),
          dedupKey: `question-answered:${parent.id}`,
          data: {
            actorName,
            message: `${displayName(actorName)} replied to your post on ${lesson}`,
            url: urlOf(comment.id),
          },
        },
      ],
      author.id
    );
  }

  return excludingActor(
    [
      {
        workflow: "comment-replied",
        recipient: recipientOf(parentAuthor),
        dedupKey: `comment-replied:${comment.id}`,
        data: {
          actorName,
          message: `${displayName(actorName)} replied to your comment on ${lesson}`,
          url: urlOf(comment.id),
        },
      },
    ],
    author.id
  );
}

function userById(db: Db, id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}
