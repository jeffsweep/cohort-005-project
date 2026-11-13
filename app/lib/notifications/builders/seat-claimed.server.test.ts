import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { TeamMemberRole, UserRole } from "~/db/schema";
import { eq } from "drizzle-orm";
import { buildSeatClaimed } from "./seat-claimed.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

function addUser(name: string, role = UserRole.Student) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.toLowerCase()}@example.com`, role })
    .returning()
    .get();
}

/** A team whose Team Admin `adminId` bought a Team Licence with `seats` Seats. */
function buyTeamLicence(adminId: number, seats: number) {
  const purchase = db
    .insert(schema.purchases)
    .values({ userId: adminId, courseId: base.course.id, amountPaid: 1000 })
    .returning()
    .get();
  const team = db.insert(schema.teams).values({}).returning().get();
  db.insert(schema.teamMembers)
    .values({ teamId: team.id, userId: adminId, role: TeamMemberRole.Admin })
    .run();
  const created = [];
  for (let i = 0; i < seats; i++) {
    created.push(
      db
        .insert(schema.coupons)
        .values({
          teamId: team.id,
          courseId: base.course.id,
          code: `seat-${purchase.id}-${i}`,
          purchaseId: purchase.id,
        })
        .returning()
        .get()
    );
  }
  return { team, seats: created };
}

let clock = 0;
function claim(seat: { id: number }, userId: number) {
  clock += 1;
  db.update(schema.coupons)
    .set({
      redeemedByUserId: userId,
      redeemedAt: new Date(Date.UTC(2026, 0, 1, 0, clock)).toISOString(),
    })
    .where(eq(schema.coupons.id, seat.id))
    .run();
}

describe("seat-claimed", () => {
  it("tells the Team Admin who claimed a Seat and how many are left, linking to the team page", () => {
    const jo = addUser("Jo");
    const sam = addUser("Sam");
    const { seats } = buyTeamLicence(jo.id, 10);
    claim(seats[0], addUser("Ann").id);
    claim(seats[1], addUser("Bob").id);
    claim(seats[2], sam.id);

    expect(buildSeatClaimed(db, { seatId: seats[2].id })).toEqual([
      {
        workflow: "seat-claimed",
        recipient: { id: String(jo.id), name: "Jo" },
        dedupKey: `seat-claimed:${seats[2].id}`,
        data: {
          actorName: "Sam",
          message: "Sam claimed a Seat on *Test Course*, 7 of 10 left",
          url: "/team",
        },
      },
    ]);
  });

  it("counts the Seats left when this Seat was claimed, not later claims", () => {
    const jo = addUser("Jo");
    const sam = addUser("Sam");
    const { seats } = buyTeamLicence(jo.id, 3);
    claim(seats[1], sam.id);
    const before = buildSeatClaimed(db, { seatId: seats[1].id });

    claim(seats[0], addUser("Ann").id);

    expect(buildSeatClaimed(db, { seatId: seats[1].id })).toEqual(before);
    expect(before[0].data.message).toBe(
      "Sam claimed a Seat on *Test Course*, 2 of 3 left"
    );
  });

  it("counts Seats on this Team Licence only", () => {
    const jo = addUser("Jo");
    const sam = addUser("Sam");
    buyTeamLicence(jo.id, 5);
    const { seats } = buyTeamLicence(jo.id, 2);
    claim(seats[0], sam.id);

    const [send] = buildSeatClaimed(db, { seatId: seats[0].id });

    expect(send.data.message).toBe(
      "Sam claimed a Seat on *Test Course*, 1 of 2 left"
    );
  });

  it("tells every Team Admin of the team", () => {
    const jo = addUser("Jo");
    const kim = addUser("Kim");
    const sam = addUser("Sam");
    const { team, seats } = buyTeamLicence(jo.id, 2);
    db.insert(schema.teamMembers)
      .values({ teamId: team.id, userId: kim.id, role: TeamMemberRole.Admin })
      .run();
    db.insert(schema.teamMembers)
      .values({
        teamId: team.id,
        userId: sam.id,
        role: TeamMemberRole.Member,
      })
      .run();
    claim(seats[0], sam.id);

    const recipients = buildSeatClaimed(db, { seatId: seats[0].id }).map(
      (send) => send.recipient
    );

    expect(recipients).toEqual([
      { id: String(jo.id), name: "Jo" },
      { id: String(kim.id), name: "Kim" },
    ]);
  });

  it("sends nothing when the Team Admin claims a Seat on their own team", () => {
    const jo = addUser("Jo");
    const { seats } = buyTeamLicence(jo.id, 2);
    claim(seats[0], jo.id);

    expect(buildSeatClaimed(db, { seatId: seats[0].id })).toEqual([]);
  });

  it("names Cadence when a Platform Admin claims a Seat", () => {
    const jo = addUser("Jo");
    const pat = addUser("Pat", UserRole.Admin);
    const { seats } = buyTeamLicence(jo.id, 1);
    claim(seats[0], pat.id);

    const [send] = buildSeatClaimed(db, { seatId: seats[0].id });

    expect(send.data).toEqual({
      actorName: null,
      message: "Cadence claimed a Seat on *Test Course*, 0 of 1 left",
      url: "/team",
    });
  });

  it("builds an identical payload when built twice", () => {
    const jo = addUser("Jo");
    const { seats } = buyTeamLicence(jo.id, 2);
    claim(seats[0], addUser("Sam").id);

    expect(buildSeatClaimed(db, { seatId: seats[0].id })).toEqual(
      buildSeatClaimed(db, { seatId: seats[0].id })
    );
  });

  it("sends nothing for a Seat that isn't claimed or doesn't exist", () => {
    const jo = addUser("Jo");
    const { seats } = buyTeamLicence(jo.id, 1);

    expect(buildSeatClaimed(db, { seatId: seats[0].id })).toEqual([]);
    expect(buildSeatClaimed(db, { seatId: 999 })).toEqual([]);
  });
});
