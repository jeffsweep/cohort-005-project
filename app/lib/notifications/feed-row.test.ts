import { describe, expect, it } from "vitest";
import {
  feedRow,
  groupByDay,
  relativeTime,
  unreadLabel,
  unreadSummary,
  type FeedItemLike,
} from "./feed-row";

const now = new Date("2026-11-13T12:00:00Z");

function item(overrides: Partial<FeedItemLike>): FeedItemLike {
  return {
    id: "msg_1",
    inserted_at: "2026-11-13T11:56:00Z",
    read_at: null,
    // Knock's blocks hold only the template ("{{ data.message }}"); the
    // sentence is read from data.
    data: {
      actorName: "Sam",
      message: "Sam enrolled on *Test Course*",
      url: "/instructor/1/students",
    },
    ...overrides,
  };
}

describe("feedRow", () => {
  it("splits the actor from the wording, with titles in italics", () => {
    expect(feedRow(item({}), now)).toEqual({
      id: "msg_1",
      actor: "Sam",
      wording: [
        { text: " enrolled on ", italic: false },
        { text: "Test Course", italic: true },
      ],
      url: "/instructor/1/students",
      read: false,
      time: "4m",
    });
  });

  it("shows Cadence as the actor when a Platform Admin acted", () => {
    const row = feedRow(
      item({
        data: {
          actorName: null,
          message: "Cadence refunded Sam's purchase of *Test Course*",
          url: "/instructor/1/students",
        },
      }),
      now
    );

    expect(row.actor).toBe("Cadence");
    expect(row.wording[0]).toEqual({ text: " refunded Sam's purchase of ", italic: false });
  });

  it("has no actor when the sentence doesn't start with one", () => {
    const row = feedRow(
      item({
        data: { actorName: null, message: "Your role is now Instructor", url: "/instructor" },
      }),
      now
    );

    expect(row.actor).toBeNull();
    expect(row.wording).toEqual([{ text: "Your role is now Instructor", italic: false }]);
  });

  it("unescapes Markdown in titles", () => {
    const row = feedRow(
      item({
        data: {
          actorName: "Sam",
          message: "Sam enrolled on *C\\*\\* in 5 \\_days\\_*",
          url: "/instructor/1/students",
        },
      }),
      now
    );

    expect(row.wording).toEqual([
      { text: " enrolled on ", italic: false },
      { text: "C** in 5 _days_", italic: true },
    ]);
  });

  it("writes a batch of added lessons from its count and course, not its message", () => {
    const row = feedRow(
      item({
        source: { key: "lesson-added" },
        total_activities: 3,
        data: {
          actorName: "Alex",
          message: "Alex added a lesson to *Test Course*",
          url: "/courses/test-course",
          courseId: 1,
          courseTitle: "*Test Course*",
        },
      }),
      now
    );

    expect(row.actor).toBeNull();
    expect(row.wording).toEqual([
      { text: "3 new lessons on ", italic: false },
      { text: "Test Course", italic: true },
    ]);
    expect(row.url).toBe("/courses/test-course");
  });

  it("says lesson, not lessons, for a batch of one", () => {
    const row = feedRow(
      item({
        source: { key: "lesson-added" },
        total_activities: 1,
        data: {
          actorName: "Alex",
          message: "Alex added a module to *Test Course*",
          url: "/courses/test-course",
          courseId: 1,
          courseTitle: "*Test Course*",
        },
      }),
      now
    );

    expect(row.wording).toEqual([
      { text: "1 new lesson on ", italic: false },
      { text: "Test Course", italic: true },
    ]);
  });

  it("is read once Knock has a read time", () => {
    expect(feedRow(item({ read_at: "2026-11-13T11:58:00Z" }), now).read).toBe(true);
  });
});

describe("relativeTime", () => {
  it.each([
    ["2026-11-13T11:59:40Z", "just now"],
    ["2026-11-13T11:56:00Z", "4m"],
    ["2026-11-13T09:30:00Z", "2h"],
    ["2026-11-10T12:00:00Z", "3d"],
  ])("%s reads as %s", (insertedAt, expected) => {
    expect(relativeTime(insertedAt, now)).toBe(expected);
  });
});

describe("unreadLabel", () => {
  it.each([
    [0, "Notifications"],
    [1, "1 unread notification"],
    [3, "3 unread notifications"],
  ])("%i unread reads as %s", (count, expected) => {
    expect(unreadLabel(count)).toBe(expected);
  });
});

describe("groupByDay", () => {
  // Days are the reader's own: local midnight, not UTC.
  const localNow = new Date(2026, 10, 13, 9, 30);
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 10, day, hour, minute).toISOString();

  it("puts items since local midnight under Today and the rest under Earlier, in the order given", () => {
    const items = [
      item({ id: "a", inserted_at: at(13, 9, 15) }),
      item({ id: "b", inserted_at: at(13, 0, 5) }),
      item({ id: "c", inserted_at: at(12, 23, 55) }),
      item({ id: "d", inserted_at: at(2, 12) }),
    ];

    const groups = groupByDay(items, localNow);

    expect(groups.map((group) => [group.label, group.items.map((i) => i.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Earlier", ["c", "d"]],
    ]);
  });

  it("leaves out a group with nothing in it", () => {
    const groups = groupByDay([item({ id: "c", inserted_at: at(12, 8) })], localNow);

    expect(groups.map((group) => group.label)).toEqual(["Earlier"]);
  });
});

describe("unreadSummary", () => {
  it.each([
    [0, "You're all caught up"],
    [1, "1 unread"],
    [3, "3 unread"],
  ])("%i unread reads as %s", (count, expected) => {
    expect(unreadSummary(count)).toBe(expected);
  });
});
