// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Basic Express server setup
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const puppeteer = require("puppeteer");
const db = require("./db");
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database first
    await db.initialize();
    console.log("Database initialized successfully");
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful startup configuration
const STARTUP_GRACE_PERIOD_MS = 30000; // 30 seconds grace period
const RETRY_DELAY_MS = 5000; // 5 seconds between retries

// Global service state management
const serviceState = {
  startupTime: Date.now(),
  puppeteer: {
    ready: false,
    transitioning: false,
    lastError: null,
    startupPhase: "initializing", // 'initializing' | 'connecting' | 'ready' | 'failed'
    retryCount: 0,
    lastRetryTime: null,
    successfulHealthChecks: 0,
  },
  db: {
    ready: false,
    lastError: null,
    startupPhase: "initializing",
  },
};

// Puppeteer global browser instance
let browserInstance;
const MAX_PUPPETEER_RESTARTS = 5;

async function startPuppeteer() {
  try {
    serviceState.puppeteer.transitioning = true;
    serviceState.puppeteer.startupPhase = "initializing";
    console.log(
      `[Puppeteer] Initialization attempt ${
        serviceState.puppeteer.retryCount + 1
      }/${MAX_PUPPETEER_RESTARTS}`
    );

  try {
    browserInstance = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      args: ["--no-sandbox"],
      // Add more robust launch options
      timeout: 30000,
      ignoreHTTPSErrors: true,
    });

    // Verify browser health with a test page
    const testPage = await browserInstance.newPage();
    await testPage.goto("about:blank");
    await testPage.close();

    serviceState.puppeteer.ready = true;
    serviceState.puppeteer.transitioning = false;
    serviceState.puppeteer.lastError = null;
    serviceState.puppeteer.startupPhase = "ready";
    serviceState.puppeteer.successfulHealthChecks = 0;
    console.log("[Puppeteer] Initialization successful");

    // Enhanced disconnect handler
    browserInstance.on("disconnected", async () => {
      console.error("[Puppeteer] Browser disconnected");
      serviceState.puppeteer.ready = false;
      serviceState.puppeteer.transitioning = true;
      serviceState.puppeteer.startupPhase = "connecting";
      serviceState.puppeteer.lastError = "Browser disconnected";
      await attemptPuppeteerRestart();
    });
  } catch (err) {
    handlePuppeteerError(err);
  } finally {
    // Ensure cleanup happens even if there's an error
  }
}

function handlePuppeteerError(err) {
  serviceState.puppeteer.ready = false;
  serviceState.puppeteer.transitioning = false;
  serviceState.puppeteer.lastError = err.message;
  serviceState.puppeteer.retryCount++;

  if (serviceState.puppeteer.retryCount < MAX_PUPPETEER_RESTARTS) {
    serviceState.puppeteer.startupPhase = "connecting";
    serviceState.puppeteer.lastRetryTime = Date.now();
    console.log(`[Puppeteer] Retrying in ${RETRY_DELAY_MS}ms...`);
    setTimeout(startPuppeteer, RETRY_DELAY_MS);
  } else {
    serviceState.puppeteer.startupPhase = "failed";
    console.error("[Puppeteer] Max retry attempts reached");
  }
}

function attemptPuppeteerRestart() {
  if (puppeteerRestartAttempts < MAX_PUPPETEER_RESTARTS) {
    puppeteerRestartAttempts++;
    setTimeout(startPuppeteer, 2000 * puppeteerRestartAttempts);
  } else {
    console.error(
      "Max Puppeteer restart attempts reached. Manual intervention required."
    );
  }
}

// Trust proxy for rate limiting
app.set("trust proxy", 1);

