<script>
  import { contentStore, previewStore, uiStateStore } from '../stores';
  import Spinner from './Spinner.svelte';
  import { onMount } from 'svelte';

  // Subscribe to contentStore to get the content object for background images
  // and the client-side fallback preview.
  let content;
  contentStore.subscribe(value => {
    content = value;
  });

  // Subscribe to the UI state store.
  let uiState = { status: 'idle', message: '' };
  uiStateStore.subscribe(value => {
    uiState = value || { status: 'idle', message: '' };
  });

  // The component now primarily relies on the auto-subscribed $previewStore
  // to render the preview content directly in the template.

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

  // Preview controls state
  let autoPreview = true;
  let flash = false; // This can be triggered by the $previewStore reactive block if desired

  // --- Debugging helpers ---

  function logStores() {
    try {
      console.log('Imported stores:', { contentStore, previewStore, uiStateStore });
      // You can add more specific store logging here if needed
    } catch (e) { console.warn('logStores failed', e); }
  }

  // Build a tiny client-side preview HTML (safe-escaped) to use as a fallback
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
    return `\n      <article class="local-preview-fallback" style="padding:1.25rem">\n        <h2 style=\"margin-top:0;\">${title}</h2>\n        <div>${body.replace(/\n/g, '<br/>')}</div>\n      </article>\n    `;
  };

  // --- Reactive logic for when the preview store changes ---

  $: if ($previewStore) {
    // When the preview store is updated from anywhere in the app,
    // this component will reactively re-render.
    // We can also trigger side-effects here, like a flash animation.
    flash = true;
    setTimeout(() => (flash = false), 600);
  }
</script>

  <div class="preview-container">

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
    {#if content}
      <!-- Fallback: render a minimal, safe client-side preview from content
           This ensures the preview pane reflects generated content even when
           server-side preview fails or the proxy blocks the request. -->
      <div class="preview-stage fallback-stage">
        <div class="preview-content" data-testid="preview-content">{@html buildLocalPreviewHtml(content)}</div>
      </div>
    {:else}
      <div class="placeholder">
        <p>Your generated preview will appear here.</p>
      </div>
    {/if}
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
    min-height: 240px; /* ensure preview area isn't collapsed to zero height */
  }
  .loading-overlay {
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

  @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

  /* flash highlight when preview updates */
  .preview-stage.flash {
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15) inset, 0 0 0 2px rgba(66,153,225,0.08);
    transition: box-shadow 0.45s ease-out;
  }
</style>
