// @ts-nocheck -- dev-only store instrumentation file; suppress TS diagnostics
import { writable, get } from "svelte/store";

// DEV-only helper: wrap writable so set/update calls are logged during development
const IS_DEV =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

// Create singletons on window in DEV to avoid multiple module instances
// (Vite HMR or differing import paths can cause duplicate module copies).
const GLOBAL_KEY = "__POEMAMUNDI_STORES__";
const DEV_VERBOSE_KEY = "__POEMAMUNDI_VERBOSE__";

// Initialize the global store container if it doesn't exist
let globalContainer;
try {
  if (typeof window !== "undefined") {
    if (!window[GLOBAL_KEY]) {
      window[GLOBAL_KEY] = {};
    }
    globalContainer = window[GLOBAL_KEY];
  }
} catch (e) {
  // Swallow - defensive for environments where window may be sealed
  globalContainer = {};
}

// Initialize verbose logging state if needed
try {
  if (typeof window !== "undefined" && !window[DEV_VERBOSE_KEY]) {
    window[DEV_VERBOSE_KEY] = (() => {
      try {
        if (!IS_DEV) return false;
        if (typeof window === "undefined") return false;
        const urlFlag =
          window.location &&
          new URLSearchParams(window.location.search).get("debugStores") ===
            "1";
        const lsFlag =
          window.localStorage &&
          window.localStorage.getItem("__ENABLE_VERBOSE_STORES__") === "1";
        return Boolean(urlFlag || lsFlag);
      } catch (e) {
        return false;
      }
    })();
  }
} catch (e) {
  // Swallow errors - verbose logging is not critical
}

// Initialize or reuse stores
function getOrCreateStore(name, initial) {
  // First check if the store already exists in the global container
  if (typeof window !== "undefined" && globalContainer[name]) {
    if (IS_DEV && window[DEV_VERBOSE_KEY]) {
      console.debug(`[DEV] Reusing existing store: ${name}`);
    }
    return globalContainer[name];
  }

  // Create a new store with the dev wrapper if needed
  const w = writable(initial);
  const store = IS_DEV
    ? {
        subscribe: w.subscribe,
        set(value) {
          if (
            IS_DEV &&
            typeof window !== "undefined" &&
            window[DEV_VERBOSE_KEY]
          ) {
            try {
              console.debug(`STORE:${name}.set`, { value });
            } catch (e) {}
          }
          w.set(value);
        },
        update(fn) {
          w.update((prev) => {
            const next = fn(prev);
            if (
              IS_DEV &&
              typeof window !== "undefined" &&
              window[DEV_VERBOSE_KEY]
            ) {
              try {
                console.debug(`STORE:${name}.update`, { prev, next });
              } catch (e) {}
            }
            return next;
          });
        },
      }
    : w;

  // Save the store in the global container and return it
  if (typeof window !== "undefined") {
    globalContainer[name] = store;
  }
  return store;
}

/**
 * @typedef {'idle' | 'loading' | 'success' | 'error'} UIState
 */

// Create or reuse all stores using our singleton pattern
const promptStoreExport = getOrCreateStore("promptStore", "");
// Create or reuse base stores using our singleton pattern
const contentStoreExport = getOrCreateStore("contentStore", null);
const previewStoreExport = getOrCreateStore("previewStore", "");
const uiStateStoreExport = getOrCreateStore("uiStateStore", {
  status: "idle",
  message: "",
});

// Initialize debug store container and E2E test instrumentation
if (typeof window !== "undefined") {
  window.__DEBUG_STORES__ = {
    LAST_UPDATE: {},
    UPDATE_HISTORY: {},
  };

  // Add E2E test instrumentation: track latest preview content
  const origPreviewSet = previewStoreExport.set;
  previewStoreExport.set = (value) => {
    try {
      if (value) {
        window.__LAST_PREVIEW_HTML = value;
        window.__preview_html_snippet = value;
        window.__preview_updated_ts = Date.now();
      }
    } catch (e) {} // Swallow instrumentation errors
    return origPreviewSet(value);
  };

  // Add E2E test instrumentation: track content store updates
  const origContentSet = contentStoreExport.set;
  contentStoreExport.set = (value) => {
    try {
      if (value && value.preview) {
        window.__LAST_PREVIEW_SET = value.preview;
      }
    } catch (e) {} // Swallow instrumentation errors
    return origContentSet(value);
  };
}

/**
 * Persist content to the server prompts API.
 * If `content.promptId` exists, perform an update; otherwise create a new prompt.
 * Returns the persisted content object from the server.
 */
export async function persistContent(api) {
  // Allow dependency injection for tests by accepting an `api` object.
  // If not provided, lazily import the real API implementation to avoid
  // hard failure when running unit tests that stub `persistContent`'s
  // dependencies.
  if (!api) {
    try {
      const mod = await import("../lib/api");
      api = {
        savePromptContent: mod.savePromptContent,
        updatePromptContent: mod.updatePromptContent,
      };
    } catch (e) {
      // If dynamic import fails, let callers handle missing API by
      // providing their own `api` object. We throw below if no api is
      // available when attempting to persist.
      api = null;
    }
  }
  const content = get(contentStore);
  if (!content) throw new Error("No content in store to persist");
  try {
    let persisted;
    if (content.promptId) {
      persisted = await api.updatePromptContent(content.promptId, content);
    } else {
      persisted = await api.savePromptContent(content);
    }
    // Normalize persisted response: unwrap common envelopes and map `id` -> `promptId`.
    try {
      const normalized = (() => {
        if (!persisted) return {};
        // If server responds with { data: { content: {...} } } or { data: {...} }
        const body =
          persisted.data && persisted.data.content
            ? persisted.data.content
            : persisted.data
            ? persisted.data
            : persisted;
        const out = Object.assign({}, body || {});
        // map common id fields to promptId while preserving original `id`
        if (out.id && !out.promptId) {
          out.promptId = out.id;
          // keep `id` as well for backward compatibility with tests/consumers
        }
        return out;
      })();

      // Dev debug - only log in development to avoid noisy test output
      try {
        if (IS_DEV)
          console.debug("[DEV] persistContent: updating contentStore with", {
            content,
            persisted,
            normalized,
          });
      } catch (e) {}

      // Atomically merge persisted fields into the existing content to avoid
      // lost updates from concurrent writers. We intentionally perform a
      // shallow merge here (consistent with prior behavior); if nested
      // structures become a problem we can switch to a deep merge.
      contentStore.update((existing) => {
        const updated = {
          ...(existing || {}),
          ...normalized,
        };
        // Update E2E test instrumentation on content updates too
        try {
          if (typeof window !== "undefined" && updated.preview) {
            window.__LAST_PREVIEW_SET = updated.preview;
          }
        } catch (e) {} // Swallow instrumentation errors
        return updated;
      });
    } catch (e) {
      // Swallow normalization/merge errors to avoid breaking persistence flow;
      // the outer catch will handle logging and rethrow if needed.
    } // end normalize/merge try

    return persisted;
  } catch (err) {
    console.warn("persistContent failed", err && err.message);
    throw err;
  }
}

/**
 * Export all store instances as singletons.
 * Every module that imports these will get the same instance.
 * HMR updates will preserve the store state through the global object.
 */
export const promptStore = promptStoreExport;
export const contentStore = contentStoreExport;
export const previewStore = previewStoreExport;
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
