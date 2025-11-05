// Services MUST be pure: return canonical Envelope and optional actions.
// This module provides a minimal, testable implementation of the Generation
// contract: async generate(prompt) -> { envelope, metadata? }

function buildContent(prompt, opts = {}) {
  const maxWords = opts.titleWords || 6;
  const words = String(prompt || "")
    .split(/\s+/)
    .filter(Boolean);
  const title = `Prompt: ${words.slice(0, maxWords).join(" ")}`;
  const body = String(prompt || "");
  return { title, body };
}

function makeCopies(content, n = 3) {
  return Array.from({ length: n }, () => ({ ...content }));
}

function buildPagesFromCopies(copies) {
  return copies.map((c, idx) => ({
    id: `p${idx + 1}`,
    title: c.title,
    blocks: [
      {
        type: "text",
        content: c.body,
      },
    ],
  }));
}

async function generate(promptOrEnvelope, opts = {}) {
  // Pure: do not perform any I/O or persistence here.
  // Support two call shapes:
  // 1) string prompt (legacy internal callers) -> return { envelope, metadata }
  // 2) { in_envelope, out_envelope } -> populate out_envelope and return full envelope

  // If caller passed envelope request
  if (
    promptOrEnvelope &&
    typeof promptOrEnvelope === "object" &&
    promptOrEnvelope.in_envelope
  ) {
    const inEnv = promptOrEnvelope.in_envelope || {};
    const outEnv = promptOrEnvelope.out_envelope || {};

    const content = buildContent(inEnv.prompt || "", opts);
    const copies = makeCopies(content, opts.copies || 3);
    const pages = buildPagesFromCopies(copies);

    // Populate out_envelope with canonical pages and metadata
    outEnv.pages = pages;
    outEnv.metadata = outEnv.metadata || { model: "sample-v1" };

    const envelope = {
      version: 1,
      in_envelope: inEnv,
      out_envelope: outEnv,
    };
    const metadata = { generatedAt: new Date().toISOString() };
    return { envelope, metadata };
  }

  // Legacy string prompt path: produce canonical envelope for compatibility
  const content = buildContent(promptOrEnvelope, opts);
  const copies = makeCopies(content, opts.copies || 3);
  const pages = buildPagesFromCopies(copies);

  const envelope = {
    // id assigned later by persistence
    version: 1,
    metadata: { model: "sample-v1" },
    pages,
  };

  const metadata = { generatedAt: new Date().toISOString() };
  return { envelope, metadata };
}

// Keep a backward-compatible wrapper name for callers that used the old API.
async function generateFromPrompt(prompt, opts = {}) {
  return generate(prompt, opts);
}

module.exports = {
  buildContent,
  makeCopies,
  buildPagesFromCopies,
  generate,
  generateFromPrompt,
};
