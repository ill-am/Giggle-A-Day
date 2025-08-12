// CRUD operations for AetherPress tables

const db = require("./db");

// Retry wrapper for DB operations (handles SQLITE_BUSY)
function withDbRetry(fn, args, cb, maxAttempts = 5, baseDelay = 50) {
  let attempt = 1;
  function tryOp() {
    fn(...args, (err, result) => {
      if (err && err.code === "SQLITE_BUSY" && attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(
          `[DB RETRY] SQLITE_BUSY, retrying in ${delay}ms (attempt ${attempt})`
        );
        attempt++;
        setTimeout(tryOp, delay);
      } else {
        if (err) {
          console.error(`[DB ERROR]`, err);
        }
        cb(err, result);
      }
    });
  }
  tryOp();
}

// --- PROMPTS ---
exports.createPrompt = (prompt, cb) => {
  withDbRetry(
    db.run.bind(db),
    [`INSERT INTO prompts (prompt) VALUES (?)`, [prompt]],
    function (err) {
      cb(err, this ? { id: this.lastID } : null);
    }
  );
};

exports.getPrompts = (cb) => {
  withDbRetry(
    db.all.bind(db),
    [`SELECT * FROM prompts ORDER BY created_at DESC`, []],
    cb
  );
};

exports.getPromptById = (id, cb) => {
  withDbRetry(
    db.get.bind(db),
    [`SELECT * FROM prompts WHERE id = ?`, [id]],
    cb
  );
};

exports.updatePrompt = (id, prompt, cb) => {
  withDbRetry(
    db.run.bind(db),
    [`UPDATE prompts SET prompt = ? WHERE id = ?`, [prompt, id]],
    function (err) {
      cb(err, { changes: this.changes });
    }
  );
};

exports.deletePrompt = (id, cb) => {
  withDbRetry(
    db.run.bind(db),
    [`DELETE FROM prompts WHERE id = ?`, [id]],
    function (err) {
      cb(err, { changes: this.changes });
    }
  );
};

// --- AI_RESULTS ---
exports.createAIResult = (prompt_id, result, cb) => {
  let jsonResult;
  try {
    jsonResult = JSON.stringify(result);
  } catch (e) {
    return cb(new Error("Invalid result object for JSON serialization"));
  }

  withDbRetry(
    db.run.bind(db),
    [
      `INSERT INTO ai_results (prompt_id, result) VALUES (?, ?)`,
      [prompt_id, jsonResult],
    ],
    function (err) {
      cb(err, this ? { id: this.lastID } : null);
    }
  );
};

exports.getAIResults = (cb) => {
  withDbRetry(
    db.all.bind(db),
    [`SELECT * FROM ai_results ORDER BY created_at DESC`, []],
    (err, rows) => {
      if (err) return cb(err);
      try {
        rows = rows.map((row) => ({
          ...row,
          result: JSON.parse(row.result),
        }));
        cb(null, rows);
      } catch (e) {
        cb(new Error("Invalid JSON in database"));
      }
    }
  );
};

exports.getAIResultById = (id, cb) => {
  withDbRetry(
    db.get.bind(db),
    [`SELECT * FROM ai_results WHERE id = ?`, [id]],
    (err, row) => {
      if (err || !row) return cb(err, row);
      try {
        row.result = JSON.parse(row.result);
        cb(null, row);
      } catch (e) {
        cb(new Error("Invalid JSON in database"));
      }
    }
  );
};

exports.updateAIResult = (id, result, cb) => {
  withDbRetry(
    db.run.bind(db),
    [`UPDATE ai_results SET result = ? WHERE id = ?`, [result, id]],
    function (err) {
      cb(err, { changes: this.changes });
    }
  );
};

exports.deleteAIResult = (id, cb) => {
  withDbRetry(
    db.run.bind(db),
    [`DELETE FROM ai_results WHERE id = ?`, [id]],
    function (err) {
      cb(err, { changes: this.changes });
    }
  );
};

