// ChaosLab — admin UI behavior (Phase 1: frontend only)
//
// Nothing in this file talks to a server. There is no backend yet.
// It exists so the admin screens feel real to interact with while
// being explicit that no login, upload, or publish actually happens.
// When the Express backend + auth + storage land (Phases 3-6), the
// fetch() calls replace these placeholder handlers directly.

document.addEventListener("DOMContentLoaded", () => {
  // ---- login form ----
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    const msg = document.getElementById("login-msg");
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      msg.textContent =
        "Authentication is not implemented yet. This screen is a UI preview only — no backend is connected.";
      msg.classList.add("show");
    });
  }

  // ---- dropzone ----
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const fileList = document.getElementById("file-list");
  const selected = [];

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

  // ---- publish form ----
  const publishForm = document.getElementById("publish-form");
  if (publishForm) {
    const msg = document.getElementById("publish-msg");
    publishForm.addEventListener("submit", (e) => {
      e.preventDefault();
      msg.textContent =
        "Publishing is not implemented yet. No files or metadata were saved — this UI is not yet connected to a backend or database.";
      msg.classList.add("show");
    });
  }
});
