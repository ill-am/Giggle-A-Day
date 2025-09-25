# Implementation Tracker: AE-devolve/01-skip-puppeteer-temp-BC

Purpose: track the initial, low-risk steps for branch `AE-devolve/01-skip-puppeteer-temp-BC` focused on implementing the preview-persist fix.

Started: basic docs and task breakdown.

Planned first code tasks (short-running):

1. Inline-safe update in `persistContent`:

   - Replace any `set()` overwrite with `contentStore.update()` that normalizes and merges the persisted fields.

2. Add unit test harness for `persistContent` using dependency injection (preferred) to avoid brittle module mocking.

   - Make `persistContent` accept optional API functions: `(api={ savePromptContent, updatePromptContent })` so tests can inject mocks.

3. Make a minimal change to `PreviewWindow.svelte` if not already done to ensure it only consumes `$previewStore`.

4. Run the `client` unit tests in isolation and fix any path/mock issues.

Short notes:

- This branch will focus on testability first, to get green unit tests before broader integration runs.
- If DI refactor touches many modules, keep the API surface backward-compatible by providing defaults that import the real API.

---

Tracker status: Created initial tracker file and branch. Next: commit and push.
