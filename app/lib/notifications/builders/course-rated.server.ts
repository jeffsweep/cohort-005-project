import { eq } from "drizzle-orm";
import { courseRatings, courses, users } from "~/db/schema";
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
 * A course rated, or re-rated with different stars: tell its Instructor.
 * `previousStars` is the rating before this write, or null for a first rating.
 * The dedup key carries the write's time, so going back to stars given before
 * is told again rather than dropped as a repeat.
 */
export function buildCourseRated(
  db: Db,
  event: { ratingId: number; previousStars: number | null }
): Send[] {
  const rating = db
    .select()
    .from(courseRatings)
    .where(eq(courseRatings.id, event.ratingId))
    .get();
  if (!rating || rating.rating === event.previousStars) return [];

  const rater = db.select().from(users).where(eq(users.id, rating.userId)).get();
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, rating.courseId))
    .get();
  if (!rater || !course) return [];

  const instructor = db
    .select()
    .from(users)
    .where(eq(users.id, course.instructorId))
    .get();
  if (!instructor) return [];

  const actorName = actorNameOf(rater);
  const stars = `${rating.rating}★`;
  const message =
    event.previousStars === null
      ? `${displayName(actorName)} rated ${italic(course.title)} ${stars}`
      : `${displayName(actorName)} changed their rating of ${italic(course.title)} to ${stars}`;

  return excludingActor(
    [
      {
        workflow: "course-rated",
        recipient: recipientOf(instructor),
        dedupKey: `course-rated:${rating.id}:${rating.rating}:${rating.updatedAt}`,
        data: {
          actorName,
          message,
          url: `/courses/${course.slug}#ratings`,
        },
      },
    ],
    rater.id
  );
}
