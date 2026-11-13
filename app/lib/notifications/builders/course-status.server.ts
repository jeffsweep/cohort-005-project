import { eq } from "drizzle-orm";
import { CourseStatus, courses, users } from "~/db/schema";
import type { Send } from "../send";
import {
  actorNameOf,
  displayName,
  excludingActor,
  italic,
  recipientOf,
  type Db,
} from "./shared.server";

const STATUS_WORDING: Record<CourseStatus, string> = {
  [CourseStatus.Published]: "published",
  [CourseStatus.Archived]: "archived",
  [CourseStatus.Draft]: "moved back to draft",
};

/**
 * A course's status was saved (read after the write commits): tell its
 * Instructor, unless they made the change themselves or the status is the
 * one it had before.
 */
export function buildCourseStatus(
  db: Db,
  event: { courseId: number; actorId: number; previousStatus: CourseStatus }
): Send[] {
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, event.courseId))
    .get();
  const actor = db.select().from(users).where(eq(users.id, event.actorId)).get();
  if (!course || !actor) return [];
  if (course.status === event.previousStatus) return [];

  const instructor = db
    .select()
    .from(users)
    .where(eq(users.id, course.instructorId))
    .get();
  if (!instructor) return [];

  const actorName = actorNameOf(actor);

  return excludingActor(
    [
      {
        workflow: "course-status",
        recipient: recipientOf(instructor),
        dedupKey: `course-status:${course.id}:${course.status}:${course.updatedAt}`,
        data: {
          actorName,
          message: `${italic(course.title)} was ${STATUS_WORDING[course.status]} by ${displayName(actorName)}`,
          url: `/instructor/${course.id}`,
        },
      },
    ],
    actor.id
  );
}
