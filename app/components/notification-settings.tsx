import { useId, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";

// ─── Notifications section on /settings ───
// "Show toasts" sits at the top. Knock toggles (muting kinds) go below it,
// each as another <SettingToggle>.

export const SHOW_TOASTS_INTENT = "show-toasts";

export function NotificationSettings({
  showToasts,
  children,
}: {
  showToasts: boolean;
  /** Further rows, e.g. the Knock toggles. */
  children?: ReactNode;
}) {
  return (
    <Card className="mt-8 max-w-md">
      <CardHeader>
        <h2 className="text-lg font-semibold">Notifications</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <ShowToastsToggle saved={showToasts} />
        {children}
      </CardContent>
    </Card>
  );
}

/** Saves through the /settings action the moment it's flipped. Shows the
 *  submitted value while saving; if the save fails, the loader's value comes
 *  back, so the switch flips back. */
function ShowToastsToggle({ saved }: { saved: boolean }) {
  const fetcher = useFetcher<{ ok: boolean }>({ key: SHOW_TOASTS_INTENT });
  const pending = fetcher.formData?.get("on");
  const checked = pending != null ? pending === "true" : saved;
  const failed = fetcher.state === "idle" && fetcher.data?.ok === false;

  return (
    <SettingToggle
      label="Show toasts"
      description="Pop up new notifications while I'm on Cadence"
      checked={checked}
      failed={failed}
      onCheckedChange={(on) =>
        fetcher.submit(
          { intent: SHOW_TOASTS_INTENT, on: String(on) },
          { method: "post", action: "/settings" }
        )
      }
    />
  );
}

/** One labelled switch row. `failed` shows "Couldn't save" under it. */
export function SettingToggle({
  label,
  description,
  checked,
  failed = false,
  disabled = false,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  failed?: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            Couldn't save
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
