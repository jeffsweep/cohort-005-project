import type { SetupFile } from "../agent-types";
import type { AgentEntry } from "./entry";

/**
 * Junie's custom-proxy override, in JSON, under ~/.junie/config.json (user
 * scope; see Junie's own configuration-files docs for how a project-scope
 * file layers on top). Unlike ompModels/piModels, this one genuinely differs
 * by wire format: Junie's proxy entry declares a `kind` — the protocol Junie
 * itself will speak on the wire — so a mismatched kind does not 404, it just
 * sends the wrong shape of request. That is why Junie gets two catalogue
 * providers below (tagged by customTemplateFor) instead of OMP's one: the
 * kind, and the auth header format that goes with it, must track the
 * renderer the student actually picked.
 *
 * `authHeader` is a placeholder line, not a real credential — see JUNIE_NOTE.
 */
function junieConfig(
  baseUrl: string,
  kind: "Anthropic" | "OpenAI",
  authHeader: string
): SetupFile {
  return {
    path: "~/.junie/config.json",
    language: "json",
    body: [
      "{",
      '  "proxies": [',
      "    {",
      '      "name": "request-logger",',
      `      "kind": "${kind}",`,
      `      "api-url": "${baseUrl}",`,
      `      "headers": ["${authHeader}"]`,
      "    }",
      "  ],",
      '  "provider": "request-logger"',
      "}",
    ].join("\n"),
  };
}

const JUNIE_NOTE =
  "Junie has no existing login for this tool to pass through the way Claude " +
  "Code or Codex do. Its custom proxy bypasses JetBrains AI authentication " +
  "entirely, so a real API key for whichever backend you are logging goes " +
  "straight into config.json's headers array in plaintext. Do not commit " +
  "this file.";

const JUNIE_MERGE_NOTE =
  "This is merged into ~/.junie/config.json, not a replacement for it — add " +
  "the proxies entry and the provider key alongside whatever else is " +
  "already in that file.";

export const JUNIE: AgentEntry = {
  id: "junie",
  label: "Junie",
  // Junie is BYOK across several backends (OpenAI, Anthropic, Google, xAI,
  // OpenRouter, Copilot, a LiteLLM proxy) with no single fixed host of its
  // own — the same shape as OMP — so every setup for it is custom too. See
  // AgentEntry.alwaysCustom.
  //
  // Junie CLI is closed source, so unlike every other entry in this
  // catalogue this one is verified against JetBrains' published docs only,
  // not against real source or a real install. Testing status is recorded
  // in the README's "How much this was tested" section, the same way every
  // other agent's is; it is not printed to the student, the same way no
  // other agent's is either.
  alwaysCustom: true,
  providers: [
    {
      id: "anthropic",
      label: "Anthropic-compatible",
      // Unused: Junie never reaches the normal (non-custom) resolution
      // path that would read this. See resolveCustomTarget.
      upstreamHost: "",
      renderer: "raw",
      bin: "junie",
      customTemplateFor: ["anthropic"],
      setup: [
        junieConfig(
          "{baseUrl}",
          "Anthropic",
          "x-api-key: YOUR_ANTHROPIC_API_KEY"
        ),
      ],
      notes: [JUNIE_NOTE, JUNIE_MERGE_NOTE],
    },
    {
      id: "openai",
      label: "OpenAI-compatible",
      // Unused, same as the Anthropic-compatible entry above: Junie never
      // reaches the normal (non-custom) resolution path that would read
      // this. See resolveCustomTarget.
      upstreamHost: "",
      renderer: "raw",
      bin: "junie",
      // Also the catch-all for "raw"/not sure — see opencode.ts and pi.ts for
      // why an OpenAI-compatible guess is the better default for an
      // unidentified custom server.
      customTemplateFor: ["openai", "raw"],
      setup: [
        junieConfig(
          "{baseUrl}",
          "OpenAI",
          "Authorization: Bearer YOUR_OPENAI_API_KEY"
        ),
      ],
      notes: [JUNIE_NOTE, JUNIE_MERGE_NOTE],
    },
  ],
};
