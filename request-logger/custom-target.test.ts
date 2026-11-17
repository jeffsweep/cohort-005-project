import { describe, it, expect } from "vitest";
import type { AgentChoice } from "./agent-types";
import { resolveChoice } from "./agents";
import { CUSTOM_ID } from "./choice-options";
import { customTargetNeedsModel } from "./custom-target";

const PORT = { port: 8787, platform: "linux" as NodeJS.Platform };

/** Resolve a custom-base-url choice, and fail loudly if it was not a usable target. */
function customTarget(choice: AgentChoice) {
  const result = resolveChoice(choice, PORT);
  if (result.kind !== "custom-target") {
    throw new Error(`expected a custom-target, got ${result.kind}`);
  }
  return result;
}

describe("resolveChoice — custom base URL", () => {
  it("resolves a valid http:// target", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.upstreamBaseUrl).toBe("http://localhost:11434");
  });

  it("resolves a valid https:// target", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "https://api.deepseek.com",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.upstreamBaseUrl).toBe("https://api.deepseek.com");
  });

  it("keeps a path segment from the typed base URL instead of discarding it", () => {
    // Regression test for #74: a custom base URL like OpenCode Go's
    // https://opencode.ai/zen/go carries a path prefix the upstream actually
    // needs. Reducing this to origin-only silently drops it, and proxy.ts
    // then forwards to https://opencode.ai/v1/chat/completions — a 404 —
    // instead of https://opencode.ai/zen/go/v1/chat/completions.
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "https://api.deepseek.com/v1/some/path",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.upstreamBaseUrl).toBe(
      "https://api.deepseek.com/v1/some/path"
    );
  });

  it("drops a trailing slash from a typed path prefix, so proxy.ts never joins a doubled slash", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "https://opencode.ai/zen/go/",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.upstreamBaseUrl).toBe("https://opencode.ai/zen/go");
  });

  it("rejects a base URL with no scheme", () => {
    const result = resolveChoice(
      {
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "localhost:11434",
      },
      PORT
    );
    expect(result.kind).toBe("error");
  });

  it("rejects a base URL that is not a URL at all", () => {
    const result = resolveChoice(
      { agent: "opencode", provider: CUSTOM_ID, customBaseUrl: "not a url" },
      PORT
    );
    expect(result.kind).toBe("error");
  });

  it("rejects a base URL with an unrelated scheme", () => {
    const result = resolveChoice(
      {
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "ftp://example.com",
      },
      PORT
    );
    expect(result.kind).toBe("error");
  });

  it("names the base URL in the rejection", () => {
    const result = resolveChoice(
      { agent: "opencode", provider: CUSTOM_ID, customBaseUrl: "not a url" },
      PORT
    );
    expect(result.kind === "error" && result.message).toContain("not a url");
  });

  it("points the student at --force when the base URL cannot be resolved", () => {
    const result = resolveChoice(
      { agent: "opencode", provider: CUSTOM_ID, customBaseUrl: "not a url" },
      PORT
    );
    expect(result.kind === "error" && result.message).toContain("--force");
  });

  it("rejects a custom choice with no base URL at all", () => {
    const result = resolveChoice(
      { agent: "opencode", provider: CUSTOM_ID },
      PORT
    );
    expect(result.kind).toBe("error");
  });

  it("defaults to the raw renderer when no wire format was given", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
    });
    expect(result.renderer).toBe("raw");
  });

  it("uses the openai renderer when that wire format is chosen", () => {
    expect(
      customTarget({
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "openai",
        customModel: "test-model",
      }).renderer
    ).toBe("openai");
  });

  it("uses the anthropic renderer when that wire format is chosen", () => {
    expect(
      customTarget({
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "anthropic",
      }).renderer
    ).toBe("anthropic");
  });

  it("uses the raw renderer when the student says they are not sure", () => {
    expect(
      customTarget({
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "raw",
      }).renderer
    ).toBe("raw");
  });

  it("warns the student that a raw capture is a JSON dump, not a broken one", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "raw",
    });
    expect(result.notes.join(" ")).toContain("not broken");
  });

  it("labels a custom target's provider as Custom base URL", () => {
    expect(
      customTarget({
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "openai",
        customModel: "test-model",
      }).providerLabel
    ).toBe("Custom base URL");
  });

  it("has no catalogue provider id at all", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result).not.toHaveProperty("provider");
  });
});

