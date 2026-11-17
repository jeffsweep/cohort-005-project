import type { AgentEntry } from "./entry";

export const COPILOT: AgentEntry = {
  id: "copilot",
  label: "GitHub Copilot CLI",
  providers: [
    {
      id: "github",
      label: "GitHub subscription",
      upstreamHost: "api.githubcopilot.com",
      renderer: "openai",
      env: [["COPILOT_API_URL", "{baseUrl}"]],
      bin: "copilot",
      notes: [
        "Copilot's built-in MCP servers add their tools to every request, and " +
          "they make calls of their own, so you get more documents than turns " +
          "you typed. That is what your agent really sends, so it is worth " +
          "reading once. If you want a smaller capture, add " +
          "--disable-builtin-mcps to the command.",
      ],
      warnings: [
        "Some models negotiate a WebSocket transport. This tool cannot see a " +
          "WebSocket, so those turns write no log at all. If your logs folder " +
          "stays empty, try a different model. gpt-5.1 used plain HTTP in testing.",
      ],
    },
  ],
};
