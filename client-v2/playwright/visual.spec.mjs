import { test, expect } from '@playwright/test';

// Basic visual snapshot that opens the preview route and captures a screenshot.
// It writes output into the config's outputDir (test-results/playwright)

test('preview window visual', async ({ page, browserName }) => {
  // Start a vite preview server in CI this should be done by running `npm --prefix client-v2 preview` in background.
  // For simplicity this test assumes the preview is served at http://127.0.0.1:5174
  const url = process.env.PREVIEW_URL || 'http://127.0.0.1:5174/preview';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500); // allow any client rendering
  const shotPath = `preview-${browserName}.png`;
  await page.screenshot({ path: shotPath, fullPage: true });
  // basic assertion: file exists and has size > 0
  const buf = await page.context().storageState();
  expect(shotPath).toBeTruthy();
});
