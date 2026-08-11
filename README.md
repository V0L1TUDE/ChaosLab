# ChaosLab — Project Website

Declarative Recovery-Correctness Analysis for Distributed Microservices.
This repo currently contains **Phase 1**: the public-facing project website.

## Run it locally

```bash
node server.js
```

Then open **http://localhost:3000**

No `npm install` is required — the server has zero dependencies.

## Routes

| URL | Page |
|---|---|
| `/` | Homepage |
| `/project` | Problem statement, objectives, scope, functions |
| `/architecture` | System architecture diagram + component breakdown |
| `/presentations` | Presentation archive |
| `/presentations/planning-v1` | Planning Presentation v1 (website-based slide deck) |
| `/admin/login` | Admin login UI (not connected to a backend yet) |
| `/admin/dashboard` | Admin dashboard UI (not connected to a backend yet) |

## Project structure

Every route is a folder containing an `index.html` (e.g. `/project` →
`public/project/index.html`). This is the standard "pretty URL" layout
static hosts like GitHub Pages resolve natively, so the same `public/`
folder works unchanged whether you run it locally via `server.js` or
deploy it as a static site.

```
ChaosLab/
├── server.js              Zero-dependency Node static server (mirrors GitHub Pages routing)
├── package.json
├── .github/workflows/
│   └── deploy-pages.yml   Publishes public/ to GitHub Pages on push to main
└── public/
    ├── css/
    │   ├── style.css         Shared design system (colors, layout, components)
    │   └── presentation.css  Slide-deck-specific styling
    ├── js/
    │   ├── main.js            Nav toggle + scroll-reveal animation
    │   ├── presentation.js    Slide deck navigation/overview/fullscreen
    │   └── admin.js           Admin UI interactions (no backend calls yet)
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

## Deploying to GitHub Pages

This repo isn't pushed to GitHub yet. From the `ChaosLab` folder:

```bash
git init
git add .
git commit -m "ChaosLab project website"
gh repo create ChaosLab --public --source=. --remote=origin --push
```

(No `gh` CLI? Create an empty repo named `ChaosLab` on github.com instead, then:
`git remote add origin https://github.com/<you>/ChaosLab.git && git branch -M main && git push -u origin main`)

Then, one-time, in the GitHub repo: **Settings → Pages → Source → GitHub
Actions**. The included workflow (`.github/workflows/deploy-pages.yml`)
publishes `public/` automatically on every push to `main`, at
`https://<you>.github.io/ChaosLab/`.

## Status

- ✅ Public website (Phase 1) — done
- ✅ Planning Presentation v1 content (Phase 2) — done
- ⬜ Node.js/Express backend (Phase 3)
- ⬜ Database (Phase 4)
- ⬜ Authentication (Phase 5)
- ⬜ Real file/folder upload (Phase 6)
- ⬜ Object storage (Phase 7)
- ⬜ Publishing/version control (Phase 8)
- ⬜ Deployment (Phase 9)

The admin login/dashboard screens are real, working **UI** — but they do not
call a server. No login, upload, or publish action is faked; each shows an
explicit "not implemented yet" message instead.
