import test from "node:test";
import assert from "node:assert/strict";
import normalizePrompt from "../utils/normalizePrompt.js";

test("normalizePrompt: null/undefined -> empty string", () => {
  assert.equal(normalizePrompt(null), "");
  assert.equal(normalizePrompt(undefined), "");
});

test("normalizePrompt: collapses whitespace and trims", () => {
  const input = "  Hello   world\n\nthis\tis  a   test  ";
  const expected = "Hello world this is a test";
  assert.equal(normalizePrompt(input), expected);
});

test("normalizePrompt: preserves case", () => {
  const input = "  Mixed CASE Prompt\n";
  assert.equal(normalizePrompt(input), "Mixed CASE Prompt");
});
