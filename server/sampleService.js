const fs = require("fs");
const path = require("path");

function safeWriteFileSync(filePath, contents) {
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, contents, { encoding: "utf8" });
  fs.renameSync(tmp, filePath);
}

function buildContentFromPrompt(prompt) {
  const title = `Prompt: ${String(prompt).split(" ").slice(0, 6).join(" ")}`;
  const body = String(prompt).replace(/\n/g, "\n");
  return { title, body };
}

module.exports = {
  savePromptToFile(prompt, options = {}) {
    const filename =
      options.filename || path.resolve(process.cwd(), "latest_prompt.txt");
    safeWriteFileSync(filename, String(prompt));
    return filename;
  },

  makeTripleCopy(content) {
    return [content, content, content];
  },

  generateFromPrompt(prompt) {
    const filename = this.savePromptToFile(prompt);
    const content = buildContentFromPrompt(prompt);
    const copies = this.makeTripleCopy(content);
    return { filename, content, copies };
  },

  readLatestPrompt(options = {}) {
    const filename =
      options.filename || path.resolve(process.cwd(), "latest_prompt.txt");
    if (!fs.existsSync(filename)) return null;
    const txt = fs.readFileSync(filename, { encoding: "utf8" });
    return txt;
  },
};
