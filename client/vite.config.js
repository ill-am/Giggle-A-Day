import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    strictPort: true, // Exit if port is in use
    hmr: {
      // Enable HMR for GitHub Codespaces
      clientPort: 443,
      protocol: "wss",
      host: process.env.CODESPACE_NAME
        ? `${process.env.CODESPACE_NAME}-5173.app.github.dev`
        : "localhost",
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log(
              "Received Response from the Target:",
              proxyRes.statusCode,
              req.url
            );
          });
        },
      },
    },
    fs: {
      strict: true,
      allow: [".."], // Allow serving files from one level up
    },
    headers: {
      // Ensure proper MIME types for Svelte files
      "*.svelte": {
        "Content-Type": "application/javascript",
      },
    },
  },
  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".svelte"],
  },
  optimizeDeps: {
    include: ["svelte"],
  },
});
