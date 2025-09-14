<script>
  import { promptStore, contentStore, previewStore, uiStateStore, setUiLoading, setUiSuccess, setUiError } from '../stores';
  import { submitPrompt, exportToPdf } from '../lib/api';
  import { tick } from 'svelte';
  import { get } from 'svelte/store';

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
      // Defensive: set the DOM value directly so test runners observe the change
  try { if (el instanceof HTMLTextAreaElement) el.value = suggestion; } catch (e) { /* ignore */ }
      el.focus();
      console.log('insertSummerSuggestion: focused textarea');
    } else {
      console.log('insertSummerSuggestion: textarea element not found');
    }
  };

  let isGenerating = false;
  let isPreviewing = false;
  // Step 1A: typed-prompt dialog state (do NOT call model in this stage)
  let showTypedPromptDialog = false;
  let typedPrompt = '';
  // Short-term visual feedback: flash the Generate button when clicked
  let generateFlash = false;
  // Preserve original body background for temporary flash
  let originalBodyBg = '';

  const handleSubmit = async () => {
    if (!currentPrompt || !currentPrompt.trim()) {
      uiStateStore.set({ status: 'error', message: 'Prompt cannot be empty.' });
      return;
    }
    isGenerating = true;
    uiStateStore.set({ status: 'loading', message: 'Generating content...' });
    try {
      const response = await submitPrompt(currentPrompt);
      // Normalize response shape: prefer response.data but accept direct
      const payload = response && (response.data || response) || {};
      if (payload && payload.content) {
        const stored = {
          ...(payload.content || {}),
          ...(payload.resultId ? { resultId: payload.resultId } : {}),
          ...(payload.promptId ? { promptId: payload.promptId } : {}),
        };
        contentStore.set(stored);
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

  // Step 1A: intercept Generate button to show typed-prompt dialog only (no model call)
  const handleGenerateClick = () => {
    const p = get(promptStore);
    if (!p || !p.trim()) {
      try { console.debug('[DEV] PromptInput: setting uiState error: Prompt cannot be empty.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'Prompt cannot be empty.' });
      return;
    }
    // Short-term UX: flash the Generate button (no modal, no model call)
    typedPrompt = p;
    generateFlash = true;
    // ensure flash is visible briefly
    setTimeout(() => { generateFlash = false; }, 700);
    // flash the preview container background to show visible activity local to the preview area
    try {
      const pc = document.querySelector('.preview-container');
      if (pc && pc instanceof HTMLElement) {
        const prevBg = pc.style.backgroundColor || getComputedStyle(pc).backgroundColor || '';
        pc.style.backgroundColor = '#ffdddd';
        pc.setAttribute('data-preview-flash', '1');
        setTimeout(() => {
          try { pc.style.backgroundColor = prevBg || ''; pc.removeAttribute('data-preview-flash'); } catch (e){}
        }, 700);
      }
    } catch (e) {}
  // (diagnostic overlay removed) — rely on contentStore/previewStore updates only
    // Option B: local preview shortcut — create a mock content object and render locally
    try {
      const localContent = { title: (typedPrompt || '').split('\n')[0].slice(0, 80) || 'Untitled', body: typedPrompt };
      // Set contentStore so codebase flow sees content
      contentStore.set(localContent);
      // Build local preview HTML and set previewStore directly (avoids network)
  const html = buildLocalPreviewHtml(localContent);
      try { console.debug('[DEV] PromptInput: about to previewStore.set (local) length=', String(html).length); } catch (e) {}
      previewStore.set(html);
      try { console.debug('[DEV] PromptInput: previewStore.set (local) done'); } catch (e) {}
      // Mark DOM with source so we can detect overwrites/hiding in the browser
      try {
        const pc = document.querySelector('.preview-container');
        if (pc) {
          pc.setAttribute('data-preview-source', `local:${Date.now()}`);
        }
      } catch (e) {}
      // mark UI state and DOM marker similar to real flow
      uiStateStore.set({ status: 'success', message: 'Preview (local) updated' });
      try { const pc = document.querySelector('.preview-container'); if (pc) pc.setAttribute('data-preview-local', String(Date.now())); } catch (e) {}
    } catch (e) {
      uiStateStore.set({ status: 'error', message: 'Local preview failed' });
    }
    // intentionally do not call submitPrompt in Step 1A
    showTypedPromptDialog = false;
  };

  // Primary handler: call the server to generate content and update stores.
  // This is now the default behaviour for Generate to make the GUI functional.
  const handleGenerateNow = async () => {

    const p = get(promptStore);
    if (!p || !p.trim()) {
      uiStateStore.set({ status: 'error', message: 'Prompt cannot be empty.' });
      return;
    }

    isGenerating = true;
    uiStateStore.set({ status: 'loading', message: 'Generating content (server)...' });

    try {
      // Use the standard client API helper so retry logic and logging are preserved.
      // submitPrompt posts to `/prompt` (server will use dev mode if configured).
      const response = await submitPrompt(p);

      // Normalize response shape: support both { data: { content } } and { content }
      const json = response && (response.data || response) || {};
      if (!json) throw new Error('Empty response from server');
      if (json && (json.content || (json.data && json.data.content))) {
        const payload = json.content || (json.data && json.data.content) || json;
        const stored = {
          ...(payload || {}),
          ...(json.resultId ? { resultId: json.resultId } : {}),
          ...(json.promptId ? { promptId: json.promptId } : {}),
        };
        contentStore.set(stored);
      } else {
        throw new Error('Unexpected server payload');
      }
      uiStateStore.set({ status: 'success', message: 'Content generated (server).' });
      await handlePreviewNow();
    } catch (err) {
      uiStateStore.set({ status: 'error', message: err.message || 'Server generation failed' });
    } finally {
      isGenerating = false;
    }
  };

  // Diagnostic overlay removed — preview is updated only via contentStore/previewStore

  // Build a tiny client-side preview HTML (safe-escaped) to emulate server preview
  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const buildLocalPreviewHtml = (content) => {
    const title = escapeHtml(content.title || 'Preview');
    const body = escapeHtml(content.body || '');
    // Minimal styling to make it visible and similar to server output
    return `
      <article class="local-preview-quick" style="padding:1.25rem">
        <h2 style=\"margin-top:0;\">${title}</h2>
        <div>${body.replace(/\n/g, '<br/>')}</div>
      </article>
    `;
  };

  const closeTypedPromptDialog = () => {
    showTypedPromptDialog = false;
    // Return focus to the textarea for keyboard users
    const el = document.getElementById('prompt-textarea');
    if (el) el.focus();
  };

  

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
    bind:value={currentPrompt}
    on:input={() => promptStore.set(currentPrompt)}
    rows="6"
    placeholder="e.g., A noir detective story set in a city of robots."
  disabled={(uiState && uiState.status === 'loading')}
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
    <button
      data-testid="generate-button"
      on:click={handleGenerateNow}
      disabled={(uiState && uiState.status === 'loading') || isGenerating || isPreviewing}
      aria-busy={isGenerating}
      aria-disabled={(uiState && uiState.status === 'loading') || isPreviewing}
      aria-live="polite"
      title={(uiState && uiState.status === 'loading') || isGenerating ? 'Generating... please wait' : 'Generate content from prompt'}
      class:flash={generateFlash}
    >
      {#if isGenerating}
        <span class="spinner" aria-hidden="true"></span>
        <span class="visually-hidden">Generating…</span>
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

  {#if import.meta.env.DEV}
    <div class="dev-status">
      <label for="dev-status-textarea">Dev status</label>
      <textarea id="dev-status-textarea" readonly rows="4">{JSON.stringify({ status: uiState.status, message: uiState.message, previewLength: $previewStore ? $previewStore.length : 0 }, null, 2)}</textarea>
    </div>
  {/if}
</div>

  {#if showTypedPromptDialog}
    <div class="typed-prompt-backdrop" role="dialog" aria-modal="true">
      <div class="typed-prompt-modal" role="document">
    <h3 id="typed-prompt-title">Hi</h3>
  <p class="typed-prompt-text">Hi</p>
        <div class="typed-prompt-actions">
          <button on:click={closeTypedPromptDialog} data-testid="typed-prompt-ok">OK</button>
        </div>
      </div>
    </div>
  {/if}

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
  .spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 0.5rem;
    vertical-align: middle;
  }
  .visually-hidden { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .error-message {
    color: #e74c3c;
    margin-top: 0.5rem;
  }
  /* Typed prompt modal styles (Step 1A) */
  .typed-prompt-backdrop {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .typed-prompt-modal {
    background: white;
    padding: 1rem 1.25rem;
    border-radius: 8px;
    max-width: 640px;
    width: 90%;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  }
  .typed-prompt-text { margin-top: 0.5rem; white-space: pre-wrap }
  .typed-prompt-actions { margin-top: 1rem; text-align: right }
  button.flash {
    background-color: #c0392b !important;
    box-shadow: 0 0 0 4px rgba(192,57,43,0.12);
    transform: scale(1.03);
  }
  .dev-status { margin-top: 0.75rem }
  .dev-status textarea { width: 100%; font-family: monospace; font-size: 0.9rem; background:#f4f6f8; border: 1px dashed #ccc; padding:0.5rem }
</style>
