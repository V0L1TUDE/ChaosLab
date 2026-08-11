// ChaosLab — local static site server
//
// Zero dependencies on purpose: at this stage the project is a static
// website (HTML/CSS/JS). This server mimics how GitHub Pages (and most
// static hosts) resolve "clean" URLs: a request for /project serves
// public/project/index.html, a request for / serves public/index.html,
// and unmatched paths fall back to 404.html. Because /public is laid
// out that way on disk, this file needs no route table to maintain —
// deploying to GitHub Pages later means pointing it at /public as-is.
//
// Every href/src in the site is hardcoded with a "/ChaosLab" base path
// (see .github/workflows/deploy-pages.yml) because GitHub Pages serves
// this repo at https://<user>.github.io/ChaosLab/, not at domain root.
// This server mirrors that same base path locally so links behave
// identically in dev and in production — visit http://localhost:3000/ChaosLab/
// (a bare "/" is redirected there automatically).
//
// When the Node/Express backend is introduced later (Phase 3), this
// file is what gets replaced/extended with real API routes — the
// /public folder itself does not need to change.

const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");
const BASE_PATH = "/ChaosLab";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function send404(res) {
  fs.readFile(path.join(ROOT, "404.html"), (err, data) => {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(err ? "404 Not Found" : data);
  });
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send404(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const rawPath = decodeURIComponent(req.url.split("?")[0]);

  // Keep local dev under the same /ChaosLab base path the site's own
  // links use, so a bare "/" (or any link missing the prefix) still works.
  if (rawPath !== BASE_PATH && !rawPath.startsWith(BASE_PATH + "/")) {
    res.writeHead(302, { Location: BASE_PATH + (rawPath.startsWith("/") ? rawPath : "/" + rawPath) });
    res.end();
    return;
  }

  const urlPath = rawPath.slice(BASE_PATH.length) || "/";
  const cleanPath = urlPath.length > 1 ? urlPath.replace(/\/+$/, "") : urlPath;
  const requestedPath = path.join(ROOT, cleanPath);

  // Guard against path traversal outside /public
  if (!requestedPath.startsWith(ROOT)) {
    send404(res);
    return;
  }

  fs.stat(requestedPath, (err, stats) => {
    if (!err && stats.isFile()) {
      // exact static asset (css/js/img) or a *.html file requested directly
      serveFile(res, requestedPath);
      return;
    }
    if (!err && stats.isDirectory()) {
      // clean route, e.g. /project -> /project/index.html
      serveFile(res, path.join(requestedPath, "index.html"));
      return;
    }
    // no extension and no matching directory -> try path/index.html anyway
    if (!path.extname(cleanPath)) {
      const asIndex = path.join(requestedPath, "index.html");
      fs.stat(asIndex, (err2, stats2) => {
        if (!err2 && stats2.isFile()) {
          serveFile(res, asIndex);
        } else {
          send404(res);
        }
      });
      return;
    }
    send404(res);
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("  ChaosLab dev server running");
  console.log(`  \x1b[36mhttp://localhost:${PORT}${BASE_PATH}/\x1b[0m`);
  console.log("");
});
