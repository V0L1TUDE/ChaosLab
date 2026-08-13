// ChaosLab — Express backend (Phase 3 + 4 + 5 + 6 + 7 + 8)
//
// This replaces the old zero-dependency static server. It still serves
// the public/ website exactly as before (same /ChaosLab base path, same
// clean URLs), but now also exposes real API endpoints under /api/* that
// the admin dashboard calls over the network with fetch() — instead of
// the dashboard's JavaScript just faking messages locally.
//
// /api/presentations reads/writes a real SQLite database (db/database.js).
// /api/auth/* is real (auth.js) — login checks a hashed password and hands
// back a session cookie; publishing requires that session. Uploaded files
// go through storage.js, which genuinely uses AWS S3 if credentials are
// configured in .env, or local disk under uploads/ if not — see that file
// for details. Either way, a presentation only becomes "published" once a
// real file is actually attached; without one it stays "draft".

// Load .env (ADMIN_USERNAME/ADMIN_PASSWORD, AWS_*) before anything that
// reads process.env at require-time, like db/database.js's seed step and
// storage.js's S3-vs-local-disk decision.
try {
  process.loadEnvFile(".env");
} catch (err) {
  if (err.code !== "ENOENT") throw err;
  // no .env file — db/database.js falls back to a default admin/admin,
  // and storage.js falls back to local disk
}

const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const storage = require("./storage");
const {
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
} = require("./db/database");
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

// ---- file upload setup (multer) ----
// memoryStorage: files arrive as buffers in memory, not auto-written to
// disk. We only write them ourselves after the database row exists, so a
// presentation and its files never end up out of sync with each other.
const ALLOWED_EXTENSIONS = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".zip", ".png", ".jpg", ".jpeg", ".gif"]);
const MIME_TYPES = {
  ".pdf": "application/pdf",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // 25MB/file, 10 files max
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error(`File type "${ext}" isn't allowed.`));
      return;
    }
    cb(null, true);
  },
});

// ---- API ----
const api = express.Router();

api.get("/health", (req, res) => {
  res.json({ status: "ok", backend: "express", time: new Date().toISOString() });
});

// Public archive: only published versions are visible without logging in.
api.get("/presentations", (req, res) => {
  res.json({ presentations: listPublishedPresentations() });
});

// The dashboard needs to see drafts too, so it deliberately uses a separate,
// protected endpoint rather than exposing draft metadata to every visitor.
api.get("/admin/presentations", requireAuth, (req, res) => {
  res.json({ presentations: listPresentations() });
});

// A permanent public metadata page calls this endpoint. Drafts stay private.
api.get("/presentations/:id", (req, res) => {
  const presentation = getPresentationById(req.params.id);
  if (!presentation || presentation.status !== "published") {
    res.status(404).json({ message: "Published presentation not found." });
    return;
  }
  res.json({ presentation, files: getFilesForPresentation(req.params.id) });
});

api.get("/presentations/:id/files", (req, res) => {
  const presentation = getPresentationById(req.params.id);
  if (!presentation || presentation.status !== "published") {
    res.status(404).json({ message: "Published presentation not found." });
    return;
  }
  const files = getFilesForPresentation(req.params.id);
  res.json({ files });
});

// Streams the first uploaded file back to the browser — this is what the
// dashboard's "View" link and the deployed site's file downloads use.
// Works identically whether storage.js is actually reading from S3 or
// local disk; this route doesn't know or care which.
async function downloadFile(req, res, file) {
  if (!file) {
    res.status(404).json({ message: "No file has been uploaded for this presentation." });
    return;
  }
  const ext = path.extname(file.original_name).toLowerCase();

  res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${file.original_name}"`);
  try {
    await storage.streamFile(req.params.id, file.stored_name, res);
  } catch (err) {
    if (!res.headersSent) res.status(404).json({ message: "File is missing from storage." });
  }
}

api.get("/presentations/:id/download", async (req, res) => {
  const presentation = getPresentationById(req.params.id);
  if (!presentation || presentation.status !== "published") {
    res.status(404).json({ message: "Published presentation not found." });
    return;
  }
  await downloadFile(req, res, getFilesForPresentation(req.params.id)[0]);
});

