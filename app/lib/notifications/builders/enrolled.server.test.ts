import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { buildEnrolled } from "./enrolled.server";

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

function enroll(userId: number, courseId = base.course.id) {
  return db
    .insert(schema.enrollments)
    .values({ userId, courseId })
    .returning()
    .get();
}

describe("enrolled", () => {
  it("tells the course's Instructor that a Student enrolled, linking to the students page", () => {
    const sam = addUser("Sam", UserRole.Student);
    const enrollment = enroll(sam.id);

    expect(buildEnrolled(db, { enrollmentId: enrollment.id })).toEqual([
      {
        workflow: "enrolled",
        recipient: { id: String(base.instructor.id), name: "Test Instructor" },
        dedupKey: `enrolled:${enrollment.id}`,
        data: {
          actorName: "Sam",
          message: "Sam enrolled on *Test Course*",
          url: `/instructor/${base.course.id}/students`,
        },
      },
    ]);
  });

  it("sends nothing when the Instructor enrolls on their own course", () => {
    const enrollment = enroll(base.instructor.id);

    expect(buildEnrolled(db, { enrollmentId: enrollment.id })).toEqual([]);
  });

  it("names Cadence when a Platform Admin enrolls", () => {
    const pat = addUser("Pat", UserRole.Admin);
    const enrollment = enroll(pat.id);

    const [send] = buildEnrolled(db, { enrollmentId: enrollment.id });

    expect(send.data).toEqual({
      actorName: null,
      message: "Cadence enrolled on *Test Course*",
      url: `/instructor/${base.course.id}/students`,
    });
  });

  it("builds an identical payload when built twice", () => {
    const sam = addUser("Sam", UserRole.Student);
    const enrollment = enroll(sam.id);

    expect(buildEnrolled(db, { enrollmentId: enrollment.id })).toEqual(
      buildEnrolled(db, { enrollmentId: enrollment.id })
    );
  });

  it("sends nothing for an Enrollment that no longer exists", () => {
    expect(buildEnrolled(db, { enrollmentId: 999 })).toEqual([]);
  });
});
