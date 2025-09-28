import Logger from "./logger";

// API utilities with retry logic
const DEFAULT_CONFIG = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 10000,
  // Do NOT retry on 401 by default — auth failures should surface immediately.
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

async function fetchWithRetry(url, options = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...options.retryConfig,
  };
  delete options.retryConfig;

  // Resolve a safe base for relative URLs. In test or Node environments
  // window.location.origin may be missing or undici may reject relative URLs,
  // so fall back to http://localhost to ensure fetch receives an absolute URL.
  const base =
    typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin
      : "http://localhost";
  const resolved = new URL(url, base);
  const endpoint = resolved.pathname;
  const method = options.method || "GET";

  Logger.apiRequest(endpoint, method, {
    config,
    headers: options.headers,
  });

  let lastError;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      // Use an absolute URL when calling fetch to avoid runtime errors in Node/undici
      const response = await fetch(resolved.href, options);

      // Log the response
      Logger.apiResponse(endpoint, response.status, {
        attempt,
        ok: response.ok,
      });

      // Successful response
      if (response.ok) return response;

      // Check if we should retry based on status
      if (config.retryableStatuses.includes(response.status)) {
        if (attempt < config.maxRetries) {
          // Calculate backoff with jitter
          const backoff = Math.min(
            config.maxBackoffMs,
            config.initialBackoffMs * Math.pow(2, attempt - 1)
          );
          const jitter = Math.random() * 100;
          const nextAttemptIn = Math.round((backoff + jitter) / 1000);

          Logger.apiRetry(endpoint, attempt, config.maxRetries, {
            status: response.status,
            nextAttemptIn,
          });

          await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
          continue;
        }
      }

      return response;
    } catch (error) {
      // If the request was aborted, do not retry — rethrow immediately.
      // Aborts are expected when the app cancels in-flight requests (for
      // example when starting a new preview). Treat these as debug-level
      // events instead of errors to avoid noisy error logs.
      if (error && (error.name === "AbortError" || error.type === "aborted")) {
        Logger.debug(`API Abort: ${endpoint}`, {
          type: "api_abort",
          endpoint,
          attempt,
          maxRetries: config.maxRetries,
          // preserve the original error for local inspection when needed
          error,
        });
        throw error;
      }

      lastError = error;

      Logger.apiError(endpoint, error, {
        attempt,
        maxRetries: config.maxRetries,
      });

      if (attempt === config.maxRetries) throw error;

      const backoff = Math.min(
        config.maxBackoffMs,
        config.initialBackoffMs * Math.pow(2, attempt - 1)
      );

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError;
}

