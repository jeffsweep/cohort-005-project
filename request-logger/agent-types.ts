/**
 * agent-types.ts — what the student picks, and every shape resolving that
 * choice can produce.
 */

export type RendererId = "anthropic" | "openai" | "gemini" | "raw";

/**
 * What the student picked. This, and only this, is what gets saved to disk —
 * except the custom target fields, which are the one documented exception.
 * See config.ts.
 */
export interface AgentChoice {
  agent: string;
  provider?: string;
  /** Only set when provider is CUSTOM_ID: the base URL the student typed. */
  customBaseUrl?: string;
  /** Only set when provider is CUSTOM_ID: the wire format they chose for it. */
  customRenderer?: RendererId;
  /**
   * Selected model for a custom target that needs one declared up front:
   * OpenCode's custom OpenAI-compatible route, and any of Pi's custom
   * routes (see resolveCustomTarget).
   */
  customModel?: string;
}

export interface ResolvedTarget {
  kind: "target";
  agent: string;
  agentLabel: string;
  provider: string;
  providerLabel: string;
  /** The single host every request is forwarded to. */
  upstreamHost: string;
  renderer: RendererId;
  /** The base URL the student points their agent at, e.g. http://localhost:8787/v1 */
  baseUrl: string;
  /** The copy-pasteable command, complete with env vars and flags. */
  command: string;
  /** Config files the student must write before the command will work. */
  setup: SetupFile[];
  /** Things worth knowing. Printed under the command. */
  notes: string[];
  /** Things that will otherwise look like the tool is broken. */
  warnings: string[];
}

/**
 * Resolved to a target the catalogue has no entry for: the student typed
 * their own base URL and picked their own wire format, rather than one being
 * looked up from a ProviderEntry. It plays the same role as a ResolvedTarget
 * everywhere downstream — the proxy routes to it and renders it exactly the
 * same way — so the two are only ever told apart by `kind`.
 */
export interface CustomTarget {
  kind: "custom-target";
  agent: string;
  agentLabel: string;
  /** Always "Custom base URL": there is no catalogue provider label to show. */
  providerLabel: string;
  /**
   * The scheme+host[+port] the student typed, plus any path prefix it
   * carried (e.g. https://opencode.ai/zen/go). proxy.ts joins that prefix
   * against each request's own path when forwarding — see
   * upstreamPathPrefix in proxy.ts.
   */
  upstreamBaseUrl: string;
  renderer: RendererId;
  baseUrl: string;
  command: string;
  setup: SetupFile[];
  notes: string[];
  warnings: string[];
}

export interface AgentRefusal {
  kind: "refusal";
  agent: string;
  agentLabel: string;
  reason: string;
}

export interface ResolveError {
  kind: "error";
  message: string;
}

/**
 * The student's setup is not in the catalogue, and they said so.
 *
 * This is not an error. The catalogue is a list of what has been tested, not a
 * list of what is possible, so the only useful answer is to ask for the missing
 * entry. It is never saved.
 */
export interface SetupRequest {
  kind: "request";
  /** The agent, when the student named one the catalogue knows. */
  agentLabel: string | null;
  /** Where to ask for the missing entry. */
  url: string;
}

export type Resolution =
  ResolvedTarget | CustomTarget | AgentRefusal | ResolveError | SetupRequest;

export interface SetupFile {
  path: string;
  body: string;
  language: string;
}
