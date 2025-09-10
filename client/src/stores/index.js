import { writable } from "svelte/store";

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
