import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import type { Send } from "../send";

// Rules every builder applies. Builders take the database and the event's ids
// and return sends; they never send anything themselves.

export type Db = BetterSQLite3Database<typeof schema>;

type Person = { id: number; name: string; role: UserRole };

/** The name to show for whoever acted: null for a Platform Admin. */
export function actorNameOf(actor: Person): string | null {
  return actor.role === UserRole.Admin ? null : actor.name;
}

/** How the actor reads in a sentence: their name, or "Cadence". */
export function displayName(actorName: string | null): string {
  return actorName ?? "Cadence";
}

/** Markdown italics, for course and lesson titles. */
export function italic(text: string): string {
  return `*${text.replace(/([\\*_])/g, "\\$1")}*`;
}

export function recipientOf(person: { id: number; name: string }) {
  return { id: String(person.id), name: person.name };
}

/** Drops any send addressed to the actor: nobody hears about their own action. */
export function excludingActor(sends: Send[], actorId: number): Send[] {
  return sends.filter((send) => send.recipient.id !== String(actorId));
}
