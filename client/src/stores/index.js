import { writable } from "svelte/store";
import { savePromptContent, updatePromptContent } from "../lib/api";

// DEV-only helper: wrap writable so set/update calls are logged during development
const IS_DEV =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

function devWritable(name, initial) {
  const w = writable(initial);
  if (!IS_DEV) return w;
  return {
    subscribe: w.subscribe,
    set(value) {
      try {
        console.log(`STORE:${name}.set`, { value });
      } catch (e) {}
      w.set(value);
    },
    update(fn) {
      w.update((prev) => {
        const next = fn(prev);
        try {
          console.log(`STORE:${name}.update`, { prev, next });
        } catch (e) {}
        return next;
      });
    },
  };
}

/**
 * @typedef {'idle' | 'loading' | 'success' | 'error'} UIState
 */

/**
 * Store for the user's prompt input.
 * @type {import('svelte/store').Writable<string>}
 */
export const promptStore = devWritable("promptStore", "");

/**
 * Store for the AI-generated content.
 * @type {import('svelte/store').Writable<object | null>}
 */
export const contentStore = devWritable("contentStore", null);

/**
 * Persist content to the server prompts API.
 * If `content.promptId` exists, perform an update; otherwise create a new prompt.
 * Returns the persisted content object from the server.
 */
export async function persistContent(content) {
  if (!content) throw new Error("No content provided to persistContent");
  try {
    let persisted;
    if (content.promptId) {
      persisted = await updatePromptContent(content.promptId, content);
    } else {
      persisted = await savePromptContent(content);
    }
    // Update local store with server-provided data
    contentStore.set({ ...(content || {}), ...(persisted || {}) });
    return persisted;
  } catch (err) {
    console.warn("persistContent failed", err && err.message);
    throw err;
  }
}

/**
 * Store for the HTML preview.
 * @type {import('svelte/store').Writable<string>}
 */
export const previewStore = devWritable("previewStore", "");

/**
 * Store for managing the overall UI state.
 * @type {import('svelte/store').Writable<{status: UIState, message: string}>}
 */
export const uiStateStore = devWritable("uiStateStore", {
  status: "idle",
  message: "",
});

// Helper setters for consistent UI state transitions
export function setUiLoading(message = "") {
  uiStateStore.set({ status: "loading", message });
}

export function setUiSuccess(message = "") {
  uiStateStore.set({ status: "success", message });
}

export function setUiError(message = "") {
  uiStateStore.set({ status: "error", message });
}
