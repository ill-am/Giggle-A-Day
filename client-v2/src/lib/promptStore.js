import { writable } from "svelte/store";

// Minimal stub store for UI-only development.
// Provides: subscribe, and submitPrompt(prompt)
const store = writable({ prompt: "", loading: false, error: null });

async function submitPrompt(newPrompt) {
  // Immediate local update for UI dev; replace with real API call later.
  store.update((s) => ({
    ...s,
    prompt: newPrompt,
    loading: true,
    error: null,
  }));

  // Simulate an async response so UI can show loading states briefly.
  setTimeout(() => {
    store.update((s) => ({ ...s, loading: false }));
  }, 300);
}

export const promptStore = {
  subscribe: store.subscribe,
  submitPrompt,
  // expose raw store for debugging if needed
  _raw: store,
};
