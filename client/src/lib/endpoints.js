import Logger from "./logger";

/**
 * Base error class for API errors
 */
export class APIError extends Error {
  constructor(message, code, status, requestId, details = null) {
    super(message);
    this.name = "APIError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }

  static fromResponse(error) {
    return new APIError(
      error.message,
      error.code,
      error.status,
      error.requestId,
      error.details
    );
  }
}

/**
 * Specific error class for validation errors
 */
export class ValidationError extends APIError {
  constructor(message, requestId, details = null) {
    super(message, "VALIDATION_ERROR", 400, requestId, details);
    this.name = "ValidationError";
  }
}

/**
 * Handles API responses and throws appropriate errors
 * @throws {APIError} When the response contains an error
 */
async function handleApiResponse(response) {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) {
      if (data.error) {
        throw APIError.fromResponse(data.error);
      }
      throw new APIError("Unknown API error", "UNKNOWN_ERROR", response.status);
    }
    return data;
  }
  return response;
}

/**
 * Export endpoint wrapper for PDF generation
 * @param {Object} content - The content to export as PDF
 * @param {Object} [options] - Additional fetch options
 * @returns {Promise<Blob>} The PDF file as a blob
 * @throws {Error} When export fails
 */
export async function exportToPdf(content, options = {}) {
  try {
    // Validate content before sending
    if (!content) {
      throw new ValidationError("Content is required for export", null, {
        provided: typeof content,
      });
    }

    const response = await fetch(
      `/export?content=${encodeURIComponent(JSON.stringify(content))}`,
      {
        method: "GET",
        headers: {
          Accept: "application/pdf, application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        ...options,
      }
    );

    const handled = await handleApiResponse(response);

    // If it's not an error response and it's a PDF, get the blob
    if (response.headers.get("content-type")?.includes("application/pdf")) {
      return await response.blob();
    }

    throw new APIError(
      "Unexpected response type",
      "PROCESSING_ERROR",
      response.status,
      null,
      { contentType: response.headers.get("content-type") }
    );
  } catch (error) {
    if (error instanceof APIError) {
      Logger.error("PDF export failed", {
        requestId: error.requestId,
        code: error.code,
        details: error.details,
      });
      throw error;
    }
    // Wrap unknown errors
    Logger.error("Unexpected error during PDF export", { error });
    throw new APIError("Failed to export PDF", "PROCESSING_ERROR", 500, null, {
      originalError: error.message,
    });
  }
}

/**
 * Preview endpoint wrapper with validation and error classification
 * @param {Object} requestData - The data to send for preview generation
 * @param {string} requestData.prompt - The prompt text to generate preview from
 * @param {Object} [options] - Additional fetch options
 * @returns {Promise<{ preview: string, metadata: Object }>}
 * @throws {ValidationError} When request validation fails
 * @throws {APIError} For other API-related failures
 * @throws {Error} For unexpected failures
 */
export async function previewEndpoint(requestData, options = {}) {
  try {
    // Validate request data
    const validationErrors = [];
    if (!requestData?.prompt) {
      validationErrors.push("Prompt is required");
    }
    if (validationErrors.length > 0) {
      Logger.warn("Preview request validation failed", { validationErrors });
      throw new ValidationError("Invalid preview request", null, {
        validationErrors,
        provided: Object.keys(requestData || {}),
      });
    }

    const response = await fetch("/api/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(requestData),
      ...options,
    });

    // Use common response handler
    const data = await handleApiResponse(response);

    // Validate response structure
    if (!data.preview) {
      throw new APIError(
        "Invalid preview response format",
        "PROCESSING_ERROR",
        500,
        null,
        { provided: Object.keys(data) }
      );
    }

    return {
      preview: data.preview,
      metadata: data.metadata || {},
    };
  } catch (error) {
    if (error instanceof APIError) {
      // Log API errors with their context
      Logger.error("Preview generation failed", {
        requestId: error.requestId,
        code: error.code,
        details: error.details,
      });
      throw error;
    }

    // Network or parsing errors
    if (error instanceof TypeError || error.name === "SyntaxError") {
      Logger.error("Preview request network failure", { error });
      throw new APIError(
        "Failed to connect to preview service",
        "SERVICE_UNAVAILABLE",
        503,
        null,
        { originalError: error.message }
      );
    }

    // Other unexpected errors
    Logger.error("Unexpected preview generation error", { error });
    throw new APIError(
      "Failed to generate preview",
      "PROCESSING_ERROR",
      500,
      null,
      { originalError: error.message }
    );
  }
}
