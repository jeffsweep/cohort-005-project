import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";
import tseslint from "typescript-eslint";

const multiline = [
  "multiline-const",
  "multiline-let",
  "multiline-expression",
  "multiline-block-like",
];

const noDividerComments = {
  meta: {
    type: "suggestion",
    messages: {
      divider: "Drop divider comments. Split the file or name things instead.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (/^\s*[-─=*]{3,}/.test(comment.value)) {
            context.report({ loc: comment.loc, messageId: "divider" });
          }
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      "build/",
      ".react-router/",
      "node_modules/",
      "request-logger/",
      ".claude/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@stylistic": stylistic,
      local: { rules: { "no-divider-comments": noDividerComments } },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-implicit-coercion": "error",
      "local/no-divider-comments": "error",
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: multiline, next: multiline },
      ],
    },
  },
  {
    files: ["scripts/**"],
    languageOptions: { globals: globals.node },
  }
);
