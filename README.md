# ChaosLab — Project Website

Declarative Recovery-Correctness Analysis for Distributed Microservices.

## Run it locally

```bash
npm install
cp .env.example .env   # then edit .env with your own admin username/password
node server.js
```

Then open **http://localhost:3000** — it redirects to `http://localhost:3000/ChaosLab/`
(see [Why the /ChaosLab prefix](#why-the-chaoslab-prefix) below).

`.env` is gitignored and only read the *first* time the app starts with an
empty database — it seeds the one admin account. If you skip this step, it
falls back to `admin` / `admin` with a warning printed to the console.

## Routes

| URL | Page |
|---|---|
| `/ChaosLab/` | Homepage |
| `/ChaosLab/project/` | Problem statement, objectives, scope, functions |
| `/ChaosLab/architecture/` | System architecture diagram + component breakdown |
| `/ChaosLab/presentations/` | Presentation archive |
| `/ChaosLab/presentations/planning-v1/` | Planning Presentation v1 (website-based slide deck) |
| `/ChaosLab/admin/login/` | Real login — wrong credentials rejected, correct ones redirect to the dashboard |
| `/ChaosLab/admin/dashboard/` | Redirects you back to login if you're not actually logged in (checks `/api/auth/me`) |

| API endpoint | What it does |
|---|---|
| `GET /api/health` | Simple server health check |
| `GET /api/presentations` | Real data from a real SQLite database (`chaoslab.db`) |
| `POST /api/auth/login` | Checks a salted+hashed password, sets a real session cookie |
| `POST /api/auth/logout` | Destroys the session, clears the cookie |
| `GET /api/auth/me` | Tells the frontend whether the current cookie is a valid session |
| `POST /api/presentations/publish` | **Requires login.** Accepts real files (multipart/form-data, via multer) and writes them to `uploads/`. With a file → row becomes `published`. Without one → stays `draft` (metadata only) |
| `GET /api/presentations/:id/files` | Lists the files attached to a presentation |
| `GET /api/presentations/:id/download` | Streams the first attached file back, with its real filename and content type |
| `DELETE /api/presentations/:id` | **Requires login.** Permanently deletes the database row, its file records, and the actual files on disk |

## Project structure

```
ChaosLab/
├── server.js               Express app: serves public/ + the /api/* routes
├── auth.js                  Password hashing + sessions (node:crypto — built into Node)
├── package.json
├── .env.example              Template for the one admin account's credentials
├── db/
│   └── database.js         SQLite schema (presentations + users + files), seed data, query functions
├── chaoslab.db              The actual database file (gitignored — generated, not source code)
├── uploads/                  Real uploaded files, one folder per presentation ID (gitignored)
├── .github/workflows/
│   └── deploy-pages.yml    Publishes public/ to GitHub Pages on push to main
└── public/
    ├── css/
    │   ├── style.css         Shared design system (colors, layout, components)
    │   └── presentation.css  Slide-deck-specific styling
    ├── js/
    │   ├── main.js            Nav toggle + scroll-reveal animation
    │   ├── presentation.js    Slide deck navigation/overview/fullscreen
    │   └── admin.js           Admin UI — calls the real /api/* endpoints
    ├── index.html             Homepage (/)
    ├── project/index.html
    ├── architecture/index.html
    ├── presentations/
    │   ├── index.html
    │   └── planning-v1/index.html
    ├── admin/
    │   ├── login/index.html
    │   └── dashboard/index.html
    ├── .nojekyll              Tells GitHub Pages not to run Jekyll processing
    └── 404.html
```

Every page route is a folder containing an `index.html` (e.g. `/project` →
`public/project/index.html`) — the standard "pretty URL" layout static
hosts resolve natively.

## Why the /ChaosLab prefix

This site is deployed on **GitHub Pages** at `https://<user>.github.io/ChaosLab/`
— a *subpath*, not the domain root. Every link and asset in the site is written
with that `/ChaosLab` prefix baked in, and `server.js` mirrors the same prefix
locally (redirecting a bare `/` to `/ChaosLab/`) so links behave identically in
dev and in production.

**This only affects the static site** (`public/`), which GitHub Pages serves
directly and doesn't run any of our backend code. The `/api/*` routes only
exist locally right now (see Status below) — they don't use the `/ChaosLab`
prefix since it's a static-hosting detail, not a backend one.

## Deployed site

Live at: `https://<your-github-username>.github.io/ChaosLab/`
(pushes to `main` redeploy it automatically via `.github/workflows/deploy-pages.yml`)

## Status

- ✅ Public website (Phase 1) — done, deployed to GitHub Pages
- ✅ Planning Presentation v1 content (Phase 2) — done
- ✅ Node.js/Express backend (Phase 3) — done, runs locally (`node server.js`)
- ✅ Database (Phase 4) — real SQLite (`chaoslab.db`, via `node:sqlite`, no extra dependency).
  Publishing writes a real `draft` row; only file storage (Phases 6/7) is still missing
- ✅ Authentication (Phase 5) — real login: scrypt-hashed passwords, session
  cookies, `/api/presentations/publish` requires being logged in, the
  dashboard redirects you out if your session isn't valid
- ✅ Real file/folder upload (Phase 6) — real files, written to local disk
  (`uploads/`) via multer. A presentation becomes genuinely `published`
  (with a working download link) once a file is attached; without one it
  stays `draft`. 25MB/file limit, 10 files max, restricted to
  pdf/ppt/pptx/doc/docx/zip/image types
- ⬜ Object storage (Phase 7) — files currently live on local disk, not
  S3/R2/etc. (see the README section on that decision below)
- ⬜ Publishing/version control (Phase 8) — no "replace an existing version"
  yet; every publish creates a new row
- ⬜ Backend deployment (Phase 9) — GitHub Pages is static-only and can't run
  Express; the backend needs separate hosting once it does more than stub responses

The admin login/dashboard screens now make **real** `fetch()` calls to the
Express API, with real login and real file uploads behind them. Nothing is
faked client-side or server-side anymore for what's actually implemented:
wrong passwords are rejected, sessions are real cookies, publishing is
gated behind being logged in, and attached files are genuinely written to
disk and downloadable afterward. The only remaining "honest gap" is that
files live on local disk instead of cloud object storage, and there's no
version-replace/rollback workflow yet.

**Note on session storage:** sessions live in server memory (a `Map`), not
the database — restarting the server logs everyone out. That's a normal,
accepted tradeoff for a project this size; it's not a bug.

**Note on local disk vs. cloud storage (Phase 6 vs. 7):** uploaded files
are saved under `uploads/`, not to AWS S3 or similar. This was a deliberate
choice — local disk needs zero setup or cloud account, and it's genuinely
enough to make uploads/downloads fully functional for development. The
tradeoff: if the backend is ever deployed to a host with an ephemeral
filesystem, uploaded files would be lost on restart/redeploy. Phase 7 is
specifically about swapping this for real object storage (Cloudflare R2 or
Backblaze B2 recommended over AWS S3 for an easier free tier) once that
becomes a real constraint.
