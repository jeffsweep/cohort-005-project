import { eq } from "drizzle-orm";
import { users } from "~/db/schema";
import type { Db } from "./builders/shared.server";

// "Show toasts" is a Cadence setting on the users table, not a Knock
// preference, so it works with or without Knock keys.

export function showToastsFor(db: Db, userId: number): boolean {
  const row = db
    .select({ showToasts: users.showToasts })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return row?.showToasts ?? true;
}

export function setShowToasts(db: Db, userId: number, on: boolean): void {
  db.update(users).set({ showToasts: on }).where(eq(users.id, userId)).run();
}
