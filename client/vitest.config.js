import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  // Keep test discovery local to the client package and ensure setupFiles
  // and aliases resolve relative to the client root.
  root: path.resolve(__dirname),
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    typecheck: false,
    exclude: ["**/node_modules/**", "**/dist/**", "../**"],
  },
});
