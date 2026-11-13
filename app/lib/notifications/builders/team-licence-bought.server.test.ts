import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { TeamMemberRole, UserRole } from "~/db/schema";
import { buildTeamLicenceBought } from "./team-licence-bought.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

function addUser(name: string, role: UserRole) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.toLowerCase()}@example.com`, role })
    .returning()
    .get();
}

/** A Team Licence on the base course, bought by `buyerId`, with `seats` Seats. */
function buyTeamLicence(buyerId: number, seats: number) {
  const purchase = db
    .insert(schema.purchases)
    .values({ userId: buyerId, courseId: base.course.id, amountPaid: 1000 })
    .returning()
    .get();
  const team = db.insert(schema.teams).values({}).returning().get();
  db.insert(schema.teamMembers)
    .values({ teamId: team.id, userId: buyerId, role: TeamMemberRole.Admin })
    .run();
  for (let i = 0; i < seats; i++) {
    db.insert(schema.coupons)
      .values({
        teamId: team.id,
        courseId: base.course.id,
        code: `seat-${purchase.id}-${i}`,
        purchaseId: purchase.id,
      })
      .run();
  }
  return purchase;
}

describe("team-licence-bought", () => {
  it("tells the course's Instructor who bought a Team Licence and how many Seats, linking to the students page", () => {
    const jo = addUser("Jo", UserRole.Student);
    const purchase = buyTeamLicence(jo.id, 10);

    expect(buildTeamLicenceBought(db, { purchaseId: purchase.id })).toEqual([
      {
        workflow: "team-licence-bought",
        recipient: { id: String(base.instructor.id), name: "Test Instructor" },
        dedupKey: `team-licence-bought:${purchase.id}`,
        data: {
          actorName: "Jo",
          message: "Jo bought a Team Licence with 10 Seats on *Test Course*",
          url: `/instructor/${base.course.id}/students`,
        },
      },
    ]);
  });

  it("says one Seat, not one Seats", () => {
    const jo = addUser("Jo", UserRole.Student);
    const purchase = buyTeamLicence(jo.id, 1);

    const [send] = buildTeamLicenceBought(db, { purchaseId: purchase.id });

    expect(send.data.message).toBe(
      "Jo bought a Team Licence with 1 Seat on *Test Course*"
    );
  });

  it("sends nothing when the Instructor buys a Team Licence for their own course", () => {
    const purchase = buyTeamLicence(base.instructor.id, 5);

    expect(buildTeamLicenceBought(db, { purchaseId: purchase.id })).toEqual([]);
  });

  it("names Cadence when a Platform Admin buys", () => {
    const pat = addUser("Pat", UserRole.Admin);
    const purchase = buyTeamLicence(pat.id, 3);

    const [send] = buildTeamLicenceBought(db, { purchaseId: purchase.id });

    expect(send.data).toEqual({
      actorName: null,
      message: "Cadence bought a Team Licence with 3 Seats on *Test Course*",
      url: `/instructor/${base.course.id}/students`,
    });
  });

  it("builds an identical payload when built twice", () => {
    const jo = addUser("Jo", UserRole.Student);
    const purchase = buyTeamLicence(jo.id, 10);

    expect(buildTeamLicenceBought(db, { purchaseId: purchase.id })).toEqual(
      buildTeamLicenceBought(db, { purchaseId: purchase.id })
    );
  });

  it("sends nothing for a Purchase that no longer exists", () => {
    expect(buildTeamLicenceBought(db, { purchaseId: 999 })).toEqual([]);
  });
});
