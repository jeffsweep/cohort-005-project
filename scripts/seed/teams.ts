import { eq, isNotNull, isNull } from "drizzle-orm";
import * as schema from "../../app/db/schema";
import { TeamMemberRole } from "../../app/db/schema";
import { countRows, db, type Course, type User } from "./db";
import { daysAgo } from "./helpers";
import type { SeededUsers } from "./users";

// ─── Teams, Team Members, and Coupons ───
// Bossy McBossface bought 5 team seats for course 2; Olivia and Liam redeemed coupons

export function seedBossyTeam(
  bossy: User,
  course2: Course,
  studentByEmail: SeededUsers["studentByEmail"]
) {
  const [team1] = db
    .insert(schema.teams)
    .values({ createdAt: daysAgo(30) })
    .returning()
    .all();

  db.insert(schema.teamMembers)
    .values({
      teamId: team1.id,
      userId: bossy.id,
      role: TeamMemberRole.Admin,
      createdAt: daysAgo(30),
    })
    .run();

  // Team purchase by Bossy McBossface for course 2 (5 seats)
  const [teamPurchase] = db
    .insert(schema.purchases)
    .values({
      userId: bossy.id,
      courseId: course2.id,
      amountPaid: 5999 * 5,
      country: "US",
      createdAt: daysAgo(30),
    })
    .returning()
    .all();

  // Generate 5 coupons for the team purchase
  const couponCodes = [
    "TEAM-NODEJS-A1B2C3",
    "TEAM-NODEJS-D4E5F6",
    "TEAM-NODEJS-G7H8I9",
    "TEAM-NODEJS-J0K1L2",
    "TEAM-NODEJS-M3N4O5",
  ];

  const seededCoupons = db
    .insert(schema.coupons)
    .values(
      couponCodes.map((code) => ({
        teamId: team1.id,
        courseId: course2.id,
        code,
        purchaseId: teamPurchase.id,
        createdAt: daysAgo(30),
      }))
    )
    .returning()
    .all();

  // Redeem 2 of the 5 coupons. Redeemers are named by email, not by position in
  // the students array — position would silently re-point these redemptions at
  // different people the moment a student is inserted rather than appended.
  // Both already have an enrolment for course 2 from the enrolments section.
  db.update(schema.coupons)
    .set({
      redeemedByUserId: studentByEmail("olivia.martinez@student.dev").id,
      redeemedAt: daysAgo(30),
    })
    .where(eq(schema.coupons.id, seededCoupons[0].id))
    .run();

  db.update(schema.coupons)
    .set({
      redeemedByUserId: studentByEmail("liam@example.com").id,
      redeemedAt: daysAgo(25),
    })
    .where(eq(schema.coupons.id, seededCoupons[1].id))
    .run();

  console.log(
    `Created 1 team with Bossy McBossface as admin, 1 team purchase, and ${seededCoupons.length} coupons (${countRows(schema.coupons, isNotNull(schema.coupons.redeemedByUserId))} redeemed, ${countRows(schema.coupons, isNull(schema.coupons.redeemedByUserId))} available).`
  );
}

// ─── Further team purchases ───
// Two more seat purchases so team revenue is not a single row, in mixed
// redemption states: one team most of the way through its seats, one that has
// bought and redeemed nothing yet.

export function seedFurtherTeamPurchases(
  course1: Course,
  course3: Course,
  studentByEmail: SeededUsers["studentByEmail"]
) {
  function createTeamPurchase(
    adminEmail: string,
    course: typeof course1,
    seats: number,
    codePrefix: string,
    purchasedDaysAgo: number,
    redeemerEmails: string[]
  ) {
    const teamAdmin = studentByEmail(adminEmail);

    const [team] = db
      .insert(schema.teams)
      .values({ createdAt: daysAgo(purchasedDaysAgo) })
      .returning()
      .all();

    db.insert(schema.teamMembers)
      .values({
        teamId: team.id,
        userId: teamAdmin.id,
        role: TeamMemberRole.Admin,
        createdAt: daysAgo(purchasedDaysAgo),
      })
      .run();

    const [purchase] = db
      .insert(schema.purchases)
      .values({
        userId: teamAdmin.id,
        courseId: course.id,
        amountPaid: course.price * seats,
        country: "US",
        createdAt: daysAgo(purchasedDaysAgo),
      })
      .returning()
      .all();

    const teamCoupons = db
      .insert(schema.coupons)
      .values(
        Array.from({ length: seats }, (_, i) => ({
          teamId: team.id,
          courseId: course.id,
          code: `${codePrefix}-${String(i + 1).padStart(2, "0")}`,
          purchaseId: purchase.id,
          createdAt: daysAgo(purchasedDaysAgo),
        }))
      )
      .returning()
      .all();

    // Redeemers named by email, for the reason given at Bossy's team above.
    redeemerEmails.forEach((email, i) => {
      const redeemer = studentByEmail(email);
      const redeemedDaysAgo = Math.max(0, purchasedDaysAgo - (i + 1) * 2);

      db.update(schema.coupons)
        .set({
          redeemedByUserId: redeemer.id,
          redeemedAt: daysAgo(redeemedDaysAgo),
        })
        .where(eq(schema.coupons.id, teamCoupons[i].id))
        .run();

      db.insert(schema.teamMembers)
        .values({
          teamId: team.id,
          userId: redeemer.id,
          role: TeamMemberRole.Member,
          createdAt: daysAgo(redeemedDaysAgo),
        })
        .run();

      db.insert(schema.enrollments)
        .values({
          userId: redeemer.id,
          courseId: course.id,
          enrolledAt: daysAgo(redeemedDaysAgo),
        })
        .run();
    });

    return { team, purchase, coupons: teamCoupons };
  }

  // Eight seats on TypeScript, six redeemed.
  createTeamPurchase(
    "ava.nakamura@student.dev",
    course1,
    8,
    "TEAM-TS-NAKAMURA",
    120,
    [
      "noah.blackwood@student.dev",
      "isla.fernandes@student.dev",
      "ethan.okafor@student.dev",
      "mia.lindqvist@student.dev",
      "lucas.moreau@student.dev",
      "zara.haddad@student.dev",
    ]
  );

  // Four seats on Design Systems, bought during launch week, none redeemed yet.
  const novakLicence = createTeamPurchase(
    "marta.novak@student.dev",
    course3,
    4,
    "TEAM-DS-NOVAK",
    4,
    []
  );

  return novakLicence;
}
