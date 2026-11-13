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
    key: "question-asked",
    name: "Question asked",
    label: "a Student posts in my course's discussion",
    group: "My courses",
    alwaysOn: false,
    batched: false,
  },
  {
    key: "question-answered",
    name: "Question answered",
    label: "someone replies to my post or comment",
    group: "Discussion & courses",
    alwaysOn: false,
    batched: false,
  },
  {
    key: "comment-replied",
    name: "Comment replied",
    label: "someone replies to my post or comment",
    group: "Discussion & courses",
    alwaysOn: false,
    batched: false,
  },
] as const satisfies readonly NotificationKind[];

export type NotificationKey = (typeof NOTIFICATION_KINDS)[number]["key"];