// --- OVERRIDES ---
exports.createOverride = (ai_result_id, override, cb) => {
  let jsonOverride;
  try {
    jsonOverride = JSON.stringify(override);
  } catch (e) {
    return cb(new Error("Invalid override object for JSON serialization"));
  }

  withDbRetry(
    db.run.bind(db),
    [
      `INSERT INTO overrides (ai_result_id, override) VALUES (?, ?)`,
      [ai_result_id, jsonOverride],
    ],
    function (err) {
      cb(err, this ? { id: this.lastID } : null);
    }
  );
};

exports.getOverrides = (cb) => {
  console.log("DEBUG: crud.getOverrides called");
  withDbRetry(
    db.all.bind(db),
    [`SELECT * FROM overrides ORDER BY created_at DESC`, []],
    (err, rows) => {
      if (err) {
        console.error("DEBUG: Database error:", err);
        return cb(err);
      }
      try {
        rows = rows.map((row) => ({
          ...row,
          override:
            typeof row.override === "string"
              ? JSON.parse(row.override)
              : row.override,
        }));
        cb(null, rows);
      } catch (e) {
        console.error("DEBUG: JSON parsing error:", e);
        cb(new Error("Invalid JSON in database"));
      }
    }
  );
};

exports.getOverrideById = (id, cb) => {
  withDbRetry(
    db.get.bind(db),
    [`SELECT * FROM overrides WHERE id = ?`, [id]],
    (err, row) => {
      if (err || !row) return cb(err, row);
      try {
        row.override =
          typeof row.override === "string"
            ? JSON.parse(row.override)
            : row.override;
        cb(null, row);
      } catch (e) {
        cb(new Error("Invalid JSON in database"));
      }
    }
  );
};

exports.updateOverride = (id, override, cb) => {
  let jsonOverride;
  try {
    jsonOverride = JSON.stringify(override);
  } catch (e) {
    return cb(new Error("Invalid override object for JSON serialization"));
  }

  withDbRetry(
    db.run.bind(db),
    [`UPDATE overrides SET override = ? WHERE id = ?`, [jsonOverride, id]],
    function (err) {
      if (err) return cb(err);
      if (this.changes === 0) return cb(null, { changes: 0 });
      cb(null, { changes: this.changes });
    }
  );
};

exports.deleteOverride = (id, cb) => {
  withDbRetry(
    db.run.bind(db),
    [`DELETE FROM overrides WHERE id = ?`, [id]],
    function (err) {
      cb(err, { changes: this.changes });
    }
  );
};

// --- PDF_EXPORTS ---
exports.createPDFExport = (ai_result_id, file_path, cb) => {
  withDbRetry(
    db.run.bind(db),
    [
      `INSERT INTO pdf_exports (ai_result_id, file_path) VALUES (?, ?)`,
      [ai_result_id, file_path],
    ],
    function (err) {
      cb(err, this ? { id: this.lastID } : null);
    }
  );
};

exports.getPDFExports = (cb) => {
  withDbRetry(
    db.all.bind(db),
    [`SELECT * FROM pdf_exports ORDER BY created_at DESC`, []],
    cb
  );
};

exports.getPDFExportById = (id, cb) => {
  withDbRetry(
    db.get.bind(db),
    [`SELECT * FROM pdf_exports WHERE id = ?`, [id]],
    cb
  );
};

exports.updatePDFExport = (id, file_path, cb) => {
  withDbRetry(
    db.run.bind(db),
    [`UPDATE pdf_exports SET file_path = ? WHERE id = ?`, [file_path, id]],
    function (err) {
      cb(err, { changes: this.changes });
    }
  );
};

exports.deletePDFExport = (id, cb) => {
  withDbRetry(
    db.run.bind(db),
    [`DELETE FROM pdf_exports WHERE id = ?`, [id]],
    function (err) {
      cb(err, { changes: this.changes });
    }
  );
};