describe("customTargetNeedsModel", () => {
  it("needs a model for Pi on every wire format", () => {
    expect(customTargetNeedsModel("pi", "openai")).toBe(true);
    expect(customTargetNeedsModel("pi", "anthropic")).toBe(true);
    expect(customTargetNeedsModel("pi", "raw")).toBe(true);
  });

  it("needs a model for OpenCode only on the OpenAI-compatible wire format", () => {
    expect(customTargetNeedsModel("opencode", "openai")).toBe(true);
    expect(customTargetNeedsModel("opencode", "anthropic")).toBe(false);
    expect(customTargetNeedsModel("opencode", "raw")).toBe(false);
  });

  it("needs no model for any other agent, on any wire format", () => {
    for (const renderer of ["openai", "anthropic", "raw"] as const) {
      expect(customTargetNeedsModel("codex", renderer)).toBe(false);
      expect(customTargetNeedsModel("claude-code", renderer)).toBe(false);
      expect(customTargetNeedsModel("omp", renderer)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// OMP — every setup is custom
// ---------------------------------------------------------------------------

describe("resolveChoice — OMP", () => {
  it("resolves OMP straight from a base URL and wire format, with no provider needed", () => {
    const result = resolveChoice(
      {
        agent: "omp",
        customBaseUrl: "http://localhost:8787",
        customRenderer: "openai",
      },
      PORT
    );
    expect(result.kind).toBe("custom-target");
  });

  it("gives OMP its own bin, with no env vars", () => {
    const result = customTarget({
      agent: "omp",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "raw",
    });
    expect(result.command).toBe("omp");
  });

  it("gives OMP its YAML models file under ~/.omp/agent/models.yml", () => {
    const result = customTarget({
      agent: "omp",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "raw",
    });
    expect(result.setup).toHaveLength(1);
    expect(result.setup[0].path).toBe("~/.omp/agent/models.yml");
    expect(result.setup[0].language).toBe("yaml");
  });

  it("puts the resolved base URL under a provider key in the YAML file", () => {
    const result = customTarget({
      agent: "omp",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "raw",
    });
    expect(result.setup[0].body).toContain('baseUrl: "http://localhost:8787"');
    expect(result.setup[0].body).toContain("providers:");
  });

  it("still resolves OMP even when the saved provider field is stale", () => {
    // alwaysCustom agents ignore whatever is saved under `provider`; only the
    // custom base URL and renderer matter.
    const result = resolveChoice(
      {
        agent: "omp",
        provider: "whatever-was-saved-before",
        customBaseUrl: "http://localhost:11434",
        customRenderer: "raw",
      },
      PORT
    );
    expect(result.kind).toBe("custom-target");
  });

  it("rejects OMP with no base URL", () => {
    expect(resolveChoice({ agent: "omp" }, PORT).kind).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// Junie — every setup is custom, and (unlike OMP) has two templates to pick
// between by wire format
// ---------------------------------------------------------------------------

describe("resolveChoice — Junie", () => {
  it("resolves Junie straight from a base URL and wire format, with no provider needed", () => {
    const result = resolveChoice(
      {
        agent: "junie",
        customBaseUrl: "http://localhost:8787",
        customRenderer: "anthropic",
      },
      PORT
    );
    expect(result.kind).toBe("custom-target");
  });

  it("gives Junie its own bin, with no env vars", () => {
    const result = customTarget({
      agent: "junie",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "anthropic",
    });
    expect(result.command).toBe("junie");
  });

  it("writes an Anthropic-kind proxy entry for the anthropic-compatible route", () => {
    const result = customTarget({
      agent: "junie",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "anthropic",
    });
    expect(result.setup).toHaveLength(1);
    expect(result.setup[0].path).toBe("~/.junie/config.json");
    expect(result.setup[0].language).toBe("json");
    expect(result.setup[0].body).toContain('"kind": "Anthropic"');
    expect(result.setup[0].body).toContain(
      '"api-url": "http://localhost:8787"'
    );
    expect(result.setup[0].body).toContain("x-api-key:");
    expect(result.setup[0].body).toContain('"provider": "request-logger"');
  });

  it("writes an OpenAI-kind proxy entry for the openai-compatible route", () => {
    const result = customTarget({
      agent: "junie",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
    });
    expect(result.setup[0].body).toContain('"kind": "OpenAI"');
    expect(result.setup[0].body).toContain("Authorization: Bearer");
  });

  it("defaults Junie's raw/not-sure custom target to the OpenAI-kind template", () => {
    // Same convention as OpenCode and Pi's custom targets: an unidentified
    // custom server is far more often OpenAI-compatible than
    // Anthropic-compatible.
    const result = customTarget({
      agent: "junie",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "raw",
    });
    expect(result.setup[0].body).toContain('"kind": "OpenAI"');
  });

  it("never sends Junie's Anthropic-kind api-key header on the OpenAI route, or vice versa", () => {
    const anthropicRoute = customTarget({
      agent: "junie",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "anthropic",
    });
    const openaiRoute = customTarget({
      agent: "junie",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
    });
    expect(anthropicRoute.setup[0].body).not.toContain("Authorization: Bearer");
    expect(openaiRoute.setup[0].body).not.toContain("x-api-key:");
  });

  it("warns that Junie's proxy bypasses JetBrains AI authentication, unlike every login-based agent here", () => {
    const result = customTarget({
      agent: "junie",
      customBaseUrl: "http://localhost:11434",
      customRenderer: "anthropic",
    });
    expect(result.notes.some((note) => note.includes("bypasses"))).toBe(true);
  });

  it("still resolves Junie even when the saved provider field is stale", () => {
    // alwaysCustom agents ignore whatever is saved under `provider`; only
    // the custom base URL and renderer matter.
    const result = resolveChoice(
      {
        agent: "junie",
        provider: "whatever-was-saved-before",
        customBaseUrl: "http://localhost:11434",
        customRenderer: "raw",
      },
      PORT
    );
    expect(result.kind).toBe("custom-target");
  });

  it("rejects Junie with no base URL", () => {
    expect(resolveChoice({ agent: "junie" }, PORT).kind).toBe("error");
  });
});
