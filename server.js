// ChaosLab — Express backend (Phase 3)
//
// This replaces the old zero-dependency static server. It still serves
// the public/ website exactly as before (same /ChaosLab base path, same
// clean URLs), but now also exposes real API endpoints under /api/* that
// the admin dashboard calls over the network with fetch() — instead of
// the dashboard's JavaScript just faking messages locally.
//
// No database yet (Phase 4) and no real authentication yet (Phase 5), so
// endpoints that depend on those honestly reply "not implemented" rather
// than pretending to succeed.

const express = require("express");
const path = require("path");
const { presentations } = require("./data/presentations");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const BASE_PATH = "/ChaosLab";

app.use(express.json());

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

// Real endpoint, real data — just not a database yet.
api.get("/presentations", (req, res) => {
  res.json({ presentations });
});

api.post("/auth/login", (req, res) => {
  res.status(501).json({
    implemented: false,
    message: "Authentication is not implemented yet (Phase 5). No login was performed.",
  });
});

api.post("/presentations/publish", (req, res) => {
  res.status(501).json({
    implemented: false,
    message:
      "Publishing is not implemented yet — it needs a database (Phase 4) and file storage (Phase 6/7). Nothing was saved.",
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
