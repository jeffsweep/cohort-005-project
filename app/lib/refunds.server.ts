import { eq } from "drizzle-orm";
import { courses, refunds, users, RefundStatus, UserRole } from "~/db/schema";
import { formatPrice } from "~/lib/utils";
import {
  sendSafely,
  toNotificationPerson,
  type Notifications,
} from "~/lib/notifications.server";
import {
  getNewestIndividualPurchase,
  getSeats,
  kindOf,
  type Db,
  type PurchaseKind,
  type Queryable,
} from "~/lib/refund-purchases.server";
import {
  checkRefundRequest,
  lastDayOfWindow,
  type Failure,
} from "~/lib/refund-eligibility.server";
import type { Email } from "~/lib/refund-decisions.server";

// docs/adr/0001–0004 explain why Refunds work the way they do.
//
// Refunds are split by stage across the refund-*.server files; this is the
// one the app imports, so it also hands on what the rest of the app reads.

export {
  getNewestIndividualPurchase,
  getSeatAvailability,
  type Db,
  type PurchaseKind,
  type SeatAvailability,
} from "~/lib/refund-purchases.server";
export {
  calendarDay,
  checkRefundRequest,
  lastDayOfWindow,
  type Failure,
  type RefundFigures,
} from "~/lib/refund-eligibility.server";
export {
  listRefundRequestsForBuyer,
  listRefundRequestsForReview,
  listTeamLicences,
  type RefundRequestForReview,
} from "~/lib/refund-request-lists.server";
export {
  approveRefundRequest,
  declineRefundRequest,
  type DecisionResult,
  type Email,
} from "~/lib/refund-decisions.server";

// ─── Raising a Refund Request ───

export type RefundOffer = {
  purchaseId: number;
  amount: number;
  lastDayInWindow: string;
};

/**
 * What the course page offers a student who wants their money back: their
 * newest Individual Purchase of the course, if it can be refunded. Team
 * Licences are refunded from the team page instead.
 */
export function getRefundOffer(
  db: Queryable,
  buyerId: number,
  courseId: number,
  now: Date
): RefundOffer | null {
  const individualPurchase = getNewestIndividualPurchase(db, buyerId, courseId);
  if (!individualPurchase) return null;

  const check = checkRefundRequest(db, individualPurchase.id, buyerId, now);
  if (!check.ok) return null;

  return {
    purchaseId: individualPurchase.id,
    amount: individualPurchase.amountPaid,
    lastDayInWindow: lastDayOfWindow(individualPurchase.createdAt),
  };
}

export type RaiseResult =
  | { ok: true; refundRequestId: number; kind: PurchaseKind; email: Email }
  | Failure;

export async function raiseRefundRequest(
  db: Db,
  purchaseId: number,
  buyerId: number,
  reason: string,
  now: Date,
  notifications: Notifications
): Promise<RaiseResult> {
  const check = checkRefundRequest(db, purchaseId, buyerId, now);
  if (!check.ok) return check;

  const { purchase } = check;
  const buyer = db.select().from(users).where(eq(users.id, buyerId)).get();
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, purchase.courseId))
    .get();

  if (!buyer || !course) {
    return { ok: false, status: 404, error: "Purchase not found." };
  }

  const refundRequest = db
    .insert(refunds)
    .values({
      purchaseId: purchase.id,
      status: RefundStatus.Open,
      reason,
      requestedAt: now.toISOString(),
    })
    .returning()
    .get();

  await sendSafely(
    notifications,
    {
      kind: "refund-requested",
      recipient: toNotificationPerson(buyer),
      data: {
        refundRequestId: refundRequest.id,
        courseTitle: course.title,
        amount: formatPrice(purchase.amountPaid),
      },
    },
    `refund-requested:${refundRequest.id}`
  );

  const platformAdmins = db
    .select()
    .from(users)
    .where(eq(users.role, UserRole.Admin))
    .all();
  for (const platformAdmin of platformAdmins) {
    await sendSafely(
      notifications,
      {
        kind: "refund-request-open",
        recipient: toNotificationPerson(platformAdmin),
        actor: toNotificationPerson(buyer),
        data: {
          refundRequestId: refundRequest.id,
          buyerName: buyer.name,
          courseTitle: course.title,
          amount: formatPrice(purchase.amountPaid),
          reason,
          url: "/admin/refunds",
        },
      },
      `refund-request-open:${refundRequest.id}`
    );
  }

  return {
    ok: true,
    refundRequestId: refundRequest.id,
    kind: kindOf(getSeats(db, purchase.id)),
    email: {
      to: buyer.email,
      subject: `Refund requested — ${course.title}`,
      body: [
        `Hi ${buyer.name},`,
        "",
        `We have your refund request for "${course.title}".`,
        `The refund is for ${formatPrice(purchase.amountPaid)}, the amount you paid.`,
        "",
        "Our team reviews every refund request by hand. You do not need to do anything else — we will email you again when it is done.",
        "",
        "— The Cadence team",
      ].join("\n"),
    },
  };
}
