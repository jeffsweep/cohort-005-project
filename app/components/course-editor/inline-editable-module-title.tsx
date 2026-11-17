import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { Pencil } from "lucide-react";

export function InlineEditableModuleTitle({
  value,
  moduleId,
}: {
  value: string;
  moduleId: number;
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
        { intent: "rename-module", moduleId: String(moduleId), title: trimmed },
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
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-base font-semibold outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted"
    >
      <h3 className="font-semibold">{value}</h3>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
