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
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini integration not configured");
  }

  // get fetch implementation
  let fetchImpl = globalThis.fetch;
  if (!fetchImpl) {
    try {
      ({ fetch: fetchImpl } = require("undici"));
    } catch (e) {
      throw new Error("No fetch available; require Node 18+ or add undici");
    }
  }

  const apiUrl = process.env.GEMINI_API_URL;
  if (!apiUrl) throw new Error("GEMINI_API_URL not configured");

  const rawKey = String(process.env.GEMINI_API_KEY || "");
  const isGoogleApiKey = /^AIza[0-9A-Za-z-_]+$/.test(rawKey);

  let requestUrl = apiUrl;
  const headers = { "Content-Type": "application/json" };
  if (isGoogleApiKey) {
    headers["X-goog-api-key"] = rawKey;
  } else if (/^ya29\./.test(rawKey)) {
    headers.Authorization = `Bearer ${rawKey}`;
  } else {
    const sep = requestUrl.includes("?") ? "&" : "?";
    requestUrl = requestUrl + sep + "key=" + encodeURIComponent(rawKey);
  }

  const candidateBodies = [
    { contents: [{ parts: [{ text: String(prompt) }] }] },
    { instances: [{ input: String(prompt) }] },
    { input: String(prompt) },
    { prompt: { text: String(prompt) } },
  ];

  let resp = null;
  let text = null;
  let lastErr = null;
  for (const b of candidateBodies) {
    try {
      resp = await fetchImpl(requestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(b),
      });
      text = await resp.text();
      if (!resp.ok) {
        lastErr = text;
        continue;
      }
      break;
    } catch (e) {
      lastErr = e.message || String(e);
      continue;
    }
  }

  if (!text) {
    const allowFallback = process.env.GEMINI_FALLBACK_TO_STUB !== "false";
    if (allowFallback) {
      const poem =
        typeof prompt === "object"
          ? prompt
          : { title: String(prompt).slice(0, 80), author: "GeminiFallback" };
      const fallback = generateBackgroundForPoem(poem, opts);
      console.warn(
        "generateWithGemini: API call failed, returning offline stub:",
        String(lastErr).slice(0, 200)
      );
      return fallback;
    }
    throw new Error(
      `Gemini requests failed. Last error: ${String(lastErr).slice(0, 500)}`
    );
  }

  const textBody = text;

  let json = null;
  try {
    json = JSON.parse(textBody);
  } catch (e) {
    const maybeData = textBody.trim();
    const dataMatch = maybeData.match(
      /data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\n\r]+)/
    );
    if (dataMatch) {
      const ext = dataMatch[1] === "jpeg" ? "jpg" : "png";
      const b64 = dataMatch[2].replace(/\s+/g, "");
      const buf = Buffer.from(b64, "base64");
      const baseName = `gemini_${Date.now()}`;
      const outDir = path.resolve(__dirname, "samples", "images");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const filename = `${baseName}.${ext}`;
      fs.writeFileSync(path.join(outDir, filename), buf);
      return filename;
    }
    const allowFallback = process.env.GEMINI_FALLBACK_TO_STUB !== "false";
    if (allowFallback) {
      const poem =
        typeof prompt === "object"
          ? prompt
          : { title: String(prompt).slice(0, 80), author: "GeminiFallback" };
      const fallback = generateBackgroundForPoem(poem, opts);
      console.warn(
        "generateWithGemini: response not JSON and no image data; returning offline stub"
      );
      return fallback;
    }
    throw new Error(
      `Gemini response not JSON and did not contain image data: ${maybeData.slice(
        0,
        200
      )}`
    );
  }

  function findBase64Image(o) {
    if (!o) return null;
    if (typeof o === "string") {
      const m = o.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\n\r]+)/);
      if (m)
        return {
          ext: m[1] === "jpeg" ? "jpg" : "png",
          b64: m[2].replace(/\s+/g, ""),
        };
      if (o.length > 1000 && /^[A-Za-z0-9+/=\n\r]+$/.test(o))
        return { ext: "png", b64: o.replace(/\s+/g, "") };
      return null;
    }
    if (Array.isArray(o)) {
      for (const v of o) {
        const found = findBase64Image(v);
        if (found) return found;
      }
      return null;
    }
    if (typeof o === "object") {
      for (const k of Object.keys(o)) {
        const found = findBase64Image(o[k]);
        if (found) return found;
      }
    }
    return null;
  }

  const found = findBase64Image(json);
  if (!found) {
    const allowFallback = process.env.GEMINI_FALLBACK_TO_STUB !== "false";
    if (allowFallback) {
      const poem =
        typeof prompt === "object"
          ? prompt
          : { title: String(prompt).slice(0, 80), author: "GeminiFallback" };
      const fallback = generateBackgroundForPoem(poem, opts);
      console.warn(
        "generateWithGemini: no image found in JSON response; returning offline stub"
      );
      return fallback;
    }
    throw new Error(
      `Gemini response did not contain image data: ${JSON.stringify(json).slice(
        0,
        1000
      )}`
    );
  }

  const buf = Buffer.from(found.b64, "base64");
  const baseName = `gemini_${Date.now()}`;
  const outDir = path.resolve(__dirname, "samples", "images");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filename = `${baseName}.${found.ext}`;
  fs.writeFileSync(path.join(outDir, filename), buf);
  return filename;
}

module.exports = { generateBackgroundForPoem, generateWithGemini };
