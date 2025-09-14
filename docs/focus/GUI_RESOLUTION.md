# GUI Resolution — Actionable Checklist

This document converts analysis and the fix plan into a concrete, checkable list of tasks. Each item is small, timeboxed, and includes acceptance criteria.

Owner: @dev-team (or whoever picks the task)

## 1. Data Layer Migration (Phase 1 continuation) — 60m

- [ ] Replace SQLite CRUD usage in `server/crud.js` with Prisma Client calls.
  - Acceptance: `crud.createPrompt`, `crud.getPrompt`, `crud.saveResult` use Prisma and pass unit tests.
- [ ] Update `server/worker-sqlite.mjs` to use Prisma or create `worker-postgres.mjs` wrapper.
  - Acceptance: Worker can process at least one job end-to-end using PostgreSQL.
- [ ] Add transaction boundaries for multi-step operations where previously implicit.
  - Acceptance: Unit test demonstrates rollback on simulated failure.

## 2. Store & Handler Cleanup (Phase 2) — 45m

[ ] Update `client/src/stores/contentStore` to fetch/save via the API which persists to PostgreSQL.

- Acceptance: Setting `contentStore` triggers a POST to server endpoints which persist data.
- [x] Remove local preview shortcut from `PromptInput.svelte` (the code path that directly writes `previewStore`).
- Acceptance: `previewStore` is updated only by `PreviewWindow` via `loadPreview`.
- [x] Remove `handleGenerateClick` and typed-prompt dialog state from `PromptInput.svelte`.
- Acceptance: Only `handleGenerateNow` is used; UI retains expected behavior.

## 3. Preview Consolidation (Phase 3) — 30m

- [ ] Move all preview responsibilities to `PreviewWindow.svelte`.
  - Acceptance: `PromptInput` no longer touches `previewStore` or buildLocalPreviewHtml.
- [ ] Implement cancellation for in-flight `loadPreview` requests (AbortController or token).
  - Acceptance: Rapid successive prompts cancel previous requests and show latest preview.
- [ ] Ensure debouncing remains only in `PreviewWindow` and does not conflict with direct updates.
  - Acceptance: Auto-preview works; no double-render flashes in automated tests.

## 4. Status & UI Feedback (Phase 4) — 30m

- [ ] Centralize UI status changes into `uiStateStore` helpers (`setUiLoading`, `setUiSuccess`, `setUiError`).
  - Acceptance: All components use helpers; status messages show consistently and persist until state changes.
- [ ] Prevent animation stacking by disabling flash or queuing short-circuit flags.
  - Acceptance: Multiple rapid clicks produce a single flash cycle and clear status transitions.

## 5. Tests & Validation (Phase 5) — 45m

- [ ] Automated unit tests for store updates and preview rendering.
  - Acceptance: Tests cover happy-path and 2 failure modes (network error, db error).
- [ ] Manual smoke test: rapid-click sequence, offline DB, and preview/export flow.
  - Acceptance: No uncaught exceptions; UI shows correct status.

## 6. Docs & Hand-off — 15m

- [ ] Update `docs/focus/GUI_FIX_PLAN.md` and `GUI_UNRESPONSIVENESS.md` to link to this checklist and mark completed items.
  - Acceptance: Links present and checklist items are actionable.

Total focused dev time (estimate): 3 hours 45 minutes

Notes:

- If the project already requires multiple commits for the Prisma migration (it does), split PRs per area: DB migration, stores/handlers, preview refactor, UI feedback.
- Prioritize Phase 2 and 3 first to make the GUI responsive; database migration is critical but can be staged alongside these UI changes.
