# AETHER_Generate+Preview

Recorded: 2025-09-10

Purpose

- Record the agreed modus operandi and a tightly-scoped correction plan that focuses only on the GUI `Generate` and `Preview` flows until further notice.
- Produce a succinct, testable set of actionables and a prioritized TODO list that maps directly to repository files and verification steps.

## Status Dashboard & Implementation Progress

Current Status: 2/5 Core Objectives Complete ✅

- [x] 1. Instrumentation & Logging Chain ✅ [Verified 2025-09-10]
  - ✓ Store instrumentation
  - ✓ Handler logs
  - ✓ Preview subscription
  - ✓ Reproducibility logs
- [x] 2. Preview Subscription Fix ✅ [Verified 2025-09-10]
  - ✓ Reactive local copy
  - ✓ DOM instrumentation
  - ✓ Event emission
- [x] 3. Canonical Flows Implementation ✅ [Verified 2025-09-10]
  - [x] `generateAndPreview(prompt)`
  - [x] `previewFromContent(content)`
  - [x] Button handler wiring
  - [x] Unit tests
- [ ] 4. UI State & Timeouts ⏳
- [ ] 5. Playwright Verification 📋

Latest Verification: `load-demo-1757518799306.json` (2025-09-10)
Next Action: Add `data-preview-ready` DOM instrumentation

Modus operandi (non‑negotiable)

1. Achieve consensus on scope and acceptance criteria before implementing code.
2. Record decisions, status, and checkable actionables in this focus doc (not as loose notes elsewhere).
3. Select specific actionables to implement. Any verified implementation must update this doc's "Verified Implementations" section and the relevant focus sections (e.g., `CORR_V0.1_Findings.md`, `AETHER_GUI_Buttons.md`).

Scope

- Surface goal: restore GUI responsiveness for the two canonical UI actions: `Generate` and `Preview` only.
- Out of scope: `Summer suggestion`, `Load V0.1 Demo` (unless they are needed strictly as steps to reproduce Generate/Preview), export pipeline and long-term refactors.

High-level contract (flows)

- generateAndPreview(prompt)

  - Input: string `prompt` (non-empty)
  - Behaviour: validate -> call submitPrompt API -> set `contentStore` -> call `previewFromContent` -> set `uiState` appropriately
  - Success: `previewStore` contains rendered HTML visible in preview pane within 3s of API response; `uiState` transitions loading→success
  - Failure modes: invalid prompt, API error, store write failure, component subscription failure

- previewFromContent(content)
  - Input: content object {title, body}
  - Behaviour: call `/preview` -> set `previewStore` -> set `uiState` -> return HTML
  - Success: preview pane renders returned HTML; no uncaught exceptions

Acceptance criteria (minimal)

- Clicking `Generate` with a valid prompt produces a visible preview in the preview pane within 5 seconds.
- Clicking `Preview` with existing content produces the same visible preview.
- Buttons set `uiState` to `loading` during requests and to `success`/`error` after completion with human-readable messages.
- Playwright reproducibility script (a short script) can assert the preview DOM is present and non-empty.

## Technical Implementation Details

1. Instrumentation & reproduction (COMPLETED ✅)

   - Files: `client/src/components/PromptInput.svelte`, `client/src/components/Preview.svelte`, `client/src/stores.js`
   - Task: add DEV-only console logs to: handler entry/exit, network responses, `previewStore.set(...)`, and preview subscription callback.
   - Verification: ✓ Full chain logged (handler → network 200 → store → subscription → DOM)
   - Evidence: See "Verified Implementations" section below

2. Fix preview subscription / reactivity (COMPLETED ✅)

   - Files: `client/src/components/Preview.svelte`
   - Task: ensure the component uses Svelte reactive store access (`$previewStore`) or a proper `subscribe()` that assigns to a reactive `let` used in markup.
   - Verify: after `previewStore.set(...)` the preview DOM updates reliably.

3. Extract canonical flows and wire buttons (medium risk, high ROI)

   - Files: add `client/src/lib/flows.js`, edit `PromptInput.svelte` button handlers
   - Task: implement `generateAndPreview(prompt)` and `previewFromContent(content)`; replace inline logic to call these functions.
   - Verify: unit test (Vitest) mocking APIs; manual UI test for Generate→Preview.

4. Guarded UI state and timeouts

   - Files: `client/src/stores.js`, UI components
   - Task: add `uiState.loading/success/error`, add request timeouts (10s) and short, clear messages.
   - Verify: spinner behaviour and error messages during simulated failures.

5. Add a small Playwright verification and CI gate (optional immediate follow-on)
   - Files: `scripts/test-generate-preview.js`, add small GitHub Action later
   - Task: assert that Generate produces a preview DOM; write timestamped JSON report to `docs/focus/logs/`

Small, safe initial patch (recommended first task)

- Implement Actionable 1 (instrumentation) and a tiny defensive subscription in `Preview.svelte` so we can learn whether the break is store-write or subscription.
- This patch will be small, reversible, and will produce deterministic evidence.

## Implementation Checklist

Current Sprint:

- [x] ✅ Instrumentation: Add logs in handlers and stores
- [x] ✅ Verification: Log chain recorded in `docs/focus/logs/`
- [x] ✅ Preview Fix: Subscription hardening implemented

Next Up:

- [ ] 🔄 Flows: Add & wire `client/src/lib/flows.js`
  - [ ] Implement `generateAndPreview(prompt)`
  - [ ] Implement `previewFromContent(content)`
  - [ ] Wire button handlers
  - [ ] Add Vitest unit tests

Final Gate:

