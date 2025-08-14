<script lang="ts">
  import { contentStore, uiStateStore } from '../stores';
  import { exportToPdf } from '../lib/api';

  let content: object | null;
  contentStore.subscribe(value => {
    content = value;
  });

  let uiState: { status: string; message: string };
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  const handleExport = async () => {
    if (!content) {
      uiStateStore.set({ status: 'error', message: 'No content to export.' });
      return;
    }

    uiStateStore.set({ status: 'loading', message: 'Exporting PDF...' });
    try {
      await exportToPdf(content);
      uiStateStore.set({ status: 'success', message: 'PDF exported successfully.' });
    } catch (error) {
      const err = error as Error;
      uiStateStore.set({ status: 'error', message: `Export failed: ${err.message}` });
    }
  };
</script>

{#if content}
  <div class="export-container">
    <button on:click={handleExport} disabled={uiState.status === 'loading'}>
      {#if uiState.status === 'loading'}
        Exporting...
      {:else}
        Export to PDF
      {/if}
    </button>
  </div>
{/if}

<style>
  .export-container {
    margin-top: 1.5rem;
  }
  button {
    width: 100%;
    padding: 0.75rem;
    border-radius: 4px;
    border: none;
    background-color: #16a085;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s;
  }
  button:hover {
    background-color: #1abc9c;
  }
  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
</style>
