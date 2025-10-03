Audit: Preview component reuse checklist

## Summary

This short audit captures reusable pieces, risks, and actionable items when migrating the `PreviewWindow` and preview store from `client/` to `client-v2`.

## Reusable pieces

- `PreviewWindow.svelte` rendering pattern: uses a store (`previewStore`) and renders via `{@html $previewStore}` inside an element with `data-testid="preview-content"`.
- Test hooks: sets `document.body` attribute `data-preview-ready` and exposes debug globals (`window.__PREVIEW_WINDOW_LAST__` / `window.__preview_html_snippet`) that tests rely on.
- CSS/layout: `.preview-container` and `.preview-content` styles are simple and portable.
- Test utilities: `client/test-utils/previewReady.js` shows how tests wait for the preview-ready attribute.

## Key data shapes & contract

- `previewStore` is a Svelte store that resolves to a string of HTML (or empty string).
- On update, `PreviewWindow` sets `data-preview-ready` when the string length > 0.
- The preview store object includes diagnostic fields in dev builds: `__chronos_id`, `__is_canonical` (these are dev-only and not required in migration).

## Risks / gotchas

- HMR/module duplication: legacy code includes checks for canonical store instance; ensure `client-v2` exposes a single canonical store instance.
- Dev-only globals and `window` instrumentation are convenient but should be gated behind `IS_DEV` or similar env flags.
- Shared types: ensure `shared/` exports types or minimal shape definitions so tests compile.

## Actionable items for Phase 1

1. Implement a minimal store adapter in `client-v2` that exposes a Svelte-compatible store (subscribe/set/update) and exports a stable instance for dev and test.
2. Create Vitest test(s) that mount `PreviewWindow` (or a simple Svelte wrapper) and assert setting the store updates DOM and `data-preview-ready`.
3. Keep test hooks (`data-testid="preview-content"`, `data-preview-ready`) identical to speed integration with existing test scripts.
4. Avoid copying over heavy dev instrumentation; add only the minimal debug globals needed for e2e smoke scripts.

## Estimated immediate work (this sprint)

- Add test skeleton for the store adapter (Vitest + @testing-library/svelte).
- Implement a minimal in-memory store adapter in `client-v2/src/lib/storeAdapter.js`.

End of audit
