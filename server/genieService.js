const sampleService = require("./sampleService");

module.exports = {
  // For the demo, generate delegates to sampleService. In future this can
  // orchestrate real AI/image jobs via aetherService.
  async generate(prompt) {
    if (!prompt || !String(prompt).trim()) {
      const e = new Error("Prompt is required");
      e.status = 400;
      throw e;
    }

    // Synchronous demo service - wrap in Promise to keep async contract
    try {
      const result = sampleService.generateFromPrompt(prompt);
      return {
        success: true,
        data: {
          content: result.content,
          copies: result.copies,
          filename: result.filename,
        },
      };
    } catch (err) {
      const e = new Error("Generation failed: " + (err && err.message));
      e.status = 500;
      throw e;
    }
  },

  readLatest() {
    return sampleService.readLatest();
  },
};
