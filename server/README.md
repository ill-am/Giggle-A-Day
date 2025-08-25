# AetherPress Server

Backend service for AetherPress content generation and management.

## Overview

This server powers the backend for AetherPress, handling:

- Content and image generation (AI orchestrator)
- HTML preview and PDF export (via Puppeteer)
- API endpoints for prompt, preview, override, and export

See the [project root README](../README.md) for full architecture, development philosophy, and project structure.

## Development

The `scripts/` directory contains utility scripts for development, testing, and health checks:

- `health-checks.js`: Server-side health monitoring (Puppeteer, preview endpoint)
- `clean_samples.js`: Maintenance of sample outputs
- `run_export_test_inproc.js`: In-process export testing
- `run_smoke_export.sh`: Smoke tests for export functionality
- `run_export_test_inproc.js`: In-process export testing (starts the server programmatically and writes outputs to a unique temp directory)
- `smoke-export.sh`: Smoke tests for export functionality (resolves sample JSON relative to script and validates PDF magic bytes)

Start the development server with auto-reload:

```bash
cd server
npm install
npm run dev
```

Start the production server:

```bash
cd server
npm start
```

## Testing

All commands must be run from within the `server/` directory. Each component (server, client) maintains its own independent `node_modules` and scripts.

Test commands:

- `npm test` - Interactive development with watch mode
- `npm run test:run` - Run all tests once and exit (CI/CD or quick checks)
- `npm run test:watch` - Explicit watch mode (same as test)
- `npm run test:ci` - CI/CD with coverage reports

Test coverage is tracked in `docs/ISSUES.md`.

## API Endpoints (Core Loop)

1. **POST /prompt** — Accepts a `prompt` and returns generated content
2. **GET /preview** — Returns an HTML preview for given content
3. **POST /override** — Accepts `content` and `override`, returns updated content
4. **GET /export** — Returns a PDF file for given content

Text → Imagery → Image workflow (Gemini + Cloudflare)

This repository uses a stable, multi-step pipeline in practice:

- Gemini (TEXT) — generates poems and converts poems into detailed image prompts.
- Cloudflare Workers AI — generates the actual image bytes (PNG) from the visual prompt. The Cloudflare model is the primary image producer in the current wiring.
- Gemini (VISION) — optional verification step: post the generated image bytes inline (Base64) along with a verification prompt to assess fidelity.

Recommended env vars:

- `GEMINI_API_URL` / `GEMINI_API_KEY` — used for poem and prompt generation and for vision verification calls when configured.
- `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` — used to call Cloudflare Workers AI image models (produces PNG bytes).
- `GEMINI_VISION_MODEL` — optional; default `gemini-1.0-pro-vision` is a good choice for verification tasks.

Process summary (what the code does now):

1. Use the Gemini TEXT endpoint to create the poem and to produce a detailed visual prompt.
2. Send the visual prompt to Cloudflare Workers AI (configured via `CLOUDFLARE_*`) and save the returned PNG bytes to `server/samples/images/`.
3. Optionally, the verifier reads the image bytes, encodes them as Base64 and posts them to the Gemini VISION endpoint along with a short verification prompt to check whether the image matches the original prompt.

Base64 verification example

When calling Gemini VISION you must embed the image data inline as Base64 (the API will not accept a filename). See `docs/IMG_GEN_API.md` for a copy-pasteable example that:

- base64-encodes your image with `base64 -w 0` (Linux) or default macOS `base64`,
- constructs a JSON payload with an `inline_data` image part, and
- posts it to the configured Gemini vision endpoint.

Development notes

If you want me to enable direct Gemini image emission (instead of Cloudflare), I can re-arrange the provider selection logic so Gemini's image model is primary — but for stability and reproducible results the current wiring uses Cloudflare for image bytes and Gemini for text and vision checks.

About the `undici` warning in your editor

- If you see a TypeScript/IDE warning like `Cannot find module 'undici' or its corresponding type declarations.`, it means the code references `undici` as a runtime fallback for `fetch` but the package is not installed. Options:
  - Install `undici` in the `server` package (`npm --prefix server install undici`) to remove the warning and provide a stable `fetch` on Node < 18.
  - Or run on Node 18+ where global `fetch` exists and the fallback won't be used. The code already tries `globalThis.fetch` first.

