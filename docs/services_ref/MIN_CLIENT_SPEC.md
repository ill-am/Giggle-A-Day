# MIN_CLIENT_SPEC — Minimal Client Specification
[WED 17th Sep 2025 @ 5:15PM]

Purpose

This document records a minimal, robust client setup to validate the core flow:

- User enters a prompt in the UI
- Client sends the prompt to the backend
- Backend writes `./samples/latest_prompt.txt` and returns previewable content or an endpoint to fetch the preview
- Client displays preview HTML in the preview pane

Keep the client intentionally minimal to eliminate HMR/global-singleton/dev-instrumentation complexity. Once the basic flow is validated, reintroduce features incrementally.

Scope (what is included)

- Minimal store exports (single Svelte `writable` instances)
- Straightforward network calls (`fetch`) with simple timeout and error handling
- UI updates content and preview synchronously (no background persistence during the smoke test)
- Local fallback preview built from `content.title` and `content.body` if server preview fails

Out of scope (for this phase)

- Complex retry/backoff strategies
- AbortController cancellation races (keep no cancellation for initial run)
- Heavy dev instrumentation and global window singletons
- Background persistence flows and non-blocking saves

Network contracts (explicit)

- Prompt submission
  - Request: `POST /prompt`
    - Body: `{ "prompt": "..." }`
  - Response: should return an object containing `content` or `data.content` where `content` is an object containing at minimum `{ title, body }`.

- Preview fetch
  - Either:
    - `GET /preview?content=<encoded JSON string>` — returns `text/html` body, or
    - `GET /preview?promptId=<id>` — returns `text/html` body
  - Fallback (server): `POST /api/preview` returns `{ preview: "<html>..." }`

Client responsibilities

- Validate response shape and render the returned HTML into the preview pane element with `data-testid="preview-content"` using Svelte's `{@html ...}`.
- If fetching the preview fails (network error or non-200), the client must render a safe local preview built from `content.title` and `content.body`.
- Keep the UI visible and informative: show "loading" state while waiting for preview and clear messages on success or failure.

Minimal store design

- `client/src/stores/index.js` (minimal exports):
  - `export const promptStore = writable('');`
  - `export const contentStore = writable(null);` // { title, body, promptId? }
  - `export const previewStore = writable('');` // HTML string
  - `export const uiStateStore = writable({ status: 'idle', message: '' });`
- No window globals or HMR-specific merging for the smoke test.

Minimal preview flow (sequence)

1. User triggers generation (click "Generate" or "Preview Now").
2. Client calls `POST /prompt` with `{ prompt }`.
3. On success: normalize response -> `const content = response.content || (response.data && response.data.content)`; call `contentStore.set(content)`.
4. Call `loadPreview(content)` which does a simple `fetch('/preview?content=' + encodeURIComponent(JSON.stringify({title,body,layout})))` and returns the HTML text.
5. On success: `previewStore.set(html)`; on failure: `previewStore.set(buildLocalPreviewHtml(content))`.
6. Preview component subscribes to `$previewStore` and renders `{@html $previewStore}` into `[data-testid="preview-content"]`.

Files to check / simplify

- `client/src/stores/index.js` — simplify to minimal exports described above.
- `client/src/lib/api.js` — provide a simplified `submitPrompt` and `loadPreview` that use direct `fetch` (no retry wrapper) for the smoke test; or add a toggle to bypass retries.
- `client/src/lib/flows.js` — implement simple sequential `generateAndPreview(prompt)` that calls `submitPrompt`, sets content, then fetches preview and sets preview store; remove or disable AbortController logic for this phase.
- `client/src/components/PreviewWindow.svelte` — ensure it subscribes to `$previewStore` and immediately renders `{@html $previewStore}`; keep the existing `Force local preview` button for debugging.
- `client/src/main.js` — avoid exposing `window.__STORES` unless specifically required.

Checkable actionables (concrete tasks)

1. Create minimal store file
   - Task: Replace current `client/src/stores/index.js` behavior with a minimal file that exports the 4 simple stores above.
   - Acceptance: In the running app, `import { previewStore } from '../stores'` returns a writable that, when `.set('<p>abc</p>')` is called from the console, updates the preview element.

2. Simplify `submitPrompt` and `loadPreview`
   - Task: Add or enable a simplified path in `client/src/lib/api.js` to use direct `fetch` for `/prompt` and `/preview` for the smoke test.
   - Acceptance: `POST /prompt` called from the UI results in backend writing `samples/latest_prompt.txt` and response content has title and body; `GET /preview?content=...` returns HTML that is rendered into preview pane.

3. Simplify `generateAndPreview` flow
   - Task: Ensure `client/src/lib/flows.js` uses the simplified API helpers and sequentially calls submit -> set content -> fetch preview -> set preview. Remove AbortController logic for the first iteration.
   - Acceptance: Clicking generate shows loading, then preview area renders HTML or local fallback within a few seconds and no AbortError logs appear.

4. Verify UI and manual smoke tests
   - Task: Run the manual smoke steps (hard refresh, enter prompt, click generate, observe preview HTML and `samples/latest_prompt.txt`).
   - Acceptance: All steps succeed consistently across two successive tries.

5. Add a single minimal integration test (optional but recommended)
   - Task: Add a vitest test that imports the minimal stores, mocks fetch, sets content and asserts previewStore contains expected HTML after `generateAndPreview` runs.
   - Acceptance: Test passes in CI/dev environment.

Validation / Manual smoke-test checklist

- [ ] Hard-refresh the running client (Ctrl+F5 to ensure no stale HMR modules remain).
- [ ] Open DevTools console and run:
  - `document.querySelector('[data-testid="preview-content"]')` -> element exists
  - `window.previewStore && typeof window.previewStore.set` (if you expose for manual testing) or use the UI force preview button
- [ ] Enter a simple prompt and click generate. Observe:
  - Backend writes `/samples/latest_prompt.txt`
  - Preview pane displays the returned HTML (or a fallback local preview) within ~5s
  - No AbortError entries in console
  - No infinite console logs

Rollback plan

- If anything fails, revert the minimal changes and re-introduce a single prior change at a time (stores only, then API/simple flows, then preview component).

Gradual reintroduction plan (after the minimal flow works)

1. Add back safe retries: small retry wrapper around fetch (maxRetries: 2, idempotent GET only by default).
2. Add AbortController with robust per-request scoping and tests for overlapping requests (ensure most-recent request wins).
3. Add background persistence flow, non-blocking; ensure persisted `promptId` is used to refresh preview once available.
4. Reintroduce HMR-safe singleton merging only if required; prefer canonical import paths and avoid heavy global mutation.
5. Reintroduce dev instrumentation guarded by an explicit debug flag and rate-limited logging.

Risks and mitigations

- Risk: HMR causing duplicate modules. Mitigation: canonical imports and avoid window globals in production; only enable global merging if absolutely required.
- Risk: Long server response or network glitches. Mitigation: simple timeout fallback and local fallback preview UI.

Estimate

- Documenting + wiring the minimal client changes: ~1–2 hours (implementation + manual smoke tests).
- Reintroducing features and tests: additional 2–4 hours depending on coverage required.

-----

End of MIN_CLIENT_SPEC
