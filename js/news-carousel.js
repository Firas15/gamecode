const NEWS_INTERVAL = 9000;
let newsCurrent = 0;
let newsAutoTimer = null;
let newsItems = [];

function escapeNewsHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNewsDescription(value = "") {
  const escaped = escapeNewsHtml(value);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a class="news-carousel-link" href="${url}" target="_blank" rel="noopener noreferrer">click here</a>`
  );
}

function buildNewsSlide(item) {
  const layoutClass = item.layout === "right" ? "layout-right" : "layout-left";

  return `
    <article class="news-carousel-slide ${layoutClass}" data-id="${escapeNewsHtml(item.id)}">
      <div class="news-carousel-media">
        <img class="news-carousel-image" src="${escapeNewsHtml(item.image)}" alt="${escapeNewsHtml(item.title)}" loading="lazy">
      </div>
      <div class="news-carousel-body">
        <div class="news-carousel-kicker pixel-text">[ ${escapeNewsHtml(item.date)} ]</div>
        <h3 class="news-carousel-title pixel-text">${escapeNewsHtml(item.title)}</h3>
        <p class="news-carousel-desc pixel-text">${formatNewsDescription(item.description)}</p>
      </div>
    </article>
  `;
}

function renderNewsEmpty(message) {
  const track = document.getElementById("newsCarouselTrack");
  const dots = document.getElementById("newsCarouselDots");
  const bar = document.getElementById("newsCarouselProgressBar");
  if (track) track.innerHTML = `<div class="news-carousel-empty pixel-text">${escapeNewsHtml(message)}</div>`;
  if (dots) dots.innerHTML = "";
  if (bar) bar.style.width = "0%";
  clearInterval(newsAutoTimer);
}

function newsPrevIndex() {
  return (newsCurrent - 1 + newsItems.length) % newsItems.length;
}

function newsNextIndex() {
  return (newsCurrent + 1) % newsItems.length;
}

function resetNewsProgressBar() {
  const bar = document.getElementById("newsCarouselProgressBar");
  if (!bar) return;
  bar.style.transition = "none";
  bar.style.width = "0%";
  bar.offsetWidth;
  bar.style.transition = `width ${NEWS_INTERVAL}ms linear`;
  bar.style.width = "100%";
}

function startNewsAuto() {
  if (newsItems.length < 2) return;
  resetNewsProgressBar();
  newsAutoTimer = setInterval(() => goToNews(newsNextIndex()), NEWS_INTERVAL);
}

function resetNewsAuto() {
  if (newsItems.length < 2) return;
  clearInterval(newsAutoTimer);
  resetNewsProgressBar();
  newsAutoTimer = setInterval(() => goToNews(newsNextIndex()), NEWS_INTERVAL);
}

function goToNews(idx, restartAuto = true) {
  if (!newsItems.length) return;
  newsCurrent = idx;

  document.querySelectorAll(".news-carousel-slide").forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === idx);
  });

  document.querySelectorAll(".news-carousel-dot").forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === idx);
  });

  if (restartAuto) resetNewsAuto();
}

function bindNewsControls(track, dotsContainer) {
  dotsContainer.querySelectorAll(".news-carousel-dot").forEach((dot) => {
    dot.addEventListener("click", () => goToNews(Number(dot.dataset.idx)));
  });

  document.getElementById("newsCarouselPrev")?.addEventListener("click", () => goToNews(newsPrevIndex()));
  document.getElementById("newsCarouselNext")?.addEventListener("click", () => goToNews(newsNextIndex()));

  let touchStartX = 0;
  track.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0].clientX;
  }, { passive: true });

  track.addEventListener("touchend", (event) => {
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 50) {
      goToNews(delta < 0 ? newsNextIndex() : newsPrevIndex());
    }
  }, { passive: true });
}

async function initNewsCarousel() {
  const track = document.getElementById("newsCarouselTrack");
  const dotsContainer = document.getElementById("newsCarouselDots");
  if (!track || !dotsContainer) return;

  try {
    const response = await fetch("api/news.php", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data || !data.ok || !Array.isArray(data.news)) {
      throw new Error("invalid-response");
    }

    newsItems = data.news
      .slice(0, 3)
      .filter((item) => item && item.id && item.title && item.image)
      .map((item) => ({
        id: String(item.id),
        title: String(item.title),
        description: String(item.description || ""),
        image: String(item.image),
        layout: item.layout === "right" ? "right" : "left",
        date: String(item.date || ""),
      }));

    if (!newsItems.length) {
      renderNewsEmpty("Новости скоро появятся");
      return;
    }

    track.innerHTML = newsItems.map(buildNewsSlide).join("");
    dotsContainer.innerHTML = newsItems.map((_, index) =>
      `<button class="news-carousel-dot ${index === 0 ? "active" : ""}" data-idx="${index}" aria-label="Новость ${index + 1}"></button>`
    ).join("");

    bindNewsControls(track, dotsContainer);
    goToNews(0, false);
    startNewsAuto();
  } catch (error) {
    renderNewsEmpty("Не удалось загрузить новости");
  }
}

document.addEventListener("DOMContentLoaded", initNewsCarousel);