// API endpoints
export async function generatePreview(prompt) {
  Logger.debug("Generating preview", { prompt });

  try {
    const response = await fetchWithRetry("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      retryConfig: { maxRetries: 3 },
    });

    if (!response.ok) {
      const error = new Error(`Generation failed: ${response.status}`);
      Logger.error("Preview generation failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const data = await response.json();
    Logger.info("Preview generated successfully", {
      promptLength: prompt.length,
      htmlLength: data.html?.length,
    });

    return data;
  } catch (error) {
    Logger.error("Preview generation error", { error });
    throw error;
  }
}

export async function loadPreview(content, options = {}) {
  Logger.debug("Loading preview", {
    contentKeys: content ? Object.keys(content) : "no content",
  });
  const signal = options && options.signal;

  // Ensure content has required structure
  // If content references a resultId or promptId, resolve it first using
  // helper endpoints added on the server: /content/result/:id and /content/prompt/:id
  try {
    // Start with direct preview since that's most reliable in development
    if (content && content.title && content.body) {
      const formattedContent = {
        title: content.title,
        body: content.body,
        layout: content.layout || "default",
      };

      Logger.debug("Requesting direct preview", { formattedContent });

      const response = await fetchWithRetry("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedContent),
        retryConfig: { maxRetries: 3 },
        signal,
      });

      if (response.ok) {
        const json = await response.json();
        const html = json.preview || "";
        if (html && html.trim()) {
          Logger.info("Direct preview successful", { length: html.length });
          return html;
        }
      }

      Logger.debug("Direct preview failed, trying id-based methods");
    }

    // Fall back to id-based preview if direct preview failed
    if (content && content.resultId) {
      if (import.meta.env.DEV)
        console.debug(
          "[DEV] loadPreview: attempting /preview?resultId=",
          content.resultId
        );
      const resp = await fetchWithRetry(
        `/preview?resultId=${encodeURIComponent(content.resultId)}`,
        { retryConfig: { maxRetries: 2 }, signal }
      );
      if (resp && resp.ok) {
        const html = await resp.text();
        Logger.info("Loaded preview by resultId", {
          resultId: content.resultId,
          length: html.length,
        });
        if (html && html.trim()) {
          // Only return if we got actual content
          if (import.meta.env.DEV)
            console.debug(
              "[DEV] loadPreview: /preview?resultId returned HTML length=",
              html.length
            );
          return html;
        }
      }
      Logger.debug("Failed to load preview by resultId, will try next method", {
        status: resp?.status,
        resultId: content.resultId,
      });
    }

    if (content && content.promptId) {
      if (import.meta.env.DEV)
        console.debug(
          "[DEV] loadPreview: attempting /preview?promptId=",
          content.promptId
        );
      const resp = await fetchWithRetry(
        `/preview?promptId=${encodeURIComponent(content.promptId)}`,
        { retryConfig: { maxRetries: 2 }, signal }
      );
      if (resp && resp.ok) {
        const html = await resp.text();
        Logger.info("Loaded preview by promptId", {
          promptId: content.promptId,
          length: html.length,
        });
        if (html && html.trim()) {
          // Only return if we got actual content
          if (import.meta.env.DEV)
            console.debug(
              "[DEV] loadPreview: /preview?promptId returned HTML length=",
              html.length
            );
          return html;
        }
      }
      Logger.debug("Failed to load preview by promptId, will try next method", {
        status: resp?.status,
        promptId: content.promptId,
      });
    }

    // Fallback: if /preview by id didn't work, try loading JSON content via
    // the helper endpoints and continue with the normal preview flow.
    if (content && (content.resultId || content.promptId)) {
      if (content.resultId) {
        const resp = await fetchWithRetry(
          `/content/result/${encodeURIComponent(content.resultId)}`,
          { signal }
        );
        if (resp && resp.ok) {
          const json = await resp.json();
          content = { ...(json.content || {}), resultId: content.resultId };
        }
      } else if (content.promptId) {
        const resp = await fetchWithRetry(
          `/content/prompt/${encodeURIComponent(content.promptId)}`,
          { signal }
        );
        if (resp && resp.ok) {
          const json = await resp.json();
          content = { ...(json.content || {}), promptId: content.promptId };
        }
      }
    }

    if (!content || !content.title || !content.body) {
      const error = new Error("Preview content must include title and body");
      Logger.error("Preview validation failed", {
        error,
        providedFields: content ? Object.keys(content) : [],
        required: ["title", "body"],
      });
      throw error;
    }
  } catch (err) {
    // If the resolution was aborted, treat as a debug-level event and
    // rethrow so callers (like previewFromContent) can handle it.
    if (err && (err.name === "AbortError" || err.type === "aborted")) {
      Logger.debug("Content resolution aborted", {
        type: "api_abort",
        error: err,
      });
      throw err;
    }

    Logger.error("Failed to resolve content by id", { err });
    throw err;
  }

  try {
    const formattedContent = {
      title: content.title,
      body: content.body,
      layout: content.layout || "default",
    };

    Logger.debug("Requesting preview", { formattedContent });

    const payloadStr = JSON.stringify(formattedContent);
    let response;

    // For large payloads, prefer POST /api/preview which returns JSON { preview }
    if (payloadStr.length > 2000) {
      response = await fetchWithRetry("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr,
        retryConfig: { maxRetries: 3, retryableStatuses: [500, 503] },
        signal,
      });
      if (!response.ok) {
        const error = new Error(`Preview failed: ${response.status}`);
        Logger.error("Preview request failed", {
          error,
          status: response.status,
        });
        throw error;
      }
      const json = await response.json();
      const previewHtml = json.preview || "";
      Logger.info("Preview loaded successfully", {
        contentLength: previewHtml.length,
        layout: formattedContent.layout,
      });
      return previewHtml;
    }

    // Small payloads: use GET /preview query param for quickness
    response = await fetchWithRetry(
      `/preview?content=${encodeURIComponent(payloadStr)}`,
      {
        retryConfig: {
          maxRetries: 3,
          retryableStatuses: [500, 503],
        },
        signal,
      }
    );

    if (!response.ok) {
      const error = new Error(`Preview failed: ${response.status}`);
      Logger.error("Preview request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const previewHtml = await response.text();
    Logger.info("Preview loaded successfully", {
      contentLength: previewHtml.length,
      layout: formattedContent.layout,
    });
    return previewHtml;
  } catch (error) {
    // Treat aborts as non-errors: callers expect AbortError to be thrown
    // so they can decide whether to ignore it (e.g. previewFromContent).
    if (error && (error.name === "AbortError" || error.type === "aborted")) {
      Logger.debug("Preview request aborted", {
        type: "api_abort",
        error,
      });
      throw error;
    }

    Logger.error("Preview loading error", { error });
    throw error;
  }
}

export async function saveOverride(content, changes) {
  Logger.debug("Saving override", {
    originalContent: content ? Object.keys(content) : "no content",
    changeKeys: changes ? Object.keys(changes) : "no changes",
  });

  try {
    const response = await fetchWithRetry("/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, changes }),
      retryConfig: {
        maxRetries: 3,
        retryableStatuses: [500, 503], // Server errors most likely for override
      },
    });

    if (!response.ok) {
      const error = new Error(`Override failed: ${response.status}`);
      Logger.error("Override request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const result = await response.json();
    Logger.info("Override saved successfully", {
      changedFields: changes ? Object.keys(changes) : [],
    });
    return result;
  } catch (error) {
    Logger.error("Override save error", { error });
    throw error;
  }
}

export async function exportToPdf(content) {
  Logger.debug("Exporting to PDF", {
    contentKeys: content ? Object.keys(content) : "no content",
  });

  if (!content || !content.title || !content.body) {
    const error = new Error("Export content must include title and body");
    Logger.error("Export validation failed", { error });
    throw error;
  }

  try {
    const response = await fetchWithRetry("/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });

    if (!response.ok) {
      const error = new Error(`Export failed: ${response.status}`);
      Logger.error("Export request failed", { error, status: response.status });
      throw error;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AetherPress-Export-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    Logger.info("PDF exported successfully");
  } catch (error) {
    Logger.error("PDF export error", { error });
    throw error;
  }
}

// Persist generated prompt/content to server-backed prompts API
export async function savePromptContent(content) {
  // content is expected to be an object with title/body and optionally prompt
  try {
    const response = await fetchWithRetry("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: content.prompt || content.title || "" }),
    });
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
    const data = await response.json();
    // server returns { success: true, data: result }
    return data && data.data ? data.data : data;
  } catch (err) {
    Logger.error("savePromptContent error", { err });
    throw err;
  }
}

export async function updatePromptContent(id, content) {
  try {
    const response = await fetchWithRetry(
      `/api/prompts/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content.prompt || content.title || "" }),
      }
    );
    if (!response.ok) throw new Error(`Update failed: ${response.status}`);
    const data = await response.json();
    return data && data.data ? data.data : data;
  } catch (err) {
    Logger.error("updatePromptContent error", { err });
    throw err;
  }
}

// Background export job API helpers
export async function startExportJob(content) {
  if (!content || !content.title || !content.body) {
    throw new Error("Export content must include title and body");
  }

  const response = await fetchWithRetry("/api/export/job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
  if (!response.ok)
    throw new Error(`Failed to start export job: ${response.status}`);
  return response.json(); // { jobId }
}

export async function getExportJobStatus(jobId) {
  if (!jobId) throw new Error("jobId required");
  const response = await fetchWithRetry(
    `/api/export/job/${encodeURIComponent(jobId)}`,
    {}
  );
  if (!response.ok)
    throw new Error(`Failed to fetch job status: ${response.status}`);
  return response.json();
}
