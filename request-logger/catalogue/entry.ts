/**
 * entry.ts — the shape of one agent, and of one provider, in the catalogue.
 */

import type { RendererId, SetupFile } from "../agent-types";

export interface ProviderEntry {
  id: string;
  label: string;
  upstreamHost: string;
  renderer: RendererId;
  /**
   * Appended to http://localhost:PORT to make the base URL.
   *
   * Per-agent, never global. OpenCode's SDK appends `/messages` to whatever it
   * is given, so it needs `/v1`. Aider's layer appends the whole path, so it
   * must not have one. Getting this wrong produces a 404 the student cannot
   * explain, so it is data, and it is tested.
   */
  suffix?: string;
  /** Environment variables, in the order they should appear in the command. */
  env?: Array<[string, string]>;
  bin: string;
  args?: string[];
  setup?: SetupFile[];
  notes?: string[];
  warnings?: string[];
  /**
   * Which custom-base-url wire formats this provider's command, env and
   * setup file are a reasonable stand-in for. Only consulted on an agent
   * with more than one provider — see findCustomTemplate. A provider tied to
   * one specific login route (a ChatGPT subscription, a Google account) is
   * never tagged: reusing its template for an unrelated third-party server
   * would silently misconfigure it rather than help.
   */
  customTemplateFor?: RendererId[];
}

export interface AgentEntry {
  id: string;
  label: string;
  /** A supported agent has providers. A refused one has a reason. */
  providers?: ProviderEntry[];
  reason?: string;
  /**
   * True when every setup for this agent is a custom target: there is no
   * fixed catalogue provider to fall back to, so the wizard skips the
   * provider question and asks the two custom-base-url questions directly.
   * OMP is the first agent like this — it can point at Ollama, LM Studio,
   * llama.cpp, LiteLLM, or anything else, so no single upstream host is ever
   * right for it.
   */
  alwaysCustom?: boolean;
}
