const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const { callGemini } = require("./geminiClient");

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
// Small helper to wait for a file to exist (avoid races when rasterizing SVG asynchronously)
function waitForFile(filePath, timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      if (fs.existsSync(filePath)) return resolve(true);
      if (Date.now() - start > timeout)
        return reject(new Error("timeout waiting for file"));
      setTimeout(check, 150);
    })();
  });
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

/**
 * Calls Cloudflare Workers AI image endpoint (model: @cf/stabilityai/...) and
 * returns a Buffer with image bytes. Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
 */
async function generateWithCloudflare(prompt, opts = {}) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token)
    throw new Error("Cloudflare image API not configured");

  const model =
    process.env.CLOUDFLARE_MODEL ||
    "@cf/stabilityai/stable-diffusion-xl-base-1.0";
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`;

  let fetchImpl = globalThis.fetch;
  if (!fetchImpl) {
    try {
      ({ fetch: fetchImpl } = require("undici"));
    } catch (e) {
      try {
        fetchImpl = require("node-fetch");
      } catch (e2) {
        throw new Error(
          "No fetch available; require Node 18+ or add undici/node-fetch"
        );
      }
    }
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({ prompt });

  const resp = await fetchImpl(url, { method: "POST", headers, body });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(
      `Cloudflare API Error: ${resp.status} ${String(txt).slice(0, 200)}`
    );
  }

  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Calls Stability AI text-to-image endpoint and returns a Buffer with PNG bytes.
 * Requires STABILITY_API_KEY env var. Uses the v1/generation endpoint.
 */
async function generateWithStability(prompt, opts = {}) {
  const key = process.env.STABILITY_API_KEY;
  if (!key) throw new Error("Stability API key not configured");

  const url =
    process.env.STABILITY_API_URL ||
    "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image";

  let fetchImpl = globalThis.fetch;
  if (!fetchImpl) {
    try {
      ({ fetch: fetchImpl } = require("undici"));
    } catch (e) {
      try {
        fetchImpl = require("node-fetch");
      } catch (e2) {
        throw new Error(
          "No fetch available; require Node 18+ or add undici/node-fetch"
        );
      }
    }
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
  };

  const body = JSON.stringify({
    text_prompts: [{ text: prompt }],
    cfg_scale: opts.cfg_scale || 7,
    height: opts.height || 1024,
    width: opts.width || 1024,
    samples: 1,
    steps: opts.steps || 30,
  });

  const resp = await fetchImpl(url, { method: "POST", headers, body });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(
      `Stability API Error: ${resp.status} ${String(txt).slice(0, 200)}`
    );
  }
  const json = await resp.json();
  const b64 = json?.artifacts?.[0]?.base64;
  if (!b64) throw new Error("Stability response missing image data");
  return Buffer.from(b64, "base64");
}

module.exports = { generateBackgroundForPoem, generateWithGemini };

/**
 * Orchestrator: generate a poem, create a visual prompt, generate an image,
 * save related artifacts and run verification.
 *
 * Returns an object with paths and verification result.
 */
async function generatePoemAndImage(opts = {}) {
  const outDir = path.resolve(__dirname, "samples", "images");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const theme =
    opts.theme ||
    "an ancient, moss-covered robot sleeping in a sunlit forest clearing.";
  const poemGenerationPrompt = `Write a short, evocative, six-line poem about "${theme}". Use rich, visual language.`;

  // Use callGemini wrapper for text modalities when available, fallback to generateWithGemini
  let poem = null;
  try {
    const res = await callGemini({
      prompt: poemGenerationPrompt,
      modality: "TEXT",
    });
    if (res && res.ok && res.text) poem = res.text;
    else if (res && res.text) poem = res.text;
  } catch (e) {
    // ignore and fallback
  }
  if (!poem) {
    try {
      poem = await generateWithGemini(poemGenerationPrompt);
    } catch (e) {
      poem = `Poem generation failed: ${String(e).slice(0, 200)}`;
    }
  }

  const imagePromptGenerationPrompt = `\nBased on the following poem, create a highly detailed and descriptive prompt for an AI image generator. Focus on the mood, lighting, style, and specific visual elements. The prompt should be a single paragraph.\n\nPoem:\n${poem}\n`;

  let visualPrompt = null;
  try {
    const res2 = await callGemini({
      prompt: imagePromptGenerationPrompt,
      modality: "TEXT",
    });
    if (res2 && res2.ok && res2.text) visualPrompt = res2.text;
    else if (res2 && res2.text) visualPrompt = res2.text;
  } catch (e) {
    // ignore and fallback
  }
  if (!visualPrompt) {
    try {
      visualPrompt = await generateWithGemini(imagePromptGenerationPrompt);
    } catch (e) {
      visualPrompt = String(e).slice(0, 200);
    }
  }

  // Generate image (this returns a filename relative to server/samples/images)
  let imageFilename;
  try {
    // Try providers in order: Cloudflare -> Stability -> Gemini
    let tried = false;
    if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
      tried = true;
      try {
        const buf = await generateWithCloudflare(visualPrompt, opts);
        const baseName = `cloudflare_${Date.now()}`;
        const filename = `${baseName}.png`;
        fs.writeFileSync(path.join(outDir, filename), buf);
        imageFilename = filename;
      } catch (e) {
        console.warn("Cloudflare image generation failed:", e.message || e);
      }
    }

    if (!imageFilename && process.env.STABILITY_API_KEY) {
      tried = true;
      try {
        const buf = await generateWithStability(visualPrompt, opts);
        const baseName = `stability_${Date.now()}`;
        const filename = `${baseName}.png`;
        fs.writeFileSync(path.join(outDir, filename), buf);
        imageFilename = filename;
      } catch (e) {
        console.warn("Stability image generation failed:", e.message || e);
      }
    }

    if (!imageFilename) {
      try {
        imageFilename = await generateWithGemini(visualPrompt, {
          format: opts.format || "png",
        });
      } catch (e) {
        imageFilename = null;
      }
    }
  } catch (e) {
    imageFilename = null;
  }

  const timestamp = Date.now();
  const imagePath = imageFilename
    ? path.resolve(__dirname, "samples", "images", imageFilename)
    : path.join(outDir, `poem_image_${timestamp}.png`);

  // If generateWithGemini returned a buffer write, it already wrote; otherwise we'll write a stub image when absent
  if (!imageFilename && opts.writeStub !== false) {
    // create offline stub SVG and set imagePath to that
    const stub = generateBackgroundForPoem({ title: theme, author: "auto" });
    imageFilename = stub;
  }

  // If an image filename exists on disk (or was just created asynchronously), wait a short while
  // to avoid races when downstream verification tries to read the file.
  if (imageFilename) {
    try {
      // resolve path again in case imageFilename was a basename
      const finalPath = path.resolve(
        __dirname,
        "samples",
        "images",
        imageFilename
      );
      // wait up to 5s for the file to appear
      await waitForFile(finalPath, 5000).catch(() => {});
    } catch (e) {
      // swallow - verification will handle missing file gracefully
    }
  }

  // Save poem and prompts alongside image
  const poemOutputPath = path.join(outDir, `poem_text_${timestamp}.txt`);
  const poemPromptPath = path.join(outDir, `poem_prompt-text_${timestamp}.txt`);
  const imagePromptPath = path.join(
    outDir,
    `poem_prompt-image_${timestamp}.txt`
  );

  try {
    fs.writeFileSync(poemOutputPath, poem);
  } catch (e) {}
  try {
    fs.writeFileSync(poemPromptPath, poemGenerationPrompt);
  } catch (e) {}
  try {
    fs.writeFileSync(imagePromptPath, visualPrompt);
  } catch (e) {}

  // Attempt verification
  let verification = null;
  try {
    verification = await verifyImageMatchesText(imagePath, poem);
    const verificationPath = path.join(
      outDir,
      `verification_${timestamp}.json`
    );
    try {
      fs.writeFileSync(verificationPath, JSON.stringify(verification, null, 2));
    } catch (e) {}
  } catch (e) {
    verification = {
      match: false,
      score: 0,
      details: `verification failed: ${String(e)}`,
    };
  }

  return {
    image: imageFilename ? path.relative(process.cwd(), imagePath) : null,
    poem: path.relative(process.cwd(), poemOutputPath),
    poemPrompt: path.relative(process.cwd(), poemPromptPath),
    imagePrompt: path.relative(process.cwd(), imagePromptPath),
    verification,
  };
}

// export orchestrator
try {
  module.exports.generatePoemAndImage = generatePoemAndImage;
} catch (e) {}

/**
 * Verify whether an image appears to match a descriptive text prompt.
 * Attempts to call a Gemini vision-style endpoint when `GEMINI_API_KEY` and
 * `GEMINI_VISION_MODEL` (or default `gemini-pro-vision`) are available. Falls
 * back to a keyword-overlap heuristic when the API is not available or fails.
 *
 * Returns an object: { match: boolean, score: number (0-1), details: string }
 */
async function verifyImageMatchesText(imagePath, textPrompt, opts = {}) {
  // Read image and convert to base64. Try a few common locations:
  let buf;
  try {
    // 1) if imagePath is absolute or exists as given, use it
    if (path.isAbsolute(imagePath) && fs.existsSync(imagePath)) {
      buf = fs.readFileSync(imagePath);
    } else if (fs.existsSync(imagePath)) {
      buf = fs.readFileSync(imagePath);
    } else if (fs.existsSync(path.resolve(process.cwd(), imagePath))) {
      // 2) relative to current working dir (scripts save to ./samples/images)
      buf = fs.readFileSync(path.resolve(process.cwd(), imagePath));
    } else {
      // 3) relative to this module's directory (server/samples/images)
      buf = fs.readFileSync(path.resolve(__dirname, imagePath));
    }
  } catch (e) {
    return {
      match: false,
      score: 0,
      details: `Could not read image: ${e.message}`,
    };
  }
  const b64 = buf.toString("base64");

  // If Gemini is configured, attempt a vision-style request
  if (process.env.GEMINI_API_KEY) {
    const rawKey = String(process.env.GEMINI_API_KEY || "");
    const apiUrl = process.env.GEMINI_API_URL;
    if (apiUrl) {
      // Build request similar to generateWithGemini but include image content
      let requestUrl = apiUrl;
      const headers = { "Content-Type": "application/json" };
      if (/^AIza[0-9A-Za-z-_]+$/.test(rawKey)) {
        headers["X-goog-api-key"] = rawKey;
      } else if (/^ya29\./.test(rawKey)) {
        headers.Authorization = `Bearer ${rawKey}`;
      } else {
        const sep = requestUrl.includes("?") ? "&" : "?";
        requestUrl = requestUrl + sep + "key=" + encodeURIComponent(rawKey);
      }

      const model = process.env.GEMINI_VISION_MODEL || "gemini-pro-vision";
      // Prepare a conservative payload that some Gemini endpoints accept: instances with image + text
      const payload = {
        instances: [
          {
            input: {
              image: { content: b64 },
              text: `Does this image depict: ${textPrompt}? Answer concisely and explain.`,
            },
          },
        ],
      };

      try {
        // prefer undici fetch if available to match other code
        let fetchImpl = globalThis.fetch;
        if (!fetchImpl) {
          try {
            ({ fetch: fetchImpl } = require("undici"));
          } catch (e) {
            // fall through to node-fetch if present
            fetchImpl = require("node-fetch");
          }
        }

        const resp = await fetchImpl(requestUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const txt = await resp.text();
        if (!resp.ok) {
          // do not fail hard; fall back to heuristic
          console.warn(
            "verifyImageMatchesText: Gemini vision request returned error:",
            resp.status,
            txt.slice(0, 400)
          );
        } else {
          // Try to parse JSON and extract any text that can be used to judge
          try {
            const j = JSON.parse(txt);
            // Search for textual description or candidate content in returned JSON
            function extractTextFromResp(o) {
              if (!o) return null;
              if (typeof o === "string") return o;
              if (Array.isArray(o))
                return o.map(extractTextFromResp).filter(Boolean).join("\n");
              if (typeof o === "object") {
                for (const k of [
                  "candidates",
                  "outputs",
                  "result",
                  "predictions",
                  "responses",
                ]) {
                  if (k in o) {
                    return extractTextFromResp(o[k]);
                  }
                }
                // flatten all string values
                const parts = [];
                for (const v of Object.values(o)) {
                  const t = extractTextFromResp(v);
                  if (t) parts.push(t);
                }
                return parts.join("\n");
              }
              return null;
            }

            const respText = extractTextFromResp(j) || "";
            // Simple yes/no detection
            const lower = respText.toLowerCase();
            if (/\bno\b/.test(lower) || /\bdoes not\b/.test(lower)) {
              return {
                match: false,
                score: 0.2,
                details: `Vision model indicates mismatch: ${respText.slice(
                  0,
                  400
                )}`,
              };
            }
            if (
              /\byes\b/.test(lower) ||
              /\bdepict\b|\bshows\b|\bcontains\b/.test(lower)
            ) {
              return {
                match: true,
                score: 0.9,
                details: `Vision model positive: ${respText.slice(0, 400)}`,
              };
            }
            // fallback: compute keyword overlap between prompt and response
            const score = keywordOverlapScore(textPrompt, respText);
            return {
              match: score > 0.25,
              score,
              details: `Vision response: ${respText.slice(0, 400)}`,
            };
          } catch (e) {
            // If response not JSON, treat plain text
            const lower = txt.toLowerCase();
            if (/\byes\b/.test(lower) || /\bdepict\b|\bshows\b/.test(lower)) {
              return {
                match: true,
                score: 0.8,
                details: `Vision text: ${txt.slice(0, 400)}`,
              };
            }
            const score = keywordOverlapScore(textPrompt, txt);
            return {
              match: score > 0.25,
              score,
              details: `Vision text (raw): ${txt.slice(0, 400)}`,
            };
          }
        }
      } catch (e) {
        console.warn(
          "verifyImageMatchesText: error calling Gemini vision:",
          e.message || e
        );
      }
    }
  }

  // Fallback heuristic: compute keyword overlap between prompt and an OCR-less naive check using the prompt itself
  const score = keywordOverlapScore(textPrompt, "");
  return {
    match: score > 0.25,
    score,
    details:
      "No vision API available; heuristic fallback used (no image-text extraction performed)",
  };
}

// Export the verifier so script runners can call it
try {
  module.exports.verifyImageMatchesText = verifyImageMatchesText;
} catch (e) {
  // noop in environments that don't support module.exports
}

function keywordOverlapScore(a, b) {
  // a and b are strings. Return simple overlap score [0..1]. If b empty, score 0.0
  if (!a || !b) return 0;
  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const as = normalize(a);
  const bs = normalize(b);
  if (as.length === 0 || bs.length === 0) return 0;
  const setB = new Set(bs);
  let common = 0;
  for (const w of as) if (setB.has(w)) common++;
  return common / Math.max(as.length, bs.length);
}

// expose verify in module.exports for CommonJS consumers
module.exports.verifyImageMatchesText = verifyImageMatchesText;
