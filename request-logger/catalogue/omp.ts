import type { SetupFile } from "../agent-types";
import { CUSTOM_ID, CUSTOM_LABEL } from "../choice-options";
import type { AgentEntry } from "./entry";

/**
 * OMP's provider override file, in YAML, under ~/.omp/agent/models.yml.
 *
 * OMP does not know, and this tool cannot know, which backend the student is
 * actually pointing at — Ollama, LM Studio, llama.cpp, LiteLLM, or something
 * else entirely — so the provider key below is a generic placeholder
 * ("custom") rather than a real backend name. OMP does not care what the key
 * is called, only that baseUrl is set correctly under it, so the placeholder
 * costs the student nothing; they may rename it if they prefer a name that
 * matches their backend.
 */
function ompModels(baseUrl: string): SetupFile {
  return {
    path: "~/.omp/agent/models.yml",
    language: "yaml",
    body: ["providers:", "  custom:", `    baseUrl: "${baseUrl}"`].join("\n"),
  };
}

const OMP_NOTE =
  "OMP has no backend of its own to hard-code the way the rest of this " +
  "catalogue does. It can point at Ollama, LM Studio, llama.cpp, LiteLLM, or " +
  "any other server that speaks one of the wire formats offered here, so " +
  "every OMP setup goes through the base URL and wire format you chose.";

export const OMP: AgentEntry = {
  id: "omp",
  label: "OMP (Oh My Pi)",
  // Every setup for OMP goes through the custom-base-url questions — see
  // AgentEntry.alwaysCustom. The one provider below never reaches the
  // wizard; it exists purely to hold the bin and setup-file template that
  // resolveCustomTarget borrows from, the same way findCustomTemplate
  // borrows from a real provider for every other agent.
  alwaysCustom: true,
  providers: [
    {
      id: CUSTOM_ID,
      label: CUSTOM_LABEL,
      // Unused: OMP never reaches the normal (non-custom) resolution path
      // that would read this.
      upstreamHost: "",
      // Irrelevant here too — the resolved renderer always comes from the
      // student's answer, not from this template. See resolveCustomTarget.
      renderer: "raw",
      bin: "omp",
      setup: [ompModels("{baseUrl}")],
      notes: [OMP_NOTE],
    },
  ],
};
