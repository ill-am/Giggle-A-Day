import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import PromptInput from "../src/components/PromptInput.svelte";
import PreviewWindow from "../src/components/PreviewWindow.svelte";
import {
  promptStore,
  contentStore,
  previewStore,
  uiStateStore,
} from "../src/stores";
import { afterEach, test, expect } from "vitest";
import { get } from "svelte/store";

afterEach(() => {
  // reset stores
  promptStore.set("");
  previewStore.set("");
  uiStateStore.set({ status: "idle", message: "" });
  contentStore.set(null);
});

test("end-to-end: prompt -> generate -> preview (local shortcut)", async () => {
  // Arrange: set a multi-line prompt where first line becomes the title
  promptStore.set("Test Title\nThis is the body of the preview.");

  // Render both components (stores are shared)
  render(PromptInput);
  render(PreviewWindow);

  // Act: click the Generate button which uses the local-preview shortcut in Step 1A
  const genBtn = await screen.findByTestId("generate-button");
  await fireEvent.click(genBtn);

  // Assert: preview content shows the title derived from the prompt (the heading element)
  const previewTitle = await screen.findByRole("heading", {
    level: 2,
    name: /Test Title/,
  });
  expect(previewTitle).toBeTruthy();

  // Assert: stores were updated
  const content = get(contentStore);
  expect(content).not.toBeNull();
  expect(content.title).toContain("Test Title");
  expect(get(previewStore).length).toBeGreaterThan(0);
});
