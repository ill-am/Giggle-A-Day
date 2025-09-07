import { chromium } from "playwright";

(async function () {
  const base = "http://localhost:5173";
  console.log("Opening", base);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // Intercept preview requests and delay them so UI Cancel button has time to appear
  await page.route("**/preview*", async (route) => {
    // Delay response by 2000ms to simulate slow backend
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await route.continue();
    } catch (e) {
      // route may be aborted if request was cancelled
    }
  });

  // Collect network events
  const requests = [];
  page.on("request", (req) =>
    requests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
    })
  );
  page.on("requestfailed", (req) => console.log("request failed:", req.url()));

  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="prompt-textarea"]', {
    timeout: 5000,
  });

  // Insert prompt and click Generate -> Preview flow uses local preview path by default in Step 1A,
  // but we'll set contentStore manually via UI: type into textarea then click Preview.
  await page.fill(
    '[data-testid="prompt-textarea"]',
    "Playwright test prompt\nLine2"
  );

  // Click Generate first to populate contentStore, then click Preview Now
  await page.click('[data-testid="generate-button"]');
  // give local preview flow a moment to set contentStore
  await page.waitForTimeout(150);
  // Debug: capture any local-preview HTML set by PromptInput
  const localPreview = await page.evaluate(() => {
    try {
      return typeof window.__getPreviewHtml === "function"
        ? window.__getPreviewHtml().slice(0, 1200)
        : null;
    } catch (e) {
      return null;
    }
  });
  console.log(
    "Local preview snapshot (post-Generate):",
    localPreview ? localPreview.replace(/\n/g, "\\n").slice(0, 400) : "<none>"
  );
  // Click Preview button in PromptInput to ensure contentStore updated
  await page.click('[data-testid="preview-button"]');
  // PreviewWindow auto-preview should trigger after contentStore update; do not click its disabled button
  console.log("Clicked Preview.");
  // Debug: capture preview and uiState immediately after clicking Preview
  const previewAfterClick = await page.evaluate(() => {
    try {
      return {
        preview:
          typeof window.__getPreviewHtml === "function"
            ? window.__getPreviewHtml().slice(0, 1200)
            : null,
        ui:
          typeof window.__getUiState === "function"
            ? window.__getUiState()
            : null,
      };
    } catch (e) {
      return { preview: null, ui: null };
    }
  });
  console.log(
    "Snapshot after clicking Preview — preview length:",
    previewAfterClick.preview ? previewAfterClick.preview.length : 0,
    "ui:",
    previewAfterClick.ui
  );

  // Wait a short time to ensure network request started.
  await page.waitForTimeout(300);

  // Click Cancel if present (prefer prompt-level cancel button)
  const previewCancelSel = '[data-testid="cancel-preview-button"]';
  const promptCancelSel = '[data-testid="prompt-cancel-preview"]';
  // Wait a bit longer for UI to update (Cancel button is added by PreviewWindow)
  await page.waitForTimeout(1500);
  if (await page.$(promptCancelSel)) {
    await page.click(promptCancelSel);
    console.log("Clicked prompt-level Cancel.");
  } else if (await page.$(previewCancelSel)) {
    await page.click(previewCancelSel);
    console.log("Clicked PreviewWindow Cancel.");
  } else {
    // As a deterministic fallback, call the test hook exposed by PreviewWindow
    const aborted = await page.evaluate(() => {
      try {
        if (typeof window.__previewAbort === "function") {
          window.__previewAbort();
          return true;
        }
      } catch (e) {}
      return false;
    });
    if (aborted) console.log("Called window.__previewAbort fallback");
    else console.log("Cancel button not present and no fallback available.");
    // Dump preview-controls and prompt controls innerHTML for debugging
    const previewControlsHtml = await page
      .$eval(".preview-controls", (el) => (el ? el.innerHTML : null))
      .catch(() => null);
    console.log("preview-controls HTML:", previewControlsHtml);
    const promptControlsHtml = await page
      .$eval(".controls-row", (el) => (el ? el.innerHTML : null))
      .catch(() => null);
    console.log("prompt controls HTML:", promptControlsHtml);
  }

  // Wait a moment and collect network activity
  await page.waitForTimeout(500);

  // Check visible UI state for messages
  const status = await page
    .$eval(".status-message", (el) => el.textContent)
    .catch(() => null);
  console.log("Status message:", status);

  // List outgoing requests to /preview or /api/preview
  const previewRequests = requests.filter(
    (r) => r.url.includes("/preview") || r.url.includes("/api/preview")
  );
  console.log("Preview-related requests seen:", previewRequests.length);
  for (const r of previewRequests)
    console.log("-", r.method, r.url, r.resourceType);

  await browser.close();
})();
