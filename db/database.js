// ChaosLab — SQLite database (Phase 4 + 5 + 6 + 8)
//
// Uses node:sqlite, which ships built into Node.js itself — no npm
// package to install, no native compilation to worry about. It's the
// real thing: a single file on disk (chaoslab.db, gitignored — a
// database file is generated data, not source code) that persists
// across server restarts, unlike the old in-memory array it replaces.
//
// This file owns all the SQL. Nothing else in the app writes queries
// directly — server.js and auth.js call the functions exported below.

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const crypto = require("crypto");
const { hashPassword } = require("../auth");

// The override is used only by automated/local tests, so tests never touch
// the student's real chaoslab.db.
const DB_PATH = process.env.CHAOSLAB_DB_PATH || path.join(__dirname, "..", "chaoslab.db");
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

// Phase 8 migration. Existing student-project databases already have the
// presentations table, so add the new columns one at a time rather than
// asking anyone to delete their database and lose their previous versions.
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((existing) => existing.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("presentations", "family_id", "TEXT");
addColumnIfMissing("presentations", "created_at", "TEXT");
addColumnIfMissing("presentations", "published_at", "TEXT");

// Legacy rows become a family based on their title. New rows receive a UUID.
// This preserves the existing Planning Presentation v1/v2 relationship while
// making every newly created family unambiguous, even if titles are reused.
db.prepare("UPDATE presentations SET family_id = lower(trim(title)) WHERE family_id IS NULL OR family_id = ''").run();
db.prepare("UPDATE presentations SET created_at = datetime('now') WHERE created_at IS NULL").run();
db.prepare("UPDATE presentations SET published_at = datetime('now') WHERE status = 'published' AND published_at IS NULL").run();
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS presentation_family_version_unique ON presentations(family_id, version)");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    presentation_id  INTEGER NOT NULL REFERENCES presentations(id),
    stored_name      TEXT NOT NULL, -- random name on disk (uploads/<presentation_id>/<stored_name>)
    original_name    TEXT NOT NULL, -- what the uploader actually called it
    size             INTEGER NOT NULL,
    uploaded_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Seed once, so a fresh chaoslab.db starts with the same two rows the
// old hardcoded array had, instead of an empty table.
const { count } = db.prepare("SELECT COUNT(*) AS count FROM presentations").get();
if (count === 0) {
  const seed = db.prepare(
    "INSERT INTO presentations (family_id, title, version, date, authors, status, url, created_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)"
  );
  seed.run(
    "planning-presentation",
    "Planning Presentation",
    "v1",
    "2026-08-10",
    "ChaosLab Team",
    "published",
    "/ChaosLab/presentations/planning-v1/",
    new Date().toISOString()
  );
  seed.run("planning-presentation", "Planning Presentation", "v2", null, "ChaosLab Team", "not_published", null, null);
}

// Seed exactly one admin user, read from .env (see .env.example). Only
// runs once — if ADMIN_USERNAME/ADMIN_PASSWORD change later, they won't
// retroactively update an already-created user unless chaoslab.db is
// deleted and reseeded from scratch.
const { userCount } = db.prepare("SELECT COUNT(*) AS userCount FROM users").get();
if (userCount === 0) {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin";
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.warn(
      `  \x1b[33m⚠ ADMIN_USERNAME/ADMIN_PASSWORD not set in .env — seeding default admin/admin. Copy .env.example to .env and change this.\x1b[0m`
    );
  }
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hashPassword(password));
}

function listPresentations() {
  return db.prepare("SELECT * FROM presentations ORDER BY title COLLATE NOCASE, id").all();
}

function listPublishedPresentations() {
  return db
    .prepare("SELECT * FROM presentations WHERE status = 'published' ORDER BY title COLLATE NOCASE, id")
    .all();
}

// Saves real metadata to a real database row. Starts as 'draft' — becomes
// 'published' only once a real file is actually attached (see
// markPresentationPublished below), which happens right after this in
// server.js if the request included any files.
function createPresentation({ title, version, date, authors, summary, familyId }) {
  const normalizedTitle = title.trim();
  const normalizedVersion = version.trim();
  const resolvedFamilyId = familyId || crypto.randomUUID();
  const existing = db
    .prepare("SELECT id FROM presentations WHERE family_id = ? AND version = ?")
    .get(resolvedFamilyId, normalizedVersion);

  if (existing) {
    const error = new Error("That version already exists in this presentation family.");
    error.code = "DUPLICATE_VERSION";
    throw error;
  }

  const result = db
    .prepare(
      "INSERT INTO presentations (family_id, title, version, date, authors, summary, status, url, created_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, datetime('now'))"
    )
    .run(resolvedFamilyId, normalizedTitle, normalizedVersion, date || null, authors || null, summary || null);
  return db.prepare("SELECT * FROM presentations WHERE id = ?").get(result.lastInsertRowid);
}

// Called once per uploaded file, after its bytes are already written to
// disk (see server.js) — this just records that the file exists.
function addFile(presentationId, { storedName, originalName, size }) {
  db.prepare(
    "INSERT INTO files (presentation_id, stored_name, original_name, size) VALUES (?, ?, ?, ?)"
  ).run(presentationId, storedName, originalName, size);
}

function getFilesForPresentation(presentationId) {
  return db.prepare("SELECT * FROM files WHERE presentation_id = ? ORDER BY id").all(presentationId);
}

function getFileForPresentation(presentationId, fileId) {
  return db.prepare("SELECT * FROM files WHERE presentation_id = ? AND id = ?").get(presentationId, fileId);
}

// Real file(s) now exist on disk for this presentation, so it's genuinely
// publishable — flips status and points url at the download endpoint.
function markPresentationPublished(presentationId, url) {
  db.prepare("UPDATE presentations SET status = 'published', url = ?, published_at = datetime('now') WHERE id = ?").run(
    url,
    presentationId
  );
  return db.prepare("SELECT * FROM presentations WHERE id = ?").get(presentationId);
}

function getPresentationById(presentationId) {
  return db.prepare("SELECT * FROM presentations WHERE id = ?").get(presentationId);
}

// Deletes the database rows only — server.js is responsible for deleting
// the actual files on disk (this module doesn't touch the filesystem).
function deletePresentation(presentationId) {
  db.prepare("DELETE FROM files WHERE presentation_id = ?").run(presentationId);
  db.prepare("DELETE FROM presentations WHERE id = ?").run(presentationId);
}

function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

module.exports = {
  listPresentations,
  listPublishedPresentations,
  createPresentation,
  getUserByUsername,
  addFile,
  getFilesForPresentation,
  getFileForPresentation,
  markPresentationPublished,
  getPresentationById,
  deletePresentation,
};
