<script>
  import { contentStore, previewStore, uiStateStore } from '../stores';
  import { loadPreview } from '../lib/api';
  import { onMount } from 'svelte';

  let content;
  contentStore.subscribe(value => {
    content = value;
    if (content) {
      updatePreview(content);
    }
  });

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  const updatePreview = async (newContent) => {
    if (!newContent) {
      previewStore.set('');
      return;
    }
    try {
      const html = await loadPreview(newContent);
      previewStore.set(html);
    } catch (error) {
      uiStateStore.set({ status: 'error', message: `Failed to load preview: ${error.message}` });
      previewStore.set('');
    }
  };

  onMount(() => {
    if (content) {
      updatePreview(content);
    }
  });
</script>

<div class="preview-container">
  {#if uiState.status === 'loading'}
    <div class="loading-overlay">
      <p>Loading Preview...</p>
    </div>
  {:else if $previewStore}
    <div class="preview-content">
      {@html $previewStore}
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
</style>