api.get("/presentations/:id/files/:fileId/download", async (req, res) => {
  const presentation = getPresentationById(req.params.id);
  if (!presentation || presentation.status !== "published") {
    res.status(404).json({ message: "Published presentation not found." });
    return;
  }
  await downloadFile(req, res, getFileForPresentation(req.params.id, req.params.fileId));
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

// Real database row AND, if files were attached, real files genuinely
// written to storage (S3 or local disk — see storage.js). Only becomes
// "published" (with a working download link) when at least one file came
// with the request — no file means it stays "draft", same honesty rule
// as before.
async function saveFilesAndPublish(presentation, files) {
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = crypto.randomBytes(16).toString("hex") + ext;
    await storage.saveFile(presentation.id, storedName, file.buffer);
    addFile(presentation.id, { storedName, originalName: file.originalname, size: file.size });
  }
  return markPresentationPublished(presentation.id, `/ChaosLab/presentation/?id=${presentation.id}`);
}

api.post("/presentations/publish", requireAuth, upload.array("files", 10), async (req, res) => {
  const { title, version, date, authors, summary } = req.body || {};

  if (!title || !version) {
    res.status(400).json({ implemented: true, message: "Title and version are required." });
    return;
  }

  let created;
  try {
    created = createPresentation({ title, version, date, authors, summary });
  } catch (err) {
    if (err.code === "DUPLICATE_VERSION") {
      res.status(409).json({ implemented: true, message: err.message });
      return;
    }
    throw err;
  }

  const files = req.files || [];
  if (files.length) {
    created = await saveFilesAndPublish(created, files);
  }

  res.status(201).json({
    implemented: true,
    message: files.length
      ? `Published with ${files.length} file(s) actually saved to ${storage.useS3 ? "AWS S3" : "disk"}.`
      : "Metadata saved to the database. No file was attached, so this stays a draft — attach a file to publish it for real.",
    presentation: created,
  });
});

// Phase 8: this creates a fresh, immutable version in the SAME family as
// the source record. It never updates the source record or its storage key,
// which is why a professor can still open v1 after v2 is published.
api.post("/presentations/:id/versions", requireAuth, upload.array("files", 10), async (req, res) => {
  const source = getPresentationById(req.params.id);
  if (!source) {
    res.status(404).json({ implemented: true, message: "The source presentation does not exist." });
    return;
  }

  const { version, date, authors, summary } = req.body || {};
  if (!version) {
    res.status(400).json({ implemented: true, message: "A new version label is required." });
    return;
  }

  const files = req.files || [];
  if (!files.length) {
    res.status(400).json({ implemented: true, message: "Attach at least one file before publishing a new version." });
    return;
  }

  let created;
  try {
    created = createPresentation({
      title: source.title,
      version,
      date,
      authors: authors || source.authors,
      summary,
      familyId: source.family_id,
    });
  } catch (err) {
    if (err.code === "DUPLICATE_VERSION") {
      res.status(409).json({ implemented: true, message: err.message });
      return;
    }
    throw err;
  }

  created = await saveFilesAndPublish(created, files);
  res.status(201).json({
    implemented: true,
    message: `Published ${created.title} ${created.version} as a new version. The source version remains unchanged.`,
    presentation: created,
  });
});

// Requires login. Deletes the database row, its files-table entries, and
// the actual files from storage (S3 or local disk) — a real, permanent
// delete, not a soft "hide it" flag.
api.delete("/presentations/:id", requireAuth, async (req, res) => {
  const presentation = getPresentationById(req.params.id);
  if (!presentation) {
    res.status(404).json({ implemented: true, message: "That presentation doesn't exist." });
    return;
  }

  deletePresentation(req.params.id);
  await storage.deleteAllFilesForPresentation(req.params.id);

  res.json({
    implemented: true,
    message: `Deleted "${presentation.title} ${presentation.version}" and any attached files.`,
  });
});

app.use("/api", api);

// Multer errors (file too big, bad type, etc.) land here instead of
// Express's default HTML error page.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes("isn't allowed")) {
    res.status(400).json({ implemented: true, message: err.message });
    return;
  }
  next(err);
});

// Anything else (S3 errors, bugs, etc.) — never leak a stack trace or file
// paths to the client. Full detail still goes to the server's own console.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ implemented: true, message: "Something went wrong on the server. Check the server console for details." });
});

// Anything else (bad routes, typos) falls back to the same 404 page.
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.listen(PORT, () => {
  console.log("");
  console.log("  ChaosLab backend running (Express)");
  console.log(`  Website:  http://localhost:${PORT}${BASE_PATH}/`);
  console.log(`  API:      http://localhost:${PORT}/api/health`);
  console.log(
    storage.useS3
      ? `  Storage:  \x1b[36mAWS S3\x1b[0m (bucket: ${process.env.AWS_S3_BUCKET})`
      : `  Storage:  local disk (uploads/) — set AWS_* in .env to switch to S3`
  );
  console.log("");
});
