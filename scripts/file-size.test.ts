import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { estimateTokens, isSourceFile, MAX_TOKENS } from "./file-size.ts";

it(`keeps every source file under ${MAX_TOKENS} tokens`, () => {
  const overBudget = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(isSourceFile)
    .filter((path) => estimateTokens(readFileSync(path, "utf8")) > MAX_TOKENS)
    .sort();
  expect(overBudget).toEqual([]);
});
