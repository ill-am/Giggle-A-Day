const fs = require("fs");
const path = require("path");

// Default to the repository-level samples/ directory so the file is located at
// <repo-root>/samples/latest_prompt.txt regardless of the server working dir.
const DEFAULT_SAMPLES_PATH = path.resolve(
  __dirname,
  "..",
  "samples",
  "latest_prompt.txt"
);

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
  // If explicit content is provided in options, use that
  if (opts.title && opts.body) {
    return {
      title: opts.title,
      body: opts.body,
    };
  }

  // Otherwise build from prompt
  const maxTitleWords = opts.titleWords || 5;
  const words = String(prompt || "")
    .split(/\s+/)
    .filter(Boolean);
  const title = `Prompt: ${words.slice(0, maxTitleWords).join(" ")}`;
  const body = String(prompt || "");

  return { title, body };
}

function savePrompt(prompt, options = {}) {
  const filename = options.filename || DEFAULT_SAMPLES_PATH;
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
  const filename = options.filename || DEFAULT_SAMPLES_PATH;
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
