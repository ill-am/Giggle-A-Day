<script lang="ts">
  import { contentStore, uiStateStore } from '../stores';
  import { exportToPdf, abortableFetch } from '../lib/api';

  let content: object | null;
  contentStore.subscribe(value => {
    content = value;
  });

  let uiState: { status: string; message: string };
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  // Local progress for export (0-100)
  let progress = 0;
  let progressInterval = null;
  let currentExportAbort = null;
  let lastError: string | null = null;

  const handleExport = async () => {
    if (!content) {
      uiStateStore.set({ status: 'error', message: 'No content to export.' });
      return;
    }

    // Start staged progress UI
    uiStateStore.set({ status: 'loading', message: 'Preparing images...' });
    progress = 5;
    // Increase progress slowly; real backend jobs would emit progress
    progressInterval = setInterval(() => {
      if (progress < 70) progress += Math.random() * 6;
      else if (progress < 95) progress += Math.random() * 2;
      progress = Math.min(99, Math.round(progress));
    }, 400);

    try {
      // Start abortable export using /api/export
      if (currentExportAbort) {
        try { currentExportAbort(); } catch (e) {}
        currentExportAbort = null;
      }
      const { promise, abort } = abortableFetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
        retryConfig: { maxRetries: 1, initialBackoffMs: 200, maxBackoffMs: 2000 },
      });
      currentExportAbort = abort;
      const resp = await promise;
      currentExportAbort = null;
      if (!resp.ok) throw new Error(`Export failed: ${resp.status}`);
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AetherPress-Export-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      progress = 100;
      lastError = null;
      uiStateStore.set({ status: 'success', message: 'PDF exported successfully.' });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        uiStateStore.set({ status: 'idle', message: 'Export canceled' });
      } else {
        const err = error;
        lastError = err && err.message ? err.message : 'Unknown error';
        uiStateStore.set({ status: 'error', message: `Export failed: ${lastError}` });
      }
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      // reset progress after small delay so UI shows 100 briefly
      setTimeout(() => {
        progress = 0;
      }, 800);
    }
  };

  function cancelExport() {
    if (currentExportAbort) {
      try { currentExportAbort(); } catch (e) {}
      currentExportAbort = null;
      uiStateStore.set({ status: 'idle', message: 'Export canceled' });
      if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
      progress = 0;
    }
  }

  const handleRetry = () => {
    // Clear last error and trigger export again
    lastError = null;
    handleExport();
  };
</script>

{#if content}
  <div class="export-container">
    <div class="actions-row">
      <button
        on:click={handleExport}
        disabled={uiState.status === 'loading'}
        aria-disabled={uiState.status === 'loading'}
        data-testid="export-button"
      >
        {#if uiState.status === 'loading'}
          Exporting... {progress}%
        {:else}
          Export to PDF
        {/if}
      </button>
        {#if uiState.status === 'error' && lastError}
        <button class="retry" on:click={handleRetry} data-testid="retry-button">Retry</button>
      {/if}
        {#if uiState.status === 'loading'}
          <button class="cancel" on:click={cancelExport} data-testid="cancel-export-button">Cancel</button>
        {/if}
    </div>
    {#if uiState.status === 'loading'}
      <div class="progress-bar"><div class="progress" style="width: {progress}%"></div></div>
    {/if}
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
  .progress-bar { width: 100%; height: 8px; background: #eee; border-radius: 4px; margin-top: 8px; overflow: hidden }
  .progress { height: 100%; background: linear-gradient(90deg,#16a085,#1abc9c); width: 0 }
</style>
