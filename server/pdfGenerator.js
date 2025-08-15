// Small helper to generate PDF buffer using Puppeteer.
// It uses the existing browserInstance if available, otherwise launches a temporary browser.
const puppeteer = require("puppeteer");
const serviceState = require("./index").serviceState || {};

async function generatePdfBuffer({
  title,
  body,
  browser: providedBrowser,
} = {}) {
  let browser;
  let page;
  let launched = false;
  try {
    if (!providedBrowser) {
      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      launched = true;
    } else {
      browser = providedBrowser;
    }

    page = await browser.newPage();
    const contentHtml = `<!doctype html><html><body><h1>${title}</h1><div>${body}</div></body></html>`;
    await page.setContent(contentHtml, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({ format: "A4", printBackground: true });
    if (page && launched) await page.close();
    if (launched && browser) await browser.close();
    return buffer;
  } catch (e) {
    if (page && launched)
      try {
        await page.close();
      } catch (er) {}
    if (launched && browser)
      try {
        await browser.close();
      } catch (er) {}
    throw e;
  }
}

module.exports = { generatePdfBuffer };
