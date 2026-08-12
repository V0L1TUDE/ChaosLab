# ChaosLab — Project Website

Declarative Recovery-Correctness Analysis for Distributed Microservices.

## Run it locally

```bash
npm install
node server.js
```

Then open **http://localhost:3000** — it redirects to `http://localhost:3000/ChaosLab/`
(see [Why the /ChaosLab prefix](#why-the-chaoslab-prefix) below).

## Routes

| URL | Page |
|---|---|
| `/ChaosLab/` | Homepage |
| `/ChaosLab/project/` | Problem statement, objectives, scope, functions |
| `/ChaosLab/architecture/` | System architecture diagram + component breakdown |
| `/ChaosLab/presentations/` | Presentation archive |
| `/ChaosLab/presentations/planning-v1/` | Planning Presentation v1 (website-based slide deck) |
| `/ChaosLab/admin/login/` | Admin login UI (calls the real API, honestly replies "not implemented") |
| `/ChaosLab/admin/dashboard/` | Admin dashboard UI (same — real API calls, honest responses) |

| API endpoint | What it does |
|---|---|
| `GET /api/health` | Simple server health check |
| `GET /api/presentations` | Real data — reads `data/presentations.js` (in-memory, not a database yet) |
| `POST /api/auth/login` | Honestly replies 501 — no auth system yet (Phase 5) |
| `POST /api/presentations/publish` | Honestly replies 501 — no database/storage yet (Phases 4 & 7) |

## Project structure

```
ChaosLab/
├── server.js               Express app: serves public/ + the /api/* routes
├── package.json
├── data/
│   └── presentations.js    In-memory stand-in for a database (Phase 4 replaces this)
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
- ⬜ Database (Phase 4) — `data/presentations.js` is a placeholder in-memory array
- ⬜ Authentication (Phase 5)
- ⬜ Real file/folder upload (Phase 6)
- ⬜ Object storage (Phase 7)
- ⬜ Publishing/version control (Phase 8)
- ⬜ Backend deployment (Phase 9) — GitHub Pages is static-only and can't run
  Express; the backend needs separate hosting once it does more than stub responses

The admin login/dashboard screens now make **real** `fetch()` calls to the
Express API. Nothing is faked client-side anymore — but the server itself is
still honest that login and publishing aren't implemented (HTTP 501 with an
explanation), because there's no database or auth system behind them yet.
