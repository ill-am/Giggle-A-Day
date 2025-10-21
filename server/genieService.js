let sampleService = require("./sampleService");
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
        const dbUtils =
          typeof _injectedDbUtils !== "undefined"
            ? _injectedDbUtils
            : require("./utils/dbUtils");
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
      const svc =
        typeof _injectedSampleService !== "undefined"
          ? _injectedSampleService
          : sampleService;
      const result = await svc.generateFromPrompt(prompt);

      const out = {
        success: true,
        data: {
          content: result.content,
          copies: result.copies,
        },
      };

      // If persistence is enabled, attempt to persist the prompt and AI result.
      // This is best-effort and must not block or fail the generation response.
      if (ENABLE_PERSISTENCE) {
        (async () => {
          try {
            const dbUtils =
              typeof _injectedDbUtils !== "undefined"
                ? _injectedDbUtils
                : require("./utils/dbUtils");

            // Create prompt record
            try {
              const p = await dbUtils.createPrompt(String(prompt));
              if (p && p.id) out.data.promptId = p.id;

              // Create AI result record linked to the prompt
              try {
                const ai = await dbUtils.createAIResult(out.data.promptId, {
                  content: out.data.content,
                  copies: out.data.copies,
                });
                if (ai && ai.id) out.data.resultId = ai.id;
              } catch (e) {
                // non-fatal: log and continue
                // eslint-disable-next-line no-console
                console.warn(
                  "genieService: failed to create AI result",
                  e && e.message
                );
              }
            } catch (e) {
              // non-fatal: log and continue
              // eslint-disable-next-line no-console
              console.warn(
                "genieService: failed to create prompt",
                e && e.message
              );
            }
          } catch (e) {
            // Non-fatal: log and ignore persistence failures
            // eslint-disable-next-line no-console
            console.warn(
              "genieService: persistence step failed",
              e && e.message
            );
          }
        })();
      }

      return out;
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

// Test helpers: allow injecting a mock dbUtils or sample service for unit tests
let _injectedDbUtils;
let _injectedSampleService;
module.exports._setDbUtils = (m) => {
  _injectedDbUtils = m;
};
module.exports._resetDbUtils = () => {
  _injectedDbUtils = undefined;
};
module.exports._setSampleService = (m) => {
  _injectedSampleService = m;
};
module.exports._resetSampleService = () => {
  _injectedSampleService = undefined;
};
