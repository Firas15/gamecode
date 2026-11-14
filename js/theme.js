/**
 * Тема оформления сайта: original или newyear.
 *
 * Тему выбирает администратор (admin/settings.php), браузер узнаёт её из
 * api/theme.php и запоминает в localStorage — со второго захода тема
 * включается сразу, не дожидаясь ответа сервера.
 *
 * Скрипт подгружает js/auth.js, поэтому тема работает на всех страницах
 * сайта, кроме игр (они auth.js не подключают).
 *
 * Новогодняя тема:
 *   — фон: снег вместо звёзд (js/pixels-bg.js и js/hero-sky.js ловят событие gc:theme);
 *   — снег лежит сверху на некоторых карточках (.ny-cap);
 *   — гирлянда под шапкой сайта (.ny-garland);
 *   — гекон в новогодней шапке: картинки подменяются на *-ny.png.
 */
(function () {
  'use strict';

  const me = document.currentScript;
  const ROOT = me && me.src ? me.src.replace(/js\/theme\.js(\?.*)?$/, '') : '/';
  const VER = me && me.src && me.src.includes('?') ? me.src.slice(me.src.indexOf('?')) : '';
  const KEY = 'gc_theme';
  const THEMES = ['original', 'newyear'];
  const html = document.documentElement;

  // Гекон → он же в новогодней шапке (картинки лежат рядом с оригиналами)
  const HATS = {
    'chat-bot.png': 'chat-bot-ny.png',
    'pixel-portrait.png': 'pixel-portrait-ny.png',
    'itgorky-mascot.png': 'itgorky-mascot-ny.png',
    'PIXEL.PNG': 'PIXEL-ny.png',
    // и команда на странице «О нас»
    'FIRAS.PNG': 'FIRAS-ny.png',
    'LERA.PNG': 'LERA-ny.png',
  };
  // Где лежит снег: не везде — только на части карточек.
  // На карточках команды снега нет; у футера — снег и сосульки по бокам.
  const CAP_TARGETS = [
    { sel: '.hstat-card', every: 1 },
    { sel: '.content-block', every: 2 },
    { sel: '.footer', every: 1 },
  ];

  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (t) => { try { localStorage.setItem(KEY, t); } catch (e) { /* приватный режим */ } };

  let current = null;
  let observer = null;

  function apply(theme) {
    if (!THEMES.includes(theme)) theme = 'original';
    if (theme === current) return;
    current = theme;
    html.dataset.theme = theme;
    if (theme === 'newyear') newYearOn(); else newYearOff();
    window.dispatchEvent(new CustomEvent('gc:theme', { detail: theme }));
  }

  // ── Новогодняя тема ──

  function newYearOn() {
    if (!document.getElementById('gc-theme-ny-css')) {
      const link = document.createElement('link');
      link.id = 'gc-theme-ny-css';
      link.rel = 'stylesheet';
      link.href = ROOT + 'css/theme-newyear.css' + VER;
      document.head.appendChild(link);
    }
    html.style.setProperty('--ny-cap', 'url(' + snowCapTile() + ')');
    const g = garlandTiles();
    html.style.setProperty('--ny-wire', 'url(' + g[0] + ')');
    html.style.setProperty('--ny-bulbs1', 'url(' + g[1] + ')');
    html.style.setProperty('--ny-bulbs2', 'url(' + g[2] + ')');
    html.style.setProperty('--ny-bulbs3', 'url(' + g[3] + ')');

    const header = document.querySelector('.header');
    if (header && !header.querySelector('.ny-garland')) {
      const gar = document.createElement('div');
      gar.className = 'ny-garland';
      gar.setAttribute('aria-hidden', 'true');
      gar.innerHTML = '<i class="ny-wire"></i><i class="ny-b1"></i><i class="ny-b2"></i><i class="ny-b3"></i>';
      header.appendChild(gar);
    }

    CAP_TARGETS.forEach(({ sel, every }) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (i % every !== 0 || el.querySelector(':scope > .ny-cap')) return;
        const cap = document.createElement('i');
        cap.className = 'ny-cap';
        cap.setAttribute('aria-hidden', 'true');
        el.appendChild(cap);
      });
    });

    const footer = document.querySelector('.footer');
    if (footer && !footer.querySelector('.ny-icicles')) {
      const ice = icicleTiles();
      html.style.setProperty('--ny-ice', 'url(' + ice + ')');
      const box = document.createElement('div');
      box.className = 'ny-icicles';
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = '<i class="ny-ice-l"></i><i class="ny-ice-r"></i>';
      footer.appendChild(box);
    }

    swapHats(document);
    // Окно чата и часть картинок появляются позже — надеваем шапку и им
    if (!observer && 'MutationObserver' in window) {
      observer = new MutationObserver((list) => {
        for (const m of list) m.addedNodes.forEach((n) => { if (n.nodeType === 1) swapHats(n); });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function newYearOff() {
    document.getElementById('gc-theme-ny-css')?.remove();
    document.querySelectorAll('.ny-garland, .ny-cap, .ny-icicles').forEach((el) => el.remove());
    if (observer) { observer.disconnect(); observer = null; }
    document.querySelectorAll('img[data-ny-orig]').forEach((img) => {
      img.src = img.dataset.nyOrig;
      delete img.dataset.nyOrig;
      img.classList.remove('ny-hat');
    });
  }

  function swapHats(root) {
    const imgs = root.tagName === 'IMG' ? [root] : root.querySelectorAll('img');
    imgs.forEach((img) => {
      if (img.dataset.nyOrig) return;
      const src = img.getAttribute('src') || '';
      const name = src.split('?')[0].split('/').pop();
      if (!HATS[name]) return;
      img.dataset.nyOrig = src;
      img.src = src.replace(name, HATS[name]);
      img.classList.add('ny-hat');
    });
  }

  // ── Пиксельные картинки, нарисованные на лету ──

  // Полоска снега: сугробы разной высоты и редкие сосульки.
  // Плитка широкая (168 px), поэтому повтор по ширине карточки не заметен.
  function snowCapTile() {
    const U = 3, COLS = 56, ROWS = 8, BASE = 5;
    const c = document.createElement('canvas');
    c.width = COLS * U; c.height = ROWS * U;
    const x = c.getContext('2d');
    // высота сугроба: сумма двух «волн» с разным шагом, концы совпадают — шов не виден
    const h = (i) => Math.round(1.6 + 1.1 * Math.sin(i / COLS * Math.PI * 4) + 0.9 * Math.sin(i / COLS * Math.PI * 10 + 1));
    const drips = { 7: 2, 23: 1, 38: 3, 49: 1 };
    for (let i = 0; i < COLS; i++) {
      const top = Math.max(0, 3 - h(i));
      for (let r = top; r < BASE; r++) {
        x.fillStyle = r === top ? '#ffffff' : r === BASE - 1 ? '#c9d8f0' : '#eef5ff';
        x.fillRect(i * U, r * U, U, U);
      }
      const d = drips[i] || 0;
      for (let r = BASE; r < BASE + d; r++) {
        x.fillStyle = r === BASE + d - 1 ? '#9fb4d8' : '#c9d8f0';
        x.fillRect(i * U, r * U, U, U);
      }
    }
    return c.toDataURL();
  }

  // Сосульки для футера: снежный край сверху и сосульки, длинные у края
  // экрана и всё короче к середине. Рисуется левая сторона, правая — её
  // зеркальная копия (CSS scaleX(-1)).
  function icicleTiles() {
    // Свой снежный край у сосулек не нужен: они висят прямо из-под полосы
    // снега футера (.ny-cap), без зазора между ними.
    const U = 3, COLS = 120, ROWS = 14;
    const c = document.createElement('canvas');
    c.width = COLS * U; c.height = ROWS * U;
    const x = c.getContext('2d');
    const END = 104;
    let i = 1;
    while (i < END - 6) {
      const fade = 1 - i / END;                                   // у края — 1, к середине — 0
      const len = Math.round((4 + ((i * 37) % 6)) * (0.2 + fade * 1.1));
      const w = fade > 0.6 ? 3 : 2;
      for (let r = 0; r < len; r++) {
        const left = r > len * 0.5 ? 1 : 0;                       // книзу сосулька сужается
        const ww = Math.max(1, w - left - (r === len - 1 ? 1 : 0));
        x.fillStyle = r === 0 ? '#c9d8f0' : r === len - 1 ? '#8fb8e6' : '#cfe6ff';
        x.fillRect((i + left) * U, r * U, ww * U, U);
        if (r > 0 && r < len - 1) { x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect((i + left) * U, r * U, U, U); }   // блик
      }
      i += w + 2 + ((i * 7) % 4);
    }
    return c.toDataURL();
  }

  // Гирлянда: провод с провисами и шесть лампочек в цветах сайта.
  // Лампочки разложены по трём слоям — слои мигают по очереди (CSS).
  function garlandTiles() {
    const W = 240, H = 26, U = 2;
    const COLORS = ['#00e5ff', '#ff4d6d', '#f5d800', '#b24bff', '#39ff14', '#ff8c1a'];
    const sag = (px) => Math.round(2 + 4 * Math.sin(Math.PI * ((px % 40) / 40)));
    const tile = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const wire = tile(), wx = wire.getContext('2d');
    wx.fillStyle = '#1d4d2e';
    for (let px = 0; px < W; px += U) wx.fillRect(px, sag(px) * U, U, U);
    const groups = [tile(), tile(), tile()];
    for (let i = 0; i < 6; i++) {
      const bx = 20 + i * 40, y = sag(bx) * U + U;
      const g = groups[i % 3].getContext('2d');
      g.fillStyle = '#2c3b2f'; g.fillRect(bx - 2, y, 4, 4);                       // цоколь
      g.fillStyle = COLORS[i]; g.fillRect(bx - 4, y + 4, 8, 8); g.fillRect(bx - 2, y + 12, 4, 2);
      g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(bx - 2, y + 6, 2, 2);        // блик
    }
    return [wire, ...groups].map((c) => c.toDataURL());
  }

  // ── Старт ──

  const cached = read();
  if (cached) {
    if (document.body) apply(cached);
    else document.addEventListener('DOMContentLoaded', () => apply(cached));
  }

  fetch(ROOT + 'api/theme.php', { credentials: 'omit' })
    .then((r) => r.json())
    .then((d) => {
      const t = d && d.theme;
      if (!THEMES.includes(t)) return;
      save(t);
      const go = () => apply(t);
      if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
    })
    .catch(() => { if (!cached) apply('original'); });
})();
