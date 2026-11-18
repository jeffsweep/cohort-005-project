export type SavedNote = { body: string; updatedAt: string };

export type NoteDraftStatus =
  | { kind: "empty" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "too-long"; over: number }
  | { kind: "unsaved" }
  | { kind: "saved"; updatedAt: string };

export type NoteDraftInput = {
  draft: string;
  saved: SavedNote | null;
  saving: boolean;
  error: string | undefined;
  maxLength: number;
};

/**
 * What the footer under a Note says, and whether Save is worth pressing.
 * The draft is compared trimmed because the server trims before it stores.
 */
export function noteDraftStatus(input: NoteDraftInput): {
  status: NoteDraftStatus;
  canSave: boolean;
} {
  const { draft, saved, saving, error, maxLength } = input;
  const trimmed = draft.trim();
  const changed = trimmed !== saved?.body;

  if (saving) return { status: { kind: "saving" }, canSave: false };
  if (trimmed.length > maxLength) {
    return {
      status: { kind: "too-long", over: trimmed.length - maxLength },
      canSave: false,
    };
  }
  if (error && changed) {
    return { status: { kind: "error", message: error }, canSave: true };
  }
  if (trimmed.length === 0) {
    return { status: { kind: "empty" }, canSave: false };
  }
  if (changed || !saved) {
    return { status: { kind: "unsaved" }, canSave: true };
  }
  return {
    status: { kind: "saved", updatedAt: saved.updatedAt },
    canSave: false,
  };
}
