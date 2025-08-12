import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    typecheck: false,
  },
});
