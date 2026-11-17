/**
 * choice-options.ts — the wizard options that are not catalogue entries:
 * "Other", "Custom base URL", and the wire formats a custom target can speak.
 */

import type { RendererId } from "./agent-types";

/**
 * The last option in both questions.
 *
 * A student whose agent or provider is missing has nowhere to go otherwise.
 * They would either pick the nearest wrong thing and read a capture that is not
 * theirs, or quit. Both questions therefore end with this, and it leads to the
 * issue tracker.
 */
export const OTHER_ID = "other";
export const OTHER_LABEL = "Other, or not sure";
export const ISSUE_URL =
  "https://github.com/ai-hero-dev/cohort-005-project/issues/new";

/**
 * The option next to "Other" at the provider question: a student whose
 * provider is not in the catalogue, but who knows its base URL, does not have
 * to file an issue and wait. This is offered on every supported agent's
 * provider question, however many catalogue providers it has — see
 * agentProviders and askChoice in config.ts.
 */
export const CUSTOM_ID = "custom";
export const CUSTOM_LABEL = "Custom base URL";

/**
 * The wire-format question a custom target answers instead of a renderer
 * being looked up from a ProviderEntry. "raw" is a real RendererId, not a
 * placeholder — render.ts checks it first and never guesses at a shape it
 * was not told.
 */
export const WIRE_FORMAT_OPTIONS: Array<{ id: RendererId; label: string }> = [
  { id: "openai", label: "OpenAI-compatible (chat/completions)" },
  { id: "anthropic", label: "Anthropic-compatible (messages)" },
  { id: "raw", label: "Not sure — show me the raw JSON" },
];
