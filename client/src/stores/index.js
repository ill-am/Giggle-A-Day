import { writable } from "svelte/store";

const GLOBAL_KEY = "__CHRONOS_STORES__";

function createStores() {
  const previewStore = writable("");
  const uiStateStore = writable({ status: "idle", message: "" });
  const contentStore = writable(null);
  const promptStore = writable("");
  return { previewStore, uiStateStore, contentStore, promptStore };
}

function getStores() {
  // If we're in the browser and the stores already exist on the window object, use them.
  if (typeof window !== "undefined" && window[GLOBAL_KEY]) {
    return window[GLOBAL_KEY];
  }

  // Otherwise, create the stores for the first time.
  const stores = createStores();

  // If in the browser, attach them to the window object for the next HMR update.
  if (typeof window !== "undefined") {
    window[GLOBAL_KEY] = stores;
  }

  return stores;
}

export const { previewStore, uiStateStore, contentStore, promptStore } =
  getStores();

// Backwards-compatibility: some modules import `persistContent` from
// `$lib/stores`. After refactoring persistContent into `src/lib/persistence.js`
// we re-export it here so those imports continue to work without changes.
export { persistContent } from "../lib/persistence.js";

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
