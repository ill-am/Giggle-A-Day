const sampleService = require("./sampleService");
const fs = require("fs");
const path = require("path");

// Atomically write to disk: write to a temp file then rename.
function safeWriteFileSync(filePath, contents) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, String(contents), { encoding: "utf8" });
  fs.renameSync(tmp, filePath);
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

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

    // Synchronous demo service - wrap in Promise to keep async contract
    try {
      const result = sampleService.generateFromPrompt(prompt, this);
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
    return sampleService.readLatest();
  },

  saveContentToFile(content) {
    const outputDir = path.resolve(__dirname, "data");
    const filename = `prompt-${getTimestamp()}.txt`;
    const fullPath = path.join(outputDir, filename);
    safeWriteFileSync(fullPath, content);
    return fullPath;
  },
};

module.exports = genieService;
