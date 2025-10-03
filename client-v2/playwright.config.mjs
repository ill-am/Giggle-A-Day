import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.join(process.cwd(), "playwright"),
  outputDir: path.join(process.cwd(), "test-results", "playwright"),
  timeout: 30_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
