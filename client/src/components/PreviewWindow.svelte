<script>
  import { onMount } from 'svelte';
  import { previewStore, uiStateStore } from '$lib/stores';
  import Spinner from './Spinner.svelte';

  onMount(() => {
    // @ts-ignore
  });

  let uiState = { status: 'idle', message: '' };
  uiStateStore.subscribe(value => {
    uiState = value || { status: 'idle', message: '' };
  });

  // Test hook: Set an attribute on the body when the preview is rendered
  // so that integration tests can reliably wait for the update.
  $: {
    if (typeof document !== 'undefined') {
      if ($previewStore && $previewStore.length > 0) {
        document.body.setAttribute('data-preview-ready', '1');
        if (typeof window !== 'undefined' && window.IS_DEV) {
          console.debug('[DEV] PreviewWindow reactive update:', {
            previewLength: $previewStore.length,
            preview: $previewStore.substring(0, 100) + '...'
          });
        }
      } else {
        document.body.removeAttribute('data-preview-ready');
        if (typeof window !== 'undefined' && window.IS_DEV) {
          console.debug('[DEV] PreviewWindow reactive update: No preview content');
        }
      }
    }
  }
</script>

<div class="preview-container">
  {#if uiState.status === 'loading'}
    <div class="loading-overlay">
      <Spinner />
      <p>{uiState.message || 'Loading Preview...'}</p>
    </div>
  {:else if $previewStore}
    <div class="preview-content" data-testid="preview-content">
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
    min-height: 240px;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .loading-overlay {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #888;
  }
  .preview-content {
    padding: 1.5rem;
    text-align: left;
    width: 100%;
    height: 100%;
  }
  .placeholder {
    color: #888;
  }
</style>
