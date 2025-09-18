# CORE_FLOW_SPEC — Essential Flow Implementation

[THU 18th Sep 2025 @ 10:35AM]

**IMPORTANT: All implementation described in this document should be done in the new branch `aetherV0/min_client_flow` branch.**

Reference: [MIN_CLIENT_SPEC.md](MIN_CLIENT_SPEC.md)

## Sample Demo Scope

```
+------------------+     (1) POST /prompt      +------------------+
|     Frontend     |----------------------->   |     Backend      |
|                  |    {"prompt": "..."}     |                  |
| +--------------+ |                          |                  |
| |Input Prompt  | |                          |    (2) Write    |
| |              | |                          |       |          |
| +--------------+ |                          |       v          |
|                  |                          | latest_prompt.txt|
| +--------------+ |    (4) Display           |                  |
| |Preview Pane  | |    <---------------     |    (3) Return    |
| |              | |    Tripled content      |    3x Content    |
| +--------------+ |                          |                  |
+------------------+                          +------------------+

Demo Interaction:
1. User types: "Hello"
2. Backend saves: "Hello" to latest_prompt.txt
3. Backend returns: "Hello\nHello\nHello"
4. Preview shows three "Hello" lines
```

## Core Flow

1. Frontend sends user's prompt to backend
2. Backend stores prompt in `./samples/latest_prompt.txt`
3. Backend sends back the prompt content in triplicate
4. Frontend displays the returned content in the preview pane

## Required Files

### Frontend

- `client/src/stores/index.js`:

  ```js
  export const promptStore = writable(""); // User's input prompt
  export const previewStore = writable(""); // Content to display
  ```

- `client/src/lib/api.js`:

  ```js
  export const submitPrompt = async (prompt) => {
    const response = await fetch("/prompt", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
    return await response.text();
  };
  ```

- `client/src/components/PreviewWindow.svelte`:
  ```svelte
  <div data-testid="preview-content">
    {$previewStore}
  </div>
  ```

### Backend

- Endpoint: `POST /prompt`
  - Input: `{ "prompt": string }`
  - Actions:
    1. Write prompt to `./samples/latest_prompt.txt`
    2. Return prompt content repeated 3 times
  - Response: Text content

## Verification

1. Enter prompt
2. Click generate
3. Verify:
   - `latest_prompt.txt` contains prompt
   - Preview shows tripled content
