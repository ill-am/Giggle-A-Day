// poem-to-image-cloudflare.js

import fetch from "node-fetch";
import fs from "fs";
// Dynamically import verifier to support both ESM and CJS consumers
let verifyImageMatchesText = null;
(async () => {
  try {
    const mod = await import("../imageGenerator.js");
    verifyImageMatchesText =
      mod.verifyImageMatchesText ||
      mod.default?.verifyImageMatchesText ||
      mod.verifyImageMatchesText;
  } catch (e) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("../imageGenerator.js");
      verifyImageMatchesText = mod.verifyImageMatchesText;
    } catch (e2) {
      verifyImageMatchesText = null;
    }
  }
})();

// --- Type definitions for API responses ---
/** @typedef {Object} GeminiError {
 *   error: {
 *     code: number,
 *     message: string,
 *     status: string
 *   }
 * } */

/** @typedef {Object} GeminiContent {
 *   parts: Array<{text: string}>
 * } */

/** @typedef {Object} GeminiCandidate {
 *   content: GeminiContent,
 *   finishReason: string
 * } */

/** @typedef {Object} GeminiResponse {
 *   candidates: GeminiCandidate[]
 * } */

// --- CONFIGURATION: Replace with your actual Gemini and Cloudflare details ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
const GEMINI_API_URL = process.env.GEMINI_API_URL || "YOUR_GEMINI_API_URL";
const CLOUDFLARE_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "YOUR_CLOUDFLARE_ACCOUNT_ID";
const CLOUDFLARE_API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN || "YOUR_CLOUDFLARE_API_TOKEN";
// --------------------------------------------------------------------------

/**
 * A generic function to call the Gemini API.
 * @param {string} prompt - The text prompt to send.
 * @returns {Promise<string>} The generated text from the model.
 */
async function generateWithGemini(prompt) {
  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  });

  try {
    const response = await fetch(url, { method: "POST", headers, body });
    if (!response.ok) {
      /** @type {GeminiError} */
      const errorData = await response.json();
      if (errorData && typeof errorData === "object" && "error" in errorData) {
        throw new Error(`Gemini API Error: ${JSON.stringify(errorData.error)}`);
      }
      throw new Error(`Gemini API Error: Unknown error structure`);
    }

    /** @type {GeminiResponse} */
    const data = await response.json();

    // Type-safe access with runtime validation
    if (!data || !Array.isArray(data.candidates)) {
      throw new Error(
        "Invalid API response structure: missing candidates array"
      );
    }

    const textContent = data.candidates[0]?.content?.parts?.[0]?.text;

    if (textContent) {
      return textContent;
    } else {
      // This handles cases where the response is successful but empty (e.g., due to safety filters)
      // or has an unexpected structure.
      console.error(
        "Unexpected response structure from Gemini API:",
        JSON.stringify(data, null, 2)
      );
      throw new Error("Could not extract text from Gemini API response.");
    }
    // --- ROBUSTNESS FIX ENDS HERE ---
  } catch (error) {
    console.error("Error calling Gemini API:", error.message);
    throw error; // Re-throw the error so the main function knows to stop
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
    Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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
  const poemTheme =
    "an ancient, moss-covered robot sleeping in a sunlit forest clearing.";
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

  // Ensure the output directory exists
  const outputDir = "./samples/images";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Use the same timestamp for all related files
  const timestamp = Date.now();
  const imageOutputPath = `${outputDir}/poem_image_${timestamp}.png`;
  const poemOutputPath = `${outputDir}/poem_text_${timestamp}.txt`;
  const poemPromptPath = `${outputDir}/poem_prompt-text_${timestamp}.txt`;
  const imagePromptPath = `${outputDir}/poem_prompt-image_${timestamp}.txt`;

  // Save all files: generated content and their prompts
  fs.writeFileSync(imageOutputPath, imageBuffer);
  fs.writeFileSync(poemOutputPath, poem);
  fs.writeFileSync(poemPromptPath, poemGenerationPrompt);
  fs.writeFileSync(imagePromptPath, visualPrompt);

  // Run image verification and write results
  try {
    const verification = await verifyImageMatchesText(imageOutputPath, poem);
    const verificationPath = `${outputDir}/verification_${timestamp}.json`;
    fs.writeFileSync(verificationPath, JSON.stringify(verification, null, 2));
    console.log(`\n🔎 Verification written: ${verificationPath}`);
  } catch (e) {
    console.warn("Image verification failed:", e && e.message ? e.message : e);
  }

  console.log(`\n✅ Success! Files saved:
  - Image: ${imageOutputPath}
  - Poem: ${poemOutputPath}
  - Poem Prompt: ${poemPromptPath}
  - Image Prompt: ${imagePromptPath}`);
}

// Run the main workflow
main().catch((error) => {
  console.error("\nWorkflow failed.", error.message);
});
