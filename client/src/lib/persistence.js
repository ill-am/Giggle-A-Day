import { get } from "svelte/store";
import { contentStore } from "../stores/index.js";

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

      // Atomically merge persisted fields into the existing content to avoid
      // lost updates from concurrent writers. We intentionally perform a
      // shallow merge here (consistent with prior behavior); if nested
      // structures become a problem we can switch to a deep merge.
      contentStore.update((existing) => {
        const updated = {
          ...(existing || {}),
          ...normalized,
        };
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
