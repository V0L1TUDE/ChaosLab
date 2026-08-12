// ChaosLab — SQLite database (Phase 4)
//
// Uses node:sqlite, which ships built into Node.js itself — no npm
// package to install, no native compilation to worry about. It's the
// real thing: a single file on disk (chaoslab.db, gitignored — a
// database file is generated data, not source code) that persists
// across server restarts, unlike the old in-memory array it replaces.
//
// This file owns all the SQL. Nothing else in the app writes queries
// directly — server.js calls the functions exported below.

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "chaoslab.db");
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS presentations (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    title    TEXT NOT NULL,
    version  TEXT NOT NULL,
    date     TEXT,
    authors  TEXT,
    summary  TEXT,
    status   TEXT NOT NULL DEFAULT 'draft', -- 'published' | 'draft' | 'not_published'
    url      TEXT
  )
`);

// Seed once, so a fresh chaoslab.db starts with the same two rows the
// old hardcoded array had, instead of an empty table.
const { count } = db.prepare("SELECT COUNT(*) AS count FROM presentations").get();
if (count === 0) {
  const seed = db.prepare(
    "INSERT INTO presentations (title, version, date, authors, status, url) VALUES (?, ?, ?, ?, ?, ?)"
  );
  seed.run("Planning Presentation", "v1", "2026-08-10", "ChaosLab Team", "published", "/ChaosLab/presentations/planning-v1/");
  seed.run("Planning Presentation", "v2", null, "ChaosLab Team", "not_published", null);
}

function listPresentations() {
  return db.prepare("SELECT * FROM presentations ORDER BY id").all();
}

// Saves real metadata to a real database row. It does NOT store any
// actual files — that's file storage (Phase 6) and object storage
// (Phase 7), neither of which exist yet — so every row created here
// is a 'draft': real data, but no page/file behind it.
function createPresentation({ title, version, date, authors, summary }) {
  const result = db
    .prepare(
      "INSERT INTO presentations (title, version, date, authors, summary, status, url) VALUES (?, ?, ?, ?, ?, 'draft', NULL)"
    )
    .run(title, version, date || null, authors || null, summary || null);
  return db.prepare("SELECT * FROM presentations WHERE id = ?").get(result.lastInsertRowid);
}

module.exports = { listPresentations, createPresentation };
