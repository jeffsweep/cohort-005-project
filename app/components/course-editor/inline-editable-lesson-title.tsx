import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { Pencil } from "lucide-react";

export function InlineEditableLessonTitle({
  value,
  lessonId,
}: {
  value: string;
  lessonId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "rename-lesson", lessonId: String(lessonId), title: trimmed },
        { method: "post" }
      );
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditValue(value);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm hover:bg-muted"
    >
      <span className="flex-1">{value}</span>
      <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
