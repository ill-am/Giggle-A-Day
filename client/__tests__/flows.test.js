import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";

import * as Api from "../src/lib/api";
import { contentStore, previewStore, uiStateStore } from "../src/stores";
import { generateAndPreview, previewFromContent } from "../src/lib/flows";

beforeEach(() => {
  // reset stores
  contentStore.set(null);
  previewStore.set("");
  uiStateStore.set({ status: "idle", message: "" });
  vi.restoreAllMocks();
});

describe("flows.generateAndPreview / previewFromContent", () => {
  it("generateAndPreview: successful flow sets stores and returns html", async () => {
    const mockContent = { title: "T", body: "B" };
    const mockHtml = "<div>preview</div>";

    vi.spyOn(Api, "submitPrompt").mockResolvedValue({
      data: { content: mockContent },
    });
    vi.spyOn(Api, "loadPreview").mockResolvedValue(mockHtml);

    const result = await generateAndPreview("a valid prompt");

    expect(get(contentStore)).toEqual(mockContent);
    expect(get(previewStore)).toBe(mockHtml);
    expect(get(uiStateStore).status).toBe("success");
    expect(result).toBe(mockHtml);
  });

  it("previewFromContent: successful preview updates previewStore and returns html", async () => {
    const content = { title: "Hello", body: "World" };
    const html = "<p>ok</p>";
    vi.spyOn(Api, "loadPreview").mockResolvedValue(html);

    const res = await previewFromContent(content);
    expect(res).toBe(html);
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
});
