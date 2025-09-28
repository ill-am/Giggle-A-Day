import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import * as Api from "../src/lib/api";
import { contentStore, previewStore, uiStateStore } from "../src/stores";
import { generateAndPreview } from "../src/lib/flows";

beforeEach(() => {
  // reset stores
  contentStore.set(null);
  previewStore.set("");
  uiStateStore.set({ status: "idle", message: "" });
  vi.restoreAllMocks();
});

describe("flows.generateAndPreview", () => {
  it("generates and displays preview successfully", async () => {
    const mockHtml = "<div>preview</div>";
    const mockContent = { title: "Test", body: "Test content" };

    vi.spyOn(Api, "generatePreview").mockResolvedValue({
      html: mockHtml,
      content: mockContent
    });

    const result = await generateAndPreview("test prompt");

    expect(Api.generatePreview).toHaveBeenCalledWith("test prompt");
    expect(get(contentStore)).toEqual(mockContent);
    expect(get(previewStore)).toBe(mockHtml);
    expect(get(uiStateStore)).toEqual({
      status: "success",
      message: "Preview loaded"
    });
    expect(result).toBe(mockHtml);
  });

  it("handles empty prompt", async () => {
    await expect(generateAndPreview("")).rejects.toThrow("Prompt cannot be empty");
    expect(get(uiStateStore)).toEqual({
      status: "error",
      message: "Prompt cannot be empty"
    });
  });

  it("handles generation failure", async () => {
    const error = new Error("Generation failed");
    vi.spyOn(Api, "generatePreview").mockRejectedValue(error);

    await expect(generateAndPreview("test prompt")).rejects.toThrow("Generation failed");
    expect(get(uiStateStore)).toEqual({
      status: "error",
      message: "Generation failed"
    });
  });

  it("handles missing HTML in response", async () => {
    vi.spyOn(Api, "generatePreview").mockResolvedValue({
      content: { title: "Test", body: "Test" }
    });

    await expect(generateAndPreview("test prompt")).rejects.toThrow("No preview HTML received");
    expect(get(uiStateStore)).toEqual({
      status: "error",
      message: "No preview HTML received"
    });
  });
    expect(get(previewStore)).toBe(html);
    expect(get(uiStateStore).status).toBe("success");
  });

  it("generateAndPreview: empty prompt errors and sets uiState error", async () => {
    await expect(generateAndPreview("")).rejects.toThrow(
      /Prompt cannot be empty/
    );
    expect(get(uiStateStore).status).toBe("error");
  });

  it("previewFromContent: invalid content throws and sets uiState error", async () => {
    await expect(previewFromContent({})).rejects.toThrow(
      /No valid content provided/
    );
    expect(get(uiStateStore).status).toBe("error");
  });

  it(
    "generateAndPreview: request timeout sets uiState error",
    { timeout: 500 },
    async () => {
      // Test skipped per dev instructions - known flaky in CI
      vi.useFakeTimers();
      const neverResolves = new Promise(() => {});
      vi.spyOn(Api, "submitPrompt").mockImplementation(() => neverResolves);

      const promise = generateAndPreview("a valid prompt", 100);

      // Attach a rejection handler early so the rejected promise doesn't
      // trigger Vitest's unhandled rejection warning when the fake timer
      // fires. We capture the error for later assertions.
      let caughtError = null;
      promise.catch((e) => {
        caughtError = e;
      });

      await vi.runAllTimersAsync();
      // allow microtasks to flush
      await Promise.resolve();

      expect(caughtError).toBeTruthy();
      expect(String(caughtError)).toMatch(/Request timed out/);
      expect(get(uiStateStore).status).toBe("error");
      vi.useRealTimers();
    }
  );
});
