import Logger from "./logger";

/**
  try {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include',
      body: JSON.stringify(requestData),
      ...options
    });se validation error for preview endpoint
 */
export class PreviewValidationError extends Error {
  constructor(message, validationErrors) {
    super(message);
    this.name = "PreviewValidationError";
    this.validationErrors = validationErrors;
  }
}

/**
 * Preview endpoint wrapper with validation and error classification
 * @param {Object} requestData - The data to send for preview generation
 * @param {string} requestData.prompt - The prompt text to generate preview from
 * @param {Object} [options] - Additional fetch options
 * @returns {Promise<{ preview: string, metadata: Object }>}
 * @throws {PreviewValidationError} When request validation fails
 * @throws {Error} For other types of failures
 */
export async function previewEndpoint(requestData, options = {}) {
  // Validate request data
  const validationErrors = [];
  if (!requestData?.prompt) {
    validationErrors.push("Prompt is required");
  }
  if (validationErrors.length > 0) {
    Logger.warn("Preview request validation failed", { validationErrors });
    throw new PreviewValidationError(
      "Invalid preview request",
      validationErrors
    );
  }

  try {
    const response = await fetch("/api/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
      ...options,
    });

    // Parse and validate response
    const data = await response.json();

    // Validate response structure
    if (!data.preview) {
      throw new Error("Preview response missing required fields");
    }

    return {
      preview: data.preview,
      metadata: data.metadata || {},
    };
  } catch (error) {
    // Classify and log errors
    if (error instanceof PreviewValidationError) {
      // Validation errors are already logged
      throw error;
    }

    // Network or parsing errors
    if (error instanceof TypeError || error.name === "SyntaxError") {
      Logger.error("Preview request failed", {
        error,
        type: "network_error",
        endpoint: "/api/preview",
      });
      throw new Error("Failed to generate preview: Network or server error");
    }

    // Other unexpected errors
    Logger.error("Unexpected error in preview request", {
      error,
      endpoint: "/api/preview",
    });
    throw new Error("Failed to generate preview: Unexpected error");
  }
}
