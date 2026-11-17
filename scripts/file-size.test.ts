import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  estimateTokens,
  isSourceFile,
  MAX_TOKENS,
  OVER_BUDGET,
} from "./file-size.ts";

function filesOverBudget() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(isSourceFile)
    .filter((path) => estimateTokens(readFileSync(path, "utf8")) > MAX_TOKENS)
    .sort();
}

describe(`source files stay under ${MAX_TOKENS} tokens`, () => {
  it("adds no new file over the budget", () => {
    const newOffenders = filesOverBudget().filter(
      (path) => !OVER_BUDGET.includes(path)
    );
    expect(newOffenders).toEqual([]);
  });

  it("drops a file from the allowlist once it fits", () => {
    const overBudget = filesOverBudget();
    const fixed = OVER_BUDGET.filter((path) => !overBudget.includes(path));
    expect(fixed).toEqual([]);
  });
});
