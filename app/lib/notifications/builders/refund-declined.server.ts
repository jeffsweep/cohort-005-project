import { RefundStatus } from "~/db/schema";
import type { Send } from "../send";
import { buildBuyerDecision } from "./refund-request.server";
import type { Db } from "./shared.server";

/** A Refund Request declined: tell the buyer. Always on. */
export function buildRefundDeclined(
  db: Db,
  event: { refundRequestId: number }
): Send[] {
  return buildBuyerDecision(db, event.refundRequestId, RefundStatus.Declined);
}
