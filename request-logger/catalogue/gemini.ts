import type { AgentEntry } from "./entry";

export const GEMINI: AgentEntry = {
  id: "gemini",
  label: "Gemini CLI",
  providers: [
    {
      id: "google-login",
      label: "Free Google account login",
      upstreamHost: "cloudcode-pa.googleapis.com",
      renderer: "gemini",
      env: [["CODE_ASSIST_ENDPOINT", "{baseUrl}"]],
      bin: "gemini",
      notes: [
        "This is the free tier. You do not need to buy anything to finish the lesson.",
        "On this route Gemini also makes several housekeeping calls that carry no " +
          "prompt. This tool forwards them but does not log them, so your logs " +
          "folder holds real turns only.",
      ],
    },
    {
      id: "api-key",
      label: "Gemini API key",
      upstreamHost: "generativelanguage.googleapis.com",
      renderer: "gemini",
      env: [["GOOGLE_GEMINI_BASE_URL", "{baseUrl}"]],
      bin: "gemini",
      // The only usable template for a custom Gemini CLI target: the
      // Google-login route is tied to that login and would misconfigure an
      // unrelated server. Gemini CLI's own wire format does not actually
      // match any of the custom choices, so this is a best-effort catch-all
      // for all three — a mismatch shows up as a renderer warning, not a
      // silent one.
      customTemplateFor: ["openai", "anthropic", "raw"],
      warnings: [
        "The two Gemini routes use different variables and they are not " +
          "interchangeable. GOOGLE_GEMINI_BASE_URL is ignored under a Google " +
          "account login, and CODE_ASSIST_ENDPOINT is ignored under an API key. " +
          "Neither one gives you an error. You just get an empty logs folder.",
      ],
    },
  ],
};
