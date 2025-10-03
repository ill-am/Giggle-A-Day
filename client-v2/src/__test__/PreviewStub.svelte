<script>
  import { previewStore } from "../lib/storeAdapter.js";
  // Subscribe to the store so Svelte reactive $previewStore works

  // Mirror test hook behavior: set body attribute when preview present
  $: if (typeof document !== "undefined") {
    if ($previewStore && $previewStore.length > 0) {
      document.body.setAttribute("data-preview-ready", "1");
    } else {
      document.body.removeAttribute("data-preview-ready");
    }
  }
</script>

{#if $previewStore && $previewStore.length > 0}
  <div data-testid="preview-content">{@html $previewStore}</div>
{:else}
  <div data-testid="preview-content">No preview</div>
{/if}
