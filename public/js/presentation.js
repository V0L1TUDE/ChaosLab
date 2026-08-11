// ChaosLab — website-based presentation deck controller
// Handles slide navigation, keyboard shortcuts, progress UI,
// an "overview" jump grid, and fullscreen presenting.

document.addEventListener("DOMContentLoaded", () => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const total = slides.length;
  if (!total) return;

  const dotsWrap = document.querySelector(".deck-controls-center");
  const progressText = document.querySelector(".deck-progress-text");
  const progressFill = document.querySelector(".progress-bar-fill");
  const overview = document.querySelector(".overview-grid");
  const deckViewport = document.querySelector(".deck-viewport");
  const prevBtn = document.querySelector("[data-action='prev']");
  const nextBtn = document.querySelector("[data-action='next']");
  const overviewBtn = document.querySelector("[data-action='overview']");
  const fullscreenBtn = document.querySelector("[data-action='fullscreen']");

  let current = 0;
  const startHash = parseInt((location.hash || "").replace("#", ""), 10);
  if (!isNaN(startHash) && startHash >= 1 && startHash <= total) {
    current = startHash - 1;
  }

  // build dot indicators
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "deck-dot";
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  // build overview cards
  slides.forEach((slide, i) => {
    const kicker = slide.querySelector(".slide-kicker");
    const title = slide.querySelector(".slide-title");
    const card = document.createElement("div");
    card.className = "overview-card";
    card.innerHTML = `
      <div class="num">${String(i + 1).padStart(2, "0")}</div>
      <div class="t">${title ? title.textContent : kicker ? kicker.textContent : "Slide " + (i + 1)}</div>
    `;
    card.addEventListener("click", () => {
      goTo(i);
      closeOverview();
    });
    overview.appendChild(card);
  });

  function render() {
    slides.forEach((slide, i) => slide.classList.toggle("active", i === current));
    document
      .querySelectorAll(".deck-dot")
      .forEach((dot, i) => dot.classList.toggle("active", i === current));
    progressText.textContent = `${String(current + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    progressFill.style.width = `${((current + 1) / total) * 100}%`;
    history.replaceState(null, "", `#${current + 1}`);
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
  }

  function goTo(i) {
    current = Math.max(0, Math.min(total - 1, i));
    render();
  }

  function next() {
    if (current < total - 1) goTo(current + 1);
  }

  function prev() {
    if (current > 0) goTo(current - 1);
  }

  function openOverview() {
    overview.classList.add("open");
    deckViewport.style.display = "none";
  }

  function closeOverview() {
    overview.classList.remove("open");
    deckViewport.style.display = "";
  }

  function toggleOverview() {
    if (overview.classList.contains("open")) closeOverview();
    else openOverview();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  overviewBtn.addEventListener("click", toggleOverview);
  fullscreenBtn.addEventListener("click", toggleFullscreen);

  document.addEventListener("keydown", (e) => {
    if (overview.classList.contains("open")) {
      if (e.key === "Escape") closeOverview();
      return;
    }
    if (e.key === "ArrowRight" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      prev();
    } else if (e.key.toLowerCase() === "o") {
      toggleOverview();
    } else if (e.key.toLowerCase() === "f") {
      toggleFullscreen();
    }
  });

  render();
});
