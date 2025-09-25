# Actionables for Preview Window Refactor

This document outlines the issues found in the `PreviewWindow.svelte` component and the steps to resolve them.

---

## 1. Problem Breakdown

The `PreviewWindow.svelte` component fails to update reliably during manual testing in the browser, even though the E2E tests pass. This is due to overly complex and conflicting logic within the component for handling preview updates.

### Diagnosis Conclusion

The component has multiple, redundant triggers for updating the preview, leading to race conditions and unpredictable behavior. It attempts to manage its own state and fetch previews, when it should simply be a "dumb" component that renders the content of the `previewStore`.

---

## 2. Actionables

To resolve this, the `PreviewWindow.svelte` component will be refactored to simplify its logic and align its behavior with the application's state management.

- [x] **Remove Redundant Logic:**

  - [x] Remove the `updatePreview` function.
  - [x] Remove the `debouncedUpdate` function.
  - [x] Remove the reactive statement `$: if (content)` that calls `updatePreview`.
  - [x] Remove the `contentStore.subscribe` block that calls `debouncedUpdate`.

- [x] **Simplify State Management:**

  - [x] The component should only react to changes in the `previewStore` and `uiStateStore`.
  - [x] The `previewHtmlLocal` variable should be directly bound to the `$previewStore`.

- [x] **Ensure Correct Rendering:**

  - [x] Verify that the component correctly displays the loading state based on `$uiStateStore.status === 'loading'`.
  - [x] Verify that the component correctly displays the preview content from `$previewStore`.
  - [x] Verify that the component displays a placeholder or fallback when `$previewStore` is empty.

- [ ] **Final Verification:**
  - [ ] Manually test the "Generate" functionality in the browser to confirm the preview updates correctly.
  - [ ] Re-run the E2E tests to ensure no regressions have been introduced.
