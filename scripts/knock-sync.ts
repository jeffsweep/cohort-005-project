import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NOTIFICATION_KINDS } from "../app/lib/notifications/catalogue";
import { generateWorkflows } from "../app/lib/notifications/workflows";

// `npm run knock:sync`: writes one workflow per Notification kind to
// knock/workflows/<key>/workflow.json (commit these), then pushes and commits
// them to Knock's Development environment with the Knock CLI.
//
// Only adds and updates. Neither the CLI nor the API can delete a workflow,
// so a kind dropped from the catalogue must be archived by hand in the
// Knock dashboard.

const WORKFLOWS_DIR = "knock/workflows";

for (const { key, workflow } of generateWorkflows(NOTIFICATION_KINDS)) {
  const directory = join(WORKFLOWS_DIR, key);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "workflow.json"),
    `${JSON.stringify(workflow, null, 2)}\n`
  );
  console.log(`Wrote ${join(directory, "workflow.json")}`);
}

if (!process.env.KNOCK_SERVICE_TOKEN && existsSync(".env")) {
  process.loadEnvFile(".env");
}
if (!process.env.KNOCK_SERVICE_TOKEN) {
  console.error(
    "KNOCK_SERVICE_TOKEN is not set, so nothing was pushed to Knock. " +
      "Add it to .env and run `npm run knock:sync` again."
  );
  process.exit(1);
}

// The CLI rewrites the files it pushes (it moves templates out to .md files
// and adds read-only fields), so push a copy and keep the committed files
// exactly as generated.
const pushDir = mkdtempSync(join(tmpdir(), "knock-workflows-"));
cpSync(WORKFLOWS_DIR, pushDir, { recursive: true });

const result = spawnSync(
  "knock",
  [
    "workflow",
    "push",
    "--all",
    "--workflows-dir",
    pushDir,
    "--environment",
    "development",
    "--commit",
    "--commit-message",
    "Sync workflows from the Cadence Notification catalogue",
  ],
  { stdio: "inherit", env: process.env }
);

rmSync(pushDir, { recursive: true, force: true });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
