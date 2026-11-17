// Big files are hard for people and agents to hold in their head. Tokens are
// estimated as characters / 4, which is close enough for a budget.

export const MAX_TOKENS = 5000;

const SOURCE_FILE = /\.(ts|tsx|js|jsx|cjs|mjs)$/;

export function isSourceFile(path: string) {
  return SOURCE_FILE.test(path);
}

export function estimateTokens(contents: string) {
  return Math.ceil(contents.length / 4);
}
