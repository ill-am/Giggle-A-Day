<script>
  import { onMount, onDestroy } from 'svelte';
  import { previewStore, uiStateStore } from '$lib/stores';
  import Spinner from './Spinner.svelte';
  
  // Development flag
  const IS_DEV = import.meta?.env?.DEV || false;
  
  let error = null;
  
  function handleError(err) {
    console.error('[PreviewWindow] Caught error:', err);
    error = err;
  }

  onMount(() => {
    // @ts-ignore
  });

  let uiState = { status: 'idle', message: '' };
  uiStateStore.subscribe(value => {
    uiState = value || { status: 'idle', message: '' };
    console.debug('[PreviewWindow] UI State update:', uiState);
  });

  previewStore.subscribe(value => {
    console.debug('[PreviewWindow] Preview content update:', {
      hasValue: !!value,
      contentLength: value?.length,
      isEmpty: value === '',
      isNull: value === null,
      content: value?.substring(0, 100),
      type: typeof value,
      willDisplay: value && value.length > 0
    });
  });

  // Test hook: Set an attribute on the body when the preview is rendered
  // so that integration tests can reliably wait for the update.
  $: {
    if (typeof document !== 'undefined') {
      if ($previewStore && $previewStore.length > 0) {
        document.body.setAttribute('data-preview-ready', '1');
        if (IS_DEV) {
          console.debug('[DEV] PreviewWindow reactive update:', {
            previewLength: $previewStore.length,
            preview: $previewStore.substring(0, 100) + '...'
          });
        }
      } else {
        document.body.removeAttribute('data-preview-ready');
        if (IS_DEV) {
          console.debug('[DEV] PreviewWindow reactive update: No preview content');
        }
      }
    }
  }
</script>

<div class="preview-container">
  {#if error}
    <div class="error-state">
      <p>Error displaying preview: {error.message}</p>
    </div>
  {:else if uiState.status === 'loading'}
    <div class="loading-overlay">
      <Spinner />
      <p>{uiState.message || 'Loading Preview...'}</p>
    </div>
  {:else if $previewStore && $previewStore.length > 0}
    <div class="preview-content" data-testid="preview-content">
      {@html $previewStore}
    </div>
  {:else}
    <div class="placeholder">
      <p>Your generated preview will appear here.</p>
      <small>Debug info - previewStore: {typeof $previewStore}, length: {$previewStore?.length}, UI state: {uiState.status}</small>
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
    max-width: 800px;
    margin: 2rem auto;
    padding: 1.5rem;
    text-align: left;
    width: 100%;
    min-height: 200px;
    font-family: system-ui;
    border: 1px solid #ddd;
    background: white;
  }
  .preview-content :global(h1) {
    color: #2c3e50;
    margin-bottom: 1rem;
  }
  .preview-content :global(.content) {
    line-height: 1.6;
  }
  .placeholder {
    color: #888;
  }
</style>
