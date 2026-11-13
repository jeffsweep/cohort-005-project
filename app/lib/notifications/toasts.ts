import type { FeedItemLike } from "./feed-row";

// ─── When a Notification toasts ───
// Browser-safe and pure. The bell hands every batch of items that arrived
// over the live connection to `nextToast`, with what the person can see right
// now; it answers which toast to show, if any.

export type ToastContext = {
  tabHidden: boolean;
  /** The popover or the full page is showing the feed. */
  feedOpen: boolean;
  /** The person's "Show toasts" choice. On for everyone in Phase 1. */
  toastsOn: boolean;
};

/** Arrivals merged into one toast so far. */
export type Burst = { count: number; lastArrivalAt: number } | null;

export type Toast<Item> =
  | { kind: "none" }
  | { kind: "single"; item: Item }
  | { kind: "burst"; count: number };

export function nextToast<Item extends FeedItemLike>(
  burst: Burst,
  arrivals: Item[],
  context: ToastContext,
  now: number
): { burst: Burst; toast: Toast<Item> } {
  const unread = arrivals.filter((item) => item.read_at === null);
  if (unread.length === 0) return { burst, toast: { kind: "none" } };
  // What arrives while the person can see the feed (or can't see Cadence)
  // isn't announced later either: the next toast starts a fresh count.
  if (!toastsAllowed(context)) return { burst: null, toast: { kind: "none" } };

  const merging = burst !== null && now - burst.lastArrivalAt <= BURST_WINDOW_MS;
  const count = (merging ? burst.count : 0) + unread.length;
  return {
    burst: { count, lastArrivalAt: now },
    toast: count === 1 ? { kind: "single", item: unread[0] } : { kind: "burst", count },
  };
}

/** The one place that decides whether toasts may show at all. */
export function toastsAllowed(context: ToastContext): boolean {
  return context.toastsOn && !context.tabHidden && !context.feedOpen;
}

/** Arrivals within this long of the previous one join its toast. */
export const BURST_WINDOW_MS = 10_000;

/** A toast closes on its own after this long. */
export const TOAST_DURATION_MS = 5_000;

/** What a merged toast says. Only used for two or more arrivals. */
export function burstWording(count: number): string {
  return `${count} new notifications`;
}
