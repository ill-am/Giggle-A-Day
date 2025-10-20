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
  // Return n copies of the content object for the demo
  return Array.from({ length: n }, () => content);
}

function generateFromPrompt(prompt, genieService) {
  // Business logic: save the prompt to a file using the provided utility
  genieService.saveContentToFile(prompt);

  const content = buildContent(prompt);
  const copies = makeCopies(content, 3);
  return { content, copies };
}

module.exports = {
  buildContent,
  makeCopies,
  generateFromPrompt,
};
