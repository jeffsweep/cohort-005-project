// Lints only the lines this branch adds, so older code is left alone.
// Usage: node scripts/lint-changed.mjs [base]   (default: $LINT_BASE or origin/bloated)
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { ESLint } from "eslint";
import * as prettier from "prettier";
import { readFile } from "node:fs/promises";

const base = process.argv[2] ?? process.env.LINT_BASE ?? "origin/bloated";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const linted = /^(app|scripts)\/.*\.(ts|tsx|js|mjs)$/;

const mergeBase = git("merge-base", "HEAD", base).trim();
const added = new Map();
const diff = git("diff", "-U0", mergeBase, "--", "app", "scripts");
const untracked = git(
  "ls-files",
  "--others",
  "--exclude-standard",
  "app",
  "scripts"
);

let file;
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ ")) {
    file = line.slice(4).replace(/^b\//, "");
    if (file === "/dev/null") file = undefined;
  }
  const hunk = /^@@ .* \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (file && hunk) {
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const lines = added.get(file) ?? new Set();
    for (let n = start; n < start + count; n++) lines.add(n);
    added.set(file, lines);
  }
}

for (const path of untracked.split("\n")) {
  if (path) added.set(path, "all");
}

const files = [...added.keys()].filter((f) => linted.test(f) && existsSync(f));
if (files.length === 0) {
  console.log(`lint: no changed files against ${base}`);
  process.exit(0);
}

let failed = false;

const results = await new ESLint().lintFiles(files);
for (const result of results) {
  const path = result.filePath.slice(process.cwd().length + 1);
  const lines = added.get(path);
  for (const m of result.messages) {
    if (lines !== "all" && !lines?.has(m.line)) continue;
    failed = true;
    console.log(`${path}:${m.line}:${m.column}  ${m.message}  (${m.ruleId})`);
  }
}

async function isFormatted(path, source) {
  const options = await prettier.resolveConfig(path);
  return prettier.check(source, { ...options, filepath: path });
}

function sourceAtBase(path) {
  try {
    return execFileSync("git", ["show", `${mergeBase}:${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

// A file that was already unformatted at the base is left as it was.
for (const path of files) {
  const before = sourceAtBase(path);
  const wasFormatted =
    before === undefined || (await isFormatted(path, before));
  const isNowFormatted = await isFormatted(path, await readFile(path, "utf8"));

  if (wasFormatted && !isNowFormatted) {
    failed = true;
    console.log(`${path}  not formatted: run npx prettier --write "${path}"`);
  }
}

if (failed) process.exit(1);
console.log(`lint: ${files.length} changed files clean against ${base}`);
