<script>
  import PreviewWindow from "../components/PreviewWindow.svelte";
  import { previewStore } from "../lib/storeAdapter.js";
  import PromptForm from "../components/PromptForm.svelte";

  let uiState = { status: "idle", message: "" };

  // seed sample content for local dev
  if (typeof window !== "undefined" && previewStore) {
    previewStore.set("<h2>Sample Poem</h2><p>A line of verse.</p>");
  }
</script>

<div style="height:100vh;padding:24px">
  <h1>Preview Route (client-v2)</h1>
  <div style="margin-top:12px">
    <PromptForm
      on:loading={(e) => {
        uiState.status = e.detail.loading ? "loading" : "idle";
      }}
      on:result={(e) => {
        previewStore.set(e.detail.html);
        uiState.status = "idle";
      }}
      on:error={(e) => {
        uiState.status = "idle";
        uiState.message = e.detail.error || "Error";
      }}
    />
  </div>
  <div style="height:70%;margin-top:12px">
    <PreviewWindow {uiState} />
  </div>
</div>
