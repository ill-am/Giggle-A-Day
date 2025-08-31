<script lang="ts">
  import { uiStateStore } from '../stores';
  import { fade } from 'svelte/transition';

  let uiState: { status: string; message: string };
  uiStateStore.subscribe(value => {
    uiState = value;
  });
</script>

{#if uiState.status === 'loading' || uiState.status === 'error' || uiState.status === 'success'}
  <div class="status-banner" class:loading={uiState.status === 'loading'} class:error={uiState.status === 'error'} class:success={uiState.status === 'success'} transition:fade>
    <p>{uiState.message}</p>
    {#if uiState.status === 'error'}
      <div class="actions">
        <button class="retry" on:click={() => uiStateStore.set({ status: 'idle', message: '' })}>Dismiss</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .status-banner {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1rem 2rem;
    border-radius: 8px;
    color: white;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-weight: 500;
  }
  .loading {
    background-color: #3498db;
  }
  .error {
    background-color: #e74c3c;
  }
</style>
