import { RefundStatus } from "~/db/schema";
import type { Send } from "../send";
import { isTeamLicence, loadRefundRequest } from "./refund-request.server";
import {
  actorNameOf,
  displayName,
  excludingActor,
  italic,
  recipientOf,
  type Db,
} from "./shared.server";

/**
 * A Refund Request approved: tell the course's Instructor what was refunded
 * and, for a Team Licence, how many Unclaimed Seats were voided.
 */
export function buildRefundApprovedInstructor(
  db: Db,
  event: { refundRequestId: number }
): Send[] {
  const loaded = loadRefundRequest(db, event.refundRequestId);
  if (!loaded || !loaded.decider) return [];
  const { refundRequest, buyer, course, instructor, decider, seats } = loaded;
  if (refundRequest.status !== RefundStatus.Approved) return [];

  const actorName = actorNameOf(decider);
  const refunded = `${displayName(actorName)} refunded ${buyer.name}'s`;
  const courseTitle = italic(course.title);

  let message: string;
  if (isTeamLicence(seats)) {
    const voided = seats.filter((seat) => seat.refundedAt !== null).length;
    const seatWord = voided === 1 ? "Seat" : "Seats";
    message = `${refunded} Team Licence on ${courseTitle}; ${voided} Unclaimed ${seatWord} voided`;
  } else {
    message = `${refunded} purchase of ${courseTitle}`;
  }

  return excludingActor(
    [
      {
        workflow: "refund-approved-instructor",
        recipient: recipientOf(instructor),
        dedupKey: `refund-approved-instructor:${refundRequest.id}`,
        data: {
          actorName,
          message,
          url: `/instructor/${course.id}/students`,
        },
      },
    ],
    decider.id
  );
}
