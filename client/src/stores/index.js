import { writable } from "svelte/store";

/**
 * @typedef {'idle' | 'loading' | 'success' | 'error'} UIState
 */

/**
 * Store for the user's prompt input.
 * @type {import('svelte/store').Writable<string>}
 */
export const promptStore = writable("");

/**
 * Store for the AI-generated content.
 * @type {import('svelte/store').Writable<object | null>}
 */
export const contentStore = writable(null);

/**
 * Store for the HTML preview.
 * @type {import('svelte/store').Writable<string>}
 */
export const previewStore = writable("");

/**
 * Store for managing the overall UI state.
 * @type {import('svelte/store').Writable<{status: UIState, message: string}>}
 */
export const uiStateStore = writable({ status: "idle", message: "" });
