// ============================================
//  GAME CODE — CAROUSEL.JS
//  Карусель игр на главной странице
// ============================================

const INTERVAL = 10000;
let current = 0;
let autoTimer = null;
let carouselGames = [];

function debugLog() {}

const GAME_VISUALS = {
  sorter: {
    img: "js/img_carusel/sortermainicon.png",
    accentColor: "var(--green)",
    gradientFrom: "#0a1f10",
    gradientTo: "#0d2e18",
    level: "НОВИЧОК",
    levelColor: "var(--green)",
    desc: "Сортируй блоки кода по правильным корзинам до того, как они упадут. Тренируй реакцию и учись различать понятия программирования в реальном времени.",
    tags: ["Логика", "Скорость", "Python"],
  },
  network: {
    img: "js/img_carusel/ipmainicon.png",
    accentColor: "var(--cyan)",
    gradientFrom: "#0d1a2e",
    gradientTo: "#0a2240",
    level: "ПРАКТИК",
    levelColor: "var(--yellow)",
    desc: "Определи, какое устройство может получить пакет данных по IP-адресу и маске подсети. Изучи основы сетевой адресации на практике.",
    tags: ["Сети", "IP", "Маски"],
  },
  millionaire: {
    img: "js/img_carusel/millionermainicon.png",
    accentColor: "var(--yellow)",
    gradientFrom: "#1a1500",
    gradientTo: "#2a2000",
    level: "ЭКСПЕРТ",
    levelColor: "var(--pink)",
    desc: "15 вопросов по Python и C++. Четыре подсказки. Доберись до виртуального миллиона и докажи, что ты настоящий программист!",
    tags: ["Python", "C++", "Викторина"],
  },
};

const FALLBACK_VISUAL = {
  img: "",
  accentColor: "var(--accent)",
  gradientFrom: "#0d1626",
  gradientTo: "#111e35",
  level: "ИГРА",
  levelColor: "var(--accent)",
  desc: "Описание появится позже.",
  tags: [],
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeGame(game) {
  const visual = GAME_VISUALS[game.id] || FALLBACK_VISUAL;
  const apiDesc = typeof game.desc === "string" ? game.desc.trim() : "";
  const normalizedDesc = apiDesc.length >= 40 ? apiDesc : visual.desc;

  return {
    id: game.id || "",
    title: game.title || "Без названия",
    desc: normalizedDesc,
    link: game.link || "#",
    preview: game.preview || visual.img || "",
    stars: Math.max(0, Math.min(3, Number(game.stars) || 0)),
    tags: Array.isArray(game.tags) && game.tags.length ? game.tags : visual.tags,
    wip: Boolean(game.wip),
    accentColor: visual.accentColor,
    gradientFrom: visual.gradientFrom,
    gradientTo: visual.gradientTo,
    level: visual.level,
    levelColor: visual.levelColor,
  };
}

function buildSlide(game) {
  const stars = Array.from({ length: 3 }, (_, i) =>
    `<span class="${i < game.stars ? "filled" : ""}">*</span>`
  ).join("");

  const tags = game.tags.map((tag) => `<span class="cs-tag">${escapeHtml(tag)}</span>`).join("");
  const playButton = game.wip
    ? ""
    : `<a href="${escapeHtml(game.link)}" class="cs-btn pixel-text" style="border-color:${game.accentColor}; color:${game.accentColor};">
         [ ИГРАТЬ ]
       </a>`;

  return `
    <div class="carousel-slide ${game.wip ? "is-wip" : ""}" data-id="${escapeHtml(game.id)}">
      <div class="cs-visual" style="background: linear-gradient(135deg, ${game.gradientFrom}, ${game.gradientTo});">
        <div class="cs-emoji">
          ${game.preview
            ? `<img src="${escapeHtml(game.preview)}" alt="${escapeHtml(game.title)}" style="width:300px; height:300px; object-fit:contain; image-rendering:pixelated;">`
            : `<span>🎮</span>`}
        </div>
        <div class="cs-scanlines"></div>
        <div class="cs-corner cs-tl" style="border-color:${game.accentColor}"></div>
        <div class="cs-corner cs-tr" style="border-color:${game.accentColor}"></div>
        <div class="cs-corner cs-bl" style="border-color:${game.accentColor}"></div>
        <div class="cs-corner cs-br" style="border-color:${game.accentColor}"></div>
      </div>
      <div class="cs-info">
        <div class="cs-meta">
          <span class="cs-level pixel-text" style="color:${game.levelColor}">${game.level}</span>
          <div class="cs-stars">${stars}</div>
        </div>
        <h3 class="cs-title pixel-text" style="color:${game.accentColor}">${escapeHtml(game.title)}</h3>
        <p class="cs-desc">${escapeHtml(game.desc)}</p>
        <div class="cs-tags">${tags}</div>
        ${game.wip ? '<div class="cs-wip-badge pixel-text">Игра в разработке</div>' : ""}
        ${playButton}
      </div>
    </div>`;
}

function renderEmptyState(track, dotsContainer, message) {
  track.innerHTML = `<div class="carousel-empty pixel-text">${escapeHtml(message)}</div>`;
  dotsContainer.innerHTML = "";
  clearInterval(autoTimer);
  const bar = document.getElementById("progressBar");
  if (bar) bar.style.width = "0%";
}

function prev() {
  return (current - 1 + carouselGames.length) % carouselGames.length;
}

function next() {
  return (current + 1) % carouselGames.length;
}

function goTo(idx, restartAuto = true) {
  if (!carouselGames.length) return;
  current = idx;

  const slides = document.querySelectorAll(".carousel-slide");
  slides.forEach((slide, i) => {
    slide.classList.toggle("active", i === idx);
    slide.classList.toggle("prev-slide", i === (idx - 1 + carouselGames.length) % carouselGames.length);
  });

  document.querySelectorAll(".carousel-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === idx);
  });

  // #region agent log
  debugLog("progress-bug", "H1", "js/carousel.js:goTo", "goTo called", { idx, restartAuto });
  // #endregion

  if (restartAuto) resetAuto();
}

