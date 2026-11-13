import { eq } from "drizzle-orm";
import {
  coupons,
  courses,
  purchases,
  refunds,
  RefundStatus,
  users,
} from "~/db/schema";
import type { Send } from "../send";
import {
  actorNameOf,
  excludingActor,
  italic,
  recipientOf,
  type Db,
} from "./shared.server";

// Shared by the Refund Request kinds (refund-requested, refund-approved,
// refund-approved-instructor, refund-declined).

/**
 * Everything the Refund Request kinds need: the request, what was bought,
 * who bought it, the course, its Instructor, who decided it (if anyone) and
 * the Team Licence's Seats (none for an Individual Purchase). Null when any
 * of the rows is missing.
 */
export function loadRefundRequest(db: Db, refundRequestId: number) {
  const refundRequest = db
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundRequestId))
    .get();
  if (!refundRequest) return null;

  const purchase = db
    .select()
    .from(purchases)
    .where(eq(purchases.id, refundRequest.purchaseId))
    .get();
  if (!purchase) return null;

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
  if (!buyer || !course) return null;

  const instructor = db
    .select()
    .from(users)
    .where(eq(users.id, course.instructorId))
    .get();
  if (!instructor) return null;

  const decider =
    refundRequest.resolvedByUserId === null
      ? null
      : (db
          .select()
          .from(users)
          .where(eq(users.id, refundRequest.resolvedByUserId))
          .get() ?? null);

  const seats = db
    .select()
    .from(coupons)
    .where(eq(coupons.purchaseId, purchase.id))
    .all();

  return { refundRequest, purchase, buyer, course, instructor, decider, seats };
}

/** A Team Licence is the Purchase that granted Seats. */
export function isTeamLicence(seats: readonly unknown[]): boolean {
  return seats.length > 0;
}

/**
 * A decided Refund Request: tell the buyer, linking to where they raised it.
 * Sends nothing unless the request was decided this way.
 */
export function buildBuyerDecision(
  db: Db,
  refundRequestId: number,
  decision: RefundStatus.Approved | RefundStatus.Declined
): Send[] {
  const loaded = loadRefundRequest(db, refundRequestId);
  if (!loaded || !loaded.decider) return [];
  const { refundRequest, buyer, course, decider, seats } = loaded;
  if (refundRequest.status !== decision) return [];

  const workflow =
    decision === RefundStatus.Approved ? "refund-approved" : "refund-declined";

  return excludingActor(
    [
      {
        workflow,
        recipient: recipientOf(buyer),
        dedupKey: `${workflow}:${refundRequest.id}`,
        data: {
          actorName: actorNameOf(decider),
          message: `Your Refund Request for ${italic(course.title)} was ${decision}`,
          url: isTeamLicence(seats) ? "/team" : "/settings",
        },
      },
    ],
    decider.id
  );
}
