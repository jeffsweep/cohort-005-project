import { execFileSync } from "node:child_process";
import { estimateTokens, isSourceFile, MAX_TOKENS } from "./file-size.ts";

// Pre-commit check: reads the staged contents, not the working tree, so what
// is checked is what gets committed.

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26 });
}

const offenders = git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
  .split("\n")
  .filter(isSourceFile)
  .map((path) => ({ path, tokens: estimateTokens(git("show", `:${path}`)) }))
  .filter(({ tokens }) => tokens > MAX_TOKENS);

if (offenders.length > 0) {
  console.error(`Over the ${MAX_TOKENS}-token budget (characters / 4):`);
  for (const { path, tokens } of offenders) {
    console.error(`  ${path}: ~${tokens} tokens`);
  }
  console.error(`
Split each file by responsibility, so every piece has one reason to change:
  - React components  -> app/components/<area>/
  - Data access        -> app/lib/<name>.server.ts, or inside a module's lib/
  - Tests              -> split to mirror the source files
Aim for ~${MAX_TOKENS * 0.9} tokens so small edits do not tip it back over.`);
  process.exit(1);
}
