import { get } from "svelte/store";
import { generatePreview } from "./api";

const IS_DEV =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
import genieServiceFE from "./genieServiceFE";
import {
  contentStore,
  previewStore,
  uiStateStore,
  setUiLoading,
  setUiSuccess,
  setUiError,
  persistContent,
} from "$lib/stores";

const DEFAULT_TIMEOUT_MS = 10000; // 10s

import { withTimeout } from "./timeout";

// Controller for managing preview request cancellation
let previewAbortController = null;

/**
 * Cancel any ongoing preview request
 */
function cancelPreview() {
  if (previewAbortController) {
    previewAbortController.abort();
    previewAbortController = null;
  }
}

/**
 * Load preview HTML for given content
 */
async function loadPreview(content) {
  const response = await generatePreview(content);
  return response.html;
}

/**
 * Generate content and preview HTML in a single request.
 * Updates stores and returns the preview HTML on success.
 */
export async function previewFromContent(
  content,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  if (!content || !content.title || !content.body) {
    const err = new Error("No valid content provided for preview");
    uiStateStore.set({ status: "error", message: err.message });
    throw err;
  }

  // Cancel any previously running preview to avoid race conditions and create
  // a fresh controller for this request. Capture the controller locally so
  // we can tell if a later cancellation corresponds to this request or a
  // newer one.
  cancelPreview();
  previewAbortController = new AbortController();
  const myController = previewAbortController;
  const signal = myController.signal;

  setUiLoading("Loading preview...");

  try {
    const html = await withTimeout(loadPreview(content), timeoutMs);

    // Debug logging for preview chain
    if (IS_DEV) {
      console.debug("[DEV] Preview chain debug:", {
        content: content,
        previewHtml: html?.substring(0, 100) + "...",
        htmlLength: html?.length,
      });
    }

    // Ensure previewStore is updated with the returned HTML
    previewStore.set(html);

    if (IS_DEV) {
      console.debug("[DEV] previewStore updated:", {
        storeValue: get(previewStore)?.substring(0, 100) + "...",
        valueLength: get(previewStore)?.length,
      });
    }

    uiStateStore.set({ status: "success", message: "Preview loaded" });
    // If this request is still the active controller, clear the global
    // reference so subsequent calls start fresh. If a newer request has
    // replaced the global controller, leave it as-is.
    if (previewAbortController === myController) previewAbortController = null;
    return html;
  } catch (err) {
    // If the request was aborted (due to a newer preview request), treat
    // it as a non-error — don't surface it to the user or clear the
    // existing preview. This prevents noisy AbortError logs when users
    // rapidly change prompts or when a previous request is intentionally
    // cancelled.
    if (err && (err.name === "AbortError" || err.type === "aborted")) {
      // Keep existing preview and UI state; return an empty string so
      // callers can continue without treating this as a failure.
      // Clear the global controller only if it belongs to this request.
      try {
        if (previewAbortController === myController)
          previewAbortController = null;
      } catch (e) {}
      return "";
    }

    setUiError(err.message || "Preview failed");
    // clear preview on failure to avoid stale views
    try {
      previewStore.set("");
    } catch (e) {}
    throw err;
  }
}

/**
 * Submit a prompt, update contentStore and trigger a preview for the generated content.
 * Returns the preview HTML string on success.
 */
export async function generateAndPreview(
  prompt,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  if (!prompt || !String(prompt).trim()) {
    const err = new Error("Prompt cannot be empty.");
    uiStateStore.set({ status: "error", message: err.message });
    throw err;
  }

  setUiLoading("Generating preview...");

  try {
    // Single API call to generate content and preview
    const generateRequest = withTimeout(generatePreview(prompt), timeoutMs);
    const { html, content } = await generateRequest;

    if (!html) {
      throw new Error("No preview HTML received");
    }

    // Update stores with the results
    if (content) {
      contentStore.set(content);
      console.debug("[Flows] Content store updated");
    }

    previewStore.set(html);
    console.debug("[Flows] Preview store updated", {
      htmlLength: html.length,
    });

    setUiSuccess("Preview loaded");
    return html;
  } catch (error) {
    const message = error.message || "Generation failed";
    console.error("[Flows] Generation error:", error);
    setUiError(message);
    throw error;
  }
}
