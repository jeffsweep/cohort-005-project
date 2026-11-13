// ─── The Notification catalogue ───
// Every kind of Notification Cadence sends. Each kind is a Knock workflow
// whose key is the prefix of its dedup key. `npm run knock:sync` generates one
// workflow per entry, and the settings screen will show one toggle per entry.
//
// This file is metadata only (no database, no Node APIs), so the browser can
// import it. The builders that turn an event into sends live in ./builders.
//
// To add a kind: add one entry below, add ./builders/<key>.server.ts with its
// test, call it from the route that handles the event, then run
// `npm run knock:sync`.

export type NotificationGroup =
  "My courses" | "My teams" | "Platform" | "Discussion & courses";

export type NotificationKind = {
  /** Knock workflow key, and the prefix of every dedup key of this kind. */
  key: string;
  /** Human name, used for the Knock workflow name. */
  name: string;
  /** Completes "Tell me when…" on the settings screen. */
  label: string;
  group: NotificationGroup;
  /** Always delivered; the recipient cannot Mute it. */
  alwaysOn: boolean;
  /** Batched per course for a day before delivery. */
  batched: boolean;
};

export const NOTIFICATION_KINDS = [
  {
    key: "enrolled",
    name: "Enrolled",
    label: "someone enrolls on my course",
    group: "My courses",
    alwaysOn: false,
    batched: false,
  },
  {
    key: "refund-requested",
    name: "Refund requested",
    label: "someone asks for a refund",
    group: "Platform",
    alwaysOn: false,
    batched: false,
  },
  {
    key: "refund-approved",
    name: "Refund approved",
    label: "my Refund Request is approved",
    group: "Platform",
    alwaysOn: true,
    batched: false,
  },
  {
    key: "refund-approved-instructor",
    name: "Refund approved (Instructor)",
    label: "Cadence refunds a purchase of my course",
    group: "My courses",
    alwaysOn: false,
    batched: false,
  },
  {
    key: "refund-declined",
    name: "Refund declined",
    label: "my Refund Request is declined",
    group: "Platform",
    alwaysOn: true,
    batched: false,
  },
] as const satisfies readonly NotificationKind[];

export type NotificationKey = (typeof NOTIFICATION_KINDS)[number]["key"];
