import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { useKnockClient } from "@knocklabs/react-core";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { useKnockAvailability } from "~/components/notification-feed";
import {
  isToggleOn,
  preferencesFromResponse,
  preferencesWithToggle,
  visibleToggleGroups,
  type Audience,
  type LoadedPreferences,
  type Toggle,
} from "~/lib/notifications/preferences";

// ─── Notifications section on /settings ───
// "Show toasts" (a Cadence setting) sits at the top. Below it, the Knock
// toggles that mute kinds of Notification, saved from the browser.

/** The section's anchor; the gear on /notifications links here. */
export const NOTIFICATION_SETTINGS_ID = "notifications";

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
    <Card id={NOTIFICATION_SETTINGS_ID} className="mt-8 max-w-md scroll-mt-6">
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

/** The "Tell me when…" toggles that mute kinds of Notification in Knock.
 *  Without keys, or if loading fails, a message replaces them. */
export function KnockToggles({ audience }: { audience: Audience }) {
  const availability = useKnockAvailability();
  if (availability === "not-set-up") {
    return <Note>Notifications aren't set up.</Note>;
  }
  if (availability === "starting") return <Note>Loading…</Note>;
  return <LoadedKnockToggles audience={audience} />;
}

function LoadedKnockToggles({ audience }: { audience: Audience }) {
  const knock = useKnockClient();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; preferences: LoadedPreferences | null }
  >({ status: "loading" });
  // What the screen shows: the loaded set plus every flip not yet rejected.
  // Each save writes this whole set, so two quick flips don't undo each other.
  const shown = useRef<LoadedPreferences | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    knock
      .client()
      .makeRequest({
        method: "GET",
        url: `/v1/users/${encodeURIComponent(knock.userId ?? "")}/preferences/default`,
      })
      .then(preferencesFromResponse)
      .catch(() => ({ ok: false as const }))
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) return setState({ status: "error" });
        shown.current = result.preferences;
        setState({ status: "ready", preferences: result.preferences });
      });
    return () => {
      cancelled = true;
    };
  }, [knock]);

  if (state.status === "loading") return <Note>Loading…</Note>;
  if (state.status === "error") {
    return <Note>Couldn't load notification settings</Note>;
  }

  function flip(toggle: Toggle, on: boolean) {
    const next = preferencesWithToggle(shown.current, toggle.keys, on);
    shown.current = next;
    setState({ status: "ready", preferences: next });
    setFailed((current) => without(current, toggle.label));

    knock.user
      .setPreferences(next)
      .catch(() => {
        // Flip back only this toggle; later flips stay as they are.
        const reverted = preferencesWithToggle(shown.current, toggle.keys, !on);
        shown.current = reverted;
        setState({ status: "ready", preferences: reverted });
        setFailed((current) => new Set(current).add(toggle.label));
      });
  }

  return (
    <>
      <p className="border-t pt-4 text-sm font-medium">Tell me when…</p>
      {visibleToggleGroups(audience).map(({ group, toggles }) => (
        <section key={group} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </h3>
          {toggles.map((toggle) => (
            <SettingToggle
              key={toggle.label}
              label={toggle.label}
              checked={isToggleOn(state.preferences, toggle.keys)}
              failed={failed.has(toggle.label)}
              onCheckedChange={(on) => flip(toggle, on)}
            />
          ))}
        </section>
      ))}
      <p className="border-t pt-4 text-sm text-muted-foreground">
        Notifications about your Refund Requests and your role are always on.
      </p>
    </>
  );
}

function without(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  if (!set.has(value)) return set;
  const copy = new Set(set);
  copy.delete(value);
  return copy;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="border-t pt-4 text-sm text-muted-foreground">{children}</p>
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
