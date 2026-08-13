// ChaosLab — admin UI behavior (Phase 3-6: real API, database, login, uploads)
//
// Every action below calls a real /api/* endpoint with fetch() and shows
// the server's real response. Login is real (session cookie), and the
// dashboard checks /api/auth/me on load, redirecting to login if you're
// not actually logged in. Publishing sends real files as multipart/form-data
// (FormData, not JSON) — the server genuinely writes them to disk. A
// presentation only becomes "published" if a file was actually attached;
// without one it stays a metadata-only "draft". Object storage (S3/R2
// instead of local disk) is still Phase 7.

const API_BASE = "/api";
const LOGIN_URL = "/ChaosLab/admin/login/";
const DASHBOARD_URL = "/ChaosLab/admin/dashboard/";

const STATUS_BADGE = {
  published: { class: "badge-published", label: "Published" },
  draft: { class: "badge-draft", label: "Draft (metadata only)" },
  not_published: { class: "badge-planned", label: "Not published" },
};

document.addEventListener("DOMContentLoaded", () => {
  // ---- login form ----
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    const msg = document.getElementById("login-msg");
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      msg.textContent = "Contacting /api/auth/login…";
      msg.classList.add("show");

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        msg.textContent = `[${res.status}] ${data.message}`;

        if (res.ok) {
          window.location.href = DASHBOARD_URL;
        }
      } catch (err) {
        msg.textContent = "Could not reach the backend — is server.js running?";
      }
    });
  }

  // ---- dashboard: require a real session ----
  const whoami = document.getElementById("whoami");
  const logoutBtn = document.getElementById("logout-btn");
  if (whoami || logoutBtn) {
    fetch(`${API_BASE}/auth/me`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ username }) => {
        if (whoami) whoami.textContent = `Logged in as ${username}`;
      })
      .catch(() => {
        window.location.href = LOGIN_URL;
      });
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
    } finally {
      window.location.href = LOGIN_URL;
    }
  }

  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  // ---- dropzone ----
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const fileList = document.getElementById("file-list");
  let selected = []; // real File objects, sent as multipart/form-data on submit

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderFiles() {
    if (!fileList) return;
    fileList.innerHTML = "";
    selected.forEach((file, i) => {
      const row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = `
        <span>${file.name} <span class="l-dim mono" style="color:var(--text-faint); font-size:11px;">(${formatSize(
        file.size
      )})</span></span>
        <button type="button" data-remove="${i}" class="mono" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px;">Remove</button>
      `;
      fileList.appendChild(row);
    });
    fileList.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selected.splice(Number(btn.dataset.remove), 1);
        renderFiles();
      });
    });
  }

  function addFiles(fileListObj) {
    Array.from(fileListObj).forEach((f) => selected.push(f));
    renderFiles();
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => addFiles(e.target.files));

    ["dragenter", "dragover"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("drag-over");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
      })
    );
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    });
  }

  // ---- version history (real data, from chaoslab.db via the API) ----
  const historyBody = document.getElementById("version-history-body");

  const historyMsg = document.getElementById("history-msg");

  function loadVersionHistory() {
    if (!historyBody) return;
    fetch(`${API_BASE}/presentations`)
      .then((res) => res.json())
      .then(({ presentations }) => {
        historyBody.innerHTML = "";
        presentations.forEach((p) => {
          const badge = STATUS_BADGE[p.status] || STATUS_BADGE.not_published;
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${p.title}</td>
            <td>${p.version}</td>
            <td>${p.date || "—"}</td>
            <td><span class="badge ${badge.class}">${badge.label}</span></td>
            <td class="row-actions">
              ${p.url ? `<a href="${p.url}">View</a>` : `<a href="#" class="disabled">View</a>`}
              <a href="#" class="disabled">Replace</a>
              <a href="#" data-delete="${p.id}" style="color:var(--danger);">Delete</a>
            </td>
          `;
          historyBody.appendChild(row);
        });

        historyBody.querySelectorAll("[data-delete]").forEach((link) => {
          link.addEventListener("click", async (e) => {
            e.preventDefault();
            const id = link.dataset.delete;
            const row = link.closest("tr");
            const title = row.children[0].textContent;
            const version = row.children[1].textContent;

            if (!window.confirm(`Delete "${title} ${version}"? This permanently removes it and any uploaded file.`)) {
              return;
            }

            if (historyMsg) {
              historyMsg.textContent = `Deleting "${title} ${version}"…`;
              historyMsg.classList.add("show");
            }

            try {
              const res = await fetch(`${API_BASE}/presentations/${id}`, { method: "DELETE" });
              const data = await res.json();
              if (historyMsg) historyMsg.textContent = `[${res.status}] ${data.message}`;
              if (res.ok) loadVersionHistory();
            } catch (err) {
              if (historyMsg) historyMsg.textContent = "Could not reach the backend — is server.js running?";
            }
          });
        });
      })
      .catch(() => {
        historyBody.innerHTML =
          '<tr><td colspan="5" class="mono" style="color:var(--danger);">Could not reach /api/presentations — is server.js running?</td></tr>';
      });
  }

  loadVersionHistory();

  // ---- publish form ----
  const publishForm = document.getElementById("publish-form");
  if (publishForm) {
    const msg = document.getElementById("publish-msg");
    publishForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // FormData, not JSON — this is what lets real file bytes ride along
      // with the text fields as multipart/form-data. Don't set a
      // Content-Type header manually: the browser generates one with the
      // correct multipart boundary itself, and overriding it breaks parsing.
      const formData = new FormData();
      formData.append("title", document.getElementById("p-title").value);
      formData.append("version", document.getElementById("p-version").value);
      formData.append("date", document.getElementById("p-date").value);
      formData.append("authors", document.getElementById("p-authors").value);
      formData.append("summary", document.getElementById("p-summary").value);
      selected.forEach((file) => formData.append("files", file));

      msg.textContent = "Uploading to /api/presentations/publish…";
      msg.classList.add("show");

      try {
        const res = await fetch(`${API_BASE}/presentations/publish`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        msg.textContent = `[${res.status}] ${data.message}`;

        if (res.ok) {
          publishForm.reset();
          selected = [];
          renderFiles();
          loadVersionHistory();
        }
      } catch (err) {
        msg.textContent = "Could not reach the backend — is server.js running?";
      }
    });
  }
});
