import { chromium } from "playwright";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// Lightweight Playwright E2E smoke test
// 1. Load the running client UI (assumes Vite dev server is available on 5173)
// 2. Type a prompt and click Generate
// 3. Wait for preview-ready marker (window.__preview_updated_ts or data attribute)
// 4. Run the fetch-preview-wait.cjs script to persist the returned HTML

const ROOT = path.resolve(process.cwd(), "..");
const CLIENT_ROOT = path.resolve(process.cwd());

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const uiUrl = process.env.UI_URL || "http://localhost:5173";
    console.log("Opening UI at", uiUrl);
    await page.goto(uiUrl, { timeout: 30000 });

    // Instrument console and page errors so we can capture client-side failures
    const logs = [];
    page.on("console", (msg) => {
      const text = msg.text();
      const type = msg.type();
      logs.push({ type, text });
      // Mirror page logs into runner output for quick visibility
      console.log("PAGE LOG>", type, text);
    });
    page.on("pageerror", (err) => {
      logs.push({
        type: "pageerror",
        text: err && err.message ? err.message : String(err),
      });
      console.error("PAGE ERROR>", err && err.message ? err.message : err);
    });

    // Wait for UI to be fully hydrated: ensure generate button and textarea are visible
    await page.waitForSelector('[data-testid="generate-button"]', {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForSelector('[data-testid="prompt-textarea"]', {
      state: "visible",
      timeout: 30000,
    });

    // Fill prompt textarea (now that it's visible)
    await page.fill(
      '[data-testid="prompt-textarea"]',
      "E2E smoke: short summer poem about waves and sand"
    );

    // Try generate + wait for preview with a few attempts in case of transient flakiness
    const maxAttempts = 3;
    let previewFound = false;
    for (let attempt = 1; attempt <= maxAttempts && !previewFound; attempt++) {
      console.log(`Attempt ${attempt} to generate preview`);
      // Ensure the button is visible and enabled before clicking
      await page.waitForSelector('[data-testid="generate-button"]', {
        state: "visible",
        timeout: 15000,
      });
      try {
        await page.click('[data-testid="generate-button"]');

        // Wait for preview update: prefer checking the actual preview HTML/text so
        // we only proceed once the expected content is rendered into the DOM.
        const expectedSnippet = "E2E smoke";
        await page.waitForFunction(
          (expected) => {
            try {
              // Quick checks for debug globals set by the PreviewWindow
              // @ts-ignore
              if (
                typeof window !== "undefined" &&
                window.__preview_html_snippet &&
                String(window.__preview_html_snippet).includes(expected)
              )
                return true;
              // @ts-ignore
              if (
                typeof window !== "undefined" &&
                window.__LAST_PREVIEW_HTML &&
                String(window.__LAST_PREVIEW_HTML).includes(expected)
              )
                return true;
              const el = document.querySelector(
                '[data-testid="preview-content"]'
              );
              if (el) {
                const text = el.innerText || el.textContent || "";
                if (text && text.includes(expected)) return true;
                const html = el.innerHTML || "";
                if (html && html.includes(expected)) return true;
              }
              return false;
            } catch (e) {
              return false;
            }
          },
          expectedSnippet,
          { timeout: 60000 }
        );

        previewFound = true;
        break;
      } catch (e) {
        console.warn(
          `Attempt ${attempt} timed out waiting for preview:`,
          e && e.message ? e.message : e
        );
        // small backoff before retrying
        if (attempt < maxAttempts) await page.waitForTimeout(1000);
      }
    }

    if (!previewFound) {
      // Persist page console logs for diagnosis
      try {
        const artifactDir = path.resolve(process.cwd(), "test-artifacts");
        if (!fs.existsSync(artifactDir))
          fs.mkdirSync(artifactDir, { recursive: true });
        const logPath = path.resolve(artifactDir, "e2e-console.log");
        fs.writeFileSync(
          logPath,
          logs.map((l) => `${l.type}: ${l.text}`).join("\n"),
          "utf8"
        );
        console.error("Preview not found. Wrote page console logs to", logPath);
      } catch (writeErr) {
        console.error("Failed to write console logs:", writeErr);
      }
      throw new Error(
        "Preview did not update in the UI after attempts — see e2e-console.log for page logs"
      );
    }

    console.log("Preview updated in UI — running fetch script to persist HTML");

    // Run the fetch-preview script (uses node from PATH)
    const scriptPath = path.resolve(
      process.cwd(),
      "scripts",
      "fetch-preview-wait.cjs"
    );
    const outFile = path.resolve(
      process.cwd(),
      "test-artifacts",
      "preview-fetched-from-e2e.html"
    );
    if (!fs.existsSync(path.dirname(outFile)))
      fs.mkdirSync(path.dirname(outFile), { recursive: true });

    await new Promise((resolve, reject) => {
      const cp = spawn(
        "node",
        [
          scriptPath,
          "--url",
          "http://localhost:3000",
          "--out",
          outFile,
          "--retries",
          "6",
          "--interval",
          "1500",
        ],
        { stdio: "inherit" }
      );
      cp.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error("fetch-preview script failed with code " + code));
      });
    });

    // Basic validation: file exists and contains the prompt title
    const html = fs.readFileSync(outFile, "utf8");
    if (!html || !html.includes("E2E smoke")) {
      throw new Error("Fetched preview HTML does not contain expected text");
    }

    console.log("E2E smoke completed successfully — preview saved to", outFile);
  } catch (err) {
    console.error("E2E smoke failed:", err && err.message ? err.message : err);
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
