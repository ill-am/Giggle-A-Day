# V0.1 Correction Findings and Plan

Recorded: 2025-09-08

## Current State (feat/V0.1-implementation)

**Status**: Non-responsive GUI with following buttons present:

- 'Summer suggestion'
- 'Load V0.1 demo'
- 'Generate'
- 'Preview'
- 'Run smoke test'

**Critical Note**: The master prototype branch (feat/V0.1-implementation) is preserved as-is. No modifications will be made until a complete fix is validated.

## Documentation Phase

1. Current Investigation

   - Document exact state of GUI components
   - Identify all failure points
   - Map data flow through components

2. Analysis & Planning

   - Catalog all required fixes
   - Define correction approach
   - Establish validation criteria

3. Implementation Strategy
   - To be detailed after consensus on approach
   - Will use separate correction branches
   - Must preserve V0.1 artifacts for reference

## Next Steps

1. Complete documentation of current state
2. Reach consensus on correction approach
3. Create detailed implementation plan
4. Begin corrections in isolated branches

## Reference Information

- Original implementation is preserved in feat/V0.1-implementation
- Corrections will be tracked in corr/V0.1-findings branch
- All changes must be validated before consideration for integration

## Validation Requirements

To be established during consensus phase. Will include:

- GUI responsiveness criteria
- Data flow verification
- Integration test requirements

## Acceptance Criteria (proposed)

These are minimal, testable criteria that define when a correction qualifies as "resolved".

- Core flow: Generate → Preview must complete without uncaught errors and must display preview HTML within 5 seconds on a local dev environment.
- UI feedback: Any action that initiates network work must set `uiState` to `loading` and then either `success` or `error` with a human-readable message.
- Local actions (e.g., "Summer suggestion") must not call the network and must update stores and focus appropriately.
- Export: `exportToPdf` must return a valid PDF blob (Content-Type: application/pdf) and trigger a download when run in the browser.
- Tests: Automated end-to-end test covering Generate→Preview→Export must pass in CI or local dev before merging.

These criteria are intentionally minimal; we can expand them with performance targets and additional automated checks after initial fixes.

## Recent corrective actions and recommendations

- A focused fix was applied to the `Summer suggestion` handler in `client/src/components/PromptInput.svelte` to make the quick-insert reliable for automated tests. See the companion focus doc `docs/focus/AETHER_GUI_Buttons.md` for the run records and details.

- Status update: The `Summer suggestion` GUI button has been validated locally and via Playwright and now meets the acceptance criteria for local actions (updates stores and focuses textarea). See `docs/focus/AETHER_GUI_Buttons.md` and `docs/focus/logs/summer-suggestion-1757450309665.json` for the successful run artifact.

- Instrumentation update (2025-09-10): DEV-only store logging and Preview component instrumentation were added to aid diagnosis. The reproducibility script `scripts/test-load-demo.js` was run and produced `docs/focus/logs/load-demo-1757515964797.json` which shows:

  - Backend `/preview` returned 200 and provided preview HTML (length ≈ 857).
  - `handlePreviewNow` received the HTML and called `previewStore.set(...)` (STORE log present).
  - `PreviewWindow` observed `previewStore` update (console log present). The preview HTML is available in the run artifact under `observations.previewHtmlFromGlobal`.
  - The prior DOM-level query used by the reproducibility script did not detect the preview selector inside the test's short observation window; this suggests a timing/subscription rendering gap rather than a backend failure.

  Recommendation: Priority fix — ensure the preview component renders from `$previewStore` (or subscribes to `previewStore` and assigns to a reactive `let`) so the preview DOM becomes visible within the test observation window. See `docs/focus/AETHER_Generate+Preview.md` for the focused plan and next steps.

- 2025-09-10 | DOM instrumentation (timestamped) implemented | `client/src/components/PreviewWindow.svelte` | Added `data-preview-timestamp` and `preview-ready` event detail to make Playwright checks deterministic.

  - Notes: Playwright scripts and reproducibility harnesses should rely on `data-preview-ready` + `data-preview-timestamp` or the `preview-ready` event detail rather than fragile layout selectors.

- Recommendation (long-term): revisit the store-binding pattern so the DOM is a single source of truth — either fully store-driven (textarea bound to the store directly and updates flow from store → DOM) or fully local-bound with explicit sync to the store. This avoids ad-hoc direct DOM writes (the repository currently uses a defensive `el.value = suggestion` to make tests reliable).

- 2025-09-10 | Canonical flows unit-tested | `client/src/lib/flows.js`, `client/__tests__/flows.test.js` | Vitest unit tests added and run: `generateAndPreview` and `previewFromContent` validated (success + error modes). UI wiring is next.

  - Notes: Tests mock the API layer and assert stores updated and UI state transitions. Proceed to wire the UI buttons to reuse these flows and add Playwright verification as the next step.

- Offered next steps:
  1.  I can open a small PR describing the fix, the rationale, and the short-term defensive change (already pushed to `corr/V0.1-findings`).
  2.  I can add a targeted CI job (Vitest or Playwright) to run the `summer-suggestion` reproducibility test on PRs to prevent regressions.

Please perform a manual validation in the running app to confirm behavior in your environment and then advise whether you want the PR description drafted or the CI step added next.

## Prioritization: next focus

- Immediate priority (POC): Extract the canonical Generate and Preview flows into a tiny shared module and wire the UI to call those functions. This Proof-of-Concept (POC) has the highest ROI: once `generateAndPreview(prompt)` and `previewFromContent(content)` exist, helper buttons (Load Demo, Summer suggestion, Smoke test, Export) should call them rather than re-implementing flow logic locally. This reduces duplication and drastically lowers the risk of timing/subscribe bugs.

- Next high-priority fix: `Load V0.1 Demo` (see `docs/focus/AETHER_GUI_Buttons.md` section "Load V0.1 Demo — Reproducibility Record"). This item remains important because it populates the UI with demo content and enables manual verification of the preview/export chain, but it should be implemented by calling the canonical POC functions rather than copying Generate/Preview logic inline.
- Recent automated run: `scripts/test-load-demo.js` executed; diagnostic saved to `docs/focus/logs/load-demo-1757451721898.json`. Backend preview requests returned 200 and logged "Preview loaded successfully", but the frontend preview pane did not visibly update in the short test window.
- All non-essential recommendations, UX improvements, and longer-term refactors should be recorded in this `CORR_V0.1_Findings.md` doc for later implementation and scheduling; only minimal, high-impact fixes will be applied immediately to restore interactive functionality.
