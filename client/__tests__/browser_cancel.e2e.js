// E2E skeleton using Playwright test runner style (this is a template; adapt to your test environment)
import { test, expect } from "@playwright/test";

test("cancel aborts in-flight preview and keeps unrelated inputs enabled", async ({
  page,
}) => {
  await page.goto(process.env.APP_URL || "http://localhost:5173");

  // Trigger preview
  await page.click('[data-test="preview-button"]');

  // Wait until request is in-flight
  await page.waitForTimeout(200);

  // Cancel
  await page.click('[data-test="preview-cancel-button"]');

  // Assert prompt input is not disabled
  const prompt = await page.locator('[data-test="prompt-input"]');
  await expect(prompt).toBeEnabled();

  // Add assertions for stale response not applied (requires app-specific DOM hooks)
});
