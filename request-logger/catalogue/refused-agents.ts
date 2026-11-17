import type { AgentEntry } from "./entry";

export const CURSOR: AgentEntry = {
  id: "cursor",
  label: "Cursor CLI",
  reason:
    "Cursor builds its system prompt on its own servers. The request that " +
    "leaves your machine holds your message and very little else, so there is " +
    "no system prompt and no tool list for this tool to show you. No proxy can " +
    "read what your machine never sends. Search the whole shipped Cursor " +
    "bundle and you will find no system prompt text and no tool schemas.",
};

export const AMP: AgentEntry = {
  id: "amp",
  label: "Amp",
  reason:
    "Amp builds its system prompt on its own servers, the same as Cursor. " +
    "Amp does have a URL setting, but it points at Amp's own server, not at " +
    "the model endpoint, so it cannot help you here.",
};
