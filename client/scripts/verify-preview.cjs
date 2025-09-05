const { chromium } = require("playwright");

(async () => {
  const base = process.env.CLIENT_URL || "http://localhost:5173";
  console.log("Visiting", base);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("console", (msg) =>
    console.log("PAGE console:", msg.type(), msg.text())
  );
  page.on("pageerror", (err) => console.log("PAGE error:", err.message));
  page.on("requestfailed", (req) =>
    console.log("REQUEST failed:", req.url(), req.failure()?.errorText)
  );
  page.on("response", (res) => {
    if (res.url().endsWith("/preview") || res.url().includes("/api/preview")) {
      console.log("PREVIEW response", res.status(), res.url());
    }
  });
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    // ensure app loaded
    await page.waitForSelector("body");

    // hide dev indicator check
    const devState = await page.$(".dev-ui-state");
    if (devState) {
      const visible = await devState.isVisible().catch(() => false);
      console.log("DEV UI STATE element present and visible?", visible);
    } else {
      console.log("DEV UI STATE element not present (expected)");
    }

    // Trigger demo load which uses existing flow and triggers preview
    const demoBtn = await page.$("button[data-testid='load-demo']");
    if (!demoBtn) {
      console.error("Load demo button not found");
      await browser.close();
      process.exit(2);
    }
    await demoBtn.click();
    console.log("Clicked Load V0.1 demo");

    // Immediately check for skeleton and spinner
    // Dump preview container HTML for diagnosis
    const previewContainer = await page.$(".preview-container");
    if (previewContainer) {
      const htmlDump = await previewContainer.innerHTML();
      console.log("Preview container HTML snapshot:", htmlDump.slice(0, 800));
    } else {
      console.log("Preview container not found in DOM");
    }

    // Immediately check for skeleton and spinner
    const skeleton = await page
      .waitForSelector(".skeleton", { timeout: 2000 })
      .catch(() => null);
    console.log("Skeleton present after click?", !!skeleton);

    const spinner =
      (await page.$(".center-spinner .spinner")) ||
      (await page.$(".loading .spinner")) ||
      (await page.$(".btn-spinner"));
    console.log("Spinner element found?", !!spinner);

    // Check for global debug markers set by the app
    const previewTs = await page
      .evaluate(() => window.__preview_updated_ts || null)
      .catch(() => null);
    const previewSnippet = await page
      .evaluate(() => window.__preview_html_snippet || null)
      .catch(() => null);
    const attrMarker = await page.$(".preview-container[data-preview-updated]");
    console.log(
      "Global preview timestamp marker?",
      !!previewTs,
      "attr marker?",
      !!attrMarker
    );

    // Wait for preview content to appear (data-testid) or fallback to searching demo text
    const preview = await page
      .waitForSelector('[data-testid="preview-content"]', { timeout: 7000 })
      .catch(() => null);
    if (preview) {
      const html = await preview.innerHTML();
      console.log("Preview content length:", html.length);
    } else {
      // fallback: look for a demo string in page body
      const found = await page
        .waitForFunction(
          () => document.body.innerText.includes("Summer Poem 1"),
          { timeout: 7000 }
        )
        .catch(() => null);
      if (found) {
        const bodyText = await page.evaluate(() =>
          document.body.innerText.slice(0, 1000)
        );
        console.log("Found demo text in page body; snippet:", bodyText);
      } else {
        console.error(
          "Preview content did not appear within timeout (no testid and demo text missing)"
        );
        await browser.close();
        process.exit(3);
      }
    }

    // Check that skeleton/spinner disappeared
    const skeletonGone = !(await page.$(".skeleton"));
    console.log("Skeleton gone after content?", skeletonGone);

    console.log("Verification PASSED");
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error("Verification ERROR", err);
    await browser.close();
    process.exit(4);
  }
})();
