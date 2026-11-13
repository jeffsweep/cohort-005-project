import type { SendData } from "./send";

// ─── How a Notification reads in the bell ───
// Browser-safe. Turns a Knock feed item into what a row shows: the actor in
// bold, the rest of the sentence (titles in italics), a relative time, and
// whether it's been read. Used by the bell's popover and the full page.

/** The parts of Knock's FeedItem a row needs. Knock's own FeedItem fits. */
export type FeedItemLike = {
  id: string;
  inserted_at: string;
  read_at: string | null;
  data: Partial<SendData> | null;
  /** The workflow that sent it. */
  source?: { key: string };
  /** How many sends Knock batched into this item. */
  total_activities?: number;
};

export type WordingPart = { text: string; italic: boolean };

export type FeedRow = {
  id: string;
  /** Bold at the start of the row; null when the sentence has no actor ("Your role is now…"). */
  actor: string | null;
  wording: WordingPart[];
  url: string;
  read: boolean;
  time: string;
};

export function feedRow(item: FeedItemLike, now: Date = new Date()): FeedRow {
  // The sentence Cadence sent. Knock's blocks hold the template
  // ("{{ data.message }}") as `content` and HTML as `rendered`, not Markdown.
  const sentence =
    item.source?.key === "lesson-added" ? lessonsAddedSentence(item) : (item.data?.message ?? "");
  const actorName = item.data?.actorName ?? "Cadence";
  const startsWithActor = sentence.startsWith(`${actorName} `);

  return {
    id: item.id,
    actor: startsWithActor ? actorName : null,
    wording: parseItalics(startsWithActor ? sentence.slice(actorName.length) : sentence),
    url: item.data?.url ?? "/",
    read: item.read_at !== null,
    time: relativeTime(item.inserted_at, now),
  };
}

/**
 * Knock batches `lesson-added` per course, and the item's `data` is one send's.
 * Same wording as the kind's workflow template in the catalogue.
 */
function lessonsAddedSentence(item: FeedItemLike): string {
  const count = item.total_activities ?? 1;
  return `${count} new ${count === 1 ? "lesson" : "lessons"} on ${item.data?.courseTitle ?? ""}`;
}

/** The Markdown builders write: `*italic*` with `\` escapes, nothing else. */
function parseItalics(markdown: string): WordingPart[] {
  const parts: WordingPart[] = [];
  let text = "";
  let italic = false;
  const flush = () => {
    if (text) parts.push({ text, italic });
    text = "";
  };

  for (let i = 0; i < markdown.length; i++) {
    const char = markdown[i];
    if (char === "\\" && i + 1 < markdown.length) {
      text += markdown[++i];
    } else if (char === "*") {
      flush();
      italic = !italic;
    } else {
      text += char;
    }
  }
  flush();
  return parts;
}

export function relativeTime(insertedAt: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(insertedAt)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}

export type DayGroup<T> = { label: "Today" | "Earlier"; items: T[] };

/**
 * The full page's groups: since the reader's local midnight, then the rest.
 * Keeps the order given (Knock's, newest first) and leaves out empty groups.
 */
export function groupByDay<T extends Pick<FeedItemLike, "inserted_at">>(
  items: T[],
  now: Date = new Date()
): DayGroup<T>[] {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: DayGroup<T>[] = [
    { label: "Today", items: items.filter((item) => Date.parse(item.inserted_at) >= midnight) },
    { label: "Earlier", items: items.filter((item) => Date.parse(item.inserted_at) < midnight) },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/** The full page's line under its heading. */
export function unreadSummary(unreadCount: number): string {
  return unreadCount === 0 ? "You're all caught up" : `${unreadCount} unread`;
}

/** The bell's accessible label and tooltip. */
export function unreadLabel(unreadCount: number): string {
  if (unreadCount === 0) return "Notifications";
  return `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`;
}
