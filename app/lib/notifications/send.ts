import type { NotificationKey } from "./catalogue";

/**
 * One Notification to one recipient, ready for the notifier. Builders return
 * these; nothing is sent until the route hands them to `notify`.
 *
 * The payload must be deterministic: Knock rejects a reused dedup key that
 * comes with a different body.
 */
export type Send = {
  workflow: NotificationKey;
  /** `id` is the Cadence user id as text, so Knock creates the user on first send. */
  recipient: { id: string; name: string };
  dedupKey: string;
  data: SendData;
};

export type SendData = {
  /** The acting person's name, or null when a Platform Admin acted ("Cadence"). */
  actorName: string | null;
  /** The full sentence, as Markdown, starting with the actor's display name. */
  message: string;
  /** A relative app path. */
  url: string;
  /** Only for `lesson-added`, which Knock batches per course. */
  courseId?: number;
  /** Only for `lesson-added`: the course title as italic Markdown, for its batched sentence. */
  courseTitle?: string;
  /** Only for `refund-requested`, so its copies can be withdrawn once decided. */
  refundRequestId?: number;
};

/**
 * Takes back every copy of a kind of Notification, whoever it went to, once
 * it no longer needs acting on. The copies are found by their workflow and by
 * values in their `data` (Knock's trigger data).
 */
export type Withdrawal = {
  workflow: NotificationKey;
  triggerData: Partial<SendData>;
};
