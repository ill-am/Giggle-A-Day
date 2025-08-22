import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Run Vitest with the server package as the root so tests here don't
  // accidentally pick up tests from sibling packages.
  root: path.resolve(__dirname),
  test: {
    // include JS and MJS test files so ESM tests like export_text.test.mjs are picked up
    include: ["__tests__/**/*.test.js", "__tests__/**/*.test.mjs"],
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "../**"],
  },
});
