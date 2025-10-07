// sanitizer.js
// Minimal server-side sanitizer. This is intentionally small for the scaffold
// and should be replaced with a hardened library (DOMPurify + jsdom or
// sanitize-html) for production.

function sanitizeHtml(input = "") {
  // Very conservative sanitizer: escape angle brackets and ampersands.
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = { sanitizeHtml };
