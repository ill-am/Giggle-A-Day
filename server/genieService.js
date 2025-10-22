let sampleService = require("./sampleService");
const { saveContentToFile } = require("./utils/fileUtils");
const normalizePrompt = require("./utils/normalizePrompt");
// dbUtils is a Prisma-backed shim present in the repo. Lazy-require inside
// functions that use it to avoid instantiating DB connections when not needed.

const ENABLE_PERSISTENCE = (() => {
  // Backwards-compat: if the flag is not set, keep persistence enabled to
  // preserve existing behavior (controller previously persisted). When the
  // flag is explicitly set to "0"/"false" persistence can be disabled.
  if (typeof process.env.GENIE_PERSISTENCE_ENABLED === "undefined") return true;
  return (
    process.env.GENIE_PERSISTENCE_ENABLED === "1" ||
    process.env.GENIE_PERSISTENCE_ENABLED === "true"
  );
})();

const AWAIT_PERSISTENCE = (() => {
  if (process.env.NODE_ENV === "test") return true;
  return (
    process.env.GENIE_PERSISTENCE_AWAIT === "1" ||
    process.env.GENIE_PERSISTENCE_AWAIT === "true"
  );
})();

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
        let dbUtils;
        try {
          dbUtils =
            typeof _injectedDbUtils !== "undefined"
              ? _injectedDbUtils
              : require("./utils/dbUtils");
        } catch (e) {
          // If Prisma-backed dbUtils is not available (dev/test without
          // prisma generate), fall back to legacy sqlite `crud` to keep
          // runtime/tests stable. This preserves non-fatal persistence
          // semantics while migrations/Prisma rollout completes.
          // eslint-disable-next-line no-console
          console.warn(
            "genieService: dbUtils unavailable, falling back to legacy crud",
            e && e.message
          );
          try {
            dbUtils = require("./crud");
          } catch (err2) {
            // Re-throw original error if fallback also unavailable
            throw e;
          }
        }
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

      // Ensure returned envelope includes expected fields (metadata, layout)
      const content = result.content || {};
      if (!content.layout) content.layout = "poem-single-column";
      const metadata = result.metadata || {
        model: "mock-1",
        tokens: Math.max(10, Math.min(200, String(prompt || "").length)),
      };

      const out = {
        success: true,
        data: {
          content,
          copies: result.copies || [],
          metadata,
        },
      };

      // If persistence is enabled, attempt to persist the prompt and AI result.
      // This is best-effort and must not block or fail the generation response.
      if (ENABLE_PERSISTENCE) {
        // Provide a Promise hook that tests can await to know when the
        // persistence attempt completes. This hook is optional and only used
        // by tests that set GENIE_PERSISTENCE_AWAIT=1.
        let persistenceResolver;
        let persistenceRejecter;
        const persistencePromise = new Promise((res, rej) => {
          persistenceResolver = res;
          persistenceRejecter = rej;
        });
        // Expose test hook
        genieService._lastPersistencePromise = persistencePromise;

        const runPersistence = async () => {
          try {
            const dbUtils =
              typeof _injectedDbUtils !== "undefined"
                ? _injectedDbUtils
                : require("./utils/dbUtils");
            // Create prompt record with dedupe-on-create handling.
            try {
              let p;
              try {
                p = await dbUtils.createPrompt(String(prompt));
              } catch (createErr) {
                // If create failed due to a uniqueness/constraint error,
                // attempt to recover by searching for an existing prompt
                // that matches the normalized text. This avoids throwing
                // when concurrent requests race to create the same prompt.
                // Normalize and search recent prompts for a match.
                try {
                  const norm = normalizePrompt(prompt);
                  const recent = await dbUtils.getPrompts(200);
                  const found = (recent || []).find((r) => {
                    try {
                      return (
                        typeof r.prompt === "string" &&
                        normalizePrompt(r.prompt) === norm
                      );
                    } catch (e) {
                      return false;
                    }
                  });
                  if (found && found.id) {
                    p = { id: found.id };
                  } else {
                    // Re-throw original create error if we couldn't recover
                    throw createErr;
                  }
                } catch (recoverErr) {
                  // Log recovery failure and rethrow original create error
                  // eslint-disable-next-line no-console
                  console.warn(
                    "genieService: createPrompt failed and recovery failed",
                    createErr && createErr.message,
                    recoverErr && recoverErr.message
                  );
                  throw createErr;
                }
              }

              if (p && p.id) out.data.promptId = p.id;

              // Create AI result record linked to the prompt
              try {
                const aiRes = (await dbUtils.createAIResult)
                  ? await dbUtils.createAIResult(out.data.promptId, {
                      content: out.data.content,
                      copies: out.data.copies,
                    })
                  : null;
                if (aiRes && aiRes.id) out.data.resultId = aiRes.id;
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
            persistenceResolver();
          } catch (e) {
            // Non-fatal: log and ignore persistence failures
            // eslint-disable-next-line no-console
            console.warn(
              "genieService: persistence step failed",
              e && e.message
            );
            persistenceRejecter(e);
          } finally {
            // Clear the last persistence promise after it's settled
            setImmediate(() => {
              genieService._lastPersistencePromise = undefined;
            });
          }
        };

        if (AWAIT_PERSISTENCE) {
          // Await persistence synchronously (test-only mode)
          await runPersistence();
        } else {
          // Fire-and-forget for normal operation
          (async () => {
            await runPersistence();
          })();
        }
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
