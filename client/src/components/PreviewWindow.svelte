<script>
  import { previewStore, uiStateStore } from '../stores';
  import Spinner from './Spinner.svelte';

  let uiState = { status: 'idle', message: '' };
  uiStateStore.subscribe(value => {
    uiState = value || { status: 'idle', message: '' };
  });
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
