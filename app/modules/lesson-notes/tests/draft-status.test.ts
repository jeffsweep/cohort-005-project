import { describe, expect, it } from "vitest";
import { noteDraftStatus, type NoteDraftInput } from "../index";

const saved = {
  body: "Generics keep the type",
  updatedAt: "2026-11-18T10:00:00.000Z",
};

function status(overrides: Partial<NoteDraftInput>) {
  return noteDraftStatus({
    draft: "",
    saved: null,
    saving: false,
    error: undefined,
    maxLength: 20,
    ...overrides,
  });
}

describe("noteDraftStatus", () => {
  it("has nothing to save before the Student writes anything", () => {
    expect(status({})).toEqual({ status: { kind: "empty" }, canSave: false });
  });

  it("treats whitespace as empty", () => {
    expect(status({ draft: "   \n" })).toEqual({
      status: { kind: "empty" },
      canSave: false,
    });
  });

  it("offers Save for a new draft", () => {
    expect(status({ draft: "First thought" })).toEqual({
      status: { kind: "unsaved" },
      canSave: true,
    });
  });

  it("reports the saved Note when the draft matches it", () => {
    expect(status({ draft: saved.body, saved, maxLength: 100 })).toEqual({
      status: { kind: "saved", updatedAt: saved.updatedAt },
      canSave: false,
    });
  });

  it("ignores surrounding whitespace when comparing with the saved Note", () => {
    expect(
      status({ draft: `  ${saved.body}\n`, saved, maxLength: 100 })
    ).toEqual({
      status: { kind: "saved", updatedAt: saved.updatedAt },
      canSave: false,
    });
  });

  it("flags an edit to the saved Note as unsaved", () => {
    expect(status({ draft: `${saved.body}!`, saved, maxLength: 100 })).toEqual({
      status: { kind: "unsaved" },
      canSave: true,
    });
  });

  it("says how far over the limit a draft is", () => {
    expect(status({ draft: "x".repeat(23) })).toEqual({
      status: { kind: "too-long", over: 3 },
      canSave: false,
    });
  });

  it("allows a draft exactly at the limit", () => {
    expect(status({ draft: "x".repeat(20) }).canSave).toBe(true);
  });

  it("shows nothing but saving while a save is in flight", () => {
    expect(status({ draft: "x".repeat(23), saving: true })).toEqual({
      status: { kind: "saving" },
      canSave: false,
    });
  });

  it("shows the server's error and lets the Student retry", () => {
    expect(status({ draft: "First thought", error: "Nope" })).toEqual({
      status: { kind: "error", message: "Nope" },
      canSave: true,
    });
  });

  it("drops a stale error once the draft matches the saved Note", () => {
    expect(
      status({ draft: saved.body, saved, error: "Nope", maxLength: 100 })
    ).toEqual({
      status: { kind: "saved", updatedAt: saved.updatedAt },
      canSave: false,
    });
  });

  it("warns that a cleared Note keeps its saved text, since an empty Note cannot be saved", () => {
    expect(status({ draft: "  ", saved, maxLength: 100 })).toEqual({
      status: { kind: "cleared" },
      canSave: false,
    });
  });
});
