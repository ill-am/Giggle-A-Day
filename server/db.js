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
/**/
/**/
// A simple helper function to promisify db.run
function runPromise(db, sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Initializes the SQLite database, enabling foreign keys and creating all necessary tables.
 * @returns {Promise<sqlite3.Database>} The database instance.
 */
async function initializeDb() {
  const dbPath = "../data/your-database-name.db"; // Make sure to define dbPath
  const sqlite3 = require('sqlite3').verbose(); // and require sqlite3

  try {
    const db = await new Promise((resolve, reject) => {
      const newDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error("Failed to connect to SQLite database:", err.message);
          return reject(err);
        }
        console.log("Connected to SQLite database at", dbPath);
        resolve(newDb);
      });
    });

    // All table creation queries in a single array
    const createTables = [
      "PRAGMA foreign_keys = ON;",
      `CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ai_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id INTEGER NOT NULL,
        result TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id)
      )`,
      `CREATE TABLE IF NOT EXISTS overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ai_result_id INTEGER NOT NULL,
        override TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ai_result_id) REFERENCES ai_results(id)
      )`,
      `CREATE TABLE IF NOT EXISTS pdf_exports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ai_result_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ai_result_id) REFERENCES ai_results(id)
      )`,
    ];

    await new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          for (const sql of createTables) {
            await runPromise(db, sql);
          }
          console.log("All tables and pragmas initialized successfully.");
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    return db;
  } catch (err) {
    console.error("Database initialization failed:", err.message);
    throw err; // Re-throw the error for the caller to handle
  }
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
