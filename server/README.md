# AetherPress Server

Backend service for AetherPress content generation and management.

## Overview

This server powers the backend for AetherPress, handling:

- Content and image generation (AI orchestrator)
- HTML preview and PDF export (via Puppeteer)
- API endpoints for prompt, preview, override, and export

## Image types & rasterization (note)

This server supports common web image formats used by the preview/export pipeline: PNG, JPEG, and SVG. For deterministic, CI-friendly PDF exports and to avoid subtle rendering differences between environments, follow these recommendations and runtime options.

Key behavior

- SVGs: By default SVG files are referenced directly in the HTML. When `EXPORT_RASTERIZE_SVG=1` the server will rasterize (or rewrite) SVGs to PNG data-URIs before sending HTML to Puppeteer. Rasterization reduces cross-environment rendering variance at the cost of raster image size.
- PNG/JPEG: These are used directly. Headless Chromium will embed raster images as PDF image XObjects during PDF generation.

Best practices for deterministic exports

- Bundle essential decorative assets with the server (preferred): place production assets in `server/public/` or `server/samples/images/` and reference them by absolute or root-relative paths. This avoids network flakiness and makes CI reproducible.
- Use hashed filenames or an asset manifest (eg. `assets-manifest.json`) so cached copies are invalidated predictably when assets change.
- Install required fonts locally and reference them via `@font-face` with local URLs (eg. `server/public/fonts/`). Ensure the same fonts are available in CI/devcontainers to avoid layout differences.
- For CI runs disable network asset fetching where possible. Use `ALLOW_REMOTE_ASSETS=false` (see env vars below) and pre-seed required images into `server/public/` before the job runs.

Runtime options (recommended env vars)

- `EXPORT_RASTERIZE_SVG` (0|1) — default `0`. If `1`, server will rasterize SVGs into PNG data-URIs for embedding.
- `EXPORT_RASTERIZE_SVG_MAX_DPI` — optional, sets rasterization DPI/scale when converting SVG → PNG.
- `ASSET_DIR` — default `server/public` — directory served by Express for static assets used during export.
- `ALLOW_REMOTE_ASSETS` (0|1) — default `1`. Set to `0` in CI to prevent fetching remote CDN assets.
- `CHROME_PATH` / `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` — used to control Chromium executable and downloads in CI/devcontainers.

Operational notes and tests

- Error handling: log and surface asset fetch failures during export (HTTP 4xx/5xx) so missing resources are visible in CI logs.
- Smoke tests: add CI job(s) that run an in-process export (see `server/scripts/run_export_test_inproc.js`) and validate the produced PDF header (`%PDF-`) and a small set of expected strings.
- PDF inspection: use `pdfimages`, `mutool`, or a full PDF parser to examine embedded images and validate expected pages/contents. Example: `pdfimages -list /tmp/output.pdf` to enumerate images.

Implementation suggestions

- Rasterization: use a robust image library (eg. `sharp`) for SVG → PNG conversions, or let Puppeteer render the SVG in a headless page and capture as PNG when complex CSS or external fonts are involved.
- Static serving: configure Express `express.static(ASSET_DIR)` with cache headers appropriate for your workflow (long cache for production-hashed assets, short/no-cache in CI/dev).
- CI: for reproducible CI runs, set `ALLOW_REMOTE_ASSETS=0`, mount or copy `server/public/` assets into the runner workspace before running the export smoke test, and set `CHROME_PATH` to the test Chrome binary.

Verification commands (examples)

- Extract images from PDF:
  ```bash
  pdfimages -list /tmp/your-export.pdf
  pdfimages /tmp/your-export.pdf /tmp/extracted-img
  ```
- Verify PDF magic header and simple text extract:
  ```bash
  head -c 4 /tmp/your-export.pdf  # should show %PDF
  node server/scripts/extract-pdf-text.js /tmp/your-export.pdf
  ```

