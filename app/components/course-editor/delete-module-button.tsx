import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";

export function DeleteModuleButton({
  moduleId,
  moduleTitle,
}: {
  moduleId: number;
  moduleTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Module deleted.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive">
          Delete "{moduleTitle}"?
        </span>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            fetcher.submit(
              { intent: "delete-module", moduleId: String(moduleId) },
              { method: "post" }
            );
            setConfirming(false);
          }}
        >
          Confirm
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
