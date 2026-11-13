import { existsSync } from "node:fs";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Server code reads settings (Knock, Postmark) from process.env; fill it from
// .env when there is one. Variables already set in the shell win. Tests use
// vitest.config.ts, so they never see these keys.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
