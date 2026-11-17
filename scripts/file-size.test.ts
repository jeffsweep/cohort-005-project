import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Big files are hard for people and agents to hold in their head. Tokens are
// estimated as characters / 4, which is close enough for a budget.

const MAX_TOKENS = 5000;
const SOURCE_FILE = /\.(ts|tsx|js|jsx|cjs|mjs)$/;

// Files already over the budget when the cap landed. This list may only
// shrink: split a file below the cap, then delete its line here.
const OVER_BUDGET = [
  "app/lib/refunds.server.test.ts",
  "app/lib/refunds.server.ts",
  "app/modules/instructor-analytics/lib/instructor-analytics.ts",
  "app/modules/instructor-analytics/tests/instructor-analytics.test.ts",
  "app/routes/courses.$slug.lessons.$lessonId.tsx",
  "app/routes/courses.$slug.tsx",
  "app/routes/instructor.$courseId.lessons.$lessonId.quiz.tsx",
  "app/routes/instructor.$courseId.tsx",
  "app/routes/instructor.analytics.tsx",
  "request-logger/agents.test.ts",
  "request-logger/agents.ts",
  "request-logger/proxy.ts",
  "request-logger/render.ts",
  "scripts/seed.ts",
];

function estimateTokens(path: string) {
  return Math.ceil(readFileSync(path, "utf8").length / 4);
}

function filesOverBudget() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((path) => SOURCE_FILE.test(path))
    .filter((path) => estimateTokens(path) > MAX_TOKENS)
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
