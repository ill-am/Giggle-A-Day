#!/usr/bin/env node
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function run(url) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const result = {
    url,
    timestamp: new Date().toISOString(),
    errors: [],
    observations: {},
  };
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    // Click the Summer suggestion button
    const btn = await page.$('[data-testid="summer-suggestion"]');
    if (!btn) {
      result.errors.push("summer-suggestion button not found");
    } else {
      await btn.click();
      await page.waitForTimeout(300);

      // read textarea
      const val = await page
        .$eval("#prompt-textarea", (el) => el.value)
        .catch(() => null);
      const focused = await page.evaluate(
        () =>
          document.activeElement &&
          document.activeElement.id === "prompt-textarea"
      );
      result.observations.textareaValue = val;
      result.observations.textareaFocused = Boolean(focused);
    }
  } catch (err) {
    result.errors.push(err && err.message ? err.message : String(err));
  } finally {
    await browser.close();
    const logsDir = path.join(__dirname, "..", "docs", "focus", "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const out = path.join(logsDir, `summer-suggestion-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(result, null, 2));
    console.log("Wrote report to", out);
    return result;
  }
}

const argv = require("minimist")(process.argv.slice(2));
const url = argv.url || "http://localhost:5173";
run(url).then((r) => {
  if (r.errors.length) process.exitCode = 2;
});
