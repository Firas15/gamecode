// ============================================
//  GAME CODE — COMPONENTS.JS
//  Общие компоненты: хедер, сайдбар, футер
//  Подключается на каждой странице
// ============================================

(function () {

  // === ОПРЕДЕЛЯЕМ ГЛУБИНУ СТРАНИЦЫ ===
  // index.html      → depth 0 → prefix ""
  // pages/how-to-play.html → depth 1 → prefix "../"

  const depth = (function () {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    // Если последний сегмент — html-файл, не считаем его как папку
    const dirs = parts.filter(p => !p.endsWith('.html'));
    // Найдём папку pages/ в пути
    const pagesIdx = dirs.indexOf('pages');
    return pagesIdx >= 0 ? dirs.length - pagesIdx : 0;
  })();

  const ROOT = depth === 0 ? '' : '../'.repeat(depth);

  // === АКТИВНАЯ ССЫЛКА МЕНЮ ===
  function isActive(href) {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    return href.split('/').pop() === current;
  }

  const NAV_LINKS = [
    { label: 'Все игры',   icon: '🎮', href: `${ROOT}index.html` },
    { label: 'Как играть', icon: '📖', href: `${ROOT}pages/how-to-play.html` },
    { label: 'Теория',     icon: '💡', href: `${ROOT}pages/theory.html` },
    { label: 'О нас',      icon: '👾', href: `${ROOT}pages/about.html` },
  ];

  // === РЕНДЕР ХЕДЕРА ===
  function renderHeader(title, tagline) {
    const headerEl = document.getElementById('app-header');
    if (!headerEl) return;

    headerEl.innerHTML = `
      <div class="header-left">
        <button class="menu-btn" id="menuBtn" aria-label="Открыть меню">
          <span></span><span></span><span></span>
        </button>
        <div class="site-title">
          <a href="${ROOT}index.html" class="logo pixel-text">GAME <span class="accent">CODE</span></a>
          <p class="tagline">${tagline || 'Изучай программирование в играх'}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="search-box">
          <input type="text" class="search-input" id="searchInput" placeholder="Поиск игр..." />
          <button class="search-btn" id="searchBtn" aria-label="Искать">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  // === РЕНДЕР ОВЕРЛЕЯ И САЙДБАРА ===
  function renderSidebar() {
    const overlayEl = document.getElementById('app-overlay');
    const sidebarEl = document.getElementById('app-sidebar');
    if (!overlayEl || !sidebarEl) return;

    overlayEl.className = 'overlay';

    const links = NAV_LINKS.map(l => {
      const active = isActive(l.href) ? ' active' : '';
      return `<li>
        <a href="${l.href}" class="sidebar-link${active}" data-icon="${l.icon}">${l.label}</a>
      </li>`;
    }).join('');

    sidebarEl.innerHTML = `
      <button class="sidebar-close" id="sidebarClose">✕</button>
      <div class="sidebar-logo">
        <span class="pixel-text">GAME</span>
        <span class="pixel-text accent">CODE</span>
      </div>
      <ul class="sidebar-nav">${links}</ul>
      <div class="sidebar-footer"><span>V1.0 — CLASSIFIER GAME</span></div>
    `;
  }

  // === РЕНДЕР ФУТЕРА ===
  function renderFooter() {
    const footerEl = document.getElementById('app-footer');
    if (!footerEl) return;
    footerEl.innerHTML = `
      <p class="pixel-text">GAME <span class="accent">CODE</span> &copy; 2025</p>
      <p class="footer-sub">Изучай программирование в играх</p>
    `;
  }

  // === ЛОГИКА МЕНЮ ===
  function initSidebarLogic() {
    const sidebar  = document.getElementById('app-sidebar');
    const overlay  = document.getElementById('app-overlay');
    const menuBtn  = document.getElementById('menuBtn');
    const closeBtn = document.getElementById('sidebarClose');
    if (!sidebar || !overlay || !menuBtn) return;

    const open  = () => { sidebar.classList.add('open'); overlay.classList.add('active'); document.body.style.overflow = 'hidden'; };
    const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); document.body.style.overflow = ''; };

    menuBtn.addEventListener('click', open);
    closeBtn && closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', e => e.key === 'Escape' && close());
    document.querySelectorAll('.sidebar-link').forEach(l => l.addEventListener('click', close));
  }

  // === ПОИСК (только на index.html) ===
  function initSearch() {
    const input   = document.getElementById('searchInput');
    const btn     = document.getElementById('searchBtn');
    if (!input) return;

    // Если мы не на главной — поиск перекидывает на главную с query
    const isHome = !window.location.pathname.includes('pages/');

    function doSearch(q) {
      if (!q.trim()) return;
      if (!isHome) {
        window.location.href = `${ROOT}index.html?q=${encodeURIComponent(q.trim())}`;
      }
    }

    input.addEventListener('keydown', e => e.key === 'Enter' && doSearch(input.value));
    btn && btn.addEventListener('click', () => doSearch(input.value));
  }

  // === INIT ===
  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    renderSidebar();
    renderFooter();
    initSidebarLogic();
    initSearch();
  });

})();
