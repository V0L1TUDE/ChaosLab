// Public archive data comes from the backend when it is available locally.
// The HTML contains a Planning v1 fallback so the existing GitHub Pages site
// remains useful even though GitHub Pages cannot run the Express API.

document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("published-presentations");
  if (!list) return;

  function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  }

  function makeCard(presentation, index) {
    const card = document.createElement("div");
    card.className = "doc-card reveal visible";
    const main = document.createElement("div");
    main.className = "doc-main";
    main.appendChild(text("div", `P${index + 1}`, "doc-icon"));
    const copy = document.createElement("div");
    copy.appendChild(text("div", `${presentation.title} ${presentation.version}`, "doc-title"));
    const meta = document.createElement("div");
    meta.className = "doc-meta";
    meta.append(
      text("span", `DATE: ${presentation.date || "Not specified"}`),
      text("span", `AUTHORS: ${presentation.authors || "Not specified"}`)
    );
    copy.appendChild(meta);
    main.appendChild(copy);

    const actionArea = document.createElement("div");
    actionArea.style.cssText = "display:flex; align-items:center; gap:16px;";
    actionArea.appendChild(text("span", "Published", "badge badge-published"));
    const actions = document.createElement("div");
    actions.className = "doc-actions";
    const open = document.createElement("a");
    open.href = presentation.url || `/ChaosLab/presentation/?id=${presentation.id}`;
    open.className = "btn btn-primary btn-sm";
    open.textContent = "Open version";
    actions.appendChild(open);
    actionArea.appendChild(actions);
    card.append(main, actionArea);
    return card;
  }

  try {
    const response = await fetch("/api/presentations");
    if (!response.ok) throw new Error("API unavailable");
    const { presentations } = await response.json();
    list.innerHTML = "";
    if (!presentations.length) {
      list.appendChild(text("p", "No published presentations are available yet.", "version-hint"));
      return;
    }
    presentations.forEach((presentation, index) => list.appendChild(makeCard(presentation, index)));
  } catch {
    // Keep the server-independent Planning v1 fallback already in the HTML.
  }
});
