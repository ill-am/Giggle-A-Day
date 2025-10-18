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
