import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

describe('genieService persistence read-only lookup', () => {
  let genieService;

  import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { createRequire } from 'module';

  describe('genieService persistence read-first lookup and persist-on-miss', () => {
    let genieService;

    beforeEach(() => {
      vi.resetModules();
      genieService = null;
    });

    it('returns cached DB result when a match exists', async () => {
      const mockDbUtils = {
        getPrompts: vi.fn(async () => [{ id: 42, prompt: 'Hello world' }]),
        getAIResultById: vi.fn(async () => ({ id: 101, result: JSON.stringify({ content: { title: 'T', body: 'B' }, copies: [] }) })),
      };

      process.env.GENIE_PERSISTENCE_ENABLED = '1';
      const mockSample = { generateFromPrompt: vi.fn(async () => ({ content: { title: 'X', body: 'Y' }, copies: [] })) };

      const require = createRequire(import.meta.url);
      genieService = require('../genieService.js');
      genieService._setDbUtils(mockDbUtils);
      genieService._setSampleService(mockSample);

      const res = await genieService.generate('Hello world');
      expect(res.success).toBe(true);
      expect(res.data.promptId).toBe(42);
      expect(res.data.resultId).toBe(101);
      expect(mockSample.generateFromPrompt).not.toHaveBeenCalled();
    });

    it('calls the generator and returns generated content when no DB match', async () => {
      const mockDbUtils = { getPrompts: vi.fn(async () => []), getAIResultById: vi.fn(async () => null) };
      process.env.GENIE_PERSISTENCE_ENABLED = '1';
      const mockSample = { generateFromPrompt: vi.fn(async () => ({ content: { title: 'G', body: 'gen' }, copies: ['a'] })) };

      const require = createRequire(import.meta.url);
      genieService = require('../genieService.js');
      genieService._setDbUtils(mockDbUtils);
      genieService._setSampleService(mockSample);

      const res = await genieService.generate('No match');
      expect(res.success).toBe(true);
      expect(res.data.content).toBeTruthy();
      expect(res.data.content.title).toBe('G');
      expect(mockSample.generateFromPrompt).toHaveBeenCalled();
    });

    afterEach(() => {
      process.env.GENIE_PERSISTENCE_ENABLED = undefined;
      if (genieService && typeof genieService._resetDbUtils === 'function') genieService._resetDbUtils();
      if (genieService && typeof genieService._resetSampleService === 'function') genieService._resetSampleService();
      vi.clearAllMocks();
    });
  });
    genieService = null;
  });

  it('returns DB cached result when persistence enabled and match found', async () => {
    const mockDbUtils = {
      getPrompts: vi.fn(async () => [{ id: 42, prompt: 'Hello world' }]),
      getAIResultById: vi.fn(async () => ({ id: 101, result: JSON.stringify({ content: { title: 'T', body: 'B' }, copies: [] }) })),
    };

    process.env.GENIE_PERSISTENCE_ENABLED = '1';
    const mockSample = { generateFromPrompt: vi.fn(async () => ({ content: { title: 'X', body: 'Y' }, copies: [] })) };

    const require = createRequire(import.meta.url);
    genieService = require('../genieService.js');
    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

    const res = await genieService.generate('Hello world');
    expect(res.success).toBe(true);
    expect(res.data.promptId).toBe(42);
    expect(res.data.resultId).toBe(101);
    expect(mockSample.generateFromPrompt).not.toHaveBeenCalled();
  });

  it('calls generator when no DB match', async () => {
    const mockDbUtils = { getPrompts: vi.fn(async () => []), getAIResultById: vi.fn(async () => null) };
    process.env.GENIE_PERSISTENCE_ENABLED = '1';
    const mockSample = { generateFromPrompt: vi.fn(async () => ({ content: { title: 'G', body: 'gen' }, copies: ['a'] })) };

    const require = createRequire(import.meta.url);
    genieService = require('../genieService.js');
    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

    const res = await genieService.generate('No match');
    expect(res.success).toBe(true);
    expect(res.data.content.title).toBe('G');
    expect(mockSample.generateFromPrompt).toHaveBeenCalled();
  });

  afterEach(() => {
    process.env.GENIE_PERSISTENCE_ENABLED = undefined;
    if (genieService && typeof genieService._resetDbUtils === 'function') genieService._resetDbUtils();
    if (genieService && typeof genieService._resetSampleService === 'function') genieService._resetSampleService();
  });
});
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";

describe("genieService persistence read-only lookup", () => {
  let genieService;

  beforeEach(() => {
    vi.resetModules();
  });

  it("returns DB cached result when persistence enabled and match found", async () => {
    const mockDbUtils = {
      getPrompts: vi.fn(async () => [{ id: 42, prompt: "Hello world" }]),
      getAIResultById: vi.fn(async () => ({
        id: 101,
        result: JSON.stringify({ content: { title: "T", body: "B" }, copies: [] }),
      })),
    };

    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    const mockSample = { generateFromPrompt: vi.fn(async () => ({ content: { title: "X", body: "Y" }, copies: [] })) };

    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");
    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

    const res = await genieService.generate("Hello world");
    expect(res.success).toBe(true);
    expect(res.data.promptId).toBe(42);
    expect(res.data.resultId).toBe(101);
    expect(mockSample.generateFromPrompt).not.toHaveBeenCalled();
  });

  it("calls generator when no DB match", async () => {
    const mockDbUtils = { getPrompts: vi.fn(async () => []), getAIResultById: vi.fn(async () => null) };
    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    const mockSample = { generateFromPrompt: vi.fn(async () => ({ content: { title: "G", body: "gen" }, copies: ["a"] })) };

    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");
    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

    const res = await genieService.generate("No match");
    expect(res.success).toBe(true);
    expect(res.data.content.title).toBe("G");
    expect(mockSample.generateFromPrompt).toHaveBeenCalled();
  });

  afterEach(() => {
    // cleanup
    try {
      process.env.GENIE_PERSISTENCE_ENABLED = undefined;
      if (genieService && typeof genieService._resetDbUtils === "function") genieService._resetDbUtils();
      if (genieService && typeof genieService._resetSampleService === "function") genieService._resetSampleService();
    } catch (e) {
      // ignore
    }
  });
});
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";

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
    // Set env var before importing the module under test
    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    // We'll import the module and inject mocks via helpers exposed for tests
    // Ensure sampleService is not called when DB hit
    const mockSample = {
      generateFromPrompt: vi.fn(async () => ({
        content: { title: "X", body: "Y" },
        copies: [],
      })),
    };

    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");
    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

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
    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    const mockSample = {
      generateFromPrompt: vi.fn(async () => ({
        content: { title: "G", body: "gen" },
        copies: ["a"],
      })),
    };
    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");
    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

    const res = await genieService.generate("No match");
    expect(res.success).toBe(true);
    expect(res.data.content.title).toBe("G");
    expect(mockSample.generateFromPrompt).toHaveBeenCalled();
  });
});

afterEach(() => {
  try {

  afterEach(() => {
    try {
      process.env.GENIE_PERSISTENCE_ENABLED = undefined;
      if (genieService && typeof genieService._resetDbUtils === "function")
        genieService._resetDbUtils();
      if (genieService && typeof genieService._resetSampleService === "function")
        genieService._resetSampleService();
    } catch (e) {
      // ignore
    }
  });

});
