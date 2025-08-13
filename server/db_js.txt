// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// SQLite database initialization for AetherPress
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname, "../data");
const dbPath = path.join(dbDir, "aetherpress.db");

// Ensure /data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

/**
 * Initialize the SQLite database with all required tables
 * @returns {Promise<import('sqlite3').Database>}
 */
function initializeDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Failed to connect to SQLite database:", err.message);
        return reject(err);
      }
      console.log("Connected to SQLite database at", dbPath);
      
      // Enable foreign key constraints and create tables
      db.serialize(() => {
        db.run("PRAGMA foreign_keys = ON;", (err) => {
          if (err) {
            console.error("Failed to enable foreign keys:", err.message);
            return reject(err);
          }
          console.log("Foreign key constraints enabled");
        });
      db.run(`CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS ai_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id INTEGER NOT NULL,
        result TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ai_result_id INTEGER NOT NULL,
        override TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ai_result_id) REFERENCES ai_results(id)
      )`);

      // Create tables in sequence
      /** @type {string[]} */
      const createTables = [
        [
          "CREATE TABLE IF NOT EXISTS pdf_exports (",
          "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
          "  ai_result_id INTEGER NOT NULL,",
          "  file_path TEXT NOT NULL,",
          "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,",
          "  FOREIGN KEY (ai_result_id) REFERENCES ai_results(id)",
          ")"
        ].join("\n")
      ];

      // Execute each table creation in sequence
      let currentTable = 0;
      const executeNextTable = () => {
        if (currentTable >= createTables.length) {
          resolve(db);
          return;
        }

        db.run(createTables[currentTable], (err) => {
          if (err) {
            console.error(`Failed to create table ${currentTable}:`, err.message);
            return reject(err);
          }
          currentTable++;
          executeNextTable();
        });
      };

      executeNextTable();
    });
  });
}

/** @type {import('sqlite3').Database | null} */
let db = null;

/** @type {import('sqlite3').Database} */
const dbInterface = {
  async initialize() {
    if (!db) {
      db = await initializeDb();
    }
    return db;
  },
  get(...args) {
    if (!db) return Promise.reject(new Error("Database not initialized"));
    return new Promise((resolve, reject) => {
      db.get(...args, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  run(...args) {
    if (!db) return Promise.reject(new Error("Database not initialized"));
    return new Promise((resolve, reject) => {
      db.run(...args, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  },
  all(...args) {
    if (!db) return Promise.reject(new Error("Database not initialized"));
    return new Promise((resolve, reject) => {
      db.all(...args, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  close() {
    return new Promise((resolve) => {
      if (db) {
        db.close(() => {
          db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
};

// Export the database interface
module.exports = dbInterface;
        ai_result_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ai_result_id) REFERENCES ai_results(id)
      )`);
    });
  }
});

module.exports = db;
