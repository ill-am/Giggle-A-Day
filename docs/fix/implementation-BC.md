# Implementation Tracker: AE-devolve/01-skip-puppeteer-temp-BC

Purpose: track the initial, low-risk steps for branch `AE-devolve/01-skip-puppeteer-temp-BC` focused on implementing the preview-persist fix.

Started: basic docs and task breakdown.

Completed implementation notes (AE-devolve/01-skip-puppeteer-temp-BC)

Summary of changes applied

- persistContent (client/src/stores/index.js):

  - Accepts an optional `api` object for DI (so unit tests can inject mocks).
  - Lazily imports the real `../lib/api` when no `api` is provided (avoids test-time module load failures).
  - Normalizes server responses (unwraps common envelopes, maps `id` → `promptId` while preserving `id`).
  - Uses an atomic `contentStore.update(curr => ({ ...curr, ...normalized }))` to merge persisted fields — avoids destructive overwrites and get()+set() races.

- Preview flow (client/src/lib/flows.js):

  - `generateAndPreview` writes generated content into `contentStore` immediately, starts background persistence (non-await), then calls `previewFromContent(content)` to fetch and set `previewStore` right away.

- PreviewWindow (client/src/components/PreviewWindow.svelte):

  - Converted to consumer-only: it no longer fetches previews itself. It subscribes to `previewStore` and `uiStateStore` and renders whatever HTML is present.
  - Provides a dev-only `forceLocalPreview` fallback that sets `previewStore` from local content for debugging/tests.

- Tests added/updated:
  - Updated `client/__tests__/persistContent.spec.js` (unit tests) to assert atomic merge behavior (create and update paths).
  - Added `client/__tests__/generate-preview.integration.test.js` — focused integration test that stubs generation, preview, and save endpoints and asserts that preview updates automatically without user action and that `promptId` is merged later by background persist.

Test results

- Ran client test suite (Vitest). All client tests passed locally (28 tests across unit and integration files). Logs show generate -> preview -> background persist sequence and the expected store merges.

Rationale and notes

- This change set focuses on the two critical fixes: (1) prevent persistence from clobbering generated content, and (2) make preview rendering canonical and immediate. Making `PreviewWindow` display-only prevents competing preview fetchers and simplifies the contract: flows write to `previewStore`, components render it.
- The DI seam for `persistContent` improves test determinism and avoids brittle module-level mocking.
- I preserved shallow-merge semantics for now; if nested object merges become required, we should add targeted deep-merge behavior for specified keys only.

Files changed (high level)

- client/src/stores/index.js — persistContent refactor + DI + normalization + atomic merge
- client/src/lib/flows.js — confirmed generate flow triggers preview before await persist
- client/src/components/PreviewWindow.svelte — consumer-only render logic
- client/**tests**/persistContent.spec.js — unit tests (existing) updated/verified
- client/**tests**/generate-preview.integration.test.js — new focused integration test

Next steps (optional)

1. Add preview request de-duplication (in-flight map keyed by content hash) to avoid duplicate /preview calls and potential 429s.
2. Add observability (preview latency metrics, persist failure logs) and small non-blocking UI indicators for preview or persist issues.
3. Open PR for review and run CI; if you want I can prepare the PR and push the branch.

Tracker status: Implementation complete for the immediate fix and tests; ready to commit & push.
