import { test, expect } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import App from "../src/App.svelte";

test("App renders preview content", () => {
  const { getByText } = render(App, {});
  // Match the heading text present in App.svelte
  expect(getByText("client-v2 — Preview")).toBeTruthy();
});
