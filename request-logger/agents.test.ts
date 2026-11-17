import { describe, it, expect } from "vitest";
import {
  agentProviders,
  listAgents,
  listProviders,
  resolveChoice,
} from "./agents";
import { CUSTOM_ID, ISSUE_URL, OTHER_ID } from "./choice-options";

const PORT = { port: 8787, platform: "linux" as NodeJS.Platform };

/** Resolve, and fail loudly if the answer was not a usable target. */
function target(agent: string, provider?: string) {
  const result = resolveChoice({ agent, provider }, PORT);
  if (result.kind !== "target") {
    throw new Error(
      `expected a target for ${agent}/${provider}, got ${result.kind}`
    );
  }
  return result;
}

describe('resolveChoice — "Other"', () => {
  it("asks for the missing agent instead of failing", () => {
    const result = resolveChoice({ agent: OTHER_ID }, PORT);
    expect(result.kind).toBe("request");
  });

  it("asks for the missing provider of an agent it knows", () => {
    const result = resolveChoice({ agent: "codex", provider: OTHER_ID }, PORT);
    expect(result.kind).toBe("request");
  });

  it("names the agent when the student named one", () => {
    const result = resolveChoice({ agent: "codex", provider: OTHER_ID }, PORT);
    if (result.kind !== "request") throw new Error("expected a request");
    expect(result.agentLabel).toBe("Codex");
  });

  it("names no agent when the agent itself was the missing one", () => {
    const result = resolveChoice({ agent: OTHER_ID }, PORT);
    if (result.kind !== "request") throw new Error("expected a request");
    expect(result.agentLabel).toBeNull();
  });

  it("sends the student to the issue tracker", () => {
    const result = resolveChoice({ agent: OTHER_ID }, PORT);
    if (result.kind !== "request") throw new Error("expected a request");
    expect(result.url).toBe(ISSUE_URL);
    expect(result.url).toContain("/issues/new");
  });

  it("never offers Other as an agent in the catalogue", () => {
    // The wizard adds it to the question. It is not an agent, so it must not
    // appear in the list the catalogue publishes.
    expect(listAgents().map((agent) => agent.id)).not.toContain(OTHER_ID);
    expect(listProviders("codex").map((p) => p.id)).not.toContain(OTHER_ID);
  });
});

describe("listAgents", () => {
  it("offers the agents in popularity order, refused ones last", () => {
    expect(listAgents().map((agent) => agent.id)).toEqual([
      "claude-code",
      "codex",
      "copilot",
      "opencode",
      "pi",
      "omp",
      "gemini",
      "antigravity",
      "junie",
      "cursor",
      "amp",
    ]);
  });

  it("puts every agent that can be logged above every agent that cannot", () => {
    const supported = listAgents().map((agent) => agent.supported);
    expect(supported.indexOf(false)).toBeGreaterThan(
      supported.lastIndexOf(true)
    );
  });

  it("marks Cursor as unsupported", () => {
    const cursor = listAgents().find((agent) => agent.id === "cursor");
    expect(cursor?.supported).toBe(false);
  });

  it("marks Claude Code as supported", () => {
    const claude = listAgents().find((agent) => agent.id === "claude-code");
    expect(claude?.supported).toBe(true);
  });

  it("says Claude Code needs a provider question now it has Vertex AI too", () => {
    const claude = listAgents().find((agent) => agent.id === "claude-code");
    expect(claude?.needsProvider).toBe(true);
  });

  it("says OpenCode needs a provider question", () => {
    const opencode = listAgents().find((agent) => agent.id === "opencode");
    expect(opencode?.needsProvider).toBe(true);
  });

  it("marks OMP as supported", () => {
    const omp = listAgents().find((agent) => agent.id === "omp");
    expect(omp?.supported).toBe(true);
  });

  it("marks OMP as always custom", () => {
    const omp = listAgents().find((agent) => agent.id === "omp");
    expect(omp?.alwaysCustom).toBe(true);
  });

  it("says no other agent is always custom", () => {
    const others = listAgents().filter(
      (agent) => agent.id !== "omp" && agent.id !== "junie"
    );
    expect(others.every((agent) => agent.alwaysCustom === false)).toBe(true);
  });

  it("says OMP needs no provider question, because it never shows one", () => {
    const omp = listAgents().find((agent) => agent.id === "omp");
    expect(omp?.needsProvider).toBe(false);
  });

  it("marks Junie as supported and always custom", () => {
    const junie = listAgents().find((agent) => agent.id === "junie");
    expect(junie?.supported).toBe(true);
    expect(junie?.alwaysCustom).toBe(true);
  });

  it("says Junie needs no provider question either, even though it has two internal templates", () => {
    // Junie is the first alwaysCustom agent with more than one catalogue
    // provider (see findCustomTemplate) — needsProvider must stay false
    // regardless, because askChoice skips the provider question for any
    // alwaysCustom agent before providers.length is ever consulted.
    const junie = listAgents().find((agent) => agent.id === "junie");
    expect(junie?.needsProvider).toBe(false);
  });
});

