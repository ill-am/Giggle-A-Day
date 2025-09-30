<script>
  let poem = `An example summer poem:\n\nThe sun drips gold upon the lane,\nA lazy breeze hums through the grain.`;
</script>

<main>
  <h1>client-v2 — Preview</h1>
  <div class="preview">
    <pre>{poem}</pre>
  </div>
</main>

<style>
  main {
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    padding: 2rem;
  }
  .preview {
    border: 1px solid #ddd;
    padding: 1rem;
    border-radius: 8px;
    background: linear-gradient(180deg, #fff, #f8fdf7);
  }
  pre {
    white-space: pre-wrap;
    font-family: inherit;
  }
</style>
