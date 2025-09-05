<script>
  import { contentStore, previewStore, uiStateStore } from '../stores';
  import { loadPreview } from '../lib/api';
  import Spinner from './Spinner.svelte';
  import PreviewSkeleton from './PreviewSkeleton.svelte';
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

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  // expose debug hook for automated verification: latest preview HTML
  let latestPreviewHtml = '';
  $: if ($previewStore) {
    latestPreviewHtml = $previewStore;
    try {
  // @ts-ignore
  window.__preview_updated_ts = Date.now();
  // @ts-ignore
  window.__preview_html_snippet = String($previewStore).slice(0, 1200);
    } catch (e) {}
  }

  // Dev-only DOM marker to help automated verification detect updates
  $: if (import.meta.env.DEV && $previewStore) {
    try {
      const el = document.querySelector('.preview-container');
      if (el) el.setAttribute('data-preview-updated', String(Date.now()));
    } catch (e) {}
  }

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
  // update token to prevent race conditions
  let latestUpdateId = 0;
  let isPreviewing = false;

  const updatePreview = async (newContent) => {
    if (!newContent) {
      previewStore.set('');
      return;
    }
    const updateId = ++latestUpdateId;
    isPreviewing = true;
    // show loading state
    uiStateStore.set({ status: 'loading', message: 'Loading preview...' });
    // enforce minimal skeleton visibility to avoid flash
    const skeletonShownAt = Date.now();
    try {
      const html = await loadPreview(newContent);
      // only apply if this update matches latest
      if (updateId === latestUpdateId) {
        const elapsed = Date.now() - skeletonShownAt;
        const minVisible = 300;
        if (elapsed < minVisible) await new Promise(r => setTimeout(r, minVisible - elapsed));
        previewStore.set(html);
        flash = true;
        setTimeout(() => (flash = false), 600);
        uiStateStore.set({ status: 'success', message: 'Preview loaded' });
      }
    } catch (error) {
      if (updateId === latestUpdateId) {
        uiStateStore.set({ status: 'error', message: `Failed to load preview: ${error.message}` });
        previewStore.set('');
      }
    } finally {
      if (updateId === latestUpdateId) isPreviewing = false;
    }
  };

  // Debounced auto update to avoid rapid requests (200ms for snappier feel)
  const debouncedUpdate = debounce(updatePreview, 200);

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

  {#if $previewStore}
    <div class="preview-stage {flash ? 'flash' : ''}">
      {#if bgUrl}
        <div class="bg-preview"><img src={bgUrl} alt="background preview" /></div>
      {/if}
      <div class="preview-content" data-testid="preview-content">
        {@html $previewStore}
      </div>
    </div>
  {:else if isPreviewing || uiState.status === 'loading'}
    <div class="loading-overlay">
      <PreviewSkeleton />
      <div class="center-spinner"><Spinner /></div>
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
