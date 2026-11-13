import { and, asc, eq } from "drizzle-orm";
import {
  coupons,
  courses,
  teamMembers,
  TeamMemberRole,
  users,
} from "~/db/schema";
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
 * A Seat claimed: tell the team's Team Admins how many Seats are left on that
 * Team Licence.
 */
export function buildSeatClaimed(db: Db, event: { seatId: number }): Send[] {
  const seat = db
    .select()
    .from(coupons)
    .where(eq(coupons.id, event.seatId))
    .get();
  if (!seat || seat.redeemedByUserId === null || seat.redeemedAt === null) {
    return [];
  }
  const claimedAt = seat.redeemedAt;

  const claimer = db
    .select()
    .from(users)
    .where(eq(users.id, seat.redeemedByUserId))
    .get();
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, seat.courseId))
    .get();
  if (!claimer || !course) return [];

  // Seats left as of this claim, so building again after later claims gives
  // the same payload.
  const licenceSeats = db
    .select()
    .from(coupons)
    .where(eq(coupons.purchaseId, seat.purchaseId))
    .all();
  const claimedSoFar = licenceSeats.filter(
    (other) =>
      other.redeemedAt !== null &&
      (other.redeemedAt < claimedAt ||
        (other.redeemedAt === claimedAt && other.id <= seat.id))
  ).length;
  const left = licenceSeats.length - claimedSoFar;

  const teamAdmins = db
    .select({ id: users.id, name: users.name })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(
      and(
        eq(teamMembers.teamId, seat.teamId),
        eq(teamMembers.role, TeamMemberRole.Admin)
      )
    )
    .orderBy(asc(users.id))
    .all();

  const actorName = actorNameOf(claimer);
  const message = `${displayName(actorName)} claimed a Seat on ${italic(course.title)}, ${left} of ${licenceSeats.length} left`;

  return excludingActor(
    teamAdmins.map((admin) => ({
      workflow: "seat-claimed",
      recipient: recipientOf(admin),
      dedupKey: `seat-claimed:${seat.id}`,
      data: { actorName, message, url: "/team" },
    })),
    claimer.id
  );
}