// Update startServer to handle all initialization
async function startServer() {
  try {
    // Initialize database first
    await db.initialize();
    console.log("Database initialized successfully");
    serviceState.db.ready = true;
    serviceState.db.startupPhase = "ready";
    
    // Then initialize Puppeteer
    await startPuppeteer();
    
    // Start the server only after both are ready
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

// Start the server with proper initialization sequence
startServer();

// Middleware
app.use(express.json());
app.use(morgan("dev"));
app.use(cors());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Helper to check if we're still in grace period
function isInGracePeriod() {
  return Date.now() - serviceState.startupTime < STARTUP_GRACE_PERIOD_MS;
}

// Startup Readiness Probe Middleware
app.use((req, res, next) => {
  // Allow health check and root route to bypass readiness check
  if (req.path === "/health" || req.path === "/") {
    return next();
  }

  const timestamp = new Date().toISOString();

  // Check if service is transitioning
  if (serviceState.puppeteer.transitioning) {
    return res.status(503).json({
      status: "error",
      reason: "Service transitioning: Puppeteer is restarting",
      timestamp,
      details: {
        puppeteerError: serviceState.puppeteer.lastError,
      },
    });
  }

  // Check if service is ready
  if (!serviceState.puppeteer.ready || !browserInstance) {
    return res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Service not ready",
      puppeteer: serviceState.puppeteer.transitioning
        ? "initializing"
        : "failed",
    });
  }

  // If we reach here, services are ready
  next();
});

// Health endpoint
// Checks both SQLite3 and Puppeteer status
const db = require("./db");
app.get("/health", async (req, res) => {
  try {
    // Throttle health checks during startup
    if (isInGracePeriod()) {
      return res.status(503).json({
        status: "initializing",
        timestamp: new Date().toISOString(),
        uptime: Date.now() - serviceState.startupTime,
        services: {
          puppeteer: {
            phase: serviceState.puppeteer.startupPhase,
            retryCount: serviceState.puppeteer.retryCount,
            transitioning: serviceState.puppeteer.transitioning,
          },
          db: {
            phase: serviceState.db.startupPhase,
          },
        },
      });
    }

    // Regular health check
    const [puppeteerStatus, dbStatus] = await Promise.all([
      checkPuppeteerHealth().catch(err => ({ ok: false, error: err.message })),
      checkDatabaseHealth().catch(err => ({ ok: false, error: err.message }))
    ]);

    const health = {
      status: puppeteerStatus.ok && dbStatus.ok ? "ok" : "error",
      timestamp: new Date().toISOString(),
      uptime: Date.now() - serviceState.startupTime,
      services: {
        puppeteer: {
          status: puppeteerStatus.ok ? "ok" : "error",
          phase: serviceState.puppeteer.startupPhase,
          error: puppeteerStatus.error,
          healthChecks: serviceState.puppeteer.successfulHealthChecks,
          ready: serviceState.puppeteer.ready,
          transitioning: serviceState.puppeteer.transitioning
        },
        db: {
          status: dbStatus.ok ? "ok" : "error",
          error: dbStatus.error,
          phase: serviceState.db.startupPhase,
          ready: serviceState.db.ready
        }
      }
    };

    if (health.status === "ok") {
      serviceState.puppeteer.successfulHealthChecks++;
      serviceState.db.ready = true;
      serviceState.db.lastError = null;
    }

    const statusCode = health.status === "ok" ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error("[Health Check Error]", error);
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        puppeteer: {
          status: "error",
          phase: serviceState.puppeteer.startupPhase,
          error: error.message
        },
        db: {
          status: "error",
          phase: serviceState.db.startupPhase,
          error: error.message
        }
      }
    });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("Hello, world! Your Express server is running.");
});

// Test error route
app.get("/test-error", (req, res, next) => {
  const err = new Error("Simulated error for testing");
  err.status = 418;
  next(err);
});

// Centralized error handler
app.use((err, req, res, next) => {
  // Log error details
  console.error("--- Error Handler ---");
  console.error("Time:", new Date().toISOString());
  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Body:", req.body);
  console.error("Error Stack:", err.stack);

  // Differentiate error response by environment
  const isDev = process.env.NODE_ENV !== "production";
  res.status(err.status || 500).json({
    error: isDev ? err.message : "Internal Server Error",
    ...(isDev && { stack: err.stack }),
  });
});

// Database initialization
require("./db");

const crud = require("./crud");

// --- PROMPT PROCESSING ENDPOINT ---
const { MockAIService } = require("./aiService");
const aiService = new MockAIService();

