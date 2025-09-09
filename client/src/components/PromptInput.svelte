<script>
  import { promptStore, contentStore, uiStateStore } from '../stores';
  import { submitPrompt, exportToPdf } from '../lib/api';
  import { tick } from 'svelte';

  let currentPrompt;
  promptStore.subscribe(value => {
    currentPrompt = value;
  });

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  // Quick-insert suggestions for the 'summer' theme
  const insertSummerSuggestion = async () => {
    const suggestion = `A short, sunlit summer poem about cicadas and long shadows.`;
    console.log('insertSummerSuggestion: setting suggestion=', suggestion);
    promptStore.set(suggestion);
    // Keep the local binding in sync so the textarea reflects the change immediately
    currentPrompt = suggestion;
    // Wait a tick for the DOM to update, then focus the textarea
    await tick();
    const el = document.getElementById('prompt-textarea');
    if (el) {
      el.focus();
      console.log('insertSummerSuggestion: focused textarea');
    } else {
      console.log('insertSummerSuggestion: textarea element not found');
    }
  };

  let isGenerating = false;
  let isPreviewing = false;

  const handleSubmit = async () => {
    console.log('handleSubmit: called, currentPrompt=', currentPrompt);
    if (!currentPrompt || !currentPrompt.trim()) {
      uiStateStore.set({ status: 'error', message: 'Prompt cannot be empty.' });
      return;
    }
    isGenerating = true;
    uiStateStore.set({ status: 'loading', message: 'Generating content...' });
    try {
      const response = await submitPrompt(currentPrompt);
      if (response && response.data) {
        contentStore.set(response.data.content);
        uiStateStore.set({ status: 'success', message: 'Content generated successfully.' });
        // Auto-trigger preview after generation completes
        await handlePreviewNow();
      } else {
        throw new Error('Invalid response structure from server.');
      }
    } catch (error) {
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
      uiStateStore.set({ status: 'error', message: 'No content to preview. Generate content first.' });
      return;
    }
    isPreviewing = true;
    try {
      uiStateStore.set({ status: 'loading', message: 'Loading preview...' });
      const html = await import('../lib/api').then((m) => m.loadPreview(current));
      const { previewStore } = await import('../stores');
      previewStore.set(html);
      uiStateStore.set({ status: 'success', message: 'Preview updated' });
    } catch (err) {
      uiStateStore.set({ status: 'error', message: err.message || 'Preview failed' });
    } finally {
      isPreviewing = false;
    }
  };

  // In-UI smoke test: runs preview -> export and saves PDF on success or diagnostic JSON on failure
  const runSmokeTest = async () => {
    const current = get(contentStore);
    if (!current) {
      uiStateStore.set({ status: 'error', message: 'No content to run smoke test. Load or generate content first.' });
      return;
    }

    uiStateStore.set({ status: 'loading', message: 'Running smoke test (preview → export)...' });
    try {
      // Ensure preview renders
      await handlePreviewNow();

      // Trigger export which downloads a PDF if successful
      await exportToPdf(current);

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
      on:click={() => {
        // Populate the content store directly with a V0.1 demo payload
        const demo = {
          title: 'Summer Poems — Demo',
          body: '<div style="page-break-after:always;padding:48px;background-image:url(/samples/images/summer1.svg);background-size:cover;background-position:center;"><h1>Summer Poem 1</h1><p>By Unknown</p><pre>Roses are red\nViolets are blue\nSummer breeze carries you</pre></div><div style="page-break-after:always;padding:48px;background-image:url(/samples/images/summer2.svg);background-size:cover;background-position:center;"><h1>Summer Poem 2</h1><p>By Unknown</p><pre>Sun on the sand\nWaves lap the shore\nA page on each</pre></div>'
        };
    // Set both the editor prompt and the generated content so the UI
    // visibly reflects the demo immediately.
    promptStore.set('Load demo: two short summer poems, one per page');
    contentStore.set(demo);
    // Trigger a preview update and show an immediate status so the user
    // sees activity on the page (not only in the terminal).
    uiStateStore.set({ status: 'loading', message: 'Loading demo preview...' });
    // Use the existing preview flow to populate the preview pane.
    handlePreviewNow();
      }}
      title="Load full V0.1 demo content"
      data-testid="load-demo"
      disabled={uiState.status === 'loading'}
    >
      Load V0.1 demo
    </button>
    <button data-testid="generate-button" on:click={handleSubmit} disabled={uiState.status === 'loading' || isGenerating || isPreviewing}>
      {#if isGenerating}
        Generating...
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
    <button data-testid="smoke-button" title="Run preview→export smoke test" on:click={runSmokeTest} disabled={uiState.status === 'loading' || isGenerating || isPreviewing}>
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