These changes help ensure the preview/export pipeline behaves consistently across developer machines and CI. See the [project root README](../README.md) for overall architecture and development philosophy.

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

Running tests with JOBS\_\* environment variables

If you want to run the server test suite locally and control the SQLite-backed job queue behavior, set the following environment variables when running the tests. These are useful to isolate DB state or speed up recovery cycles in tests.

- `JOBS_DB` — Path to the SQLite jobs DB file used by `server/jobs.js`. Default: `data/jobs.db`.
- `JOBS_RECOVERY_INTERVAL_MS` — How often (ms) the server runs the recovery pass that calls `requeueStaleJobs`. Default: `300000` (5 minutes).
- `JOBS_STALE_MS` — How old a `processing` job must be (ms) to be considered stale and requeued. Default: `600000` (10 minutes).

Example (run all tests once with a temp jobs DB and speedy recovery):

```bash
# from repo root
mkdir -p /tmp/strawberry-test-jobs
JOBS_DB=/tmp/strawberry-test-jobs/jobs.db JOBS_RECOVERY_INTERVAL_MS=1000 JOBS_STALE_MS=5000 npm --prefix server run test:run
```

Notes:

- Setting `JOBS_DB` to a temp file isolates test runs from your local `data/jobs.db` and is recommended when running tests locally or in CI.
- Reducing `JOBS_RECOVERY_INTERVAL_MS` and `JOBS_STALE_MS` is useful for faster feedback while developing recovery logic; restore defaults for production-like runs.
- The server test harness starts the server programmatically (it will not bind to the network when running under `NODE_ENV=test`), so these env vars are picked up by the in-process server used by the tests.

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

## Worker CLI & Startup recovery smoke test

You can run a quick local smoke test that verifies the server's startup recovery pass will requeue stale `processing` jobs:

```bash
# from repo root
node server/scripts/smoke_startup_requeue.js
```

This script seeds a stale `processing` job into a temp `JOBS_DB`, starts the server programmatically in `NODE_ENV=test` with `SKIP_PUPPETEER=true`, and confirms the job is returned to `queued` state. Useful when validating the recovery behavior locally before opening a PR.

To run the worker CLI (polling worker) separately, use the provided CLI scripts (if available) or run the worker via Node in a separate process with `JOBS_DB` pointing to your jobs DB file. Example:

```bash
# start worker (example CLI if present)
node server/worker-sqlite.mjs --jobs-db /tmp/jobs.db
```

## Job metrics & log rotation

A lightweight metrics endpoint is available to inspect job queue counts:

```bash
# GET /api/jobs/metrics
curl http://localhost:3000/api/jobs/metrics
```

This returns JSON with counts for `queued`, `processing`, `done`, and `failed`.

A simple log rotation helper is provided at `scripts/logrotate.sh`. Run it periodically (cron or CI cleanup) to keep `server/logs/` bounded.

### Job queue metrics endpoint

There is a simple metrics endpoint that returns counts of queued/processing/done jobs:

```bash
# GET /api/export/jobs/metrics
curl http://localhost:3000/api/export/jobs/metrics
# response: { "queued": 1, "processing": 0, "done": 3 }
```

This prefers the SQLite jobs DB (when `JOBS_DB` is set and opened) and falls back to the in-memory job map when the DB is not available.

### Log rotation helper

A small rotation script is available at `scripts/logrotate.sh` which keeps the most recent N log files and removes older files. Example:

```bash
# keep last 10 files, remove older than 30 days
bash scripts/logrotate.sh server/logs 10 30
```

Notes:

- The extraction script `server/scripts/extract-pdf-text.js` uses a lightweight PDF parser to extract text for assertions.
- The Vitest export test runs the server programmatically (does not bind to a network port) and closes the Puppeteer browser on teardown.

## CI/CD Workflows

For a detailed summary and assessment of the GitHub Actions workflows used in this project, please see the `WORKFLOWS.md` document located in the `.github/workflows/` directory of the root of this repository.
