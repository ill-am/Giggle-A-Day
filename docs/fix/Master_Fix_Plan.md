# Master Fix Plan: Resolving the Preview Disconnect

**SAT 28 SEP 2025**

This document synthesizes all previous findings into a single, actionable strategy to resolve the frontend preview failure. It outlines the root cause and a prioritized list of solutions to be implemented systematically.

## Master Root Cause: Store Singleton Violation via HMR

The primary issue is a **Store Singleton Violation**, triggered by Vite's **Hot Module Replacement (HMR)** during development.

This creates duplicate, disconnected instances of the Svelte stores in memory, severing the reactive link between the application's logic (which updates one store instance) and its UI (which subscribes to another, unchanged instance). This core problem explains why E2E tests pass in a clean environment (no HMR) while manual testing consistently fails during a typical development session.

## Modus Operandi: Systematic Implementation & Verification

Each solution will be implemented on a **new, dedicated branch** named with a solution suffix (e.g., `...-solution1`). After implementing a solution, a full validation suite will be executed to assess its efficacy.

The process for each solution is:

1. Create a new branch from the latest baseline.
2. Implement the code changes for the solution.
3. Execute the full verification checklist.
4. Document the results. If the solution is not a complete fix, keep the changes if they are otherwise beneficial; otherwise, revert and proceed to the next solution.

---

## ✅ Solution #1: Implement HMR-Proof Svelte Stores (Highest Priority)

**Goal:** Directly target the root cause by making the Svelte stores immune to HMR-induced duplication.

### Actionables

- [x] **1. Branch:** Create a new branch ending in `-solution1`.
- [x] **2. Implement HMR-Proof Singleton:** Modify `client/src/stores/index.js` to use a global `window` key. This ensures that even if the module is reloaded, every part of the application receives a reference to the exact same store objects created on the very first load.

  ```javascript
  // In client/src/stores/index.js
  import { writable } from "svelte/store";

  const GLOBAL_KEY = "__CHRONOS_STORES__";

  function createStores() {
    const previewStore = writable("");
    const uiStateStore = writable({ status: "idle", message: "" });
    // ... other stores
    return { previewStore, uiStateStore };
  }

  function getStores() {
    if (typeof window !== "undefined" && window[GLOBAL_KEY]) {
      return window[GLOBAL_KEY];
    }
    const stores = createStores();
    if (typeof window !== "undefined") {
      window[GLOBAL_KEY] = stores;
    }
    return stores;
  }

  export const { previewStore, uiStateStore } = getStores();
  ```

  ## Session update (SAT 28 SEP 2025) — branch: AE-devolve/01-skip-puppeteer-preview-solution1

  Summary of edits applied in this session (keeps the Master Fix Plan current):

  - Implemented a canonical global container and robust promotion from legacy global key in `client/src/stores/index.js`.
  - Reworked store initialization to prefer canonical instances and rebound module-local store variables to canonical instances to preserve identity across HMR.
  - Added dev instrumentation for E2E and debugging:
    - write-log for `previewStore.set` (recorded to `window.__STORE_WRITE_LOG__`).
    - debug wrappers that set `window.__LAST_PREVIEW_HTML`, `window.__preview_html_snippet`, and `window.__preview_updated_ts` on preview writes.
  - Restored and stabilized `PreviewWindow.svelte` rendering to a simpler reactive implementation to prevent SSR/test harness regressions.
  - Added small debug logs in `client/src/lib/flows.js` before `previewStore.set(...)` calls to emit `__chronos_id` and canonical registry information.
  - Created and iteratively enhanced `client/tmp/inspect-preview.mjs` (Playwright probe) to:
    - trigger a generate action in the running UI,
    - wait for preview globals or DOM to appear,
    - capture `__LAST_PREVIEW_HTML`, `__STORE_WRITE_LOG__`, and the canonical registry for analysis.

  Key findings from the probe run:
  **Key findings from the probe runs (after instrumentation):**

  - The running frontend does execute the preview writer. `window.__LAST_PREVIEW_HTML` and `window.__STORE_WRITE_LOG__` contain the generated HTML and a write-log entry whose `storeId` matches the canonical id found under `window.__CHRONOS_STORES__.__STORE_IDS__.previewStore`.

  - Despite the canonical write, the mounted `PreviewWindow` component did not observe (or did not render) that value in the probe runs: the DOM still showed the placeholder and the component-level probe global (`window.__PREVIEW_WINDOW_LAST__`) was not populated by the component in earlier runs.

  - This is strong evidence of a persistent duplicate-store situation at runtime: the writer is writing to the canonical store, while the mounted component is (in at least some runs) subscribed to a different store instance created by a separate module evaluation (HMR/module-resolution divergence). That mismatch disconnects writer → UI even though the canonical container holds the correct value.

  - Small changes were made to reduce the surface area of the problem (rebinding module-local exports to canonical instances, simplifying `PreviewWindow.svelte` to avoid SSR/test harness issues). Those were necessary stabilizations but did not, by themselves, fully eliminate the mismatch observed in the running dev server.

  Immediate diagnostic step already performed in this session:

  - Added a dev-only, onMount subscription in `PreviewWindow.svelte` (guarded by `IS_DEV`) which writes what the mounted component actually observes into `window.__PREVIEW_WINDOW_LAST__`. Updated the Playwright probe to set `window.IS_DEV` prior to app bootstrap and to capture `__PREVIEW_WINDOW_LAST__` alongside other globals.

  Observed outcome after the instrumentation:

  - The probe confirms the canonical write log and canonical store ids are present, but `PreviewWindow` still did not consistently report seeing the same value (the component-level probe global was empty in the captured runs while the canonical write-log showed the new HTML). In short: the writer writes the canonical store; the mounted PreviewWindow is not reliably reading it.

  Short-term recommended next steps (ordered, dev-only first):

  1. Dev-only canonical observer (fast, decisive):

  - Add a second, dev-only subscription in `PreviewWindow.svelte` that subscribes directly to the canonical store object (if present) at `window.__CHRONOS_STORES__.previewStore` and record what that subscription sees into `window.__PREVIEW_WINDOW_LAST__.canonicalObserved`. This will prove, at runtime, whether the canonical store actually contains the HTML _and_ whether a subscription from the component's context can see it.

  2. If the canonical observer shows the component can see the canonical store when subscribed explicitly, that indicates the component's default import path still resolves to a different instance. The short-term remediation then is to ensure our store module always re-exports (rebinding) the canonical instance at import time (already partially implemented) and sweep any remaining import aliases.

  3. If explicit canonical subscription still does not see the canonical value, the problem is deeper (multiple globals or fragmented runtime realms). In that case escalate to a broader runtime hardening approach:

  - Force singletons at import time (definitive rebind) in `client/src/stores/index.js` so the module always sets its exports to the global canonical object (this is the durable fix for HMR-caused duplicates).
  - Add a short test harness that validates runtime identity: a unit test that imports the store from multiple relative paths and asserts the `__chronos_id` values are identical.

  4. After confirming the above, run the verification checklist (client tests, E2E smoke, manual HMR trial) and iterate.

  Operational notes:

  - The dev-only instrumentation is safe to enable in local dev sessions only (guarded by `IS_DEV`). Keep it temporary and remove after the root cause is fixed.
  - The updated Playwright probe (`client/tmp/inspect-preview.mjs`) now sets `window.IS_DEV` before the app loads, triggers a generate, and captures the new developer diagnostics for easy comparison.

  Current branch status:

  - All updated files for the HMR-proof store work and the dev instrumentation were committed to branch `AE-devolve/01-skip-puppeteer-preview-solution1` and pushed upstream.

