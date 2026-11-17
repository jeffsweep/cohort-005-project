import type { SetupFile } from "../agent-types";
import type { AgentEntry } from "./entry";

const PI_NOTE =
  "Pi has no base URL variable and no flag. A config file is the only way to " +
  "point it at this tool. Overriding the provider keeps Pi's whole built-in " +
  "model list, so you do not have to list the models yourself.";

/**
 * Pi's provider override file. The key is `baseUrl`, in this exact spelling.
 * Pi accepts other spellings into the file and then refuses to start, so this
 * is worth getting right for the student.
 *
 * `modelId`, when given, is written as a one-entry `models` array under the
 * same provider. Pi replaces that provider's whole built-in model catalogue
 * with whatever `models` lists — see resolveCustomTarget's Pi branch, which
 * is the only caller that passes it. Omitted, as it is for every catalogue
 * entry below, Pi keeps its built-in catalogue for that provider, which is
 * correct there because those routes really do talk to Anthropic or OpenAI.
 */
export function piModels(
  providerId: string,
  baseUrl: string,
  modelId?: string
): SetupFile {
  return {
    path: "~/.pi/agent/models.json",
    language: "json",
    body: [
      "{",
      '  "providers": {',
      `    "${providerId}": {`,
      `      "baseUrl": "${baseUrl}"${modelId ? "," : ""}`,
      ...(modelId ? [`      "models": [{ "id": "${modelId}" }]`] : []),
      "    }",
      "  }",
      "}",
    ].join("\n"),
  };
}

export const PI: AgentEntry = {
  id: "pi",
  label: "Pi",
  providers: [
    {
      id: "anthropic",
      label: "Anthropic",
      upstreamHost: "api.anthropic.com",
      renderer: "anthropic",
      bin: "pi",
      customTemplateFor: ["anthropic"],
      setup: [piModels("anthropic", "{baseUrl}")],
      notes: [
        PI_NOTE,
        "This route works with an Anthropic API key and with a Claude " +
          "subscription login.",
        "Pi never counts tokens, so every file in your logs folder is a real turn.",
      ],
    },
    {
      id: "openai",
      label: "OpenAI API key",
      upstreamHost: "api.openai.com",
      renderer: "openai",
      // Pi hands this to the OpenAI SDK, which appends `/responses`.
      suffix: "/v1",
      bin: "pi",
      // Also the catch-all for "raw"/not sure — see opencode.ts for why an
      // OpenAI-compatible guess is the better default.
      customTemplateFor: ["openai", "raw"],
      setup: [piModels("openai", "{baseUrl}")],
      notes: [PI_NOTE],
    },
    {
      id: "codex",
      label: "ChatGPT subscription (Codex)",
      upstreamHost: "chatgpt.com",
      renderer: "openai",
      // Pi appends `/codex/responses` itself, and the real endpoint lives
      // under `/backend-api`. Without this suffix the forwarded path would be
      // missing that segment and the request would fail.
      suffix: "/backend-api",
      bin: "pi",
      setup: [
        piModels("openai-codex", "{baseUrl}"),
        {
          path: "~/.pi/agent/settings.json",
          language: "json",
          body: ["{", '  "transport": "sse"', "}"].join("\n"),
        },
      ],
      notes: [
        PI_NOTE,
        "The SSE transport is not optional on this route. Pi's default tries " +
          "a WebSocket first, and this tool cannot see a WebSocket. The " +
          "setting goes in the settings file, not in the models file. Pi " +
          "accepts it in the models file and then quietly ignores it.",
        "Pi compresses the request body on this route. The readable .md file " +
          "shows the decoded body. The .request.txt file keeps the compressed " +
          "bytes exactly as sent, so you can still replay it.",
      ],
    },
  ],
};
