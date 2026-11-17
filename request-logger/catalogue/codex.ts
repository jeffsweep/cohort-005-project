import type { AgentEntry } from "./entry";

/**
 * Codex has no base URL environment variable. OPENAI_BASE_URL was read by older
 * versions and is gone from 0.133.0, so a student following an older guide gets
 * an empty logs folder and no error. The `-c` flag sets one config key for one
 * run, which is why it is used here in place of editing a file.
 */
const CODEX_OVERRIDE_NOTE =
  "The -c flag sets this for one run only. Your ~/.codex/config.toml is not " +
  "touched, so your normal Codex is unchanged the moment you stop using this " +
  "command. Keep the quotes exactly as they are: Codex reads the value as TOML, " +
  "and an unquoted URL does not parse.";

export const CODEX: AgentEntry = {
  id: "codex",
  label: "Codex",
  providers: [
    {
      id: "chatgpt",
      label: "ChatGPT subscription",
      upstreamHost: "chatgpt.com",
      renderer: "openai",
      // Codex joins the base URL and the word `responses` with one slash, so
      // the base URL must carry the whole prefix that it would otherwise use,
      // which is https://chatgpt.com/backend-api/codex.
      suffix: "/backend-api/codex",
      bin: "codex",
      args: ["-c", `'openai_base_url="{baseUrl}"'`],
      notes: [CODEX_OVERRIDE_NOTE],
    },
    {
      id: "openai",
      label: "OpenAI API key",
      upstreamHost: "api.openai.com",
      renderer: "openai",
      // The API key route defaults to https://api.openai.com/v1, and Codex
      // appends `responses` to it, so the base URL keeps the /v1.
      suffix: "/v1",
      bin: "codex",
      args: ["-c", `'openai_base_url="{baseUrl}"'`],
      // The only usable template for a custom Codex target: Codex only
      // ever speaks the OpenAI-compatible wire format, so it is the
      // catch-all for every choice, including "anthropic" — a mismatch
      // there is Codex's limitation, not a bug in this tool.
      customTemplateFor: ["openai", "raw", "anthropic"],
      notes: [CODEX_OVERRIDE_NOTE],
    },
  ],
};
