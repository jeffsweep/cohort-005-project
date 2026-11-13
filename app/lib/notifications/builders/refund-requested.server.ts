import { eq } from "drizzle-orm";
import { UserRole, users } from "~/db/schema";
import type { Send, Withdrawal } from "../send";
import { loadRefundRequest } from "./refund-request.server";
import {
  actorNameOf,
  displayName,
  excludingActor,
  italic,
  recipientOf,
  type Db,
} from "./shared.server";

/** A Refund Request raised: tell every Platform Admin. */
export function buildRefundRequested(
  db: Db,
  event: { refundRequestId: number }
): Send[] {
  const loaded = loadRefundRequest(db, event.refundRequestId);
  if (!loaded) return [];
  const { refundRequest, buyer, course } = loaded;

  const platformAdmins = db
    .select()
    .from(users)
    .where(eq(users.role, UserRole.Admin))
    .orderBy(users.id)
    .all();

  const actorName = actorNameOf(buyer);

  return excludingActor(
    platformAdmins.map((admin) => ({
      workflow: "refund-requested",
      recipient: recipientOf(admin),
      dedupKey: `refund-requested:${refundRequest.id}`,
      data: {
        actorName,
        message: `${displayName(actorName)} asked for a refund on ${italic(course.title)}`,
        url: `/admin/refunds?request=${refundRequest.id}`,
        refundRequestId: refundRequest.id,
      },
    })),
    buyer.id
  );
}

/**
 * Once a Refund Request is decided, every Platform Admin's copy of its
 * refund-requested Notification is withdrawn, the decider's included.
 */
export function refundRequestedWithdrawal(refundRequestId: number): Withdrawal {
  return { workflow: "refund-requested", triggerData: { refundRequestId } };
}
