import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { buildCourseRated } from "./course-rated.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

const RATED_AT = "2026-11-01T10:00:00.000Z";

function rate(userId: number, rating: number) {
  return db
    .insert(schema.courseRatings)
    .values({ userId, courseId: base.course.id, rating, updatedAt: RATED_AT })
    .returning()
    .get();
}

function rerate(ratingId: number, rating: number, updatedAt: string) {
  db.update(schema.courseRatings)
    .set({ rating, updatedAt })
    .where(eq(schema.courseRatings.id, ratingId))
    .run();
}

describe("course-rated", () => {
  it("tells the Instructor that a Student rated the course, linking to the ratings", () => {
    const rating = rate(base.user.id, 4);

    expect(
      buildCourseRated(db, { ratingId: rating.id, previousStars: null })
    ).toEqual([
      {
        workflow: "course-rated",
        recipient: { id: String(base.instructor.id), name: "Test Instructor" },
        dedupKey: `course-rated:${rating.id}:4:${RATED_AT}`,
        data: {
          actorName: "Test User",
          message: "Test User rated *Test Course* 4★",
          url: "/courses/test-course#ratings",
        },
      },
    ]);
  });

  it("says the Student changed their rating when they re-rate with different stars", () => {
    const rating = rate(base.user.id, 4);
    rerate(rating.id, 2, "2026-11-02T10:00:00.000Z");

    expect(
      buildCourseRated(db, { ratingId: rating.id, previousStars: 4 })
    ).toEqual([
      {
        workflow: "course-rated",
        recipient: { id: String(base.instructor.id), name: "Test Instructor" },
        dedupKey: `course-rated:${rating.id}:2:2026-11-02T10:00:00.000Z`,
        data: {
          actorName: "Test User",
          message: "Test User changed their rating of *Test Course* to 2★",
          url: "/courses/test-course#ratings",
        },
      },
    ]);
  });

  it("tells the Instructor again when a Student goes back to stars they gave before", () => {
    const rating = rate(base.user.id, 4);
    const [first] = buildCourseRated(db, {
      ratingId: rating.id,
      previousStars: null,
    });
    rerate(rating.id, 2, "2026-11-02T10:00:00.000Z");
    rerate(rating.id, 4, "2026-11-03T10:00:00.000Z");

    const [back] = buildCourseRated(db, {
      ratingId: rating.id,
      previousStars: 2,
    });

    expect(back.dedupKey).not.toBe(first.dedupKey);
    expect(back.data.message).toBe(
      "Test User changed their rating of *Test Course* to 4★"
    );
  });

  it("sends nothing when the Student re-rates with the same stars", () => {
    const rating = rate(base.user.id, 4);

    expect(
      buildCourseRated(db, { ratingId: rating.id, previousStars: 4 })
    ).toEqual([]);
  });

  it("sends nothing when the Instructor rates their own course", () => {
    const rating = rate(base.instructor.id, 5);

    expect(
      buildCourseRated(db, { ratingId: rating.id, previousStars: null })
    ).toEqual([]);
  });

  it("names Cadence when a Platform Admin rates", () => {
    const pat = db
      .insert(schema.users)
      .values({
        name: "Pat",
        email: "pat@example.com",
        role: schema.UserRole.Admin,
      })
      .returning()
      .get();
    const rating = rate(pat.id, 3);

    const [send] = buildCourseRated(db, {
      ratingId: rating.id,
      previousStars: null,
    });

    expect(send.data).toEqual({
      actorName: null,
      message: "Cadence rated *Test Course* 3★",
      url: "/courses/test-course#ratings",
    });
  });

  it("builds an identical payload when built twice", () => {
    const rating = rate(base.user.id, 4);
    const event = { ratingId: rating.id, previousStars: null };

    expect(buildCourseRated(db, event)).toEqual(buildCourseRated(db, event));
  });

  it("sends nothing for a rating that no longer exists", () => {
    expect(buildCourseRated(db, { ratingId: 999, previousStars: null })).toEqual(
      []
    );
  });
});
