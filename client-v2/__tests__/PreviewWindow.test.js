import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte/svelte5";
import PreviewWindow from "../src/components/PreviewWindow.svelte";
import { previewStore } from "../src/lib/storeAdapter.js";

describe("PreviewWindow component", () => {
  // ensure DOM is cleaned between tests to avoid duplicate mounted nodes
  afterEach(() => cleanup());
  it("shows placeholder when store empty and not loading", () => {
    // ensure store is empty
    previewStore.set("");
    const { getByText, queryByTestId } = render(PreviewWindow, {
      uiState: { status: "idle" },
    });
    expect(getByText("Your generated preview will appear here.")).toBeTruthy();
    expect(queryByTestId("preview-content")).toBeNull();
  });

  it("renders preview HTML from store", async () => {
    previewStore.set("<h1>Poem</h1><p>Line</p>");
    const { getAllByTestId } = render(PreviewWindow, {
      uiState: { status: "idle" },
    });
    // allow for multiple mounted components in the test environment; assert at least one
    const els = await getAllByTestId("preview-content");
    expect(els.length).toBeGreaterThan(0);
    expect(els[0].innerHTML).toContain("Poem");
  });

  it("shows loading skeleton when uiState.loading", () => {
    previewStore.set("");
    const { container } = render(PreviewWindow, {
      uiState: { status: "loading", message: "Generating..." },
    });
    // The component prefers to show a skeleton when loading; assert skeleton exists
    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).not.toBeNull();
  });
});
