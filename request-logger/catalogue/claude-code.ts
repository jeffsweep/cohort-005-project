import type { AgentEntry } from "./entry";

export const CLAUDE_CODE: AgentEntry = {
  id: "claude-code",
  label: "Claude Code",
  providers: [
    {
      id: "anthropic",
      label: "Anthropic",
      upstreamHost: "api.anthropic.com",
      renderer: "anthropic",
      env: [
        ["ANTHROPIC_BASE_URL", "{baseUrl}"],
        ["ENABLE_TOOL_SEARCH", "true"],
      ],
      bin: "claude",
      // Claude Code's own wire format is Anthropic-shaped regardless of
      // what a custom target claims to speak, so this stays the catch-all
      // for every wire format a custom target might pick — the same
      // "used regardless of the wire format chosen" guarantee this agent
      // had when it was the only provider, back when findCustomTemplate's
      // single-provider branch picked it unconditionally. Now that
      // "vertex" (below) is a second provider, that branch no longer
      // fires, so the guarantee has to be spelled out here instead.
      customTemplateFor: ["anthropic", "openai", "raw"],
      notes: [
        "ENABLE_TOOL_SEARCH=true is important. Claude Code trusts one host only. " +
          "When the base URL points somewhere else, it turns off tool search, stops " +
          "deferring tools, and writes every tool schema into the request. Your " +
          "capture is then larger than a real one and has a different shape. The " +
          "flag turns that effect off, so what you read is what Claude Code really sends.",
        "This works with a Claude subscription login. Your login stays active. " +
          "Only the model traffic moves.",
      ],
    },
    {
      id: "vertex",
      label: "Google Vertex AI",
      // Fixed to the global endpoint on purpose — see the region note below.
      upstreamHost: "aiplatform.googleapis.com",
      // Vertex's Claude endpoint is Anthropic's own Messages API shape,
      // routed by URL path instead of a body field — the model ID moves
      // from the body's "model" key into the URL
      // (.../publishers/anthropic/models/{model}:streamRawPredict), and
      // the body gains "anthropic_version". findModel() in render.ts
      // already falls back to reading the model out of the path when the
      // body has none, and the Anthropic renderer only reads specific
      // known keys, so the existing "anthropic" renderer reads this
      // correctly without a dedicated renderer of its own.
      renderer: "anthropic",
      env: [
        ["ANTHROPIC_VERTEX_BASE_URL", "{baseUrl}"],
        ["ENABLE_TOOL_SEARCH", "true"],
      ],
      bin: "claude",
      notes: [
        "This assumes CLAUDE_CODE_USE_VERTEX=1, CLOUD_ML_REGION and " +
          "ANTHROPIC_VERTEX_PROJECT_ID are already exported in your shell — " +
          "request-logger does not set those, only ANTHROPIC_VERTEX_BASE_URL, " +
          "which is the variable Claude Code actually reads for a base-URL " +
          "override once Vertex mode is on. ANTHROPIC_BASE_URL, used by the " +
          "plain Anthropic route above, is silently ignored in Vertex mode — " +
          "that mismatch is the usual reason a Vertex student's logs folder " +
          "stays empty.",
        "Only CLOUD_ML_REGION=global is supported by this entry. A regional " +
          "value (us-east5, say) talks to a different host " +
          "({region}-aiplatform.googleapis.com), which this entry does not " +
          "resolve to yet — ask for it via the issue tracker if you hit this.",
        "ENABLE_TOOL_SEARCH=true matters here for the same reason it does on " +
          "the plain Anthropic route above: a non-default host turns off tool " +
          "search unless this is set.",
      ],
    },
  ],
};
