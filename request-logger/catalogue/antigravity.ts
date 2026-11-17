import type { AgentEntry } from "./entry";

/**
 * Antigravity CLI (`agy`) is a separate Google product from Gemini CLI — a
 * different binary, a different agent harness — but its API-key route stores
 * its settings under Gemini CLI's own directory (`~/.gemini/...`) and, per
 * Google's docs, calls the public Gemini API directly and reads the exact
 * same GOOGLE_GEMINI_BASE_URL variable Gemini CLI's own API-key route does.
 * The existing "gemini" renderer already reads that wire format correctly,
 * so this entry needed no renderer of its own — only a catalogue entry with
 * the right bin and the settings file that switches this route on.
 */
const ANTIGRAVITY_NOTE =
  "Antigravity CLI is a different product from Gemini CLI, with its own " +
  "binary (agy, not gemini). This route works the same as Gemini CLI's API " +
  "key route, though: both call the public Gemini API directly and read the " +
  "same GOOGLE_GEMINI_BASE_URL variable, so the existing gemini renderer " +
  "reads this capture correctly with no changes.";

const ANTIGRAVITY_KEY_NOTE =
  "GEMINI_API_KEY must also be exported in your shell, and modelProvider " +
  'must be "gemini" in the settings file below. Without both, Antigravity ' +
  "CLI falls back to its own account sign-in instead — a different, " +
  "unverified route this catalogue does not cover yet (see the warning below).";

const ANTIGRAVITY_MERGE_NOTE =
  "This is merged into ~/.gemini/antigravity-cli/settings.json, not a " +
  "replacement for it — add modelProvider alongside whatever else is " +
  "already in that file.";

const ANTIGRAVITY_LOGIN_WARNING =
  "This entry covers the Gemini API key route only. Antigravity CLI's " +
  "default account sign-in was not verified against real source (it is " +
  "closed source) or a real login, and public reporting on the Antigravity " +
  "IDE suggests its account-login traffic can go to a different, internal " +
  "host rather than the Code Assist host Gemini CLI's own free login uses — " +
  "so this catalogue does not claim that route works. Ask for it via the " +
  "issue tracker if you need it logged.";

export const ANTIGRAVITY: AgentEntry = {
  id: "antigravity",
  label: "Antigravity CLI",
  providers: [
    {
      id: "api-key",
      label: "Gemini API key",
      upstreamHost: "generativelanguage.googleapis.com",
      renderer: "gemini",
      env: [["GOOGLE_GEMINI_BASE_URL", "{baseUrl}"]],
      bin: "agy",
      setup: [
        {
          path: "~/.gemini/antigravity-cli/settings.json",
          language: "json",
          body: ["{", '  "modelProvider": "gemini"', "}"].join("\n"),
        },
      ],
      notes: [ANTIGRAVITY_NOTE, ANTIGRAVITY_KEY_NOTE, ANTIGRAVITY_MERGE_NOTE],
      warnings: [ANTIGRAVITY_LOGIN_WARNING],
    },
  ],
};
