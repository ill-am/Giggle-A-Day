import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import PreviewWindow from "../src/components/PreviewWindow.svelte";
import { previewStore } from "../src/lib/storeAdapter.js";

describe("PreviewWindow snapshot", () => {
  it("matches DOM snapshot with sample content", () => {
    previewStore.set("<h2>Snapshot Poem</h2><p>Snapshot line</p>");
    const { container } = render(PreviewWindow, {
      uiState: { status: "idle" },
    });
    // Use a simple DOM snapshot to capture structure
    expect(container.innerHTML).toMatchSnapshot();
  });
});
