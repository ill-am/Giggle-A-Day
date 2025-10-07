// genieService.js
// Orchestrator that accepts payloads from plumbing, calls application services
// (like sampleService), resolves generator intents (stubbed here), sanitizes
// content via a sanitizer module, and returns persistInstructions for the
// persistence executor to run.

const { generateFromPrompt } = require("./sampleService");
const { sanitizeHtml } = require("./sanitizer");
const crypto = require("crypto");

function makeRequestId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return "req-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

async function generate(payload = {}, opts = {}) {
  const requestId = makeRequestId();

  // Call application service to produce intents and content
  const svcRes = await generateFromPrompt(payload);
  if (!svcRes || !svcRes.success) {
    return { success: false, error: "application-service-failed", requestId };
  }

  const { content, metadata, persistIntents } = svcRes.data;

  // Basic sanitization on content fields (defensive)
  const safeContent = {
    ...content,
    title: sanitizeHtml(String(content.title || "")),
    body: sanitizeHtml(String(content.body || "")),
  };

  // Convert persistIntents into persistInstructions (without final paths)
  // Persistence executor will resolve safe final paths and write them.
  const persistInstructions = (persistIntents || []).map((intent, idx) => {
    return {
      purpose: intent.purpose,
      filenameHint: intent.filenameHint || `artifact-${requestId}-${idx}`,
      folderHint: intent.folderHint || "exports",
      content: intent.content || "",
      encoding: intent.encoding || "utf8",
      // keep original intent for traceability
      originalIntent: intent,
    };
  });

  return {
    success: true,
    data: {
      content: safeContent,
      metadata: { ...metadata, requestId },
      persistInstructions,
      requestId,
    },
  };
}

module.exports = { generate };
const sampleService = require("./sampleService");

/**
 * @typedef {{ title?: string, body?: string, layout?: string }} AIContent
 */

module.exports = {
  // For the demo, generate delegates to sampleService. In future this can
  // orchestrate real AI/image jobs via aetherService.
  async generate(prompt) {
    if (!prompt || !String(prompt).trim()) {
      const e = new Error("Prompt is required");
      /** @type {any} */ (e).status = 400;
      throw e;
    }

    // Allow tests to simulate an AI failure via env var
    const fail = String(process.env.SIMULATE_AI_FAILURE || "").toLowerCase();
    if (fail === "1" || fail === "true") {
      const e = new Error("simulated-ai-failure");
      /** @type {any} */ (e).status = 500;
      throw e;
    }

    // Synchronous demo service - wrap in Promise to keep async contract
    try {
      const result = sampleService.generateFromPrompt(prompt);
      // Normalize the demo content to match the AI service shape expected
      // by API tests (include layout + metadata).
      /** @type {AIContent} */
      const content = { ...(result.content || {}) };
      if (!content.layout)
        /** @type {any} */ (content).layout = "poem-single-column";
      const metadata = {
        model: "mock-1",
        tokens: Math.max(10, Math.min(200, String(prompt).length)),
      };

      return {
        success: true,
        data: {
          content,
          metadata,
          copies: result.copies,
          filename: result.filename,
        },
      };
    } catch (err) {
      const e = new Error("Generation failed: " + (err && err.message));
      /** @type {any} */ (e).status = 500;
      throw e;
    }
  },

  readLatest() {
    return sampleService.readLatest();
  },
};
