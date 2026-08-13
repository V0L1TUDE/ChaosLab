// ChaosLab — SQLite database (Phase 4 + 5 + 6)
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
const { hashPassword } = require("../auth");

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
    "INSERT INTO presentations (title, version, date, authors, status, url) VALUES (?, ?, ?, ?, ?, ?)"
  );
  seed.run("Planning Presentation", "v1", "2026-08-10", "ChaosLab Team", "published", "/ChaosLab/presentations/planning-v1/");
  seed.run("Planning Presentation", "v2", null, "ChaosLab Team", "not_published", null);
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
  return db.prepare("SELECT * FROM presentations ORDER BY id").all();
}

// Saves real metadata to a real database row. Starts as 'draft' — becomes
// 'published' only once a real file is actually attached (see
// markPresentationPublished below), which happens right after this in
// server.js if the request included any files.
function createPresentation({ title, version, date, authors, summary }) {
  const result = db
    .prepare(
      "INSERT INTO presentations (title, version, date, authors, summary, status, url) VALUES (?, ?, ?, ?, ?, 'draft', NULL)"
    )
    .run(title, version, date || null, authors || null, summary || null);
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

// Real file(s) now exist on disk for this presentation, so it's genuinely
// publishable — flips status and points url at the download endpoint.
function markPresentationPublished(presentationId, url) {
  db.prepare("UPDATE presentations SET status = 'published', url = ? WHERE id = ?").run(url, presentationId);
  return db.prepare("SELECT * FROM presentations WHERE id = ?").get(presentationId);
}

function getPresentationById(presentationId) {
  return db.prepare("SELECT * FROM presentations WHERE id = ?").get(presentationId);
}

function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

module.exports = {
  listPresentations,
  createPresentation,
  getUserByUsername,
  addFile,
  getFilesForPresentation,
  markPresentationPublished,
  getPresentationById,
};
