// poem-to-image-stability.js

import fetch from 'node-fetch';
import fs from 'fs';

// --- CONFIGURATION: Replace with your actual API keys ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || "YOUR_STABILITY_AI_KEY";
// ---------------------------------------------------------

const GEMINI_API_URL = "https://generativelace.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent";
const STABILITY_API_URL = "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image";

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
 * Calls the Stability AI API to generate an image.
 * @param {string} prompt - The visual prompt for the image.
 * @returns {Promise<Buffer>} A buffer containing the generated PNG image data.
 */
async function generateWithStability(prompt) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${STABILITY_API_KEY}`,
  };
  const body = JSON.stringify({
    text_prompts: [{ text: prompt }],
    cfg_scale: 7,
    height: 1024,
    width: 1024,
    samples: 1,
    steps: 30,
  });

  try {
    const response = await fetch(STABILITY_API_URL, { method: "POST", headers, body });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stability API Error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const imageBase64 = data.artifacts[0].base64;
    return Buffer.from(imageBase64, 'base64');
  } catch (error) {
    console.error("Error calling Stability AI API:", error);
    throw error;
  }
}

/**
 * Main function to run the full poem-to-image workflow.
 */
async function main() {
  console.log("--- Step 1: Generating a poem... ---");
  const poemTheme = "a forgotten library where books whisper secrets to the moonlight.";
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

  console.log("\n--- Step 3: Generating the image with Stability AI... ---");
  const imageBuffer = await generateWithStability(visualPrompt);

  const outputPath = `poem_image_${Date.now()}.png`;
  fs.writeFileSync(outputPath, imageBuffer);
  console.log(`\n✅ Success! Image saved to: ${outputPath}`);
}

// Run the main workflow
main().catch(error => {
  console.error("\nWorkflow failed.", error.message);
});
