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

The `AWS_*` variables in `.env.example` are optional — leave them blank and
uploads go to local disk (`uploads/`). Fill them in with real AWS
credentials to switch to a real S3 bucket instead; see
[Setting up AWS S3](#setting-up-aws-s3) below. The server prints which
mode it's actually running in on startup.

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
├── storage.js                File storage: real AWS S3 if configured, local disk otherwise
├── package.json
├── .env.example              Template for admin credentials + optional AWS credentials
├── db/
│   └── database.js         SQLite schema (presentations + users + files), seed data, query functions
├── chaoslab.db              The actual database file (gitignored — generated, not source code)
├── uploads/                  Real uploaded files if running in local-disk mode (gitignored)
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

### Phase 8 update: publishing and version preservation (complete)

The Phase 8 version workflow now creates a **new immutable record** instead
of replacing an older presentation. Each version has its own presentation ID,
storage location, files, publication timestamp, and permanent public page.
The protected endpoint is:

| API endpoint | What it does |
|---|---|
| `POST /api/presentations/:id/versions` | Creates and publishes a new version in the same presentation family. Requires login and at least one attached file. It returns `409` if that version label already exists in the family. |

The public archive calls `GET /api/presentations` and lists **only published**
versions. The dashboard calls the protected `GET /api/admin/presentations`
endpoint so it can also manage drafts. New uploaded versions use the generic
permanent page at `/ChaosLab/presentation/?id=<version-id>`; the original
Planning Presentation v1 web deck keeps its existing permanent URL.

The earlier Phase 8 placeholder in the historical checklist below is
superseded by this section.

- ✅ Public website (Phase 1) — done, deployed to GitHub Pages
- ✅ Planning Presentation v1 content (Phase 2) — done
- ✅ Node.js/Express backend (Phase 3) — done, runs locally (`node server.js`)
- ✅ Database (Phase 4) — real SQLite (`chaoslab.db`, via `node:sqlite`, no extra dependency)
- ✅ Authentication (Phase 5) — real login: scrypt-hashed passwords, session
  cookies, `/api/presentations/publish` requires being logged in, the
  dashboard redirects you out if your session isn't valid
- ✅ Real file/folder upload (Phase 6) — real files via multer. A
  presentation becomes genuinely `published` (with a working download
  link) once a file is attached; without one it stays `draft`. 25MB/file
  limit, 10 files max, restricted to pdf/ppt/pptx/doc/docx/zip/image types
- ✅ Object storage (Phase 7) — `storage.js` genuinely uploads to a real
  AWS S3 bucket when `AWS_*` credentials are set in `.env`; with no
  credentials set, it falls back to local disk (`uploads/`) with identical
  behavior. Verified end-to-end against a real bucket: upload, download,
  and delete all confirmed working (including IAM least-privilege
  permissions — the app's IAM user can only touch its one bucket)
- ⬜ Publishing/version control (Phase 8) — no "replace an existing version"
  yet; every publish creates a new row
- ⬜ Backend deployment (Phase 9) — GitHub Pages is static-only and can't run
  Express; the backend needs separate hosting once it does more than stub responses

The admin login/dashboard screens now make **real** `fetch()` calls to the
Express API, with real login and real file uploads (to S3 or disk) behind
them. Nothing is faked client-side or server-side anymore for what's
actually implemented: wrong passwords are rejected, sessions are real
cookies, publishing is gated behind being logged in, and attached files are
genuinely stored and downloadable afterward. The only remaining "honest
gap" is that there's no version-replace/rollback workflow yet (Phase 8).

**Note on session storage:** sessions live in server memory (a `Map`), not
the database — restarting the server logs everyone out. That's a normal,
accepted tradeoff for a project this size; it's not a bug.

## Setting up AWS S3

Optional — the app works fully without this (local disk instead). To switch
to real S3:

1. **Create a bucket** in the AWS S3 console (any region, block public
   access left **on** — the app only ever reads/writes through the backend,
   never directly from the browser).
2. **Create an IAM user** (e.g. `chaoslab-app`) with *only* this inline
   policy attached (replace `YOUR-BUCKET-NAME`) — least-privilege, not an
   admin/root credential:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
         "Resource": ["arn:aws:s3:::YOUR-BUCKET-NAME", "arn:aws:s3:::YOUR-BUCKET-NAME/*"]
       }
     ]
   }
   ```
3. **Generate an access key** for that user (Security credentials tab →
   Create access key).
4. Put all four values in `.env` (never in `.env.example`, never committed):
   ```
   AWS_REGION=your-bucket-region
   AWS_S3_BUCKET=your-bucket-name
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```
5. Restart the server — the startup log will say `Storage: AWS S3` instead
   of `Storage: local disk`.

If a credential is ever exposed (pasted somewhere it shouldn't be, committed
by accident, etc.), treat it as compromised: deactivate + delete the key in
IAM and generate a fresh one. Access keys are free and instant to rotate.
