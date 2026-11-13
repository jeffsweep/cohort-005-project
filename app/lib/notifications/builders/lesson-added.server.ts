import { eq } from "drizzle-orm";
import { courses, enrollments, lessons, modules, users } from "~/db/schema";
import type { Send } from "../send";
import {
  actorNameOf,
  displayName,
  excludingActor,
  italic,
  recipientOf,
  type Db,
} from "./shared.server";

type LessonAddedEvent =
  { lessonId: number; actorId: number } | { moduleId: number; actorId: number };

/**
 * A new lesson or module: tell every Student enrolled on the course. Knock
 * batches these per Student and course for a day and shows one sentence
 * written from the batch's count, so `message` only appears in the outbox.
 */
export function buildLessonAdded(db: Db, event: LessonAddedEvent): Send[] {
  let moduleId: number;
  let what: "lesson" | "module";
  let dedupKey: string;
  if ("lessonId" in event) {
    const lesson = db
      .select()
      .from(lessons)
      .where(eq(lessons.id, event.lessonId))
      .get();
    if (!lesson) return [];
    moduleId = lesson.moduleId;
    what = "lesson";
    dedupKey = `lesson-added:${lesson.id}`;
  } else {
    moduleId = event.moduleId;
    what = "module";
    dedupKey = `module-added:${event.moduleId}`;
  }

  const mod = db.select().from(modules).where(eq(modules.id, moduleId)).get();
  if (!mod) return [];
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, mod.courseId))
    .get();
  const actor = db
    .select()
    .from(users)
    .where(eq(users.id, event.actorId))
    .get();
  if (!course || !actor) return [];

  const students = db
    .select({ id: users.id, name: users.name })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(eq(enrollments.courseId, course.id))
    .orderBy(enrollments.id)
    .all();

  const actorName = actorNameOf(actor);
  const courseTitle = italic(course.title);

  return excludingActor(
    students.map((student) => ({
      workflow: "lesson-added",
      recipient: recipientOf(student),
      dedupKey,
      data: {
        actorName,
        message: `${displayName(actorName)} added a ${what} to ${courseTitle}`,
        url: `/courses/${course.slug}`,
        courseId: course.id,
        courseTitle,
      },
    })),
    actor.id
  );
}
