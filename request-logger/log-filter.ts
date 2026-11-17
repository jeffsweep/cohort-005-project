/**
 * log-filter.ts — which forwarded requests are worth writing down.
 */

import type { RendererId } from "./agent-types";

/**
 * Some calls reach the model provider but never produce a model reply. One turn
 * fires several of them, so they are noise for "what is sent to the model". The
 * proxy forwards them all. It only writes down the ones this returns true for.
 *
 *  - A model call is always a POST. Agents also send connectivity probes, which
 *    would otherwise write an empty document at the top of the logs folder.
 *  - The direct Anthropic API counts tokens with a `count_tokens` path.
 *    Claude Code on Vertex AI reaches the same Anthropic wire format through a
 *    Vertex-style URL instead, whose token-counting call ends
 *    `:countTokens` — Vertex's own camelCase, colon-suffixed convention,
 *    not Anthropic's underscored one — so both spellings are matched below.
 *  - Gemini counts tokens under a different name, and on the Google login route
 *    it fires several calls that carry no prompt at all. On that route the only
 *    calls worth keeping are the ones that generate content.
 */
export function shouldLogRequest(
  method: string,
  reqPath: string,
  renderer: RendererId
): boolean {
  if (method.toUpperCase() !== "POST") return false;
  // Case-insensitive on purpose: the streaming call is `:streamGenerateContent`,
  // with a capital G, and the non-streaming one is `:generateContent`.
  if (renderer === "gemini") return /generateContent/i.test(reqPath);
  // Matches both `count_tokens` (direct Anthropic API) and `countTokens`
  // (Claude Code on Vertex AI).
  return !/count[_-]?tokens/i.test(reqPath);
}
