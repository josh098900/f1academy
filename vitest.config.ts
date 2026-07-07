import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Pure-logic tests (scoring, team rules, parsers) run in the default node
// environment for speed. Component tests opt into jsdom per-file with a
// `// @vitest-environment jsdom` docblock. tsconfigPaths resolves the `@/`
// alias so component tests can import app modules the way the app does.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    setupFiles: ["tests/setup.ts"],
  },
});