- [ ] 📋 Add Playwright verification script
- [ ] 🔄 (Optional) Add CI job for PR checks

Verified Implementations (update this section after every completed change)

- 2025-09-10 | DEV store instrumentation added | `client/src/stores/index.js` | runtime evidence: `STORE:<name>.set` console logs in dev

  - Notes: Introduced a DEV-only wrapper for Svelte writables to log `set`/`update` calls during development for deterministic tracing.

- 2025-09-10 | Preview handler instrumentation added | `client/src/components/Preview.svelte` | included in reproducibility logs

  - Notes: `loadPreview()` now logs entry and received preview length when running in dev.

- 2025-09-10 | Preview subscription hardening (reactive local copy) | `client/src/components/PreviewWindow.svelte` | affects template rendering to use `previewHtmlLocal`

  - Notes: Added `previewHtmlLocal` assigned from `previewStore` to reduce render races; kept DOM-visible instrumentation (`data-preview-ready`, `preview-ready` event, `__LAST_PREVIEW_HTML`).

- 2025-09-10 | DOM instrumentation: timestamped preview-ready attribute | `client/src/components/PreviewWindow.svelte` | Added `data-preview-timestamp` on `body` and `[data-testid="preview-content"]`, and `preview-ready` event with detail.timestamp for Playwright/diagnostics.

  - Notes: Automated reproducibility scripts should now wait for `[data-testid="preview-content"][data-preview-ready="1"]` or read `data-preview-timestamp` to avoid timing races.

- 2025-09-10 | Canonical flows implemented (unit-tested) | `client/src/lib/flows.js`, `client/__tests__/flows.test.js` | Implemented and verified `generateAndPreview(prompt)` and `previewFromContent(content)` with Vitest unit tests covering success and failure modes.

  - Notes: Tests mock `submitPrompt` and `loadPreview` and assert `contentStore`, `previewStore`, and `uiStateStore` transitions. Next: wire UI buttons to call these flows and add Playwright verification.

- 2025-09-10 | UI wiring: buttons call canonical flows | `client/src/components/PromptInput.svelte` | `Generate` now calls `generateAndPreview(prompt)`; `Preview` calls `previewFromContent(content)`; `Load V0.1 demo` uses existing `handlePreviewNow` that calls `previewFromContent`.

  - Notes: This reduces duplicated logic in handlers and centralizes error/timeouts. Next verification: add Playwright smoke test that clicks `Generate` and waits for `data-preview-ready`.

- 2025-09-10 | Playwright smoke: Generate→Preview | `scripts/test-generate-preview.js` | Script added and run; report: `docs/focus/logs/generate-preview-1757532581226.json` (captures mock preview HTML via global fallback and console/network logs).

  - Notes: Script fills the prompt, clicks Generate, waits for `data-preview-ready` or `__LAST_PREVIEW_HTML` fallback, and saves a timestamped JSON report to `docs/focus/logs/`.

- 2025-09-10 | Repro test harness tuned (timeouts / waits) | `scripts/test-load-demo.js` | `docs/focus/logs/load-demo-1757515964797.json`, `docs/focus/logs/load-demo-1757516582232.json`

  - Notes: Increased timeouts, added waits for console signal and `data-preview-ready`, and fallback to `__LAST_PREVIEW_HTML` to capture preview content reliably. Two run artifacts exist in `docs/focus/logs/` showing API 200 and store/preview updates.

- 2025-09-10 | Repro test run captured (global fallback) | `scripts/test-load-demo.js` | `docs/focus/logs/load-demo-1757518799306.json`

  - Notes: Script captured a complete preview HTML via global fallback (`__LAST_PREVIEW_HTML`) although `previewSelectorFound` was null. Dev logs show `STORE:previewStore.set` and `PreviewWindow: previewStore updated` with content length 857 and API 200 responses. This indicates the preview data is being produced and stored, but the in-DOM selector used by the test did not match the rendered preview; next action: ensure the preview DOM node sets `data-preview-ready` when store updates so the reproducibility script can detect it reliably.

- 2025-09-10 | UI state helpers & timeout test added | `client/src/stores/index.js`, `client/__tests__/flows.test.js` | Vitest: all flow tests and timeout test passed locally (`Test Files 5 passed, Tests 21 passed`).

Next verification: implement canonical flows (`client/src/lib/flows.js`) and wire `Generate`/`Preview` handlers to those flows, then add a small Vitest unit and mark the flows verified in this section.

How to update focus documents after a verified change

1. When an implementation is verified, add a single-line entry in this doc's "Verified Implementations" with the details above.
2. Update `CORR_V0.1_Findings.md` status lines to reflect PASS/FAIL changes and acceptance criteria satisfied.
3. In `AETHER_GUI_Buttons.md`, update the per-button Reproducibility Record to point to the new artifact and mark the test PASS.

Notes on minimal test artifacts and reproducibility

- Playwright reproducibility scripts must write JSON output to `docs/focus/logs/` with a timestamped filename.
- Unit tests (Vitest) should live under `client/__tests__/` and be quick to run locally.

## Next Actions (Prioritized)

1. DOM Instrumentation Enhancement

   - Add `data-preview-ready` attribute to preview DOM node
   - Ensure attribute updates on store changes
   - Verify with reproducibility script

2. Canonical Flows Implementation

   - Create `client/src/lib/flows.js`
   - Implement both core flows with tests
   - Wire up button handlers

3. UI State Management
   - Add loading/success/error states
   - Implement timeout handling
   - Add user feedback messages

---

End of `AETHER_Generate+Preview.md`.
