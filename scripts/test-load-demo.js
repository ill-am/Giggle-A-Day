#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

async function run(url) {
  let playwright;
  try {
    playwright = require("playwright");
  } catch (e) {
    try {
      const altPath = path.join(
        __dirname,
        "..",
        "client",
        "node_modules",
        "playwright"
      );
      if (fs.existsSync(path.join(__dirname, "..", "client", "node_modules"))) {
        playwright = require(altPath);
      } else {
        throw e;
      }
    } catch (err2) {
      console.error(
        "Playwright not found. Run this script from the client/ dir or install Playwright."
      );
      throw e;
    }
  }

  const browser = await playwright.chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const result = {
    url,
    timestamp: new Date().toISOString(),
    errors: [],
    observations: {},
    console: [],
    network: [],
  };

  page.on("console", (msg) => {
    try {
      result.console.push({ type: msg.type(), text: msg.text() });
    } catch (e) {}
  });

  page.on("requestfinished", async (req) => {
    try {
      const res = req.response();
      result.network.push({
        url: req.url(),
        method: req.method(),
        status: res ? res.status() : null,
      });
    } catch (e) {}
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });

    const btn = await page.$('[data-testid="load-demo"]');
    if (!btn) {
      result.errors.push("load-demo button not found");
    } else {
      await btn.click();
      // wait for possible preview changes
      await page.waitForTimeout(500);

      // Try to find a preview element by common selectors
      const previewSelectors = [
        '[data-testid="preview-frame"]',
        ".preview",
        "#preview",
        ".preview-pane",
      ];
      let found = null;
      for (const sel of previewSelectors) {
        const el = await page.$(sel);
        if (el) {
          found = sel;
          break;
        }
      }

      result.observations.previewSelectorFound = found;

      if (found) {
        const html = await page
          .$eval(found, (el) => el.innerHTML)
          .catch(() => null);
        result.observations.previewHtml = html ? html.slice(0, 2000) : null;
      } else {
        // attempt to read the preview iframe or main content area
        const bodyHtml = await page
          .$eval("body", (b) => b.innerHTML)
          .catch(() => null);
        result.observations.bodySnippet = bodyHtml
          ? bodyHtml.slice(0, 2000)
          : null;
      }
    }
  } catch (err) {
    result.errors.push(err && err.message ? err.message : String(err));
  } finally {
    await browser.close();
    const logsDir = path.join(__dirname, "..", "docs", "focus", "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const out = path.join(logsDir, `load-demo-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(result, null, 2));
    console.log("Wrote report to", out);
    return result;
  }
}

const raw = process.argv.slice(2);
let url = "http://localhost:5173";
for (let i = 0; i < raw.length; i++) {
  if (raw[i] === "--url" && raw[i + 1]) {
    url = raw[i + 1];
    break;
  }
}

run(url).then((r) => {
  if (r.errors.length) process.exitCode = 2;
});
