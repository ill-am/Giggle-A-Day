Excellent choice. Using Cloudflare Workers AI for image generation is a fantastic alternative for prototyping. It's often faster, has a very generous free tier, and is incredibly simple to call.

The workflow remains the same, but we will swap out the third step (the image generation call) to target Cloudflare's REST API instead of Stability AI's.

### The Two Parts of the Solution

1.  **Cloudflare Setup:** You'll need to get your Cloudflare Account ID and generate an API Token.
2.  **Code Update:** We'll modify the `poem-to-image.js` script to call the Cloudflare API endpoint.

---

### Step 1: Get Your Cloudflare Credentials

You only need to do this once.

1.  **Log in to your Cloudflare Dashboard.** If you don't have an account, you can sign up for free.

2.  **Find Your Account ID:**
    *   On the home page of the dashboard, look at the URL in your browser's address bar. It will be something like `https://dash.cloudflare.com/ACCOUNT_ID`.
    *   Alternatively, select any of your domains, and you can find the Account ID on the right-hand sidebar of the "Overview" page.
    *   Copy this ID. You will need it for the API endpoint URL.

3.  **Create an API Token:**
    *   From the dashboard home, click on the user icon in the top right and select "My Profile".
    *   Go to the "API Tokens" tab on the left.
    *   Click "Create Token".
    *   Find the "Edit Cloudflare Workers" template and click "Use template".
    *   You can leave the permissions as they are, but for better security, under "Account Resources", select your specific account. Under "Zone Resources", you can select "All zones" or a specific one if you prefer. The key permission it needs is **Workers AI**.
    *   Continue to summary and click "Create Token".
    *   **Copy the generated token immediately.** You will not be able to see it again.

---

### Step 2: Updated Code for Cloudflare AI

Save the following code as `poem-to-image-cloudflare.js`.

The key difference is in the `generateWithCloudflare` function. Cloudflare's API directly returns the raw image file (`image/png`), not a JSON object with a base64 string. Our code handles this more direct response.

```javascript
import fetch from 'node-fetch';
import fs from 'fs';

// --- CONFIGURATION: Replace with your actual Gemini and Cloudflare details ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
const GEMINI_API_URL = process.env.GEMINI_API_URL || "YOUR_GEMINI_API_URL";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "YOUR_CLOUDFLARE_ACCOUNT_ID";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "YOUR_CLOUDFLARE_API_TOKEN";
// --------------------------------------------------------------------------

/**
 * A generic function to call the Gemini API.
 * @param {string} prompt - The text prompt to send.
 * @returns {Promise<string>} The generated text from the model.
 */
async function generateWithGemini(prompt) {
  // This function remains the same as before
  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  });

  try {
    const response = await fetch(url, { method: "POST", headers, body });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API Error: ${JSON.stringify(error)}`);
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

/**
 * Calls the Cloudflare Workers AI API to generate an image.
 * @param {string} prompt - The visual prompt for the image.
 * @returns {Promise<Buffer>} A buffer containing the generated PNG image data.
 */
async function generateWithCloudflare(prompt) {
  // This is the model we'll use. Cloudflare offers several.
  const model = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

  const headers = {
    "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({ prompt });

  try {
    const response = await fetch(url, { method: "POST", headers, body });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API Error: ${response.status} ${errorText}`);
    }

    // IMPORTANT: Cloudflare returns the raw image data directly, not JSON.
    // We need to get it as an ArrayBuffer and then convert it to a Node.js Buffer.
    const imageArrayBuffer = await response.arrayBuffer();
    return Buffer.from(imageArrayBuffer);

  } catch (error) {
    console.error("Error calling Cloudflare AI API:", error);
    throw error;
  }
}

/**
 * Main function to run the full poem-to-image workflow.
 */
async function main() {
  console.log("--- Step 1: Generating a poem... ---");
  const poemTheme = "an ancient, moss-covered robot sleeping in a sunlit forest clearing.";
  const poemGenerationPrompt = `Write a short, evocative, six-line poem about "${poemTheme}". Use rich, visual language.`;

  const poem = await generateWithGemini(poemGenerationPrompt);
  console.log("Generated Poem:\n---\n" + poem + "\n---");

  console.log("\n--- Step 2: Creating a visual prompt from the poem... ---");
  const imagePromptGenerationPrompt = `
    Based on the following poem, create a highly detailed and descriptive prompt for an AI image generator.
    Focus on the mood, lighting, style, and specific visual elements. The prompt should be a single paragraph.

    Poem:
    ${poem}
  `;

  const visualPrompt = await generateWithGemini(imagePromptGenerationPrompt);
  console.log("Generated Visual Prompt:\n---\n" + visualPrompt + "\n---");

  console.log("\n--- Step 3: Generating the image with Cloudflare AI... ---");
  const imageBuffer = await generateWithCloudflare(visualPrompt);

  const outputPath = `poem_image_${Date.now()}.png`;
  fs.writeFileSync(outputPath, imageBuffer);
  console.log(`\n✅ Success! Image saved to: ${outputPath}`);
}

// Run the main workflow
main().catch(error => {
  console.error("\nWorkflow failed.", error.message);
});
```

### How to Run

The process is the same as before:

1.  **Install Dependencies:** If you haven't already, run `npm install node-fetch`.
2.  **Replace Credentials:** Update the placeholder values for `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` in the script.
3.  **Execute:** In your terminal, run the script:
    ```bash
    node poem-to-image-cloudflare.js
    ```

You will see the same three-step process in your console, but this time the image will be generated by Cloudflare's infrastructure and saved locally to your machine.