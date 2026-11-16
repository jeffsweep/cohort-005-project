import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import {
  getNote,
  isBookmarked,
  listBookmarks,
  listNotes,
  saveNote,
  toggleBookmark,
} from "./bookmarks-and-notes.server";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);

function minutesAfter(minutes: number) {
  return new Date(NOW.getTime() + minutes * 60_000);
}

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2, 3].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase()}@example.com`,
      role: UserRole.Student,
    })
    .returning()
    .get();
}

describe("toggling a Bookmark", () => {
  it("bookmarks a Lesson, then removes the Bookmark on the second toggle", () => {
    const student = base.user.id;

    expect(
      toggleBookmark(db, { userId: student, lessonId: lessonIds[0], now: NOW })
    ).toBe(true);
    expect(isBookmarked(db, student, lessonIds[0])).toBe(true);

    expect(
      toggleBookmark(db, {
        userId: student,
        lessonId: lessonIds[0],
        now: minutesAfter(1),
      })
    ).toBe(false);
    expect(isBookmarked(db, student, lessonIds[0])).toBe(false);
  });

  it("never leaves two Bookmarks on the same Lesson", () => {
    const student = base.user.id;
    toggleBookmark(db, { userId: student, lessonId: lessonIds[0], now: NOW });
    toggleBookmark(db, {
      userId: student,
      lessonId: lessonIds[0],
      now: minutesAfter(1),
    });
    toggleBookmark(db, {
      userId: student,
      lessonId: lessonIds[0],
      now: minutesAfter(2),
    });

    expect(listBookmarks(db, student)).toHaveLength(1);
  });

  it("is refused by the database when a second Bookmark is inserted directly", () => {
    const student = base.user.id;
    toggleBookmark(db, { userId: student, lessonId: lessonIds[0], now: NOW });

    expect(() =>
      db
        .insert(schema.bookmarks)
        .values({ userId: student, lessonId: lessonIds[0] })
        .run()
    ).toThrow();
  });
});

describe("saving a Note", () => {
  it("creates the Note when there is none", () => {
    const result = saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "  First go  ",
      now: NOW,
    });

    expect(result).toEqual({ ok: true });
    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "First go",
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last-edited time on", () => {
    saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "First go",
      now: NOW,
    });
    saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "Second go",
      now: minutesAfter(5),
    });

    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "Second go",
      updatedAt: minutesAfter(5).toISOString(),
    });
    expect(listNotes(db, base.user.id)).toHaveLength(1);
  });

  it("is refused by the database when a second Note is inserted directly", () => {
    saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "First go",
      now: NOW,
    });

    expect(() =>
      db
        .insert(schema.notes)
        .values({ userId: base.user.id, lessonId: lessonIds[0], body: "Again" })
        .run()
    ).toThrow();
  });

  it("accepts a Note of exactly 2,000 characters", () => {
    const body = "a".repeat(MAX_NOTE_LENGTH);

    expect(
      saveNote(db, {
        userId: base.user.id,
        lessonId: lessonIds[0],
        body: body,
        now: NOW,
      })
    ).toEqual({
      ok: true,
    });
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe(body);
  });

  it("refuses a Note over 2,000 characters and keeps the old one", () => {
    saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "Keep me",
      now: NOW,
    });

    const result = saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "a".repeat(MAX_NOTE_LENGTH + 1),
      now: minutesAfter(1),
    });

    expect(result).toEqual({
      ok: false,
      error: "A note can be at most 2,000 characters.",
    });
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("Keep me");
  });

  it("keeps Markdown characters exactly as typed", () => {
    saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "# not a heading\n*not bold*",
      now: NOW,
    });

    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe(
      "# not a heading\n*not bold*"
    );
  });

  it("clears the Note when saved empty", () => {
    saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "Something",
      now: NOW,
    });
    saveNote(db, {
      userId: base.user.id,
      lessonId: lessonIds[0],
      body: "   ",
      now: minutesAfter(1),
    });

    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });
});

describe("the Saved lists", () => {
  it("hold only the Student's own rows, newest first, with Lesson and Course", () => {
    const student = base.user.id;
    const other = addStudent("Olive").id;

    toggleBookmark(db, { userId: student, lessonId: lessonIds[0], now: NOW });
    toggleBookmark(db, {
      userId: student,
      lessonId: lessonIds[1],
      now: minutesAfter(1),
    });
    toggleBookmark(db, {
      userId: other,
      lessonId: lessonIds[2],
      now: minutesAfter(2),
    });

    saveNote(db, {
      userId: student,
      lessonId: lessonIds[0],
      body: "Older note",
      now: NOW,
    });
    saveNote(db, {
      userId: student,
      lessonId: lessonIds[1],
      body: "Newer note",
      now: minutesAfter(1),
    });
    saveNote(db, {
      userId: other,
      lessonId: lessonIds[2],
      body: "Not yours",
      now: minutesAfter(2),
    });
    saveNote(db, {
      userId: student,
      lessonId: lessonIds[0],
      body: "Edited note",
      now: minutesAfter(3),
    });

    expect(listBookmarks(db, student)).toMatchObject([
      {
        lessonId: lessonIds[1],
        lessonTitle: "Lesson 2",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      { lessonId: lessonIds[0], lessonTitle: "Lesson 1" },
    ]);
    expect(listBookmarks(db, student)).toHaveLength(2);

    expect(listNotes(db, student)).toMatchObject([
      {
        body: "Edited note",
        lessonId: lessonIds[0],
        courseTitle: "Test Course",
      },
      { body: "Newer note", lessonId: lessonIds[1] },
    ]);
    expect(listNotes(db, student)).toHaveLength(2);
  });
});

describe("approving a Refund Request", () => {
  it("keeps the Student's Bookmarks and Notes", () => {
    const student = base.user.id;
    const platformAdmin = db
      .insert(schema.users)
      .values({
        name: "Pat Admin",
        email: "pat@example.com",
        role: UserRole.Admin,
      })
      .returning()
      .get();
    const purchase = db
      .insert(schema.purchases)
      .values({
        userId: student,
        courseId: base.course.id,
        amountPaid: 7900,
        createdAt: new Date(NOW.getTime() - 3 * 86_400_000).toISOString(),
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({ userId: student, courseId: base.course.id })
      .run();

    toggleBookmark(db, { userId: student, lessonId: lessonIds[0], now: NOW });
    saveNote(db, {
      userId: student,
      lessonId: lessonIds[0],
      body: "Still here",
      now: NOW,
    });

    const raised = raiseRefundRequest(
      db,
      purchase.id,
      student,
      "It was not what I expected.",
      NOW
    );
    if (!raised.ok) throw new Error(raised.error);
    const approved = approveRefundRequest(
      db,
      raised.refundRequestId,
      platformAdmin.id,
      null,
      NOW
    );

    expect(approved.ok).toBe(true);
    expect(isBookmarked(db, student, lessonIds[0])).toBe(true);
    expect(getNote(db, student, lessonIds[0])?.body).toBe("Still here");
  });
});