If you'd like, I can add `undici` to `server/package.json` and update `.env.example` with the new env var names.

## PDF Export Note

**Important:**

When sending binary data (like PDFs) from Express, use `res.end(pdf)` instead of `res.send(pdf)` to avoid file corruption. See [`docs/archive/ISSUES_recommend.md`](../docs/archive/ISSUES_recommend.md) for the full debugging history and resolution.

---

## Puppeteer smoke test

From within the `server/` directory you can run a small Puppeteer smoke test which uses the Chrome binary provided by the devcontainer or system `CHROME_PATH`.

1. Ensure server deps are installed in `server/node_modules`:

```bash
cd server
npm ci
```

2. Run the smoke test (this resolves `puppeteer-core` from `server/node_modules` and uses the top-level smoke script):

```bash
# If you have a running server, run the networked smoke script:
npm run smoke:export
```

The script by default writes to a unique temp location and now validates the saved file is a PDF by checking the `%PDF-` magic header. If Chrome is not found, set `CHROME_PATH` to the system binary before running.

Note: the repository includes a lightweight headless e2e smoke script at `server/scripts/e2e-smoke.js` which exercises the client UI and falls back to the server API when the UI path is flaky. The script avoids static imports of client modules (it dynamically imports `/src/stores` at runtime in the browser context) and uses attribute checks to be compatible with headless browsers and static type-checkers.

You can run the networked e2e smoke from the repo root (requires client dev server at :5173 and server at :3000):

```bash
# from repo root
npm --prefix server run e2e:smoke
```

## How you can run these locally (verification)

From the repo root you can run a full smoke + verification flow which:

- posts the sample poems to the server export endpoint
- saves the returned PDF to `samples/ebook.pdf`
- extracts text from the PDF to assert expected content

1. Ensure server dependencies are installed and the server is running (or let the test start the server programmatically):

```bash
cd server
npm install
npm run dev    # or run the tests which start the server in-process
```

2. Run the smoke export and extraction verification (writes PDF and prints extracted text). Note: `verify-export` expects a running server at `http://localhost:3000` unless you use the in-process helper below.

```bash
cd /workspaces/vanilla
npm --prefix server run verify-export
```

3. Alternatively, run the in-process verification helper which starts the server programmatically and writes outputs to a unique temp directory (preferred for CI without managing separate server process):

```bash
node server/scripts/run_export_test_inproc.js
```

Run the automated export test (Vitest) which asserts the PDF magic bytes and that the extracted text contains a sample poem title:

```bash
npx vitest run server/__tests__/export_text.test.mjs --run
# or
npm --prefix server run test:export
```

CI and local artifact handling

- The `server` scripts may write artifacts to `server/test-artifacts/` for debugging in CI runs. These directories are ignored locally to avoid accidentally committing temporary outputs. To reproduce artifacts locally run the in-process helper or smoke scripts which will write to a temp dir and (optionally) copy to `server/test-artifacts/` for inspection.

Runtime logs and artifact locations

- Server runtime logs are written to `server/logs/` by the application. This directory is ignored by `server/.gitignore` and should not be committed.
- CI workflows copy runner-produced artifacts (PDFs, HTML snapshots, debug outputs) into `server/test-artifacts/` for upload. Locally, the scripts write to a temporary directory by default and only copy into `server/test-artifacts/` when `CI` or `GITHUB_ACTIONS` environment is set.

```bash
# run in-process export test which writes artifacts to a temp dir (and may copy to server/test-artifacts)
node server/scripts/run_export_test_inproc.js

# run smoke export (networked)
bash server/scripts/smoke-export.sh
```

Notes:

- The extraction script `server/scripts/extract-pdf-text.js` uses a lightweight PDF parser to extract text for assertions.
- The Vitest export test runs the server programmatically (does not bind to a network port) and closes the Puppeteer browser on teardown.

## CI/CD Workflows

For a detailed summary and assessment of the GitHub Actions workflows used in this project, please see the `WORKFLOWS.md` document located in the `.github/workflows/` directory of the root of this repository.
