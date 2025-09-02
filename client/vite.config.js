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
      "/prompt": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        // Attach proxy event hooks to surface backend errors as clearer 502 responses
        configure(proxy, options) {
          // Inject DEV_AUTH_TOKEN into proxied requests when present (dev-only)
          proxy.on("proxyReq", (proxyReq, req, res) => {
            try {
              if (process.env.DEV_AUTH_TOKEN) {
                proxyReq.setHeader("x-dev-auth", process.env.DEV_AUTH_TOKEN);
              }
            } catch (e) {}
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
            // Forward short backend error header to the client if present
            const backendError = proxyRes.headers["x-backend-error"];
            const requestId = proxyRes.headers["x-request-id"];
            if (backendError) res.setHeader("X-Backend-Error", backendError);
            if (requestId) res.setHeader("X-Request-Id", requestId);
          });
          proxy.on("error", (err, req, res) => {
            // If the backend is down or there is a proxy error, respond with 502 and a short JSON
            try {
              if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    error: "Bad Gateway",
                    reason:
                      err && err.message ? String(err.message) : "proxy_error",
                  })
                );
              }
            } catch (e) {
              // swallow errors
            }
          });
        },
      },
      "/preview": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        configure(proxy) {
          // Inject DEV_AUTH_TOKEN into proxied requests when present (dev-only)
          proxy.on("proxyReq", (proxyReq, req, res) => {
            try {
              if (process.env.DEV_AUTH_TOKEN) {
                proxyReq.setHeader("x-dev-auth", process.env.DEV_AUTH_TOKEN);
              }
            } catch (e) {}
          });
          proxy.on("error", (err, req, res) => {
            try {
              if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    error: "Bad Gateway",
                    reason:
                      err && err.message ? String(err.message) : "proxy_error",
                  })
                );
              }
            } catch (e) {}
          });
        },
      },
      "/override": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        configure(proxy) {
          // Inject DEV_AUTH_TOKEN into proxied requests when present (dev-only)
          proxy.on("proxyReq", (proxyReq, req, res) => {
            try {
              if (process.env.DEV_AUTH_TOKEN) {
                proxyReq.setHeader("x-dev-auth", process.env.DEV_AUTH_TOKEN);
              }
            } catch (e) {}
          });
          proxy.on("error", (err, req, res) => {
            try {
              if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    error: "Bad Gateway",
                    reason:
                      err && err.message ? String(err.message) : "proxy_error",
                  })
                );
              }
            } catch (e) {}
          });
        },
      },
      "/export": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        configure(proxy) {
          // Inject DEV_AUTH_TOKEN into proxied requests when present (dev-only)
          proxy.on("proxyReq", (proxyReq, req, res) => {
            try {
              if (process.env.DEV_AUTH_TOKEN) {
                proxyReq.setHeader("x-dev-auth", process.env.DEV_AUTH_TOKEN);
              }
            } catch (e) {}
          });
          proxy.on("error", (err, req, res) => {
            try {
              if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    error: "Bad Gateway",
                    reason:
                      err && err.message ? String(err.message) : "proxy_error",
                  })
                );
              }
            } catch (e) {}
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
