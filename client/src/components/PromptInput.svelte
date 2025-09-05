<script>
  import { promptStore, contentStore, uiStateStore, previewStore } from '../stores';
  import { submitPrompt, exportToPdf, loadPreview } from '../lib/api';

  let currentPrompt;
  promptStore.subscribe(value => {
    currentPrompt = value;
  });

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  // Quick-insert suggestions for the 'summer' theme
  const insertSummerSuggestion = () => {
    const suggestion = `A short, sunlit summer poem about cicadas and long shadows.`;
    promptStore.set(suggestion);
    // Focus textarea after inserting so keyboard users can immediately edit
    const el = document.getElementById('prompt-textarea');
    if (el) el.focus();
  };

  let isGenerating = false;
  let isPreviewing = false;

  const handleSubmit = async () => {
    if (!currentPrompt || !currentPrompt.trim()) {
      try { console.debug('[DEV] PromptInput: setting uiState error: Prompt cannot be empty.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'Prompt cannot be empty.' });
      return;
    }
    isGenerating = true;
    try { console.debug('[DEV] PromptInput: setting uiState loading: Generating content...'); } catch(e){}
    uiStateStore.set({ status: 'loading', message: 'Generating content...' });
    try {
      const response = await submitPrompt(currentPrompt);
      // Defensive handling: server may return multiple shapes. Accept the common variants:
      // { data: { content: {...} } } or { content: {...} } or { data: {...} }
      try { console.debug('[DEV] PromptInput: submitPrompt response', response); } catch (e) {}
      let newContent = null;
      if (response) {
        if (response.data && response.data.content) newContent = response.data.content;
        else if (response.content) newContent = response.content;
        else if (response.data && response.data.title && response.data.body) newContent = response.data;
        else if (response.title && response.body) newContent = response;
      }

      if (newContent) {
        contentStore.set(newContent);
        try { console.debug('[DEV] PromptInput: setting uiState success: Content generated successfully.'); } catch(e){}
        uiStateStore.set({ status: 'success', message: 'Content generated successfully.' });
        // Auto-trigger preview after generation completes
        await handlePreviewNow();
      } else {
        // Surface the unexpected response shape for debugging
        console.error('[DEV] PromptInput: unexpected submitPrompt response shape', response);
        throw new Error('Invalid response structure from server.');
      }
    } catch (error) {
      try { console.debug('[DEV] PromptInput: setting uiState error:', error && error.message); } catch(e){}
      uiStateStore.set({ status: 'error', message: error.message || 'An unknown error occurred.' });
    }
    finally {
      isGenerating = false;
    }
  };

  import { get } from 'svelte/store';

  const handlePreviewNow = async () => {
    const current = get(contentStore);
    if (!current) {
      try { console.debug('[DEV] handlePreviewNow: setting uiState error: No content to preview.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'No content to preview. Generate content first.' });
      return;
    }
    isPreviewing = true;
    try {
      try { console.debug('[DEV] handlePreviewNow: setting uiState loading: Loading preview...'); } catch(e){}
      uiStateStore.set({ status: 'loading', message: 'Loading preview...' });
      const html = await loadPreview(current);
      previewStore.set(html);
      // Debug hook: expose snippet for automated verification
      try {
        // eslint-disable-next-line no-undef
        window.__preview_html_snippet = String(html).slice(0, 1200);
      } catch (e) {}
      // Debug hook for automated verification: mark preview container when updated
      try {
        const pc = document.querySelector('.preview-container');
        if (pc) pc.setAttribute('data-preview-updated', String(Date.now()));
      } catch (e) {}
      try { console.debug('[DEV] handlePreviewNow: setting uiState success: Preview updated'); } catch(e){}
      uiStateStore.set({ status: 'success', message: 'Preview updated' });
    } catch (err) {
      try { console.debug('[DEV] handlePreviewNow: setting uiState error:', err && err.message); } catch(e){}
      uiStateStore.set({ status: 'error', message: err.message || 'Preview failed' });
    } finally {
      isPreviewing = false;
    }
  };

  // In-UI smoke test: runs preview -> export and saves PDF on success or diagnostic JSON on failure
  const runSmokeTest = async () => {
    const current = get(contentStore);
    if (!current) {
      try { console.debug('[DEV] runSmokeTest: setting uiState error: No content to run smoke test.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'No content to run smoke test. Load or generate content first.' });
      return;
    }

    try { console.debug('[DEV] runSmokeTest: setting uiState loading: Running smoke test (preview → export)...'); } catch(e){}
    uiStateStore.set({ status: 'loading', message: 'Running smoke test (preview → export)...' });
    try {
      // Ensure preview renders
      await handlePreviewNow();

      // Trigger export which downloads a PDF if successful
      await exportToPdf(current);

      try { console.debug('[DEV] runSmokeTest: setting uiState success: Smoke test succeeded — PDF downloaded.'); } catch(e){}
      uiStateStore.set({ status: 'success', message: 'Smoke test succeeded — PDF downloaded.' });
    } catch (err) {
      // Create a diagnostic JSON blob and trigger download
      const diag = {
        error: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : null,
        timestamp: new Date().toISOString(),
        contentSnapshot: current,
      };
      const blob = new Blob([JSON.stringify(diag, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagnostic-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      try { console.debug('[DEV] runSmokeTest: setting uiState error: Smoke test failed — diagnostic saved.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'Smoke test failed — diagnostic saved.' });
    }
  };
</script>

  <div class="prompt-container">
  <label for="prompt-textarea">Prompt</label>
  <textarea
    id="prompt-textarea"
    data-testid="prompt-textarea"
    bind:value={$promptStore}
    rows="6"
    placeholder="e.g., A noir detective story set in a city of robots."
    disabled={uiState.status === 'loading'}
  ></textarea>
  <div class="controls-row">
    <button
      class="suggestion"
      on:click={insertSummerSuggestion}
      title="Insert summer prompt suggestion"
      aria-label="Insert a summer prompt suggestion"
      data-testid="summer-suggestion"
      disabled={uiState.status === 'loading'}
    >
      Summer suggestion
    </button>
    <button
      class="demo"
      style="display:none"
      aria-hidden="true"
      title="Load full V0.1 demo content (developer helper - hidden)"
      data-testid="load-demo"
      disabled={uiState.status === 'loading'}
    >
      Load V0.1 demo
    </button>
      <button data-testid="generate-button" on:click={handleSubmit} disabled={uiState.status === 'loading' || isGenerating || isPreviewing}>
        {#if isGenerating}
          <span class="btn-spinner" aria-hidden="true"></span> Generating...
        {:else}
          Generate
        {/if}
      </button>
    <button data-testid="preview-button" on:click={handlePreviewNow} disabled={uiState.status === 'loading' || isGenerating || isPreviewing}>
      {#if isPreviewing}
        Previewing...
      {:else}
        Preview
      {/if}
    </button>
    <button data-testid="smoke-button" style="display:none" aria-hidden="true" title="Run preview→export smoke test (developer helper - hidden)" on:click={runSmokeTest} disabled={uiState.status === 'loading' || isGenerating || isPreviewing}>
      Run smoke test
    </button>
  </div>
  
  {#if uiState.status === 'error'}
    <p class="error-message">{uiState.message}</p>
  {/if}
</div>

<style>
  .prompt-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    text-align: left;
  }
  .controls-row { display:flex; gap:0.5rem; align-items:center }
  .suggestion { background: #f6e58d; color: #2d3436; padding: 0.5rem; border-radius:4px; border:none }
  label {
    font-weight: bold;
  }
  textarea {
    width: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #ccc;
    font-family: inherit;
    font-size: 1rem;
  }
  button {
    padding: 0.75rem;
    border-radius: 4px;
    border: none;
    background-color: #2c3e50;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s;
  }
  button:hover {
    background-color: #3a506b;
  }
  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  .error-message {
    color: #e74c3c;
    margin-top: 0.5rem;
  }
</style>
