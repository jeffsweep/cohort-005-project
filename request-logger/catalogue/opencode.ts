import type { AgentEntry } from "./entry";

const OPENCODE_NOTE =
  "The environment variable above works, but only by accident: OpenCode passes " +
  "no base URL of its own for this provider, so the bundled SDK falls back to " +
  "reading the variable. The config file below is the durable way to do it.";

export const OPENCODE: AgentEntry = {
  id: "opencode",
  label: "OpenCode",
  providers: [
    {
      id: "anthropic",
      label: "Anthropic",
      upstreamHost: "api.anthropic.com",
      renderer: "anthropic",
      suffix: "/v1",
      env: [["ANTHROPIC_BASE_URL", "{baseUrl}"]],
      bin: "opencode",
      customTemplateFor: ["anthropic"],
      setup: [
        {
          path: "~/.config/opencode/opencode.json",
          language: "json",
          body: [
            "{",
            '  "$schema": "https://opencode.ai/config.json",',
            '  "model": "anthropic/claude-sonnet-4-5",',
            '  "small_model": "anthropic/claude-sonnet-4-5",',
            '  "provider": {',
            '    "anthropic": {',
            '      "options": {',
            '        "apiKey": "{env:ANTHROPIC_API_KEY}",',
            '        "baseURL": "{baseUrl}"',
            "      }",
            "    }",
            "  }",
            "}",
          ].join("\n"),
        },
      ],
      notes: [
        OPENCODE_NOTE,
        "OpenCode never counts tokens. Instead it makes a second call with its " +
          "small model to title the thread, so one turn writes exactly two captures.",
      ],
    },
    {
      id: "openai",
      label: "OpenAI API key",
      upstreamHost: "api.openai.com",
      renderer: "openai",
      suffix: "/v1",
      env: [["OPENAI_BASE_URL", "{baseUrl}"]],
      bin: "opencode",
      // Also the catch-all for "raw"/not sure: a third-party server behind
      // a custom base URL is far more often OpenAI-compatible than
      // Anthropic-compatible, so this is the better default guess.
      customTemplateFor: ["openai", "raw"],
      setup: [
        {
          path: "~/.config/opencode/opencode.json",
          language: "json",
          body: [
            "{",
            '  "$schema": "https://opencode.ai/config.json",',
            '  "model": "openai/gpt-5.1",',
            '  "small_model": "openai/gpt-5.1",',
            '  "provider": {',
            '    "openai": {',
            '      "options": {',
            '        "apiKey": "{env:OPENAI_API_KEY}",',
            '        "baseURL": "{baseUrl}"',
            "      }",
            "    }",
            "  }",
            "}",
          ].join("\n"),
        },
      ],
      notes: [
        OPENCODE_NOTE,
        "OpenCode uses a different system prompt for each provider. Run it once " +
          "against Anthropic and once against OpenAI and compare the two captures.",
      ],
      warnings: [
        "A ChatGPT login will not work here. OpenCode sends that traffic to a " +
          "different host on purpose, so it goes around this tool. Use an " +
          "OpenAI API key.",
      ],
    },
  ],
};
