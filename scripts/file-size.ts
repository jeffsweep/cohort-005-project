// Big files are hard for people and agents to hold in their head. Tokens are
// estimated as characters / 4, which is close enough for a budget.

export const MAX_TOKENS = 5000;

// Files already over the budget when the cap landed. This list may only
// shrink: split a file below the cap, then delete its line here.
export const OVER_BUDGET = [
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

const SOURCE_FILE = /\.(ts|tsx|js|jsx|cjs|mjs)$/;

export function isSourceFile(path: string) {
  return SOURCE_FILE.test(path);
}

export function estimateTokens(contents: string) {
  return Math.ceil(contents.length / 4);
}
