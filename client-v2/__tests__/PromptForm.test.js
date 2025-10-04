import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/svelte/svelte5";
import PromptForm from "../src/components/PromptForm.svelte";
import { previewStore } from "../src/lib/storeAdapter.js";

// simple helper to wait microtask
const wait = () => new Promise((r) => setTimeout(r, 0));

describe("PromptForm", () => {
  beforeEach(() => {
    cleanup();
    // reset store
    previewStore.set("");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows validation error when submitting empty prompt", async () => {
    const { getByText, getByLabelText } = render(PromptForm);
    const submit = getByText("Generate");
    await fireEvent.click(submit);
    getByText("Please enter a prompt");
  });

  it("posts prompt and emits result on success", async () => {
    const fakeResponse = {
      success: true,
      data: { content: { title: "T", body: "<h1>Hi</h1>" } },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ json: () => Promise.resolve(fakeResponse) })
      )
    );

    const { getByText, getByLabelText, component } = render(PromptForm);
    const input = getByLabelText("Prompt");

    const results = [];
    component.$on("result", (e) => results.push(e.detail));

    await fireEvent.input(input, { target: { value: "Hello" } });
    const submit = getByText("Generate");
    await fireEvent.click(submit);

    // wait for microtasks and promises to resolve
    await wait();

    expect(global.fetch).toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].html).toContain("Hi");
  });
});
