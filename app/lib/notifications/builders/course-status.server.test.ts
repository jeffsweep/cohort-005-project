import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus, UserRole } from "~/db/schema";
import { buildCourseStatus } from "./course-status.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

function addAdmin() {
  return db
    .insert(schema.users)
    .values({ name: "Pat", email: "pat@example.com", role: UserRole.Admin })
    .returning()
    .get();
}

function setStatus(status: CourseStatus, updatedAt: string) {
  db.update(schema.courses)
    .set({ status, updatedAt })
    .where(eq(schema.courses.id, base.course.id))
    .run();
}

describe("course-status", () => {
  it("tells the Instructor that Cadence archived their course, linking to the course editor", () => {
    const pat = addAdmin();
    setStatus(CourseStatus.Archived, "2026-11-13T09:00:00.000Z");

    expect(
      buildCourseStatus(db, { courseId: base.course.id, actorId: pat.id })
    ).toEqual([
      {
        workflow: "course-status",
        recipient: { id: String(base.instructor.id), name: "Test Instructor" },
        dedupKey: `course-status:${base.course.id}:archived:2026-11-13T09:00:00.000Z`,
        data: {
          actorName: null,
          message: "*Test Course* was archived by Cadence",
          url: `/instructor/${base.course.id}`,
        },
      },
    ]);
  });

  it("words publishing and moving back to draft", () => {
    const pat = addAdmin();
    const event = { courseId: base.course.id, actorId: pat.id };

    setStatus(CourseStatus.Published, "2026-11-13T09:00:00.000Z");
    expect(buildCourseStatus(db, event)[0].data.message).toBe(
      "*Test Course* was published by Cadence"
    );

    setStatus(CourseStatus.Draft, "2026-11-13T10:00:00.000Z");
    expect(buildCourseStatus(db, event)[0].data.message).toBe(
      "*Test Course* was moved back to draft by Cadence"
    );
  });

  it("sends nothing when the Instructor changes their own course's status", () => {
    setStatus(CourseStatus.Archived, "2026-11-13T09:00:00.000Z");

    expect(
      buildCourseStatus(db, {
        courseId: base.course.id,
        actorId: base.instructor.id,
      })
    ).toEqual([]);
  });

  it("builds an identical payload when built twice", () => {
    const pat = addAdmin();
    setStatus(CourseStatus.Archived, "2026-11-13T09:00:00.000Z");
    const event = { courseId: base.course.id, actorId: pat.id };

    expect(buildCourseStatus(db, event)).toEqual(buildCourseStatus(db, event));
  });

  it("sends nothing for a course that no longer exists", () => {
    const pat = addAdmin();

    expect(buildCourseStatus(db, { courseId: 999, actorId: pat.id })).toEqual(
      []
    );
  });
});
