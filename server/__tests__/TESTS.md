# Test Documentation (Consolidated)

This document consolidates all tests found under `server/__tests__`.

**Note:** This is a living document and must reflect the current state of tests. Please update as new tests are added or existing ones are modified. (Last updated: October 23, 2025)

## Table of Contents

- Core Business Logic Tests (5 tests)
- Service Integration Tests (4 tests)
- Image Generation Tests (3 tests)
- Export and PDF Tests (6 tests)
- E2E Tests (1 test)

---

## Core Business Logic Tests

### Prompt API (`prompt.test.js`)

Purpose: Validate prompt CRUD + validation + state management.

Highlights:

- Tests create/read/update/delete prompts
- Validates input validation and error states
- Ensures cleanup restores DB state

Dependencies: `vitest`, `supertest`.

Run:

```
cd server
npm run test:run -- prompt.test.js
```

---

### Core Flow (`coreFlow.integration.test.js`)

Purpose: End-to-end flow testing prompt -> preview -> export pipeline.

Highlights:

- Validates complete user interaction flow

Dependencies: `vitest`, `supertest`.

Run:

```
cd server
npm run test:run -- coreFlow.integration.test.js
```

---

### Preview Generation (`preview.test.js`)

Purpose: Tests preview generation endpoints and validates HTML rendering for various content types.

Run:

```
cd server
npm run test:run -- preview.test.js
```

---

### Jobs Management (`jobs.test.mjs`)

Purpose: Tests job queue operations and validates job state transitions.

Run:

```
cd server
npx vitest run __tests__/jobs.test.mjs --run
```

---

### Worker Processing (`worker.test.mjs`)

Purpose: Tests SQLite worker job processing and validates job finalization and error handling.

Run:

```
cd server
npx vitest run __tests__/worker.test.mjs --run
```

---

## Service Integration Tests

### AI Service (`aiService.test.js`)

Purpose: Validate the AI service abstraction (`MockAIService`) behavior and integration with prompt/AI result storage.

Highlights:

- Validates structured AI response (content + metadata)
- Tests error cases (empty/invalid prompts)
- Verifies DB storage of prompt/result pairs

Run:

```
cd server
npm run test:run -- aiService.test.js
```

---

### Genie Service (`genieService.persistence.dedupe.test.mjs`)

Purpose: Tests deduplication in the persistence layer and validates caching and response consistency.

Run:

```
cd server
npx vitest run __tests__/genieService.persistence.dedupe.test.mjs --run
```

---

### Service Lifecycle (`closeServices.test.js`)

Purpose: Tests graceful shutdown of service components and validates resource cleanup.

Run:

```
cd server
npm run test:run -- closeServices.test.js
```

---

### Job Requeuing (`jobs.requeue.test.mjs`)

Purpose: Tests job requeuing on service startup and validates stale job handling.

Run:

```
cd server
npx vitest run __tests__/jobs.requeue.test.mjs --run
```

---

## Image Generation Tests

### Core Image Generation (`imageGenerator.test.mjs`)

Purpose: Tests offline image generation capabilities and validates poem background creation.

Run:

```
cd server
npx vitest run __tests__/imageGenerator.test.mjs --run
```

---

### Gemini AI Integration (`imageGenerator.gemini.test.mjs`)

Purpose: Tests Gemini AI integration, validates fallback behavior, and verifies prompt generation.

Run:

```
cd server
npx vitest run __tests__/imageGenerator.gemini.test.mjs --run
```

---

### Image Validation (`imageValidation.test.mjs`)

Purpose: Validates image formats and constraints, and tests error handling for invalid inputs.

Run:

```
cd server
npx vitest run __tests__/imageValidation.test.mjs --run
```

---

## Export and PDF Tests

### Export Integration (`export.integration.test.js`)

Purpose: End-to-end verification of the `/export` endpoint using Puppeteer.

What it does:

- Starts the app programmatically (no network listen)
- Waits for `/health` to be `ok`
- Posts `{ title, body }` to `/export`
- Asserts a 200 response with `application/pdf` and a non-empty binary buffer

Dependencies: `vitest`, `supertest`, `puppeteer-core`, plus a system Chrome/Chromium or `CHROME_PATH` configured.

Run:

```
cd server
npm run test:run -- export.integration.test.js
```

CI note: The CI job must install a system Chrome/Chromium binary or set `CHROME_PATH`. See `.github/workflows/server-tests-pr.yml`.

---

### PDF Quality (`pdfQuality.integration.test.mjs`)

Purpose: Integration tests for PDF quality, validates content rendering, and tests PDF metadata and structure.

Run:

```
cd server
npx vitest run __tests__/pdfQuality.integration.test.mjs --run
```

---

### Export Handler (`export-handler.test.js`)

Purpose: Tests export endpoint request handling and validates error cases and edge conditions.

Run:

```
cd server
npm run test:run -- export-handler.test.js
```

---

### Export Text Verification (`export_text.test.mjs`)

Purpose: End-to-end verification of the `/api/export/book` endpoint that asserts:

- The response is a valid PDF (magic bytes `%PDF-`).
- The extracted PDF text contains expected poem titles (uses `server/scripts/extract-pdf-text.js`).

What it does:

- Starts the app programmatically (no network listen), ensuring DB and Puppeteer are initialized.
- Posts to `/api/export/book` and captures the binary response.
- Writes the buffer to a temp file and calls `server/scripts/extract-pdf-text.js` to extract text for assertions.

Run:

```
cd server
npx vitest run __tests__/export_text.test.mjs --run
```

Notes:

- This test uses a subprocess to run the extraction script to avoid importing `pdf-parse` directly inside the test process (some versions run debug code on import).
- For CI, see the `verify-export` script in `server/package.json` which runs the smoke export and extraction.

---

### PDF Generator (`pdfGenerator.test.mjs`)

Purpose: Unit tests for PDF generation utilities, testing formatting and layout options.

Run:

```
cd server
npx vitest run __tests__/pdfGenerator.test.mjs --run
```

---

### Puppeteer PDF Flow (`test-puppeteer-pdf.js`)

Purpose: Functional verification that a Puppeteer-driven PDF flow creates a file and returns a buffer.

Run:

```
cd server
npm run test:run -- test-puppeteer-pdf.js
```

CI note: Requires Chrome/Chromium.

---

## E2E Tests

### Summer Poems Flow (`e2e.summer-poems.test.mjs`)

Purpose: Full export flow with stubbed AI services, testing deterministic poem generation and export, and validating the complete user journey.

Run:

```
cd server
npx vitest run __tests__/e2e.summer-poems.test.mjs --run
```

---

```markdown
## General Notes

- Tests run under Vitest
- Use `npm test` for interactive watch mode
- Use `npm run test:run` for CI-friendly runs
- Integration and Puppeteer-based tests need Chrome/Chromium
- Some tests can be gated behind environment variables for CI optimization

---

Last updated: October 23, 2025
```
