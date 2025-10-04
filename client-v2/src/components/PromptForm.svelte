<script>
  import { createEventDispatcher } from "svelte";
  import { tick } from "svelte";

  let prompt = "";
  let loading = false;
  let errorMsg = "";
  const dispatch = createEventDispatcher();

  function extractHtmlFromResponse(json) {
    // Common shapes returned by server: { success:true, data: { content: { body, title } } }
    // legacy shapes: { content: { body } } or { html }
    if (!json) return null;
    if (json.data && json.data.content) {
      const c = json.data.content;
      return c.body || c.html || JSON.stringify(c);
    }
    if (json.content) {
      const c = json.content;
      return c.body || c.html || JSON.stringify(c);
    }
    if (json.html) return json.html;
    if (json.preview) return json.preview;
    return JSON.stringify(json);
  }

  async function submitPrompt() {
    errorMsg = "";
    if (!prompt || prompt.trim().length === 0) {
      errorMsg = "Please enter a prompt";
      return;
    }
    loading = true;
    dispatch("loading", { loading: true });
    try {
      // Use the dev query param so the server's deterministic handler will run in dev
      const res = await fetch("/prompt?dev=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      const html = extractHtmlFromResponse(json);
      if (!html) throw new Error("Invalid response from server");
      dispatch("result", { html });
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      errorMsg = msg;
      dispatch("error", { error: msg });
    } finally {
      loading = false;
      dispatch("loading", { loading: false });
      await tick();
    }
  }

  function onKeydown(e) {
    // Ctrl+Enter or Cmd+Enter submits
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      submitPrompt();
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
