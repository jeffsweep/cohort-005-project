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
  /**
   * The in-app template's Markdown, when the kind writes its own sentence.
   * Without it the template shows the send's `data.message`.
   */
  markdownBody?: string;
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
    key: "lesson-added",
    name: "Lesson added",
    label: "new lessons are added to a course I'm enrolled on",
    group: "Discussion & courses",
    alwaysOn: false,
    batched: true,
    // Knock renders only the first 10 batched activities, so the sentence is
    // written from the batch's count, not from each send's message.
    markdownBody:
      "{{ total_activities }} new {% if total_activities == 1 %}lesson{% else %}lessons{% endif %} on {{ data.courseTitle }}",
  },
] as const satisfies readonly NotificationKind[];

export type NotificationKey = (typeof NOTIFICATION_KINDS)[number]["key"];
