// ChaosLab admin UI (Phase 3-8): authentication, uploads, and immutable versions.
// A new version always becomes a new database record and storage folder.

const API_BASE = "/api";
const LOGIN_URL = "/ChaosLab/admin/login/";
const DASHBOARD_URL = "/ChaosLab/admin/dashboard/";

const STATUS_BADGE = {
  published: { class: "badge-published", label: "Published" },
  draft: { class: "badge-draft", label: "Draft (metadata only)" },
  not_published: { class: "badge-planned", label: "Not published" },
};

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    const msg = document.getElementById("login-msg");
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      msg.textContent = "Contacting /api/auth/login...";
      msg.classList.add("show");
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: document.getElementById("username").value,
            password: document.getElementById("password").value,
          }),
        });
        const data = await res.json();
        msg.textContent = `[${res.status}] ${data.message}`;
        if (res.ok) window.location.href = DASHBOARD_URL;
      } catch {
        msg.textContent = "Could not reach the backend - is server.js running?";
      }
    });
  }

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
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener("click", (event) => {
    event.preventDefault();
    logout();
  });

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const fileList = document.getElementById("file-list");
  const publishForm = document.getElementById("publish-form");
  const versionMode = document.getElementById("version-mode");
  const cancelVersionBtn = document.getElementById("cancel-version-btn");
  let selected = [];
  let versionSource = null;
  let currentPresentations = [];

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderFiles() {
    if (!fileList) return;
    fileList.innerHTML = "";
    selected.forEach((file, index) => {
      const row = document.createElement("div");
      row.className = "file-row";
      const label = document.createElement("span");
      label.textContent = `${file.name} (${formatSize(file.size)})`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "mono";
      remove.textContent = "Remove";
      remove.style.cssText = "background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px;";
      remove.addEventListener("click", () => {
        selected.splice(index, 1);
        renderFiles();
      });
      row.append(label, remove);
      fileList.appendChild(row);
    });
  }

  function addFiles(files) {
    Array.from(files).forEach((file) => selected.push(file));
    renderFiles();
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (event) => addFiles(event.target.files));
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("drag-over");
    }));
    ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("drag-over");
    }));
    dropzone.addEventListener("drop", (event) => {
      if (event.dataTransfer?.files.length) addFiles(event.dataTransfer.files);
    });
  }

  function resetVersionMode() {
    versionSource = null;
    if (versionMode) versionMode.hidden = true;
    if (cancelVersionBtn) cancelVersionBtn.hidden = true;
    const title = document.getElementById("p-title");
    if (title) title.readOnly = false;
  }

  function startNewVersion(source) {
    versionSource = source;
    document.getElementById("p-title").value = source.title;
    document.getElementById("p-title").readOnly = true;
    document.getElementById("p-version").value = "";
    document.getElementById("p-date").value = new Date().toISOString().slice(0, 10);
    document.getElementById("p-authors").value = source.authors || "";
    document.getElementById("p-summary").value = "";
    selected = [];
    if (fileInput) fileInput.value = "";
    renderFiles();
    if (versionMode) {
      versionMode.hidden = false;
      versionMode.textContent = `Creating a new version of ${source.title} ${source.version}. The original remains unchanged.`;
    }
    if (cancelVersionBtn) cancelVersionBtn.hidden = false;
    document.getElementById("p-version").focus();
  }

  if (cancelVersionBtn) cancelVersionBtn.addEventListener("click", () => {
    publishForm.reset();
    selected = [];
    if (fileInput) fileInput.value = "";
    renderFiles();
    resetVersionMode();
  });

  const historyBody = document.getElementById("version-history-body");
  const historyMsg = document.getElementById("history-msg");

  function loadVersionHistory() {
    if (!historyBody) return;
    fetch(`${API_BASE}/admin/presentations`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ presentations }) => {
        currentPresentations = presentations;
        historyBody.innerHTML = "";
        presentations.forEach((presentation) => {
          const badge = STATUS_BADGE[presentation.status] || STATUS_BADGE.not_published;
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${presentation.title}</td>
            <td>${presentation.version}</td>
            <td>${presentation.date || "-"}</td>
            <td><span class="badge ${badge.class}">${badge.label}</span></td>
            <td class="row-actions">
              ${presentation.url ? `<a href="${presentation.url}">View</a>` : '<a href="#" class="disabled">View</a>'}
              <a href="#" data-new-version="${presentation.id}">New version</a>
              <a href="#" data-delete="${presentation.id}" style="color:var(--danger);">Delete</a>
            </td>`;
          historyBody.appendChild(row);
        });

        historyBody.querySelectorAll("[data-new-version]").forEach((link) => link.addEventListener("click", (event) => {
          event.preventDefault();
          const source = currentPresentations.find((item) => item.id === Number(link.dataset.newVersion));
          if (source) startNewVersion(source);
        }));

        historyBody.querySelectorAll("[data-delete]").forEach((link) => link.addEventListener("click", async (event) => {
          event.preventDefault();
          const presentation = currentPresentations.find((item) => item.id === Number(link.dataset.delete));
          if (!presentation || !window.confirm(`Delete "${presentation.title} ${presentation.version}"? This permanently removes it and any uploaded file.`)) return;
          if (historyMsg) {
            historyMsg.textContent = `Deleting "${presentation.title} ${presentation.version}"...`;
            historyMsg.classList.add("show");
          }
          try {
            const res = await fetch(`${API_BASE}/presentations/${presentation.id}`, { method: "DELETE" });
            const data = await res.json();
            if (historyMsg) historyMsg.textContent = `[${res.status}] ${data.message}`;
            if (res.ok) loadVersionHistory();
          } catch {
            if (historyMsg) historyMsg.textContent = "Could not reach the backend - is server.js running?";
          }
        }));
      })
      .catch(() => {
        historyBody.innerHTML = '<tr><td colspan="5" class="mono" style="color:var(--danger);">Could not load version history.</td></tr>';
      });
  }

  loadVersionHistory();

  if (publishForm) publishForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const msg = document.getElementById("publish-msg");
    const formData = new FormData();
    formData.append("title", document.getElementById("p-title").value);
    formData.append("version", document.getElementById("p-version").value);
    formData.append("date", document.getElementById("p-date").value);
    formData.append("authors", document.getElementById("p-authors").value);
    formData.append("summary", document.getElementById("p-summary").value);
    selected.forEach((file) => formData.append("files", file));

    const endpoint = versionSource
      ? `${API_BASE}/presentations/${versionSource.id}/versions`
      : `${API_BASE}/presentations/publish`;
    msg.textContent = versionSource ? "Publishing a new immutable version..." : "Uploading presentation...";
    msg.classList.add("show");

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      msg.textContent = `[${res.status}] ${data.message}`;
      if (res.ok) {
        publishForm.reset();
        selected = [];
        if (fileInput) fileInput.value = "";
        renderFiles();
        resetVersionMode();
        loadVersionHistory();
      }
    } catch {
      msg.textContent = "Could not reach the backend - is server.js running?";
    }
  });
});
