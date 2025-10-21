import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("genieService persistence read-only lookup", () => {
  let genieService;

  beforeEach(async () => {
    // Reset module registry between tests
    vi.resetModules();
  });

  it("returns DB cached result when persistence enabled and match found", async () => {
    // Mock dbUtils to return a matching prompt and an AI result
    const mockDbUtils = {
      getPrompts: vi.fn(async () => [{ id: 42, prompt: "Hello world" }]),
      getAIResultById: vi.fn(async (id) => ({
        id: 101,
        result: JSON.stringify({
          content: { title: "T", body: "B" },
          copies: [],
        }),
      })),
    };

    vi.mock("../utils/dbUtils.js", () => mockDbUtils, { virtual: true });
    // Ensure sampleService is not called when DB hit
    const mockSample = {
      generateFromPrompt: vi.fn(async () => ({
        content: { title: "X", body: "Y" },
        copies: [],
      })),
    };
    vi.mock("../sampleService.js", () => mockSample, { virtual: true });

    genieService = await import("../genieService.js");
    process.env.GENIE_PERSISTENCE_ENABLED = "1";

    const res = await genieService.generate("Hello world");
    expect(res.success).toBe(true);
    expect(res.data.promptId).toBe(42);
    expect(res.data.resultId).toBe(101);
    // sampleService should not have been called
    expect(mockSample.generateFromPrompt).not.toHaveBeenCalled();
  });

  it("calls generator when no DB match", async () => {
    const mockDbUtils = {
      getPrompts: vi.fn(async () => []),
      getAIResultById: vi.fn(async () => null),
    };
    vi.mock("../utils/dbUtils.js", () => mockDbUtils, { virtual: true });

    const mockSample = {
      generateFromPrompt: vi.fn(async () => ({
        content: { title: "G", body: "gen" },
        copies: ["a"],
      })),
    };
    vi.mock("../sampleService.js", () => mockSample, { virtual: true });

    genieService = await import("../genieService.js");
    process.env.GENIE_PERSISTENCE_ENABLED = "1";

    const res = await genieService.generate("No match");
    expect(res.success).toBe(true);
    expect(res.data.content.title).toBe("G");
    expect(mockSample.generateFromPrompt).toHaveBeenCalled();
  });
});
