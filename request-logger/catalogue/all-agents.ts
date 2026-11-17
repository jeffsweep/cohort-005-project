/**
 * all-agents.ts — the catalogue of coding agents the request-logger can proxy.
 *
 * The catalogue is the single source of truth for every per-agent fact:
 *  - which upstream host that agent's traffic must go to,
 *  - which renderer reads that wire format,
 *  - the exact command to run, correct by construction.
 *
 * Nothing else in the tool decides these things. The wizard reads the catalogue
 * to build its questions, the proxy reads the resolved target to route and to
 * render, and the startup banner prints the resolved command. Because the facts
 * are data rather than prose, they can be tested — and they cannot silently rot
 * the way a README does.
 *
 * Each agent's entry lives in its own file beside this one. Adding an agent
 * should be one new file there and one line here, and nothing else.
 */

import { ANTIGRAVITY } from "./antigravity";
import { CLAUDE_CODE } from "./claude-code";
import { CODEX } from "./codex";
import { COPILOT } from "./copilot";
import type { AgentEntry } from "./entry";
import { GEMINI } from "./gemini";
import { JUNIE } from "./junie";
import { OMP } from "./omp";
import { OPENCODE } from "./opencode";
import { PI } from "./pi";
import { AMP, CURSOR } from "./refused-agents";

/**
 * Ordered by popularity, decided 2026-08-06. The wizard shows them in this
 * order, so a student is most likely to find theirs first.
 */
export const AGENTS: AgentEntry[] = [
  CLAUDE_CODE,
  CODEX,
  COPILOT,
  CURSOR,
  OPENCODE,
  PI,
  OMP,
  GEMINI,
  ANTIGRAVITY,
  JUNIE,
  AMP,
];