function startAuto() {
  if (carouselGames.length < 2) return;
  // #region agent log
  debugLog("progress-bug", "H2", "js/carousel.js:startAuto", "startAuto invoked", { games: carouselGames.length });
  // #endregion
  resetProgressBar();
  autoTimer = setInterval(() => goTo(next()), INTERVAL);
}

function resetAuto() {
  if (carouselGames.length < 2) return;
  // #region agent log
  debugLog("progress-bug", "H2", "js/carousel.js:resetAuto", "resetAuto invoked", {});
  // #endregion
  clearInterval(autoTimer);
  resetProgressBar();
  autoTimer = setInterval(() => goTo(next()), INTERVAL);
}

function resetProgressBar() {
  const bar = document.getElementById("progressBar");
  if (!bar) {
    // #region agent log
    debugLog("progress-bug", "H3", "js/carousel.js:resetProgressBar", "progress bar missing", {});
    // #endregion
    return;
  }
  const widthBefore = bar.style.width;
  bar.style.transition = "none";
  bar.style.width = "0%";
  bar.offsetWidth;
  bar.style.transition = `width ${INTERVAL}ms linear`;
  bar.style.width = "100%";
  // #region agent log
  debugLog("progress-bug", "H3", "js/carousel.js:resetProgressBar", "progress bar reset", {
    widthBefore,
    widthAfter: bar.style.width,
    transition: bar.style.transition,
  });
  // #endregion
}

function bindControls(track, dotsContainer) {
  dotsContainer.querySelectorAll(".carousel-dot").forEach((dot) => {
    dot.addEventListener("click", () => goTo(Number(dot.dataset.idx)));
  });

  const prevBtn = document.getElementById("carouselPrev");
  const nextBtn = document.getElementById("carouselNext");
  if (prevBtn) prevBtn.addEventListener("click", () => goTo(prev()));
  if (nextBtn) nextBtn.addEventListener("click", () => goTo(next()));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") goTo(prev());
    if (e.key === "ArrowRight") goTo(next());
  });

  let touchStartX = 0;
  track.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  track.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) goTo(dx < 0 ? next() : prev());
  }, { passive: true });
}

async function initCarousel() {
  const track = document.getElementById("carouselTrack");
  const dotsContainer = document.getElementById("carouselDots");
  if (!track || !dotsContainer) return;

  try {
    const response = await fetch("api/games.php", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data || !data.ok || !Array.isArray(data.games)) {
      throw new Error("invalid-response");
    }

    carouselGames = data.games.map(normalizeGame).filter((g) => g.id && g.title);
    if (!carouselGames.length) {
      renderEmptyState(track, dotsContainer, "Игры скоро появятся");
      return;
    }

    track.innerHTML = carouselGames.map(buildSlide).join("");
    dotsContainer.innerHTML = carouselGames.map((_, i) =>
      `<button class="carousel-dot ${i === 0 ? "active" : ""}" data-idx="${i}" aria-label="Слайд ${i + 1}"></button>`
    ).join("");

    bindControls(track, dotsContainer);
    goTo(0, false);
    startAuto();
  } catch (e) {
    renderEmptyState(track, dotsContainer, "Не удалось загрузить игры");
  }
}

document.addEventListener("DOMContentLoaded", initCarousel);
