import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";
import { persistContent } from "../src/lib/persistence.js";
import { contentStore } from "../src/stores/index.js";

const saveMock = vi.fn();
const updateMock = vi.fn();

describe("persistContent", () => {
  beforeEach(() => {
    saveMock.mockReset();
    updateMock.mockReset();
    contentStore.set(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("merges persisted promptId into existing content without removing title/body (create path)", async () => {
    // Set generated content that has title/body but no promptId
    contentStore.set({ title: "Poem", body: "Waves crash" });

    // Mock savePromptContent to return only { promptId }
    saveMock.mockResolvedValue({ promptId: "abc123" });

    const persisted = await persistContent({
      savePromptContent: saveMock,
      updatePromptContent: updateMock,
    });

    expect(saveMock).toHaveBeenCalled();
    expect(persisted).toEqual({ promptId: "abc123" });

    const final = get(contentStore);
    expect(final).toEqual({
      title: "Poem",
      body: "Waves crash",
      promptId: "abc123",
    });
  });

  it("merges update response into existing content without removing title/body (update path)", async () => {
    // existing content with promptId
    contentStore.set({
      title: "Poem",
      body: "Waves crash",
      promptId: "abc123",
    });

    // Mock updatePromptContent to return partial fields (e.g., updated timestamp)
    updateMock.mockResolvedValue({
      promptId: "abc123",
      updatedAt: "2025-09-25T00:00:00Z",
    });

    const persisted = await persistContent({
      savePromptContent: saveMock,
      updatePromptContent: updateMock,
    });

    expect(updateMock).toHaveBeenCalledWith("abc123", expect.any(Object));
    expect(persisted).toEqual({
      promptId: "abc123",
      updatedAt: "2025-09-25T00:00:00Z",
    });

    const final = get(contentStore);
    expect(final).toEqual({
      title: "Poem",
      body: "Waves crash",
      promptId: "abc123",
      updatedAt: "2025-09-25T00:00:00Z",
    });
  });
});
