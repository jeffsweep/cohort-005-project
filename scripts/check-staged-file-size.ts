import { execFileSync } from "node:child_process";
import {
  estimateTokens,
  isSourceFile,
  MAX_TOKENS,
  OVER_BUDGET,
} from "./file-size.ts";

// Pre-commit check: reads the staged contents, not the working tree, so what
// is checked is what gets committed.

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26 });
}

const offenders = git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
  .split("\n")
  .filter((path) => isSourceFile(path) && !OVER_BUDGET.includes(path))
  .map((path) => ({ path, tokens: estimateTokens(git("show", `:${path}`)) }))
  .filter(({ tokens }) => tokens > MAX_TOKENS);

if (offenders.length > 0) {
  console.error(`Files over the ${MAX_TOKENS}-token budget (characters / 4):`);
  for (const { path, tokens } of offenders) {
    console.error(`  ${path}: ~${tokens} tokens`);
  }
  console.error("Split them before committing.");
  process.exit(1);
}
