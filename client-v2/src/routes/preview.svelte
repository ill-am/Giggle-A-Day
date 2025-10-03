<script>
  import PreviewWindow from "../components/PreviewWindow.svelte";
  import { previewStore } from "../lib/storeAdapter.js";

  // seed sample content for local dev
  if (typeof window !== "undefined" && previewStore) {
    previewStore.set("<h2>Sample Poem</h2><p>A line of verse.</p>");
  }
</script>

<div style="height:100vh;padding:24px">
  <h1>Preview Route (client-v2)</h1>
  <div style="height:80%;margin-top:12px">
    <PreviewWindow uiState={{ status: "idle" }} />
  </div>
</div>
