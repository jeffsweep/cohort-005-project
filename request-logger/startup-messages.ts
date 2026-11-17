/**
 * startup-messages.ts — everything the tool prints once it knows what the
 * student chose: the banner for a target, or why there is none.
 */

import type {
  AgentRefusal,
  CustomTarget,
  ResolvedTarget,
  SetupRequest,
} from "./agent-types";
import { bold, dim, wrap } from "./terminal-text";

/** A field in the banner: a dim label, then the value it describes. */
function field(label: string, value: string): void {
  console.log(`  ${dim(label.padEnd(10))} ${value}`);
}

export function printBanner(
  target: ResolvedTarget | CustomTarget,
  port: number,
  logDir: string
): void {
  const rule = dim("-".repeat(72));
  const forwards =
    target.kind === "target"
      ? `https://${target.upstreamHost}`
      : target.upstreamBaseUrl;
  console.log("");
  console.log(rule);
  field("Agent", bold(`${target.agentLabel} (${target.providerLabel})`));
  field("Listening", `http://localhost:${port}`);
  field("Forwards", forwards);
  field("Logs", dim(logDir));
  console.log(rule);

  for (const file of target.setup) {
    console.log("");
    console.log(`  Put this in ${bold(file.path)}:`);
    console.log("");
    for (const line of file.body.split("\n")) {
      console.log(dim(`      ${line}`));
    }
  }

  console.log("");
  console.log(
    target.setup.length > 0
      ? "  Then run your agent in another terminal with:"
      : "  Run your agent in another terminal with:"
  );
  console.log("");
  console.log(`      ${bold(target.command)}`);
  console.log("");

  for (const note of target.notes) printWrapped("Note", note);
  for (const warning of target.warnings) printWrapped("Warning", warning);

  console.log(
    dim("  Using a different agent now? Run: npm run request-logger -- --force")
  );
  // The tool waits on a port, so nothing tells the student it is finished.
  // Say how to stop it here, where they are already reading.
  // The styles are not nested. Both dim and bold close with the same code, so
  // a bold word inside a dim string ends the dim early.
  console.log(dim("  Press ") + bold("Ctrl+C") + dim(" to stop logging."));
  console.log(rule);
  console.log("");
}

export function printSetupRequest(resolution: SetupRequest): void {
  const rule = dim("-".repeat(72));
  const what = resolution.agentLabel
    ? `${resolution.agentLabel} in that setup is`
    : "Your agent is";
  console.log("");
  console.log(rule);
  console.log(`  ${bold(`${what} not in this list yet.`)}`);
  console.log(rule);
  console.log("");
  for (const line of wrap(
    "This list holds the setups that have been tested. Yours can be added. " +
      "Each one needs three facts: the host your agent talks to, the wire " +
      "format it uses, and the command that points it at this tool.",
    68
  )) {
    console.log(`  ${line}`);
  }
  console.log("");
  console.log("  Ask for it here, and say which agent you use:");
  console.log("");
  console.log(`      ${bold(resolution.url)}`);
  console.log("");
}

export function printRefusal(resolution: AgentRefusal): void {
  const rule = dim("-".repeat(72));
  console.log("");
  console.log(rule);
  console.log(
    `  ${bold(resolution.agentLabel)} cannot be logged by this tool.`
  );
  console.log(rule);
  console.log("");
  for (const line of wrap(resolution.reason, 68)) console.log(`  ${line}`);
  console.log("");
  console.log(
    dim("  This is worth knowing on its own: some tools send the system")
  );
  console.log(
    dim("  prompt from your machine, and some build it on their servers.")
  );
  console.log(dim("  Only the first kind can ever be inspected."));
  console.log("");
  console.log(
    "  To follow the lesson, install one of the other agents, then run:"
  );
  console.log("");
  console.log(`      ${bold("npm run request-logger")}`);
  console.log("");
}

/** Print a labelled paragraph, indented and wrapped. */
function printWrapped(label: string, text: string): void {
  const lines = wrap(text, 66);
  console.log(`  ${bold(`${label}:`)} ${lines[0] ?? ""}`);
  for (const line of lines.slice(1)) console.log(`        ${line}`);
  console.log("");
}
