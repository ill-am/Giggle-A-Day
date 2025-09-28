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

- [ ] **1. Branch:** Create a new branch ending in `-solution1`.
- [ ] **2. Implement HMR-Proof Singleton:** Modify `client/src/stores/index.js` to use a global `window` key. This ensures that even if the module is reloaded, every part of the application receives a reference to the exact same store objects created on the very first load.

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
