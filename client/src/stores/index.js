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
// `promptStore` will be created from the singleton exports below so it
// is shared across HMR copies. Exported at the end as `promptStore`.

/**
 * Store for the AI-generated content.
 * @type {import('svelte/store').Writable<object | null>}
 */
// Create singletons on window in DEV to avoid multiple module instances
// (Vite HMR or differing import paths can cause duplicate module copies).
const GLOBAL_STORES_KEY = "__STRAWBERRY_SINGLETON_STORES__";

// DEV flag for verbose store logging (shared scope)
const DEV_STORES_VERBOSE = (() => {
  try {
    if (!(import.meta && import.meta.env && import.meta.env.DEV)) return false;
    if (typeof window === "undefined") return false;
    const urlFlag =
      window.location &&
      new URLSearchParams(window.location.search).get("debugStores") === "1";
    const lsFlag =
      window.localStorage &&
      window.localStorage.getItem("__ENABLE_VERBOSE_STORES__") === "1";
    return Boolean(urlFlag || lsFlag);
  } catch (e) {
    return false;
  }
})();

let promptStoreExport,
  contentStoreExport,
  previewStoreExport,
  uiStateStoreExport;

if (typeof window !== "undefined" && window[GLOBAL_STORES_KEY]) {
  // Defensive check: ensure the existing global singleton looks like our
  // expected object (stores should have a `subscribe` function).
  try {
    const g = window[GLOBAL_STORES_KEY];
    const looksLikeStores =
      g &&
      typeof g === "object" &&
      ((g.promptStore && typeof g.promptStore.subscribe === "function") ||
        (g.contentStore && typeof g.contentStore.subscribe === "function") ||
        (g.previewStore && typeof g.previewStore.subscribe === "function"));
    if (looksLikeStores) {
      ({
        promptStore: promptStoreExport,
        contentStore: contentStoreExport,
        previewStore: previewStoreExport,
        uiStateStore: uiStateStoreExport,
      } = g);
    } else {
      // Malformed global singleton found (maybe overwritten by other code).
      try {
        console.warn(
          "[DEV] Detected malformed",
          GLOBAL_STORES_KEY,
          "overwriting with fresh stores"
        );
      } catch (e) {}
      // Remove it so the normal creation path runs below
      try {
        delete window[GLOBAL_STORES_KEY];
      } catch (e) {}
      promptStoreExport = undefined;
    }
  } catch (e) {
    try {
      console.warn("[DEV] Error validating global stores key", e);
    } catch (e) {}
    try {
      delete window[GLOBAL_STORES_KEY];
    } catch (e) {}
    promptStoreExport = undefined;
  }
}

if (!promptStoreExport) {
  promptStoreExport = devWritable("promptStore", "");
  contentStoreExport = devWritable("contentStore", null);
  previewStoreExport = devWritable("previewStore", "");
  uiStateStoreExport = devWritable("uiStateStore", {
    status: "idle",
    message: "",
  });

  if (typeof window !== "undefined") {
    try {
      window[GLOBAL_STORES_KEY] = {
        promptStore: promptStoreExport,
        contentStore: contentStoreExport,
        previewStore: previewStoreExport,
        uiStateStore: uiStateStoreExport,
      };
      // attach a small marker to help runtime debugging
      try {
        window[GLOBAL_STORES_KEY].__marker = "strawberry-stores-v1";
      } catch (e) {}
    } catch (e) {}
  }
}

// Attach small instance ids to each store object to aid runtime debugging
try {
  const INSTANCE_ID = (
    Math.random().toString(36) + Date.now().toString(36)
  ).slice(2, 12);
  try {
    if (contentStoreExport && typeof contentStoreExport === "object")
      contentStoreExport.__instanceId =
        contentStoreExport.__instanceId || INSTANCE_ID;
  } catch (e) {}
  try {
    if (previewStoreExport && typeof previewStoreExport === "object")
      previewStoreExport.__instanceId =
        previewStoreExport.__instanceId || INSTANCE_ID;
  } catch (e) {}
  try {
    if (promptStoreExport && typeof promptStoreExport === "object")
      promptStoreExport.__instanceId =
        promptStoreExport.__instanceId || INSTANCE_ID;
  } catch (e) {}
  try {
    if (uiStateStoreExport && typeof uiStateStoreExport === "object")
      uiStateStoreExport.__instanceId =
        uiStateStoreExport.__instanceId || INSTANCE_ID;
  } catch (e) {}
  try {
    if (typeof window !== "undefined" && window[GLOBAL_STORES_KEY])
      window[GLOBAL_STORES_KEY].__instanceId =
        window[GLOBAL_STORES_KEY].__instanceId || INSTANCE_ID;
  } catch (e) {}
} catch (e) {}

export const contentStore = contentStoreExport;

// DEV instrumentation: expose last set value and log when contentStore is updated
if (typeof window !== "undefined") {
  try {
    const originalSet = contentStore.set;
    contentStore.set = function (v) {
      try {
        // Only perform verbose console logging when explicitly enabled
        if (DEV_STORES_VERBOSE)
          console.debug("[DEV] contentStore.set called with", v);
        // @ts-ignore - dev-only assigned global
        window.__LAST_CONTENT_SET = v;
      } catch (e) {}
      return originalSet.call(this, v);
    };
  } catch (e) {}
}

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
    try {
      console.debug("[DEV] persistContent: updating contentStore with", {
        content,
        persisted,
      });
    } catch (e) {}
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
export const previewStore = previewStoreExport;

// DEV instrumentation: expose last set value and log when previewStore is updated
if (typeof window !== "undefined") {
  try {
    const originalPreviewSet = previewStore.set;
    previewStore.set = function (v) {
      try {
        if (DEV_STORES_VERBOSE)
          console.debug(
            "[DEV] previewStore.set called with length=",
            v ? v.length || 0 : 0
          );
        // @ts-ignore - dev-only assigned global
        window.__LAST_PREVIEW_SET = v;
      } catch (e) {}
      return originalPreviewSet.call(this, v);
    };
  } catch (e) {}
}

// Export the promptStore singleton so all modules import the same instance
export const promptStore = promptStoreExport;

/**
 * Store for managing the overall UI state.
 * @type {import('svelte/store').Writable<{status: UIState, message: string}>}
 */
export const uiStateStore = uiStateStoreExport;

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
