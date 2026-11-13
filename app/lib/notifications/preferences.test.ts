import { describe, expect, it } from "vitest";
import { UserRole } from "~/db/schema";
import {
  isToggleOn,
  preferencesFromResponse,
  preferencesWithToggle,
  visibleToggleGroups,
} from "./preferences";

const discussionAndCourses = {
  group: "Discussion & courses",
  toggles: [
    {
      label: "Someone replies to my post or comment",
      keys: ["question-answered", "comment-replied"],
    },
    {
      label: "New lessons are added to a course I'm enrolled on",
      keys: ["lesson-added"],
    },
  ],
};

describe("visibleToggleGroups", () => {
  it("shows a Student only Discussion & courses, with one toggle for both reply kinds", () => {
    expect(
      visibleToggleGroups({ role: UserRole.Student, isTeamAdmin: false })
    ).toEqual([discussionAndCourses]);
  });

  it("shows an Instructor the My courses group first", () => {
    expect(
      visibleToggleGroups({ role: UserRole.Instructor, isTeamAdmin: false })
    ).toEqual([
      {
        group: "My courses",
        toggles: [
          { label: "Someone enrolls on my course", keys: ["enrolled"] },
          {
            label: "Someone buys a Team Licence for my course",
            keys: ["team-licence-bought"],
          },
          {
            label: "Cadence refunds a purchase of my course",
            keys: ["refund-approved-instructor"],
          },
          {
            label: "A Student posts in my course's discussion",
            keys: ["question-asked"],
          },
          { label: "Someone rates my course", keys: ["course-rated"] },
          {
            label: "Cadence changes my course's status",
            keys: ["course-status"],
          },
        ],
      },
      discussionAndCourses,
    ]);
  });

  it("shows a Student who is a Team Admin the My teams group", () => {
    expect(
      visibleToggleGroups({ role: UserRole.Student, isTeamAdmin: true })
    ).toEqual([
      {
        group: "My teams",
        toggles: [
          { label: "Someone claims a Seat on my team", keys: ["seat-claimed"] },
        ],
      },
      discussionAndCourses,
    ]);
  });

  it("shows a Platform Admin refund requests but never the always-on kinds", () => {
    expect(
      visibleToggleGroups({ role: UserRole.Admin, isTeamAdmin: false })
    ).toEqual([
      {
        group: "Platform",
        toggles: [
          { label: "Someone asks for a refund", keys: ["refund-requested"] },
        ],
      },
      discussionAndCourses,
    ]);
  });
});

describe("preferencesWithToggle", () => {
  const loaded = {
    id: "default",
    workflows: { "course-rated": false, enrolled: true },
    categories: null,
    channel_types: { in_app_feed: true },
    channels: null,
  };

  it("mutes both reply kinds and keeps the rest of the loaded set", () => {
    expect(
      preferencesWithToggle(
        loaded,
        ["question-answered", "comment-replied"],
        false
      )
    ).toEqual({
      workflows: {
        "course-rated": false,
        enrolled: true,
        "question-answered": false,
        "comment-replied": false,
      },
      channel_types: { in_app_feed: true },
    });
  });

  it("turns a Muted kind back on", () => {
    expect(preferencesWithToggle(loaded, ["course-rated"], true)).toEqual({
      workflows: { "course-rated": true, enrolled: true },
      channel_types: { in_app_feed: true },
    });
  });

  it("starts from an empty set when the person has none yet", () => {
    expect(preferencesWithToggle(null, ["enrolled"], false)).toEqual({
      workflows: { enrolled: false },
    });
  });
});

describe("preferencesFromResponse", () => {
  it("reads the loaded set", () => {
    const body = { id: "default", workflows: { enrolled: false } };
    expect(
      preferencesFromResponse({ statusCode: "ok", status: 200, body })
    ).toEqual({ ok: true, preferences: body });
  });

  it("treats a person Knock doesn't know yet as having no settings", () => {
    expect(
      preferencesFromResponse({ statusCode: "error", status: 404, body: {} })
    ).toEqual({ ok: true, preferences: null });
  });

  it("keeps per-channel and conditional settings it doesn't change", () => {
    const body = {
      id: "default",
      workflows: {
        enrolled: { channel_types: { email: false } },
        "lesson-added": {
          conditions: [
            { variable: "recipient.x", operator: "equal_to", argument: "y" },
          ],
        },
      },
      categories: null,
      channel_types: { in_app_feed: true },
      channels: null,
    };
    expect(
      preferencesFromResponse({ statusCode: "ok", status: 200, body })
    ).toEqual({ ok: true, preferences: body });
  });

  it("fails on a body that isn't a preference set", () => {
    expect(
      preferencesFromResponse({
        statusCode: "ok",
        status: 200,
        body: { workflows: { enrolled: "off" } },
      })
    ).toEqual({ ok: false });
  });

  it("fails on any other error", () => {
    expect(
      preferencesFromResponse({ statusCode: "error", status: 401, body: {} })
    ).toEqual({ ok: false });
  });
});

describe("isToggleOn", () => {
  it("is on by default, for a kind with no setting", () => {
    expect(isToggleOn(null, ["enrolled"])).toBe(true);
    expect(isToggleOn({ workflows: {} }, ["enrolled"])).toBe(true);
  });

  it("is off when the kind is Muted", () => {
    expect(isToggleOn({ workflows: { enrolled: false } }, ["enrolled"])).toBe(
      false
    );
  });

  it("shows the reply toggle off if either reply kind is Muted", () => {
    expect(
      isToggleOn({ workflows: { "comment-replied": false } }, [
        "question-answered",
        "comment-replied",
      ])
    ).toBe(false);
  });
});