- [ ] **3. Verification:**
  - [ ] **Client Tests:** Run the full Vitest suite for the client.
  - [ ] **E2E Test:** Execute the `node client/tests/e2e/generate-and-verify.spec.mjs` script.
  - [ ] **Manual Walk-through:**
    - Start the dev server.
    - Generate a preview.
    - Make a cosmetic change to a Svelte component (e.g., `PreviewWindow.svelte`) to trigger HMR.
    - Generate a second preview.
- [ ] **4. Assessment:** Document whether the preview updates correctly after the HMR event.

---

## ✅ Solution #2: Enforce Canonical Import Paths

**Goal:** Prevent the singleton issue at its source by enforcing a single, consistent import path for stores across the entire application. This is a critical best practice.

### Actionables

- [ ] **1. Branch:** Create a new branch ending in `-solution2`.
- [ ] **2. Audit & Refactor Imports:**
  - [ ] Search the entire `client/` directory for store imports using relative paths (e.g., `../stores`, `../../stores`).
  - [ ] Refactor all found instances to use the established path alias (e.g., `$lib/stores`).
- [ ] **3. Verification:**
  - [ ] **Client Tests:** Run the full Vitest suite for the client.
  - [ ] **E2E Test:** Execute the `generate-and-verify.spec.mjs` script.
  - [ ] **Manual Walk-through:** Perform the same manual test as in Solution #1.
- [ ] **4. Assessment:** Document if standardizing paths alone resolves the HMR issue.

---

## ✅ Solution #3: Simplify the Backend API (Architectural Improvement)

**Goal:** Make the system more robust and easier to maintain by consolidating the multi-step preview process into a single, atomic backend transaction.

### Actionables

- [ ] **1. Branch:** Create a new branch ending in `-solution3`.
- [ ] **2. Implement Backend Endpoint:** Create a new, consolidated `/api/generate` endpoint in the server that handles content generation, preview creation, and database persistence in one call.
- [ ] **3. Refactor Frontend:** Simplify the `generateAndPreview` flow in `client/src/lib/flows.js` to call this single endpoint and place the returned HTML directly into the `previewStore`.
- [ ] **4. Deprecate Old Endpoints:** Once the new flow is verified, remove the old, multi-step API endpoints.
- [ ] **5. Verification:**
  - [ ] **Client Tests:** Update and run the client test suite to reflect the new API call.
  - [ ] **E2E Test:** Update and run the E2E test to use the new flow.
  - [ ] **Manual Walk-through:** Confirm the end-to-end functionality works as expected.
- [ ] **6. Assessment:** Document the results of the architectural simplification.

---

## ✅ Missing Part: Add Content Validation to E2E Test

**Goal:** Enhance the E2E test to ensure it verifies not just the _process_, but also the _correctness_ of the rendered content.

### Actionables

- [ ] **1. Branch:** This can be implemented on the same branch as the final, successful solution.
- [ ] **2. Enhance E2E Test:** Modify `client/tests/e2e/generate-and-verify.spec.mjs`.
  - [ ] After the preview HTML artifact is saved, read its content.
  - [ ] Add an assertion to verify the HTML does **not** contain the raw prompt text (e.g., `E2E smoke: short summer poem...`).
  - [ ] Add an assertion to verify the HTML **does** contain a characteristic of successfully generated content (e.g., a specific class, or simply being non-empty and different from the prompt).
- [ ] **3. Verification:** Run the E2E test and confirm that it passes with the new, stricter assertions.
- [ ] **4. Assessment:** The E2E test is now a more reliable indicator of true success.
