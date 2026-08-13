// ChaosLab — Express backend (Phase 3 + 4 + 5)
//
// This replaces the old zero-dependency static server. It still serves
// the public/ website exactly as before (same /ChaosLab base path, same
// clean URLs), but now also exposes real API endpoints under /api/* that
// the admin dashboard calls over the network with fetch() — instead of
// the dashboard's JavaScript just faking messages locally.
//
// /api/presentations reads/writes a real SQLite database (db/database.js).
// /api/auth/* is now real too (auth.js) — login checks a hashed password
// and hands back a session cookie; publishing requires that session.
// No real file storage yet (Phases 6/7), so publish still only saves
// metadata, not actual files.

// Load .env (ADMIN_USERNAME/ADMIN_PASSWORD) before anything that reads
// process.env at require-time, like db/database.js's seed step.
try {
  process.loadEnvFile(".env");
} catch (err) {
  if (err.code !== "ENOENT") throw err;
  // no .env file — db/database.js falls back to a default admin/admin
}

const express = require("express");
const path = require("path");
const { listPresentations, createPresentation, getUserByUsername } = require("./db/database");
const {
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  SESSION_COOKIE,
} = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const BASE_PATH = "/ChaosLab";

app.use(express.json());
app.use((req, res, next) => {
  req.cookies = parseCookies(req);
  next();
});

// Send requests through the same /ChaosLab prefix GitHub Pages will use
// in production (see README), so links behave identically in dev and live.
// API requests are left alone — the base path is a static-hosting detail,
// not something the backend itself needs.
app.use((req, res, next) => {
  if (req.path === BASE_PATH || req.path.startsWith(BASE_PATH + "/") || req.path.startsWith("/api/")) {
    return next();
  }
  res.redirect(302, BASE_PATH + req.originalUrl);
});

// The website itself — unchanged from Phase 1/2.
app.use(BASE_PATH, express.static(PUBLIC_DIR));

// ---- API ----
const api = express.Router();

api.get("/health", (req, res) => {
  res.json({ status: "ok", backend: "express", time: new Date().toISOString() });
});

// Real endpoint, backed by a real SQLite database now.
api.get("/presentations", (req, res) => {
  res.json({ presentations: listPresentations() });
});

api.post("/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ implemented: true, message: "Username and password are required." });
    return;
  }

  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ implemented: true, message: "Invalid username or password." });
    return;
  }

  const token = createSession(user);
  setSessionCookie(res, token);
  res.json({ implemented: true, message: `Welcome back, ${user.username}.`, user: { username: user.username } });
});

api.post("/auth/logout", (req, res) => {
  destroySession(req.cookies[SESSION_COOKIE]);
  clearSessionCookie(res);
  res.json({ implemented: true, message: "Logged out." });
});

// Lets the frontend ask "is anyone logged in right now?" — used by the
// admin dashboard to decide whether to redirect to the login page.
api.get("/auth/me", (req, res) => {
  const session = getSession(req.cookies[SESSION_COOKIE]);
  if (!session) {
    res.status(401).json({ loggedIn: false });
    return;
  }
  res.json({ loggedIn: true, username: session.username });
});

// This genuinely writes a row to chaoslab.db — it's just honest that no
// actual file bytes are stored anywhere yet (that's Phases 6/7), so the
// new row has no page behind it and is marked "draft", not "published".
// requireAuth means you now have to actually be logged in to reach this.
api.post("/presentations/publish", requireAuth, (req, res) => {
  const { title, version, date, authors, summary } = req.body || {};

  if (!title || !version) {
    res.status(400).json({ implemented: true, message: "Title and version are required." });
    return;
  }

  const created = createPresentation({ title, version, date, authors, summary });
  res.status(201).json({
    implemented: true,
    message:
      "Metadata saved to the database. No actual file was stored — file/object storage isn't implemented yet (Phase 6/7) — so this entry has no page to view.",
    presentation: created,
  });
});

app.use("/api", api);

// Anything else (bad routes, typos) falls back to the same 404 page.
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.listen(PORT, () => {
  console.log("");
  console.log("  ChaosLab backend running (Express)");
  console.log(`  Website:  http://localhost:${PORT}${BASE_PATH}/`);
  console.log(`  API:      http://localhost:${PORT}/api/health`);
  console.log("");
});
