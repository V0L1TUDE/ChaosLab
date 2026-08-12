// ChaosLab — admin UI behavior (Phase 3 + 4: talks to the real API + database)
//
// Every action below calls a real /api/* endpoint with fetch() and shows
// the server's real response. Login still honestly replies "not
// implemented yet" (no auth system exists — Phase 5). Publishing now
// really writes a row to the SQLite database, but honestly says so when
// no actual file was stored (file/object storage is Phases 6/7).

const API_BASE = "/api";

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
      } catch (err) {
        msg.textContent = "Could not reach the backend — is server.js running?";
      }
    });
  }

  // ---- dropzone ----
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const fileList = document.getElementById("file-list");
  let selected = [];

  function renderFiles() {
    if (!fileList) return;
    fileList.innerHTML = "";
    selected.forEach((name) => {
      const row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = `<span>${name}</span><span class="l-dim mono" style="color:var(--text-faint); font-size:11px;">selected, not uploaded</span>`;
      fileList.appendChild(row);
    });
  }

  function addFiles(fileListObj) {
    Array.from(fileListObj).forEach((f) => selected.push(f.name));
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
            </td>
          `;
          historyBody.appendChild(row);
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
      const body = {
        title: document.getElementById("p-title").value,
        version: document.getElementById("p-version").value,
        date: document.getElementById("p-date").value,
        authors: document.getElementById("p-authors").value,
        summary: document.getElementById("p-summary").value,
        fileNames: selected,
      };

      msg.textContent = "Contacting /api/presentations/publish…";
      msg.classList.add("show");

      try {
        const res = await fetch(`${API_BASE}/presentations/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
