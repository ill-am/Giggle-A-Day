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

function buildContent(prompt, opts = {}) {
  const maxWords = opts.titleWords || 6;
  const words = String(prompt || "")
    .split(/\s+/)
    .filter(Boolean);
  const title = `Prompt: ${words.slice(0, maxWords).join(" ")}`;
  const body = String(prompt || "");
  return { title, body };
}

function savePrompt(prompt, options = {}) {
  const filename =
    options.filename || path.resolve(process.cwd(), "latest_prompt.txt");
  safeWriteFileSync(filename, String(prompt));
  return filename;
}

function makeCopies(content, n = 3) {
  // Return n copies of the content object for the demo
  return Array.from({ length: n }, () => content);
}

function generateFromPrompt(prompt) {
  const filename = savePrompt(prompt);
  const content = buildContent(prompt);
  const copies = makeCopies(content, 3);
  return { filename, content, copies };
}

function readLatest(options = {}) {
  const filename =
    options.filename || path.resolve(process.cwd(), "latest_prompt.txt");
  if (!fs.existsSync(filename)) return null;
  return fs.readFileSync(filename, { encoding: "utf8" });
}

module.exports = {
  savePrompt,
  buildContent,
  makeCopies,
  generateFromPrompt,
  readLatest,
};
