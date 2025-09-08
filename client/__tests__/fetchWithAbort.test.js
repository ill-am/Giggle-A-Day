import { describe, it, expect } from "vitest";
import { abortableFetch } from "../src/lib/api.js";

// Minimal test skeleton — assumes fetchWithAbort returns a Promise and accepts an AbortSignal

describe("fetchWithAbort", () => {
  it("aborts an in-flight request when controller.abort() is called", async () => {
    // Create an abort controller
    const controller = new AbortController();

    // Use a URL that never resolves in tests; here we mock global fetch below
    // We'll mock fetch to verify it receives the signal and that rejection occurs

    let receivedSignal = null;

    global.fetch = async (url, opts) => {
      receivedSignal = opts.signal;
      // never resolve until aborted
      return new Promise((resolve, reject) => {
        if (opts.signal) {
          opts.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }
      });
    };

    // Use abortableFetch helper which returns { promise, abort }
    const { promise, abort } = abortableFetch("/test/never");

    // abort quickly
    abort();

    await expect(promise).rejects.toThrow();
    // verify that fetch was provided a signal
    expect(receivedSignal).toBeTruthy();
  });
});
