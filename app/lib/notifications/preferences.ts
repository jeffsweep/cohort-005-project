import type { UserRole } from "~/db/schema";
import {
  NOTIFICATION_KINDS,
  type NotificationGroup,
  type NotificationKey,
} from "./catalogue";

// ─── Muting kinds of Notification (browser-safe) ───
// Which "Tell me when…" toggles a person sees on /settings, and the Knock
// PreferenceSet a toggle writes. Muted is `workflows.<key>: false`.

export type Audience = { role: `${UserRole}`; isTeamAdmin: boolean };

export type Toggle = { label: string; keys: NotificationKey[] };
export type ToggleGroup = { group: NotificationGroup; toggles: Toggle[] };

const GROUP_ORDER: NotificationGroup[] = [
  "My courses",
  "My teams",
  "Platform",
  "Discussion & courses",
];

/** Whether a person can currently receive the kinds in a group. */
function receives(audience: Audience, group: NotificationGroup): boolean {
  switch (group) {
    case "My courses":
      return audience.role === "instructor";
    case "My teams":
      return audience.isTeamAdmin;
    case "Platform":
      return audience.role === "admin";
    case "Discussion & courses":
      return true;
  }
}

function sentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The toggles a person sees, grouped in the spec's order. Always-on kinds
 *  and kinds they can't receive now are left out. */
export function visibleToggleGroups(audience: Audience): ToggleGroup[] {
  return GROUP_ORDER.filter((group) => receives(audience, group))
    .map((group) => {
      const toggles: Toggle[] = [];
      for (const kind of NOTIFICATION_KINDS) {
        if (kind.group !== group || kind.alwaysOn) continue;
        const label = sentenceCase(kind.label);
        // Kinds sharing a label share one toggle (the two reply kinds).
        const same = toggles.find((toggle) => toggle.label === label);
        if (same) same.keys.push(kind.key);
        else toggles.push({ label, keys: [kind.key] });
      }
      return { group, toggles };
    })
    .filter(({ toggles }) => toggles.length > 0);
}

// The parts of Knock's PreferenceSet this screen reads and writes. Values
// other than `false` (e.g. per-channel settings) count as on.
type PreferenceMap = Partial<Record<string, unknown>>;
export type LoadedPreferences = {
  workflows?: PreferenceMap | null;
  categories?: PreferenceMap | null;
  channel_types?: PreferenceMap | null;
  channels?: PreferenceMap | null;
};
export type PreferencesToSave = {
  workflows: PreferenceMap;
  categories?: PreferenceMap;
  channel_types?: PreferenceMap;
  channels?: PreferenceMap;
};

/** The shape of a response from the Knock client's `makeRequest`. */
export type KnockResponse = {
  statusCode: "ok" | "error";
  status: number;
  body?: unknown;
};

/** Reads a GET of the person's default PreferenceSet. Knock answers 404 for a
 *  user it hasn't been sent anything yet: they have no settings, so every
 *  kind is on. (The client's `getPreferences` hides the status, so the
 *  settings section asks with `makeRequest`.) */
export function preferencesFromResponse(
  response: KnockResponse
):
  | { ok: true; preferences: LoadedPreferences | null }
  | { ok: false } {
  if (response.statusCode === "ok") {
    return { ok: true, preferences: response.body as LoadedPreferences };
  }
  if (response.status === 404) return { ok: true, preferences: null };
  return { ok: false };
}

/** On unless one of the toggle's kinds is Muted. */
export function isToggleOn(
  loaded: LoadedPreferences | null,
  keys: readonly NotificationKey[]
): boolean {
  return keys.every((key) => loaded?.workflows?.[key] !== false);
}

/** The whole set to save after flipping one toggle: the loaded set with every
 *  kind of the toggle set to `on`. Knock replaces the set on each write. */
export function preferencesWithToggle(
  loaded: LoadedPreferences | null,
  keys: readonly NotificationKey[],
  on: boolean
): PreferencesToSave {
  const workflows: PreferenceMap = { ...loaded?.workflows };
  for (const key of keys) workflows[key] = on;
  return {
    workflows,
    ...(loaded?.categories && { categories: loaded.categories }),
    ...(loaded?.channel_types && { channel_types: loaded.channel_types }),
    ...(loaded?.channels && { channels: loaded.channels }),
  };
}
