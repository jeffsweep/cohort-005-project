import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { cn, formatRelativeTime } from "~/lib/utils";
import {
  noteDraftStatus,
  type NoteDraftStatus,
  type SavedNote,
} from "~/modules/lesson-notes";

/** Key it by Lesson, so moving to the next Lesson starts a fresh draft. */
export function LessonNote({ note }: { note: SavedNote | null }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const { status, canSave } = noteDraftStatus({
    draft,
    saved: note,
    saving: fetcher.state !== "idle",
    error: fetcher.data?.error,
    maxLength: MAX_NOTE_LENGTH,
  });

  return (
    <Card className="mb-8 py-0">
      <CardContent className="p-6">
        <LessonNoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            aria-invalid={status.kind === "too-long" || status.kind === "error"}
            className="min-h-32 resize-y"
          />
          <div className="flex items-center justify-between gap-3">
            <NoteStatusLine status={status} />
            <div className="flex shrink-0 items-center gap-3">
              <CharacterCount
                length={draft.trim().length}
                over={status.kind === "too-long"}
              />
              <Button type="submit" size="sm" disabled={!canSave}>
                {status.kind === "saving" ? "Saving..." : "Save note"}
              </Button>
            </div>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function LessonNoteHeader() {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function CharacterCount({ length, over }: { length: number; over: boolean }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums text-muted-foreground",
        over && "text-red-600"
      )}
    >
      {length.toLocaleString("en")} / {MAX_NOTE_LENGTH.toLocaleString("en")}
    </span>
  );
}

function NoteStatusLine({ status }: { status: NoteDraftStatus }) {
  switch (status.kind) {
    case "saved":
      return (
        <span
          suppressHydrationWarning
          className="text-xs text-muted-foreground"
        >
          Saved · edited {formatRelativeTime(status.updatedAt)}
        </span>
      );
    case "unsaved":
      return <span className="text-xs text-amber-600">Unsaved changes</span>;
    case "too-long":
      return (
        <span className="text-xs text-red-600">
          {status.over.toLocaleString("en")} characters over the limit
        </span>
      );
    case "error":
      return <span className="text-xs text-red-600">{status.message}</span>;
    case "saving":
      return <span className="text-xs text-muted-foreground">Saving...</span>;
    case "cleared":
      return (
        <span className="text-xs text-amber-600">
          An empty note can't be saved; your saved note is kept
        </span>
      );
    case "empty":
      return <span />;
  }
}
