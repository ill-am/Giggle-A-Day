const fs = require("fs");
const path = require("path");

/**
 * Generate a simple decorative SVG background for a poem and save it to samples/images.
 * This is a safe, offline stub used for V0.1 demo verification.
 * Returns the filename relative to server/samples/images.
 */
function generateBackgroundForPoem(poem, opts = {}) {
  const title = (poem.title || "Untitled")
    .replace(/[^a-z0-9_-]/gi, "_")
    .slice(0, 40);
  const filename = `auto_${Date.now()}_${title}.svg`;
  const outDir = path.resolve(__dirname, "samples", "images");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Simple SVG: gradient + centered title text
  const svg =
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">\n` +
    `  <defs>\n` +
    `    <linearGradient id="g" x1="0" x2="1">\n` +
    `      <stop offset="0%" stop-color="#FFEDA0"/>\n` +
    `      <stop offset="100%" stop-color="#F5A9A9"/>\n` +
    `    </linearGradient>\n` +
    `  </defs>\n` +
    `  <rect width="100%" height="100%" fill="url(#g)"/>\n` +
    `  <g transform="translate(10,20)">\n` +
    `    <text x="0" y="10" font-size="6" font-family="serif" fill="#3b3b3b">${escapeXml(
      poem.title || ""
    )}</text>\n` +
    `    <text x="0" y="18" font-size="4" font-family="serif" fill="#3b3b3b">${escapeXml(
      poem.author || ""
    )}</text>\n` +
    `  </g>\n` +
    `</svg>`;

  try {
    fs.writeFileSync(path.join(outDir, filename), svg, "utf8");
    return filename;
  } catch (e) {
    // If writing fails, return null so caller can fallback
    return null;
  }
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

module.exports = { generateBackgroundForPoem };
