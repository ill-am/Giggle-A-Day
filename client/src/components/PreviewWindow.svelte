<script>
  import { contentStore, previewStore, uiStateStore } from '../stores';
  import { loadPreview } from '../lib/api';
  import { onMount } from 'svelte';

  import { debounce } from '../lib/utils';

  let content;
  contentStore.subscribe(value => {
    content = value;
    if (content && autoPreview) {
      // Debounced auto update to avoid rapid requests
      debouncedUpdate(content);
    }
  });

  // Instrument previewStore updates for diagnostics
  let lastPreview = '';
  previewStore.subscribe(value => {
    if (value !== lastPreview) {
      console.log('PreviewWindow: previewStore updated, length=', value ? value.length : 0);
      lastPreview = value;
    }
  });

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  // Background preview URL derived from content.background (filename or absolute URL)
  $: bgUrl = null;
  $: if (content && content.background) {
    if (typeof content.background === 'string' && content.background.startsWith('http')) {
      bgUrl = content.background;
    } else {
      bgUrl = `/samples/images/${encodeURIComponent(content.background)}`;
    }
  }

  // Preview controls
  let autoPreview = true;
  let flash = false;

  const updatePreview = async (newContent) => {
    if (!newContent) {
      previewStore.set('');
      return;
    }
    try {
      uiStateStore.set({ status: 'loading', message: 'Loading preview...' });
      const html = await loadPreview(newContent);
      previewStore.set(html);
      // trigger brief flash to draw attention
      flash = true;
      setTimeout(() => (flash = false), 600);
      uiStateStore.set({ status: 'success', message: 'Preview loaded' });
    } catch (error) {
      uiStateStore.set({ status: 'error', message: `Failed to load preview: ${error.message}` });
      previewStore.set('');
    }
  };

  // Debounced auto update to avoid rapid requests
  const debouncedUpdate = debounce(updatePreview, 350);

  onMount(() => {
    if (content) {
      updatePreview(content);
    }
  });
</script>

<div class="preview-container">
  <div class="preview-controls">
    <label><input type="checkbox" data-testid="auto-preview-checkbox" bind:checked={autoPreview} /> Auto-preview</label>
    <button data-testid="preview-now-button" on:click={() => updatePreview(content)} disabled={!content || uiState.status === 'loading'}>
      {#if uiState.status === 'loading'}
        Previewing...
      {:else}
        Preview Now
      {/if}
    </button>
  </div>

  {#if uiState.status === 'loading'}
    <div class="loading-overlay">
      <p>Loading Preview...</p>
    </div>
  {:else if $previewStore}
    <div class="preview-stage {flash ? 'flash' : ''}">
      {#if bgUrl}
        <div class="bg-preview"><img src={bgUrl} alt="background preview" /></div>
      {/if}
      <div class="preview-content" data-testid="preview-content">
        {@html $previewStore}
      </div>
    </div>
  {:else}
    <div class="placeholder">
      <p>Your generated preview will appear here.</p>
    </div>
  {/if}
</div>

<style>
  .preview-container {
    position: relative;
    height: 100%;
    width: 100%;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background-color: #f9f9f9;
    overflow-y: auto;
  }
  .loading-overlay, .placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #888;
  }
  .preview-content {
    padding: 1.5rem;
    text-align: left;
  }

  .preview-stage { position: relative; min-height: 300px }
  .bg-preview { position: absolute; inset: 0; opacity: 0.45; pointer-events: none }
  .bg-preview img { width: 100%; height: 100%; object-fit: cover }
  .preview-stage .preview-content { position: relative; z-index: 2 }

  /* flash highlight when preview updates */
  .preview-stage.flash {
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15) inset, 0 0 0 2px rgba(66,153,225,0.08);
    transition: box-shadow 0.45s ease-out;
  }
</style>
