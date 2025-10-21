const sampleService = require("./sampleService");
const { saveContentToFile } = require("./utils/fileUtils");
const normalizePrompt = require("./utils/normalizePrompt");
// dbUtils is a Prisma-backed shim present in the repo. Lazy-require inside
// functions that use it to avoid instantiating DB connections when not needed.

const ENABLE_PERSISTENCE =
  process.env.GENIE_PERSISTENCE_ENABLED === "1" ||
  process.env.GENIE_PERSISTENCE_ENABLED === "true";

const genieService = {
  // For the demo, generate delegates to sampleService. In future this can
  // orchestrate real AI/image jobs via aetherService.
  async generate(prompt) {
    if (!prompt || !String(prompt).trim()) {
      const e = new Error("Prompt is required");
      // @ts-ignore
      e.status = 400;
      throw e;
    }

    // If persistence/lookup is enabled, attempt a read-only DB lookup first.
    if (ENABLE_PERSISTENCE) {
      try {
        const dbUtils = require("./utils/dbUtils");
        const norm = normalizePrompt(prompt);
        // Try to find a prompt with matching normalized text. dbUtils.getPrompts
        // returns recent prompts; keep this read-only and non-fatal.
        const prompts = await dbUtils.getPrompts(200);
        const match = (prompts || []).find((p) => {
          try {
            return (
              typeof p.prompt === "string" && normalizePrompt(p.prompt) === norm
            );
          } catch (e) {
            return false;
          }
        });

        if (match && match.id) {
          // Load latest AI result for this prompt id.
          try {
            const results = (await dbUtils.getPrompts)
              ? await dbUtils.getPrompts()
              : [];
            // Prefer direct AI result lookup when available
            const aiRow = await dbUtils
              .getAIResultById(match.id)
              .catch(() => null);
            if (aiRow && aiRow.result) {
              const resultObj =
                typeof aiRow.result === "string"
                  ? JSON.parse(aiRow.result)
                  : aiRow.result;
              return {
                success: true,
                data: {
                  content: resultObj.content || resultObj,
                  copies: resultObj.copies || [],
                  promptId: match.id,
                  resultId: aiRow.id,
                },
              };
            }
          } catch (e) {
            // non-fatal; fall through to generation
          }
        }
      } catch (e) {
        // Non-fatal: log and fall back to generation
        // eslint-disable-next-line no-console
        console.warn("genieService: read-only lookup failed", e && e.message);
      }
    }

    // Synchronous demo service - wrap in Promise to keep async contract
    try {
      const result = await sampleService.generateFromPrompt(prompt);
      return {
        success: true,
        data: {
          content: result.content,
          copies: result.copies,
        },
      };
    } catch (err) {
      const e = new Error("Generation failed: " + (err && err.message));
      // @ts-ignore
      e.status = 500;
      throw e;
    }
  },

  readLatest() {
    try {
      const { readLatest } = require("./utils/fileUtils");
      return readLatest();
    } catch (e) {
      return null;
    }
  },

  // Backwards-compatible wrapper that delegates to utils/fileUtils
  saveContentToFile(content) {
    return saveContentToFile(content);
  },
};

module.exports = genieService;
