// Mock AI service used in tests and local development.
// Behavior:
// - If process.env.SIMULATE_AI_FAILURE is set ("1" or "true"), generateContent throws.
// - Otherwise it returns a deterministic mock response matching tests' expectations.
exports.MockAIService = class {
  async generateContent(prompt) {
    const fail = String(process.env.SIMULATE_AI_FAILURE || "").toLowerCase();
    if (fail === "1" || fail === "true") {
      throw new Error("simulated-ai-failure");
    }

    const title =
      typeof prompt === "string" && prompt.length > 0
        ? `Mock: ${prompt.split(" ").slice(0, 5).join(" ")}`
        : "Mock Title";
    const body = `This is a mock response for prompt: ${String(prompt)}.`;
    const layout = "poem-single-column";
    const metadata = {
      model: "mock-1",
      tokens: Math.max(10, Math.min(200, String(prompt || "").length)),
    };

    return {
      content: { title, body, layout },
      metadata,
    };
  }
};
