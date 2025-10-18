# Bug: Backend-generated preview HTML not rendering in frontend preview area

Datetime: 2025-10-18 13:25 UTC
Branch: aetherV0/min_client_flow_06

## One-line synopsis

When the preview backend returns a full HTML document (with <!DOCTYPE>, <html>, <head>, and <body>), the client injects it into the preview pane via {@html $previewStore}, which does not render the document as expected. The preview area appears blank or misses styles.

## What is happening

- The server returns a full HTML document string.
- `client/src/lib/flows.js` calls `previewStore.set(html)` with that full document.
- `PreviewWindow.svelte` renders `{@html $previewStore}` inside a div (`.preview-content`).
- Injecting a full document into a div causes browsers to ignore head/body wrapping and can lead to the injected styles being ignored or the content not being displayed correctly.

## Reproduction (steps)

1. Start the dev server.
2. Click "Generate" with a prompt that triggers server preview generation.
3. Observe in the console that `previewStore.set` contains a full HTML document (contains `<!DOCTYPE html>`).
4. Look at the preview area: expected rendered content is not present or styles are missing.

## Safe fixes

1. Client-side fragment extraction (applied fix)
   - Parse the returned HTML document, extract <style> blocks and the <body> innerHTML, and set `previewStore` to the concatenation of extracted styles and the body fragment. This will render properly inside `.preview-content`.
2. Backend fix (recommended long-term)
   - Change the preview endpoint to return an HTML fragment (no doctype/head/body) so clients can inject it directly.
3. iframe alternative
   - Render the returned document into an iframe to display the full document exactly as-is. This isolates CSS/JS but is heavier.

## Resolution placeholder

When fixed, update this file with the exact commit hash and summarize the actual code change.

Status: OPEN

## Actions taken (chronological)

- Implemented a client-side HTML extraction step (client-side) that parses a returned full HTML document and extracts <style> blocks and the <body> innerHTML, then sets `previewStore` to the extracted fragment. This was implemented on a child branch for testing.

  - Result: `previewStore` contains the fragment (logs show the fragment being set). Example log excerpts show `STORE:previewStore.set` with a body fragment and length values.
  - Visible outcome: preview area remains blank or does not display the expected rendered content.

- Observed behavior in DevTools during attempts:
  - Preview requests succeed (HTTP 200) and `uiState` becomes `success` with message `Preview loaded`.
  - `previewFromContent` returned extracted HTML fragments (lengths 166–404 in different runs).
  - Despite `previewStore` containing the fragment, the UI does not display the content in the preview pane.

## Analysis of attempted fix

- The client-side extraction correctly handles the server returning a full document and converts it to a fragment suitable for injection with `{@html}`.
- The extracted fragment may still not be visible due to one or more of the following:
  1.  Visibility/styling issues: element exists but styles make it invisible (color, opacity, height, z-index, display)

2.  Scoped Svelte/CSS specificity prevents the injected styles from applying
3.  CSP or environment prevents injected <style> tags from taking effect
4.  Race conditions or store updates clearing the injected HTML (less likely given logs)

## Next step (agreed iterative approach)

We will follow a stepwise, observable approach. For each trial we will:

1. Update this report with what we tried and the observed result.
2. If the trial succeeds (preview visible and tests pass), record the exact commit and close the bug.
3. If it fails, document failure details and proceed to the next trial.

Planned trials (order recommended):

1. Inject extracted CSS into `document.head` (low risk)

   - Rationale: If injected `<style>` tags placed inside `innerHTML` are ignored or scoped incorrectly, moving CSS into an app-level <style id="preview-injected-styles"> inside `document.head` makes the rules global (but we will namespace them to `.preview` where possible) so they reliably apply to the injected fragment.
   - Verification: After applying, a Generate should show visible preview content. DevTools should show the style element in the document head and the `.preview` element present in the DOM.
   - Rollback: Remove the injected head <style> (or revert the commit). No other code changes required.

2. If (1) fails — switch to an iframe-based preview (medium risk)

   - Rationale: An iframe renders the returned document exactly as the server produced it, bypassing component scoping and CSP issues for inline styles inside the framed document.
   - Verification: Preview content visible inside iframe; data-testid remains available on the iframe element (tests that query inside it may need adjustments).
   - Rollback: Revert the iframe change; restore fragment-injection behavior.

3. If (2) fails or is unsuitable — backend change (long-term)
   - Ask server to return fragment only (no full document). This is the cleanest fix but requires server deployment.

## Verification checklist (manual)

- After each trial, run these checks in DevTools Console:
  - document.querySelector('[data-testid="preview-content"]') -> exists?
  - document.querySelector('[data-testid="preview-content"]').innerHTML -> contains expected fragment?
  - !!document.querySelector('.preview') -> true
  - getComputedStyle(document.querySelector('[data-testid="preview-content"]')) -> ensure display/opacity/height are reasonable

## What I will do next

I will not change application code until you approve the next trial. Please confirm which trial you want me to attempt first:

- Reply with `TRY 1` to attempt Trial 1 (inject extracted CSS into document.head), or
- Reply with `TRY 2` to attempt Trial 2 (iframe-based preview), or
- Reply with `WAIT` to pause and run additional diagnostics yourself (paste DevTools outputs) before any changes.

When you reply I will document the action in this report, implement the code change on the child branch (`aetherV0/min_client_flow_06-prev_patch`), commit and push it for you to test, and then update this report with the results.

## Actions taken (2025-10-18)

- Implemented client-side fragment extraction in `client/src/lib/flows.js` to turn full HTML documents into a fragment (collect <style> tags + body content) before setting `previewStore`.
- Observed logs show `previewStore` being set to the extracted fragment; however the preview area remained visually blank (content not visible).
- Attempted a preview rework using an `iframe` in `PreviewWindow.svelte` (draft), but that change was reverted / undone during troubleshooting to avoid larger UI changes without agreement.

Result: The extractor runs and the fragment is present in the store, but the rendered preview is still not visible in the UI.

## Current hypothesis

- The fragment is being inserted, but its styles are not taking effect inside the preview container (scoped styles, CSP or specificity issues may be preventing injected <style> tags from applying). The next low-risk step is to extract CSS from the returned document and inject it into `document.head` in a single namespaced <style> element so the rules reliably apply.

## Plan (iterative)

1. Try: Inject extracted CSS into `document.head` from the client (applied on child branch `aetherV0/min_client_flow_06-prev_patch`) and set the preview to the body fragment only. Test.
   - If this fixes the preview visually, update this file with the commit hash and mark the bug resolved.
2. If (1) fails: Try iframe rendering (reintroduce iframe-based preview) on the child branch and test.
3. If (2) fails: Revisit backend contract — prefer changing the server preview endpoint to return a fragment rather than a full document.

Status: TRYING STEP 1 (style injection) — applied on branch `aetherV0/min_client_flow_06-prev_patch`. Awaiting verification.
