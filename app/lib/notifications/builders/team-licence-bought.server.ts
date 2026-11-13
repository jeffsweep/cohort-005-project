import { eq, sql } from "drizzle-orm";
import { coupons, courses, purchases, users } from "~/db/schema";
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
 * A Team Licence bought: tell the course's Instructor. Teams have no name, so
 * the buyer is named.
 */
export function buildTeamLicenceBought(
  db: Db,
  event: { purchaseId: number }
): Send[] {
  const purchase = db
    .select()
    .from(purchases)
    .where(eq(purchases.id, event.purchaseId))
    .get();
  if (!purchase) return [];

  const buyer = db
    .select()
    .from(users)
    .where(eq(users.id, purchase.userId))
    .get();
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, purchase.courseId))
    .get();
  if (!buyer || !course) return [];

  const instructor = db
    .select()
    .from(users)
    .where(eq(users.id, course.instructorId))
    .get();
  if (!instructor) return [];

  const seats =
    db
      .select({ count: sql<number>`count(*)` })
      .from(coupons)
      .where(eq(coupons.purchaseId, purchase.id))
      .get()?.count ?? 0;

  const actorName = actorNameOf(buyer);

  return excludingActor(
    [
      {
        workflow: "team-licence-bought",
        recipient: recipientOf(instructor),
        dedupKey: `team-licence-bought:${purchase.id}`,
        data: {
          actorName,
          message: `${displayName(actorName)} bought a Team Licence with ${seats} ${seats === 1 ? "Seat" : "Seats"} on ${italic(course.title)}`,
          url: `/instructor/${course.id}/students`,
        },
      },
    ],
    buyer.id
  );
}