app.post("/prompt", async (req, res, next) => {
  const { prompt } = req.body;

  // Input validation with structured error
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(
      res,
      "Prompt is required and must be a non-empty string",
      {
        provided: typeof prompt,
        required: "non-empty string",
      }
    );
  }

  try {
    // Use AI service abstraction with new content format
    const aiResponse = await aiService.generateContent(prompt);

    crud.createPrompt(prompt, (err, dbResult) => {
      if (err) {
        err.status = 500;
        err.message = "Failed to store prompt in database";
        return next(err);
      }

      // Store both prompt and generated content
      crud.createAIResult(dbResult.id, aiResponse.content, (err, aiResult) => {
        if (err) {
          err.status = 500;
          err.message = "Failed to store AI result in database";
          return next(err);
        }

        res.status(201).json({
          success: true,
          data: {
            ...aiResponse,
            promptId: dbResult.id,
            resultId: aiResult.id,
          },
        });
      });
    });
  } catch (err) {
    // Enhanced AI service error handling
    err.status = err.status || 500;
    err.message = `AI Service Error: ${err.message}`;
    next(err);
  }
});

// --- PREVIEW ENDPOINT ---
// Import error handling utilities
const { sendValidationError } = require("./utils/errorHandler");

const previewTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    .preview { max-width: 800px; margin: 2rem auto; font-family: system-ui; }
    .preview h1 { color: #2c3e50; }
    .preview .content { line-height: 1.6; }
  </style>
</head>
<body>
  <div class="preview">
    <h1>${content.title}</h1>
    <div class="content">${content.body}</div>
  </div>
</body>
</html>
`;

app.get("/preview", (req, res) => {
  const { content } = req.query;

  // Validate required parameter
  if (!content) {
    return sendValidationError(res, "Content parameter is required");
  }

  try {
    const contentObj = JSON.parse(content);

    // Validate content structure
    if (!contentObj.title || !contentObj.body) {
      return sendValidationError(res, "Content must include title and body", {
        provided: Object.keys(contentObj),
      });
    }

    res.send(previewTemplate(contentObj));
  } catch (err) {
    sendValidationError(res, "Invalid content format", { error: err.message });
  }
});

// --- OVERRIDE ENDPOINT ---
app.post("/override", (req, res) => {
  const { content, changes } = req.body;

  // Enhanced input validation
  if (!content) {
    return sendValidationError(res, "Content is required", {
      provided: typeof content,
      required: "object",
    });
  }

  if (!changes) {
    return sendValidationError(res, "Changes are required", {
      provided: typeof changes,
      required: "object",
    });
  }

  if (typeof content !== "object" || content === null) {
    return sendValidationError(res, "Content must be an object", {
      provided: content === null ? "null" : typeof content,
      required: "object",
    });
  }

  try {
    const updated = { ...content, ...changes };
    res.status(200).json({
      success: true,
      data: {
        content: updated,
      },
    });
  } catch (err) {
    sendValidationError(res, "Failed to update content", {
      error: err.message,
    });
  }
});

// --- PDF EXPORT ENDPOINT ---
app.post("/export", async (req, res, next) => {
  const fs = require("fs");
  const path = require("path");

  // Input validation
  const { title, body } = req.body;
  if (!title || !body) {
    return sendValidationError(res, "Content must include title and body", {
      provided: Object.keys(req.body),
      required: ["title", "body"],
    });
  }

  // Service availability check
  if (!puppeteerReady || !browserInstance) {
    const err = new Error("PDF generation service not ready");
    err.status = 503;
    err.code = "SERVICE_UNAVAILABLE";
    err.details = {
      puppeteer: puppeteerReady ? "ready" : "initializing",
      browser: browserInstance ? "available" : "not available",
    };
    return next(err);
  }

  // Log request for debugging (optional)
  try {
    const reqBodyPath = path.resolve(
      __dirname,
      "../samples/export_request_body.json"
    );
    fs.writeFileSync(reqBodyPath, JSON.stringify(req.body, null, 2));
  } catch (e) {
    console.warn("Failed to write debug log:", e.message);
  }

  let page;
  try {
    // PDF Generation process
    page = await browserInstance.newPage();
    if (!page) {
      throw new Error("Failed to create new browser page");
    }

    const contentObj = { title, body };
    await page.setContent(previewTemplate(contentObj));

    // Generate PDF with both buffer and file output
    const timestamp = Date.now();
    const filename = `output-${timestamp}.pdf`;
    const outputPath = path.resolve(__dirname, `../samples/${filename}`);

    const pdf = await page.pdf({
      path: outputPath, // Save to file
      format: "A4",
      printBackground: true,
      margin: {
        top: "1cm",
        right: "1cm",
        bottom: "1cm",
        left: "1cm",
      },
    });

    // Verify file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error("PDF file was not created successfully");
    }

    // Read the generated file
    const pdfBuffer = fs.readFileSync(outputPath);

    // Optional debug logging
    try {
      const pdfFirst16Path = path.resolve(
        __dirname,
        "../samples/export_pdf_first16.bin"
      );
      fs.writeFileSync(pdfFirst16Path, pdf.slice(0, 16));
    } catch (e) {
      console.warn("Failed to write debug sample:", e.message);
    }

    // Set response headers
    res.setHeader("Content-Disposition", `inline; filename=${filename}`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);

    // Send PDF response
    res.end(pdfBuffer);

    // Clean up: Remove the temporary file
    try {
      fs.unlinkSync(outputPath);
    } catch (cleanupError) {
      console.warn(
        "Failed to clean up temporary PDF file:",
        cleanupError.message
      );
    }
  } catch (err) {
    const exportError = new Error(`PDF Generation Failed: ${err.message}`);
    exportError.status = 500;
    exportError.code = "PDF_GENERATION_ERROR";
    exportError.details = {
      step: err.message.includes("browser page")
        ? "page_creation"
        : err.message.includes("setContent")
        ? "content_rendering"
        : err.message.includes("generation failed")
        ? "pdf_creation"
        : "unknown",
      originalError: err.message,
    };
    next(exportError);
  } finally {
    if (page) await page.close();
  }
});

// --- PROMPTS CRUD API ---
app.post("/api/prompts", (req, res, next) => {
  const { prompt } = req.body;

  // Input validation with structured error
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(
      res,
      "Prompt is required and must be a non-empty string",
      {
        provided: typeof prompt,
        required: "non-empty string",
        received: prompt,
      }
    );
  }

  crud.createPrompt(prompt, (err, result) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate prompt not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to create prompt";
      }
      return next(err);
    }

    // Return standardized success response
    res.status(201).json({
      success: true,
      data: result,
    });
  });
});

app.get("/api/prompts", (req, res, next) => {
  // Parse pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Validate pagination parameters
  if (page < 1 || limit < 1) {
    return sendValidationError(res, "Invalid pagination parameters", {
      provided: { page, limit },
      required: "positive integers",
      details: "Page and limit must be greater than 0",
    });
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  crud.getPrompts((err, rows) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve prompts";
      return next(err);
    }

    // Handle empty results
    if (!rows || rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    // Calculate total pages
    const total = rows.length;
    const pages = Math.ceil(total / limit);

    // Paginate results
    const paginatedRows = rows.slice(offset, offset + limit);

    // Return standardized success response with pagination
    res.status(200).json({
      success: true,
      data: paginatedRows,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  });
});

app.get("/api/prompts/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid prompt ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Prompt ID must be a positive integer",
    });
  }

  crud.getPromptById(id, (err, row) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve prompt";
      return next(err);
    }

    // Handle not found
    if (!row) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Prompt not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: row,
    });
  });
});

app.put("/api/prompts/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid prompt ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Prompt ID must be a positive integer",
    });
  }

  // Validate prompt in request body
  const { prompt } = req.body;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(
      res,
      "Prompt is required and must be a non-empty string",
      {
        provided: typeof prompt,
        required: "non-empty string",
        received: prompt,
      }
    );
  }

  crud.updatePrompt(id, prompt, (err, result) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate prompt not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to update prompt";
      }
      return next(err);
    }

    // Handle not found case
    if (!result || result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Prompt not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        id,
        prompt,
        updated_at: new Date().toISOString(),
      },
    });
  });
});

app.delete("/api/prompts/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid prompt ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Prompt ID must be a positive integer",
    });
  }

  crud.deletePrompt(id, (err, result) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 409;
        err.message = "Cannot delete prompt: It is referenced by other records";
      } else {
        err.status = 500;
        err.message = "Failed to delete prompt";
      }
      return next(err);
    }

    // Handle not found case
    if (!result || result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Prompt not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        message: "Prompt deleted successfully",
        id,
        deleted_at: new Date().toISOString(),
      },
    });
  });
});

// --- AI_RESULTS CRUD API ---
app.post("/api/ai_results", (req, res, next) => {
  const { prompt_id, result } = req.body;

  // Validate prompt_id
  if (!Number.isInteger(prompt_id) || prompt_id < 1) {
    return sendValidationError(res, "prompt_id must be a positive integer", {
      provided: typeof prompt_id === "number" ? prompt_id : typeof prompt_id,
      required: "positive integer",
      details: "prompt_id must be a valid prompt reference",
    });
  }

  // Validate result object
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return sendValidationError(res, "result must be a valid object", {
      provided: Array.isArray(result) ? "array" : typeof result,
      required: "object",
      details: "result must contain the AI generation output",
    });
  }

  // Validate required result properties
  const requiredProps = ["content", "metadata"];
  const missingProps = requiredProps.filter((prop) => !(prop in result));
  if (missingProps.length > 0) {
    return sendValidationError(res, "Missing required properties in result", {
      missing: missingProps,
      required: requiredProps,
      provided: Object.keys(result),
    });
  }

  crud.createAIResult(prompt_id, result, (err, resultObj) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 404;
        err.message = "Referenced prompt not found";
      } else if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate AI result not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to create AI result";
      }
      return next(err);
    }

    // Return standardized success response
    res.status(201).json({
      success: true,
      data: {
        ...resultObj,
        created_at: new Date().toISOString(),
      },
    });
  });
});

app.get("/api/ai_results", (req, res, next) => {
  // Parse and validate pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const prompt_id = req.query.prompt_id ? parseInt(req.query.prompt_id) : null;

  // Validate pagination parameters
  if (page < 1 || limit < 1) {
    return sendValidationError(res, "Invalid pagination parameters", {
      provided: { page, limit },
      required: "positive integers",
      details: "Page and limit must be greater than 0",
    });
  }

  // Validate prompt_id if provided
  if (prompt_id !== null && (isNaN(prompt_id) || prompt_id < 1)) {
    return sendValidationError(res, "Invalid prompt_id filter", {
      provided: req.query.prompt_id,
      required: "positive integer",
      details: "prompt_id must be a positive integer",
    });
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  crud.getAIResults((err, rows) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve AI results";
      return next(err);
    }

    // Filter by prompt_id if provided
    let filteredRows = rows;
    if (prompt_id) {
      filteredRows = rows.filter((row) => row.prompt_id === prompt_id);
    }

    // Handle empty results
    if (!filteredRows || filteredRows.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    // Calculate pagination
    const total = filteredRows.length;
    const pages = Math.ceil(total / limit);
    const paginatedRows = filteredRows.slice(offset, offset + limit);

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: paginatedRows,
      pagination: {
        page,
        limit,
        total,
        pages,
        prompt_id: prompt_id || undefined,
      },
    });
  });
});

app.get("/api/ai_results/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid AI result ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "AI result ID must be a positive integer",
    });
  }

  crud.getAIResultById(id, (err, row) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve AI result";
      return next(err);
    }

    // Handle not found
    if (!row) {
      return res.status(404).json({
        success: false,
        error: {
          message: "AI result not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        ...row,
        result:
          typeof row.result === "string" ? JSON.parse(row.result) : row.result,
      },
    });
  });
});

app.put("/api/ai_results/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid AI result ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "AI result ID must be a positive integer",
    });
  }

  // Validate result object
  const { result } = req.body;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return sendValidationError(res, "result must be a valid object", {
      provided: Array.isArray(result) ? "array" : typeof result,
      required: "object",
      details: "result must contain the AI generation output",
    });
  }

  // Validate required result properties
  const requiredProps = ["content", "metadata"];
  const missingProps = requiredProps.filter((prop) => !(prop in result));
  if (missingProps.length > 0) {
    return sendValidationError(res, "Missing required properties in result", {
      missing: missingProps,
      required: requiredProps,
      provided: Object.keys(result),
    });
  }

  crud.updateAIResult(id, result, (err, resultObj) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Constraint violation in update";
      } else if (!resultObj || resultObj.changes === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: "AI result not found",
            code: "RESOURCE_NOT_FOUND",
            status: 404,
            details: { id },
          },
        });
      } else {
        err.status = 500;
        err.message = "Failed to update AI result";
      }
      return next(err);
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        id,
        result,
        updated_at: new Date().toISOString(),
      },
    });
  });
});

app.delete("/api/ai_results/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid AI result ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "AI result ID must be a positive integer",
    });
  }

  crud.deleteAIResult(id, (err, resultObj) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 409;
        err.message =
          "Cannot delete AI result: It is referenced by other records";
      } else {
        err.status = 500;
        err.message = "Failed to delete AI result";
      }
      return next(err);
    }

    // Handle not found case
    if (!resultObj || resultObj.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "AI result not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        message: "AI result deleted successfully",
        id,
        deleted_at: new Date().toISOString(),
      },
    });
  });
});

// --- OVERRIDES CRUD API ---
app.post("/api/overrides", (req, res, next) => {
  const { ai_result_id, override } = req.body;

  // Validate ai_result_id
  if (!Number.isInteger(ai_result_id) || ai_result_id < 1) {
    return sendValidationError(res, "ai_result_id must be a positive integer", {
      provided:
        typeof ai_result_id === "number" ? ai_result_id : typeof ai_result_id,
      required: "positive integer",
      details: "ai_result_id must be a valid AI result reference",
    });
  }

  // Validate override object
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return sendValidationError(res, "override must be a valid object", {
      provided: Array.isArray(override) ? "array" : typeof override,
      required: "object",
      details: "override must contain the modifications to the AI result",
    });
  }

  // Validate override properties
  const allowedProps = ["content", "metadata", "changes"];
  const invalidProps = Object.keys(override).filter(
    (prop) => !allowedProps.includes(prop)
  );
  if (invalidProps.length > 0) {
    return sendValidationError(res, "Invalid properties in override object", {
      invalid: invalidProps,
      allowed: allowedProps,
      provided: Object.keys(override),
    });
  }

  // Ensure at least one valid modification
  if (Object.keys(override).length === 0) {
    return sendValidationError(
      res,
      "Override must contain at least one modification",
      {
        provided: "empty object",
        required: "at least one of: content, metadata, changes",
        details: "Override cannot be empty",
      }
    );
  }

  crud.createOverride(ai_result_id, override, (err, resultObj) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 404;
        err.message = "Referenced AI result not found";
      } else if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate override not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to create override";
      }
      return next(err);
    }

    // Return standardized success response
    res.status(201).json({
      success: true,
      data: {
        ...resultObj,
        created_at: new Date().toISOString(),
      },
    });
  });
});

app.get("/api/overrides", (req, res, next) => {
  console.log("DEBUG: Entering GET /api/overrides");
  console.log("DEBUG: Query params:", req.query);

  // Parse and validate pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const ai_result_id = req.query.ai_result_id
    ? parseInt(req.query.ai_result_id)
    : null;

  console.log("DEBUG: Parsed params:", { page, limit, ai_result_id });

  // Validate pagination parameters
  if (page < 1 || limit < 1) {
    return sendValidationError(res, "Invalid pagination parameters", {
      provided: { page, limit },
      required: "positive integers",
      details: "Page and limit must be greater than 0",
    });
  }

  // Validate ai_result_id if provided
  if (ai_result_id !== null && (isNaN(ai_result_id) || ai_result_id < 1)) {
    return sendValidationError(res, "Invalid ai_result_id filter", {
      provided: req.query.ai_result_id,
      required: "positive integer",
      details: "ai_result_id must be a positive integer",
    });
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  console.log("DEBUG: About to call crud.getOverrides");
  crud.getOverrides((err, rows) => {
    console.log("DEBUG: getOverrides callback received:", {
      err,
      rowCount: rows?.length,
    });
    if (err) {
      console.error("DEBUG: Error in getOverrides:", err);
      err.status = 500;
      err.message = "Failed to retrieve overrides";
      return next(err);
    }

    // Filter by ai_result_id if provided
    let filteredRows = rows;
    if (ai_result_id) {
      filteredRows = rows.filter((row) => row.ai_result_id === ai_result_id);
    }

    // Handle empty results
    if (!filteredRows || filteredRows.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    // Calculate pagination
    const total = filteredRows.length;
    const pages = Math.ceil(total / limit);
    const paginatedRows = filteredRows.slice(offset, offset + limit);

    // Parse override JSON if stored as string
    const processedRows = paginatedRows.map((row) => ({
      ...row,
      override:
        typeof row.override === "string"
          ? JSON.parse(row.override)
          : row.override,
    }));

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: processedRows,
      pagination: {
        page,
        limit,
        total,
        pages,
        ai_result_id: ai_result_id || undefined,
      },
    });
  });
});

app.get("/api/overrides/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid override ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Override ID must be a positive integer",
    });
  }

  crud.getOverrideById(id, (err, row) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve override";
      return next(err);
    }

    // Handle not found
    if (!row) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Override not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Parse override JSON if stored as string
    const processedRow = {
      ...row,
      override:
        typeof row.override === "string"
          ? JSON.parse(row.override)
          : row.override,
    };

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: processedRow,
    });
  });
});

app.put("/api/overrides/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid override ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Override ID must be a positive integer",
    });
  }

  // Validate override object
  const { override } = req.body;
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return sendValidationError(res, "override must be a valid object", {
      provided: Array.isArray(override) ? "array" : typeof override,
      required: "object",
      details: "override must contain the modifications to the AI result",
    });
  }

  // Validate override properties
  const allowedProps = ["content", "metadata", "changes"];
  const invalidProps = Object.keys(override).filter(
    (prop) => !allowedProps.includes(prop)
  );
  if (invalidProps.length > 0) {
    return sendValidationError(res, "Invalid properties in override object", {
      invalid: invalidProps,
      allowed: allowedProps,
      provided: Object.keys(override),
    });
  }

  // Ensure at least one valid modification
  if (Object.keys(override).length === 0) {
    return sendValidationError(
      res,
      "Override must contain at least one modification",
      {
        provided: "empty object",
        required: "at least one of: content, metadata, changes",
        details: "Override cannot be empty",
      }
    );
  }

  crud.updateOverride(id, override, (err, resultObj) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to update override";
      return next(err);
    }

    if (!resultObj || resultObj.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Override not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        id,
        override,
        updated_at: new Date().toISOString(),
      },
    });
  });
});

app.delete("/api/overrides/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid override ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Override ID must be a positive integer",
    });
  }

  crud.deleteOverride(id, (err, resultObj) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 409;
        err.message =
          "Cannot delete override: It is referenced by other records";
      } else {
        err.status = 500;
        err.message = "Failed to delete override";
      }
      return next(err);
    }

    // Handle not found case
    if (!resultObj || resultObj.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Override not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        message: "Override deleted successfully",
        id,
        deleted_at: new Date().toISOString(),
      },
    });
  });
});

// --- PDF_EXPORTS CRUD API ---
app.post("/api/pdf_exports", (req, res, next) => {
  const { ai_result_id, file_path } = req.body;

  // Validate ai_result_id
  if (!Number.isInteger(ai_result_id) || ai_result_id < 1) {
    return sendValidationError(res, "ai_result_id must be a positive integer", {
      provided:
        typeof ai_result_id === "number" ? ai_result_id : typeof ai_result_id,
      required: "positive integer",
      details: "ai_result_id must be a valid AI result reference",
    });
  }

  // Validate file_path
  if (typeof file_path !== "string" || !file_path.trim()) {
    return sendValidationError(res, "file_path must be a non-empty string", {
      provided: typeof file_path,
      required: "non-empty string",
      details: "file_path must be a valid path string",
    });
  }

  // Validate file path format
  const validPathPattern = /^[a-zA-Z0-9\-_\/\.]+\.(pdf|PDF)$/;
  if (!validPathPattern.test(file_path)) {
    return sendValidationError(res, "Invalid file path format", {
      provided: file_path,
      required: "valid PDF file path",
      details: "File path must be a valid path ending with .pdf",
    });
  }

  crud.createPDFExport(ai_result_id, file_path, (err, resultObj) => {
    if (err) {
      // Handle foreign key constraint violation
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 404;
        err.message = "Referenced AI result not found";
      } else if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate PDF export not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to create PDF export";
      }
      return next(err);
    }

    // Return standardized success response
    res.status(201).json({
      success: true,
      data: {
        ...resultObj,
        created_at: new Date().toISOString(),
      },
    });
  });
});

app.get("/api/pdf_exports", (req, res, next) => {
  // Parse and validate pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const ai_result_id = req.query.ai_result_id
    ? parseInt(req.query.ai_result_id)
    : null;

  // Validate pagination parameters
  if (page < 1 || limit < 1) {
    return sendValidationError(res, "Invalid pagination parameters", {
      provided: { page, limit },
      required: "positive integers",
      details: "Page and limit must be greater than 0",
    });
  }

  // Validate ai_result_id if provided
  if (ai_result_id !== null && (isNaN(ai_result_id) || ai_result_id < 1)) {
    return sendValidationError(res, "Invalid ai_result_id filter", {
      provided: req.query.ai_result_id,
      required: "positive integer",
      details: "ai_result_id must be a positive integer",
    });
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  crud.getPDFExports((err, rows) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve PDF exports";
      return next(err);
    }

    // Filter by ai_result_id if provided
    let filteredRows = rows;
    if (ai_result_id) {
      filteredRows = rows.filter((row) => row.ai_result_id === ai_result_id);
    }

    // Handle empty results
    if (!filteredRows || filteredRows.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    // Calculate pagination
    const total = filteredRows.length;
    const pages = Math.ceil(total / limit);
    const paginatedRows = filteredRows.slice(offset, offset + limit);

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: paginatedRows,
      pagination: {
        page,
        limit,
        total,
        pages,
        ai_result_id: ai_result_id || undefined,
      },
    });
  });
});

app.get("/api/pdf_exports/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid PDF export ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "PDF export ID must be a positive integer",
    });
  }

  crud.getPDFExportById(id, (err, row) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve PDF export";
      return next(err);
    }

    // Handle not found
    if (!row) {
      return res.status(404).json({
        success: false,
        error: {
          message: "PDF export not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: row,
    });
  });
});

app.put("/api/pdf_exports/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid PDF export ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "PDF export ID must be a positive integer",
    });
  }

  // Validate file_path in request body
  const { file_path } = req.body;
  if (typeof file_path !== "string" || !file_path.trim()) {
    return sendValidationError(res, "file_path must be a non-empty string", {
      provided: typeof file_path,
      required: "non-empty string",
      details: "file_path must be a valid path string",
    });
  }

  // Validate file path format
  const validPathPattern = /^[a-zA-Z0-9\-_\/\.]+\.(pdf|PDF)$/;
  if (!validPathPattern.test(file_path)) {
    return sendValidationError(res, "Invalid file path format", {
      provided: file_path,
      required: "valid PDF file path",
      details: "File path must be a valid path ending with .pdf",
    });
  }

  crud.updatePDFExport(id, file_path, (err, resultObj) => {
    if (err) {
      // Handle database errors
      if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate file path not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to update PDF export";
      }
      return next(err);
    }

    // Handle not found case
    if (!resultObj || resultObj.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "PDF export not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        id,
        file_path,
        updated_at: new Date().toISOString(),
      },
    });
  });
});

app.delete("/api/pdf_exports/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid PDF export ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "PDF export ID must be a positive integer",
    });
  }

  crud.deletePDFExport(id, (err, resultObj) => {
    if (err) {
      // Handle specific database errors
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 409;
        err.message =
          "Cannot delete PDF export: It is referenced by other records";
      } else {
        err.status = 500;
        err.message = "Failed to delete PDF export";
      }
      return next(err);
    }

    // Handle not found case
    if (!resultObj || resultObj.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "PDF export not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
          details: { id },
        },
      });
    }

    // Return standardized success response
    res.status(200).json({
      success: true,
      data: {
        message: "PDF export deleted successfully",
        id,
        deleted_at: new Date().toISOString(),
      },
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown for Puppeteer and DB
process.on("SIGINT", async () => {
  console.log("Received SIGINT. Closing resources...");
  if (browserInstance) await browserInstance.close();
  db.close();
  process.exit(0);
});

async function checkPuppeteerHealth() {
  if (!browserInstance) {
    return { ok: false, error: "No browser instance" };
  }

  try {
    const page = await browserInstance.newPage();
    await page.close();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkDatabaseHealth() {
  return new Promise((resolve) => {
    db.get("SELECT 1", (err) => {
      if (err) {
        resolve({ ok: false, error: err.message });
      } else {
        resolve({ ok: true, error: null });
      }
    });
  });
}
