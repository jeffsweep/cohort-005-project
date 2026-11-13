import { eq } from "drizzle-orm";
import { courses, enrollments, users } from "~/db/schema";
import type { Send } from "../send";
import {
  actorNameOf,
  displayName,
  excludingActor,
  italic,
  recipientOf,
  type Db,
} from "./shared.server";

/** A new Enrollment: tell the course's Instructor. */
export function buildEnrolled(db: Db, event: { enrollmentId: number }): Send[] {
  const enrollment = db
    .select()
    .from(enrollments)
    .where(eq(enrollments.id, event.enrollmentId))
    .get();
  if (!enrollment) return [];

  const student = db
    .select()
    .from(users)
    .where(eq(users.id, enrollment.userId))
    .get();
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, enrollment.courseId))
    .get();
  if (!student || !course) return [];

  const instructor = db
    .select()
    .from(users)
    .where(eq(users.id, course.instructorId))
    .get();
  if (!instructor) return [];

  const actorName = actorNameOf(student);

  return excludingActor(
    [
      {
        workflow: "enrolled",
        recipient: recipientOf(instructor),
        dedupKey: `enrolled:${enrollment.id}`,
        data: {
          actorName,
          message: `${displayName(actorName)} enrolled on ${italic(course.title)}`,
          url: `/instructor/${course.id}/students`,
        },
      },
    ],
    student.id
  );
}
