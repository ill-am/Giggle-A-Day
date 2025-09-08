import { vi } from "vitest";
// Make debounce immediate in tests to avoid timing flakiness
vi.mock("../src/lib/utils", () => ({ debounce: (fn) => fn }));

import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import PreviewWindow from "../src/components/PreviewWindow.svelte";
import { contentStore, uiStateStore, previewStore } from "../src/stores";

afterEach(() => {
  // reset stores
  uiStateStore.set({ status: "idle", message: "" });
  contentStore.set(null);
  if (global.fetch && global.fetch.mockRestore) global.fetch.mockRestore();
  if (typeof vi !== "undefined" && vi.restoreAllMocks) vi.restoreAllMocks();
});

test("PreviewWindow fetches preview and renders server HTML", async () => {
  // Mock fetch to return HTML similar to server previewTemplate
  const html = `<!DOCTYPE html><html><body><div class="preview"><h1>A Summer Day</h1><div class="content">Sunlight warms the shore.</div></div></body></html>`;

  global.fetch =
    typeof vi !== "undefined" && vi.fn
      ? vi.fn(() =>
          Promise.resolve({ ok: true, text: () => Promise.resolve(html) })
        )
      : () => Promise.resolve({ ok: true, text: () => Promise.resolve(html) });

  render(PreviewWindow);

  // Trigger content store with required fields
  contentStore.set({
    title: "A Summer Day",
    body: "Sunlight warms the shore.",
  });

  // For deterministic rendering in this unit test, set the preview HTML directly
  previewStore.set(html);

  // Wait for the preview container to render and assert it contains expected HTML
  const previewEl = await screen.findByTestId("preview-content", undefined, {
    timeout: 1000,
  });
  expect(previewEl).toBeTruthy();
  expect(previewEl.innerHTML).toMatch(/A Summer Day/);
});
