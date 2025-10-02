import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        // Keep compatibility with Svelte 4-style component API (new App(...))
        compatibility: { componentApi: 4 },
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
});
