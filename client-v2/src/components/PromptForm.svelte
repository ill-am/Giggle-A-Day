<script>
  import { createEventDispatcher } from "svelte";
  let prompt = "";
  let loading = false;
  const dispatch = createEventDispatcher();

  async function submitPrompt() {
    if (!prompt || prompt.trim().length === 0) return;
    loading = true;
    dispatch("loading", { loading: true });
    try {
      const res = await fetch("/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, dev: true }),
      });
      const json = await res.json();
      // Attempt to extract preview HTML from server response
      const html =
        json?.content?.body ||
        json?.html ||
        json?.preview ||
        JSON.stringify(json);
      dispatch("result", { html });
    } catch (e) {
      dispatch("error", { error: e.message || String(e) });
    } finally {
      loading = false;
      dispatch("loading", { loading: false });
    }
  }
</script>

<div class="prompt-form">
  <label for="prompt-input">Prompt</label>
  <div style="display:flex;gap:8px;align-items:center">
    <input
      id="prompt-input"
      bind:value={prompt}
      placeholder="Enter a poem prompt"
    />
    <button on:click={submitPrompt} disabled={loading}>Generate</button>
  </div>
  {#if loading}
    <div class="loading">Generating…</div>
  {/if}
</div>

<style>
  .prompt-form {
    margin-bottom: 12px;
  }
  input {
    padding: 8px;
    min-width: 320px;
  }
  button {
    padding: 8px 12px;
  }
  .loading {
    color: #666;
    font-size: 13px;
  }
</style>
