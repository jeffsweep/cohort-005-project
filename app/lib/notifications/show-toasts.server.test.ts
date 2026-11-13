import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import { setShowToasts, showToastsFor } from "./show-toasts.server";

let db: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

describe("Show toasts setting", () => {
  it("is on for a new user", () => {
    expect(showToastsFor(db, base.user.id)).toBe(true);
  });

  it("stays off once turned off", () => {
    setShowToasts(db, base.user.id, false);
    expect(showToastsFor(db, base.user.id)).toBe(false);
  });

  it("comes back on when turned on again", () => {
    setShowToasts(db, base.user.id, false);
    setShowToasts(db, base.user.id, true);
    expect(showToastsFor(db, base.user.id)).toBe(true);
  });

  it("only changes the person who flipped it", () => {
    setShowToasts(db, base.user.id, false);
    expect(showToastsFor(db, base.instructor.id)).toBe(true);
  });
});
