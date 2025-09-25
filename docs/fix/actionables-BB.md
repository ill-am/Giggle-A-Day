# Actionable Plan: Fix State Management Bug (`-BB`)

This document outlines the plan to fix the state management bug that causes a UI error during content generation and persistence.

## 1. Problem Diagnosis

The root cause of the `uiState error: No valid content provided for preview` is a race condition and incorrect state update within the `persistContent` function in `client/src/stores/index.js`.

- **The Flow**:
  1.  `generateAndPreview` is called.
  2.  It calls the `/prompt` API to get the generated `title` and `body`.
  3.  It updates the `contentStore` with this new content.
  4.  Crucially, it _asynchronously_ calls `persistContent`.
  5.  `persistContent` calls the `/api/prompts` endpoint to save the content and get back a `promptId`.
  6.  **The Bug**: Upon success, `persistContent` updates the `contentStore` again, but the response from `/api/prompts` only contains the `promptId` and a few other fields, **not** the `title` and `body`. This overwrites the existing store data, wiping out the `title` and `body` that the preview component relies on.
  7.  The `previewStore`'s reactive logic sees the incomplete content and correctly reports that there is "No valid content provided for preview," triggering the UI error.

## 2. Proposed Solution

The fix is to ensure that when `persistContent` updates the `contentStore`, it **merges** the new `persisted` data (containing the `promptId`) with the **existing** content in the store, rather than overwriting it.

The implementation will involve:

1.  In `client/src/stores/index.js`, modify the `persistContent` function.
2.  Inside the function, get the current value of the `contentStore`.
3.  When the API call to `/api/prompts` is successful, perform a deep merge of the current store value and the `persisted` object returned from the API.
4.  Set the `contentStore` with this newly merged object, preserving all necessary fields (`title`, `body`, `promptId`, etc.).

## 3. Verification Plan (Checkables)

To confirm the fix is successful and has not introduced regressions, the following checks must pass:

1.  **E2E Test**: Run the `node client/tests/e2e/generate-and-verify.spec.mjs` script.

    - **Expected Outcome**: The script must complete successfully, and the log output must **not** contain the line `uiState update: {status: error, message: No valid content provided for preview}`.

2.  **Manual UI Test**:

    - Launch the application.
    - Enter a prompt and click "Generate".
    - **Expected Outcome**: The preview window on the right should update correctly with the generated content. The loading indicators should appear and then be replaced by the final preview without any intervening error messages.

3.  **Data Integrity Check**:
    - After a successful generation in the manual UI test, check the application's database (or network tab for the API response).
    - **Expected Outcome**: The persisted record for the new prompt should contain the `promptId`, `title`, and `body`. The `contentStore` in the Svelte devtools should reflect the complete, merged object.