describe("listProviders", () => {
  it("returns nothing for an agent with one provider", () => {
    expect(listProviders("copilot")).toEqual([]);
  });

  it("returns nothing for a refused agent", () => {
    expect(listProviders("cursor")).toEqual([]);
  });

  it("returns both Claude Code providers", () => {
    expect(listProviders("claude-code").map((p) => p.id)).toEqual([
      "anthropic",
      "vertex",
    ]);
  });

  it("leads Claude Code with the Anthropic route, which is the simplest", () => {
    expect(listProviders("claude-code")[0].id).toBe("anthropic");
  });

  it("returns both OpenCode providers", () => {
    expect(listProviders("opencode").map((p) => p.id)).toEqual([
      "anthropic",
      "openai",
    ]);
  });

  it("returns all three Pi providers", () => {
    expect(listProviders("pi").map((p) => p.id)).toEqual([
      "anthropic",
      "openai",
      "codex",
    ]);
  });

  it("leads Pi with the Anthropic route, which is the simplest", () => {
    expect(listProviders("pi")[0].id).toBe("anthropic");
  });
});

describe("agentProviders", () => {
  it("returns the one provider a single-provider agent has, unlike listProviders", () => {
    expect(listProviders("copilot")).toEqual([]);
    expect(agentProviders("copilot").map((p) => p.id)).toEqual(["github"]);
  });

  it("returns nothing for a refused agent", () => {
    expect(agentProviders("cursor")).toEqual([]);
  });

  it("returns OMP's one internal template provider, even though the wizard never shows it", () => {
    // config.ts never calls agentProviders for an alwaysCustom agent — see
    // askChoice — but the entry exists to hold the command/setup template
    // resolveCustomTarget borrows from, so it is not empty here.
    expect(agentProviders("omp").map((p) => p.id)).toEqual([CUSTOM_ID]);
  });

  it("agrees with listProviders once there are two or more", () => {
    expect(agentProviders("opencode").map((p) => p.id)).toEqual(
      listProviders("opencode").map((p) => p.id)
    );
  });

  it("returns Junie's two internal template providers, even though the wizard never shows them", () => {
    // Same reasoning as OMP above, except Junie has two templates to pick
    // between (see findCustomTemplate) rather than one.
    expect(agentProviders("junie").map((p) => p.id)).toEqual([
      "anthropic",
      "openai",
    ]);
  });
});

describe("resolveChoice — refusals", () => {
  it("refuses Cursor", () => {
    expect(resolveChoice({ agent: "cursor" }, PORT).kind).toBe("refusal");
  });

  it("gives a reason for refusing Cursor", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result.kind === "refusal" && result.reason).toContain("own servers");
  });

  it("refuses Amp", () => {
    expect(resolveChoice({ agent: "amp" }, PORT).kind).toBe("refusal");
  });

  it("gives a reason for refusing Amp", () => {
    const result = resolveChoice({ agent: "amp" }, PORT);
    expect(result.kind === "refusal" && result.reason).toContain("own servers");
  });

  it("names the agent in the refusal", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result.kind === "refusal" && result.agentLabel).toBe("Cursor CLI");
  });

  it("gives no upstream host for a refused agent", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result).not.toHaveProperty("upstreamHost");
  });
});

describe("resolveChoice — bad input", () => {
  it("rejects an unknown agent", () => {
    expect(resolveChoice({ agent: "nonesuch" }, PORT).kind).toBe("error");
  });

  it("lists the known agents when the agent is unknown", () => {
    const result = resolveChoice({ agent: "nonesuch" }, PORT);
    expect(result.kind === "error" && result.message).toContain("claude-code");
  });

  it("rejects a choice that omits a needed provider", () => {
    expect(resolveChoice({ agent: "opencode" }, PORT).kind).toBe("error");
  });

  it("lists the providers when one is missing", () => {
    const result = resolveChoice({ agent: "opencode" }, PORT);
    expect(result.kind === "error" && result.message).toContain("anthropic");
  });

  it("rejects an unknown provider", () => {
    expect(
      resolveChoice({ agent: "opencode", provider: "cohere" }, PORT).kind
    ).toBe("error");
  });

  it("accepts a single-provider agent with no provider given", () => {
    // Claude Code no longer qualifies now it has two providers (see below) —
    // Copilot is still single-provider and exercises this general case.
    expect(resolveChoice({ agent: "copilot" }, PORT).kind).toBe("target");
  });

  it("ignores a stale provider on a single-provider agent", () => {
    expect(target("copilot", "whatever").upstreamHost).toBe(
      "api.githubcopilot.com"
    );
  });

  it("now requires a provider for Claude Code, since it has two", () => {
    const result = resolveChoice({ agent: "claude-code" }, PORT);
    expect(result.kind).toBe("error");
    expect(result.kind === "error" && result.message).toContain("vertex");
  });

  it("points the student at --force when a choice cannot be resolved", () => {
    const result = resolveChoice({ agent: "nonesuch" }, PORT);
    expect(result.kind === "error" && result.message).toContain("--force");
  });
});
