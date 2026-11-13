import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { buildRoleChanged } from "./role-changed.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let pat: typeof schema.users.$inferSelect;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  pat = db
    .insert(schema.users)
    .values({ name: "Pat", email: "pat@example.com", role: UserRole.Admin })
    .returning()
    .get();
});

function setRole(userId: number, role: UserRole) {
  db.update(schema.users)
    .set({ role })
    .where(eq(schema.users.id, userId))
    .run();
}

describe("role-changed", () => {
  it("tells the person their new role, linking to where it starts", () => {
    setRole(base.user.id, UserRole.Instructor);

    expect(
      buildRoleChanged(db, { userId: base.user.id, actorId: pat.id })
    ).toEqual([
      {
        workflow: "role-changed",
        recipient: { id: String(base.user.id), name: "Test User" },
        dedupKey: `role-changed:${base.user.id}:instructor`,
        data: {
          actorName: null,
          message: "Your role is now Instructor",
          url: "/instructor",
        },
      },
    ]);
  });

  it("links a new Student to their dashboard and a new Platform Admin to the users page", () => {
    setRole(base.instructor.id, UserRole.Student);
    expect(
      buildRoleChanged(db, { userId: base.instructor.id, actorId: pat.id })[0]
        .data
    ).toEqual({
      actorName: null,
      message: "Your role is now Student",
      url: "/dashboard",
    });

    setRole(base.user.id, UserRole.Admin);
    expect(
      buildRoleChanged(db, { userId: base.user.id, actorId: pat.id })[0].data
    ).toEqual({
      actorName: null,
      message: "Your role is now Platform Admin",
      url: "/admin/users",
    });
  });

  it("sends nothing when a Platform Admin changes their own role", () => {
    setRole(pat.id, UserRole.Instructor);

    expect(buildRoleChanged(db, { userId: pat.id, actorId: pat.id })).toEqual(
      []
    );
  });

  it("builds an identical payload when built twice", () => {
    setRole(base.user.id, UserRole.Instructor);
    const event = { userId: base.user.id, actorId: pat.id };

    expect(buildRoleChanged(db, event)).toEqual(buildRoleChanged(db, event));
  });

  it("sends nothing for a person who no longer exists", () => {
    expect(buildRoleChanged(db, { userId: 999, actorId: pat.id })).toEqual([]);
  });
});
