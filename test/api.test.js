// Phase 9 integration tests. They start the real server with an isolated
// SQLite database and local upload folder, never touching student data.

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const port = 33000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const testRootPromise = mkdtemp(path.join(os.tmpdir(), "chaoslab-api-test-"));
let testRoot;
let server;
let cookie;
let firstVersionId;

async function request(route, options = {}) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set("Cookie", cookie);
  return fetch(`${baseUrl}${route}`, { ...options, headers });
}

function uploadForm(fields, filename = "presentation.pdf") {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  form.append("files", new Blob(["ChaosLab test file"], { type: "application/pdf" }), filename);
  return form;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server has not finished starting yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not start.");
}

before(async () => {
  testRoot = await testRootPromise;
  server = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      CHAOSLAB_DB_PATH: path.join(testRoot, "test.db"),
      CHAOSLAB_UPLOADS_DIR: path.join(testRoot, "uploads"),
      CHAOSLAB_FORCE_LOCAL_STORAGE: "1",
      ADMIN_USERNAME: "test-admin",
      ADMIN_PASSWORD: "test-password",
    },
    stdio: "ignore",
  });
  await waitForServer();
});

after(async () => {
  if (server) {
    const exitPromise = new Promise((resolve) => server.on("exit", resolve));
    server.kill();
    await exitPromise;
  }
  try {
    await rm(testRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
});

test("adds baseline security headers and rejects an unapproved origin", async () => {
  const response = await request("/api/health");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");

  const crossOrigin = await request("/api/health", { headers: { Origin: "https://untrusted.example" } });
  assert.equal(crossOrigin.status, 403);
});

test("rejects unauthenticated admin access and wrong credentials", async () => {
  assert.equal((await request("/api/admin/presentations")).status, 401);
  const wrongLogin = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "wrong-password" }),
  });
  assert.equal(wrongLogin.status, 401);
});

test("authenticates an admin with an HttpOnly session cookie", async () => {
  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "test-password" }),
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  cookie = setCookie.split(";")[0];
  assert.equal((await request("/api/admin/presentations")).status, 200);
});

test("rejects an invalid upload type", async () => {
  const response = await request("/api/presentations/publish", {
    method: "POST",
    body: uploadForm({ title: "Invalid Upload", version: "v1" }, "malware.exe"),
  });
  assert.equal(response.status, 400);
});

test("publishes v1, creates v2, and preserves both versions", async () => {
  const first = await request("/api/presentations/publish", {
    method: "POST",
    body: uploadForm({ title: "Automated Test Presentation", version: "v1", authors: "Test Team", summary: "Initial version" }),
  });
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  firstVersionId = firstBody.presentation.id;
  assert.equal(firstBody.presentation.status, "published");

  const second = await request(`/api/presentations/${firstVersionId}/versions`, {
    method: "POST",
    body: uploadForm({ version: "v2", authors: "Test Team", summary: "Second version" }),
  });
  assert.equal(second.status, 201);
  const secondBody = await second.json();
  assert.equal(secondBody.presentation.status, "published");
  assert.notEqual(secondBody.presentation.id, firstVersionId);
  assert.equal(secondBody.presentation.family_id, firstBody.presentation.family_id);

  const published = await (await request("/api/presentations")).json();
  const versions = published.presentations
    .filter((presentation) => presentation.family_id === firstBody.presentation.family_id)
    .map((presentation) => presentation.version)
    .sort();
  assert.deepEqual(versions, ["v1", "v2"]);

  assert.equal((await request(`/api/presentations/${firstVersionId}/download`)).status, 200);
  assert.equal((await request(`/api/presentations/${secondBody.presentation.id}/download`)).status, 200);
});

test("rejects a duplicate version label", async () => {
  const duplicate = await request(`/api/presentations/${firstVersionId}/versions`, {
    method: "POST",
    body: uploadForm({ version: "v2" }),
  });
  assert.equal(duplicate.status, 409);
});
