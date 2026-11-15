// shared/db.js
//
// One SQLite file, shared by identity-service and game-service.
// Why a shared file instead of a dedicated persistence-service: at this
// project's scale a whole extra network hop to read/write one SQLite file
// buys nothing. The boundary that actually matters for low coupling is kept:
// each service only ever touches the TABLES it owns.
//   identity-service owns: users, owned_powerups
//   game-service      owns: dive_logs, leaderboard
// Neither service reaches into a table it doesn't own — that's the real
// interface, even though the storage happens to be one file.

// v2.1: Node's BUILT-IN SQLite (node:sqlite, Node 22.5+) instead of the
// better-sqlite3 package. better-sqlite3 is native C++ and must be compiled
// on install when no prebuilt binary matches your Node version, which on
// Windows needs Visual Studio. The built-in one needs nothing installed.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// timeout: wait up to 5 s for another service's write instead of failing.
const db = new DatabaseSync(path.join(DATA_DIR, 'deepdive.sqlite'), { timeout: 5000 });

// better-sqlite3 had db.transaction(fn); node:sqlite doesn't, so we add the
// same shape: everything inside fn commits together or not at all.
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(...args);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

// v2 fix: when two services start at the same moment on a brand-new
// database file, both try to set it up at once and one gets
// "database is locked" and crashes. So setup steps retry for a few
// seconds instead of failing on the first collision.
function withRetry(step) {
  for (let attempt = 0; ; attempt++) {
    try {
      return step();
    } catch (err) {
      const busy = err.code === 'SQLITE_BUSY' || err.errcode === 5 || /database is locked/i.test(err.message);
      if (!busy || attempt >= 50) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); // sleep 100 ms
    }
  }
}

withRetry(() => db.exec('PRAGMA journal_mode = WAL'));

withRetry(() => db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    is_guest INTEGER NOT NULL DEFAULT 0,
    treasure INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS owned_powerups (
    user_id TEXT NOT NULL,
    powerup_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, powerup_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS dive_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    depth INTEGER NOT NULL,
    score INTEGER NOT NULL,
    chests INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    best_score INTEGER NOT NULL,
    best_depth INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`));

// --- v2 migration ---------------------------------------------------------
// `CREATE TABLE IF NOT EXISTS` never changes a table that already exists,
// so a database made by the v1 code would be missing the new columns.
// This adds each one only if it isn't there yet — safe to run every start.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (columns.includes(column)) return;
  try {
    withRetry(() => db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`));
  } catch (err) {
    // The other service added it a split second before us — that's fine.
    if (!/duplicate column/i.test(err.message)) throw err;
  }
}
ensureColumn('dive_logs', 'coins', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('dive_logs', 'zone', "TEXT NOT NULL DEFAULT 'sunlight'");
ensureColumn('dive_logs', 'site', 'TEXT');

module.exports = db;
