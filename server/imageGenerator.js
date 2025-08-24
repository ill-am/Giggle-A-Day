const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

// Optional dependency: sharp for high-DPI rasterization of SVG stubs.
let sharp;
try {
  sharp = require("sharp");
} catch (e) {
  sharp = null;
}

/**
 * Generate a simple decorative SVG background for a poem and save it to samples/images.
 * This is a safe, offline stub used for V0.1 demo verification.
 * Returns the filename relative to server/samples/images.
 */
function generateBackgroundForPoem(poem, opts = {}) {
  // opts: { format: 'svg'|'png', dpi: number }
  const title = (poem.title || "Untitled")
    .replace(/[^a-z0-9_-]/gi, "_")
    .slice(0, 40);
  const baseName = `auto_${Date.now()}_${title}`;
  const outDir = path.resolve(__dirname, "samples", "images");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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

  const svgFilename = `${baseName}.svg`;
  try {
    fs.writeFileSync(path.join(outDir, svgFilename), svg, "utf8");
  } catch (e) {
    return null;
  }

  // If caller requested PNG and sharp is available, rasterize at given DPI
  const fmt = opts.format || "svg";
  if (fmt === "png") {
    if (!sharp) {
      // fallback to svg if sharp not available
      return svgFilename;
    }

    const dpi = typeof opts.dpi === "number" ? opts.dpi : 300; // default 300 DPI
    // A4 in inches: 8.27 x 11.69 -> pixels = inches * dpi
    const widthPx = Math.round(8.27 * dpi);
    const heightPx = Math.round(11.69 * dpi);
    const pngFilename = `${baseName}.png`;
    try {
      // sharp can read SVG buffer and resize
      sharp(Buffer.from(svg))
        .resize(widthPx, heightPx)
        .png()
        .toFile(path.join(outDir, pngFilename));
      return pngFilename;
    } catch (e) {
      // If conversion fails, return svg filename so callers can still use it
      return svgFilename;
    }
  }

  return svgFilename;
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Placeholder for future Gemini integration. When GEMINI_API_KEY is present,
// a real implementation would call the Gemini/image API and return a filename
// placed into server/samples/images. For V0.1 we keep a stub but expose the
// hook so integrating the real API later is straightforward.
async function generateWithGemini(prompt, opts = {}) {
  // For safety avoid network calls in tests — must be gated behind env var
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini integration not configured");
  }

  // TODO: implement actual Gemini call here. Return filename on success.
  throw new Error("Gemini integration not implemented in this branch");
}

module.exports = { generateBackgroundForPoem, generateWithGemini };
