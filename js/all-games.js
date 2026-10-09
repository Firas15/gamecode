/* ============================================================
   СТРАНИЦА «ВСЕ ИГРЫ» (pages/games.html)

   Список игр, порядок и статус WIP берутся из того же API, что
   и карусель на главной (api/games.php → таблица games, правится
   в админке). Картинка, уровень, теги и цвет карточки — здесь,
   как GAME_VISUALS в js/carousel.js. Новая игра без записи ниже
   всё равно появится — с нейтральной карточкой.

   Сверху: фильтр по уровню и «случайная игра».
   В карточке: картинка, уровень и звёзды, название, описание,
   теги, кнопка ИГРАТЬ.
   ============================================================ */
(function () {
  'use strict';

  const ROOT = '../';

  const LEVELS = {
    beginner: { label: 'НОВИЧОК', color: 'var(--green)' },
    medium:   { label: 'ПРАКТИК', color: 'var(--yellow)' },
    expert:   { label: 'ЭКСПЕРТ', color: 'var(--pink)' },
  };

  const META = {
    sorter: {
      img: 'js/img_carusel/sortermainicon.png', accent: '#39ff14', from: '#0a1f10', to: '#0d2e18',
      level: 'beginner', stars: 1,
      desc: 'Сортируй блоки кода по правильным корзинам до того, как они упадут. Тренируй реакцию и учись различать понятия программирования в реальном времени.',
      tags: ['Логика', 'Скорость', 'Python'],
    },
    network: {
      img: 'js/img_carusel/ipmainicon.png', accent: '#00e5ff', from: '#0d1a2e', to: '#0a2240',
      level: 'medium', stars: 2,
      desc: 'Доведи пакеты до цели: подсети и маски, адреса сети и broadcast, шлюзы, поиск поломок и таблицы маршрутизации. Задания каждый раз новые, а геккон-сисадмин объясняет каждую ошибку.',
      tags: ['Сети', 'IP', 'Маршрутизация'],
    },
    millionaire: {
      img: 'js/img_carusel/millionermainicon.png', accent: '#f5d800', from: '#1a1500', to: '#2a2000',
      level: 'expert', stars: 3,
      desc: '15 вопросов по Python и C++. Четыре подсказки. Доберись до виртуального миллиона и докажи, что ты настоящий программист!',
      tags: ['Python', 'C++', 'Викторина'],
    },
    pixelgame: {
      img: 'img/virus.png', accent: '#b24bff', from: '#14092e', to: '#1e0f3f',
      level: 'expert', stars: 3,
      desc: 'Пиксельная RPG: исследуй лабиринт внутри компьютера, открывай сундуки с кодом, побеждай вирусы и собери программу на Go, чтобы выбраться!',
      tags: ['Go', 'RPG', 'Квест'],
    },
    glitch: {
      img: 'js/img_carusel/glitchmainicon.png', accent: '#00e5ff', from: '#061620', to: '#0b2233',
      level: 'medium', stars: 2,
      desc: 'Глюк-призраки атакуют сервер GameCode! Отвечай на вопросы по сетям, Python, железу, Linux, данным и вебу — верный ответ сбивает глюк из пушки. В конце — босс «Глюк-ядро».',
      tags: ['Викторина', 'Аркада', 'Все темы IT'],
    },
  };
  const FALLBACK = { img: 'img/ICON.PNG', accent: '#2a5fbf', from: '#0d1626', to: '#111e35', level: 'beginner', stars: 1, desc: '', tags: [] };

  const grid = document.getElementById('agGrid');
  const filtersEl = document.getElementById('agFilters');
  const randomBtn = document.getElementById('agRandom');
  const subtitle = document.getElementById('agSubtitle');
  let games = [];
  let filter = 'all';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const withPeriod = t => { t = String(t || '').trim(); return !t || /[.!?…»)]$/.test(t) ? t : t + '.'; };
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many);
  };

  function card(g, i) {
    const m = META[g.id] || FALLBACK;
    const lvl = LEVELS[m.level] || LEVELS.beginner;
    const desc = withPeriod(m.desc || g.desc);
    const stars = [1, 2, 3].map(n => `<span class="${n <= m.stars ? 'filled' : ''}">*</span>`).join('');
    const tags = (m.tags || []).map(t => `<span class="ag-tag">${esc(t)}</span>`).join('');
    const link = g.wip ? '' : ROOT + g.link;
    return `
      <article class="ag-card${g.wip ? ' is-wip' : ''}" style="--a:${m.accent};--from:${m.from};--to:${m.to};animation-delay:${i * 0.06}s" data-level="${esc(m.level)}">
        <a class="ag-visual" ${link ? `href="${esc(link)}"` : 'tabindex="-1" aria-disabled="true"'} aria-label="${esc(g.title)}">
          <img src="${esc(ROOT + m.img)}" alt="" loading="lazy"/>
          <span class="ag-scan"></span>
          <span class="ag-corner ag-tl"></span><span class="ag-corner ag-tr"></span>
          <span class="ag-corner ag-bl"></span><span class="ag-corner ag-br"></span>
          ${g.wip ? '<span class="ag-soon pixel-text">СКОРО</span>' : ''}
        </a>
        <div class="ag-body">
          <div class="ag-meta">
            <span class="ag-level pixel-text" style="color:${lvl.color}">${lvl.label}</span>
            <span class="ag-stars cs-stars" title="Сложность">${stars}</span>
          </div>
          <h2 class="ag-name pixel-text">${esc(g.title)}</h2>
          <p class="ag-desc">${esc(desc)}</p>
          <div class="ag-tags">${tags}</div>
          ${link
            ? `<a class="ag-play pixel-text" href="${esc(link)}">[ ИГРАТЬ ]</a>`
            : '<span class="ag-play is-off pixel-text">[ СКОРО ]</span>'}
        </div>
      </article>`;
  }

  function render() {
    const list = games.filter(g => filter === 'all' || (META[g.id] || FALLBACK).level === filter);
    grid.innerHTML = list.length
      ? list.map(card).join('')
      : '<div class="ag-loading pixel-text">// в этом разделе пока нет игр</div>';
  }

  function renderFilters() {
    const count = lv => games.filter(g => lv === 'all' || (META[g.id] || FALLBACK).level === lv).length;
    const items = [['all', 'ВСЕ', '#2a5fbf'], ...Object.entries(LEVELS).map(([k, v]) => [k, v.label, v.color])]
      .filter(([k]) => k === 'all' || count(k) > 0);
    filtersEl.innerHTML = items.map(([k, label, color]) =>
      `<button type="button" class="ag-filter pixel-text${filter === k ? ' on' : ''}" data-f="${k}" style="--c:${color}" role="tab" aria-selected="${filter === k}">${label} <b>${count(k)}</b></button>`
    ).join('');
  }

  filtersEl.addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    renderFilters();
    render();
  });

  randomBtn.addEventListener('click', () => {
    const playable = games.filter(g => !g.wip);
    if (!playable.length) return;
    const g = playable[Math.floor(Math.random() * playable.length)];
    randomBtn.disabled = true;
    randomBtn.textContent = g.title.toUpperCase() + '!';
    setTimeout(() => { window.location.href = ROOT + g.link; }, 700);
  });

  fetch(ROOT + 'api/games.php', { cache: 'no-store' })
    .then(r => r.json())
    .then(d => {
      if (!d || !d.ok || !Array.isArray(d.games)) throw new Error('bad');
      games = d.games;
      const n = games.filter(g => !g.wip).length;
      subtitle.textContent = `${n} ${plural(n, 'игра', 'игры', 'игр')} — выбирай по уровню и начинай прямо сейчас`;
      renderFilters();
      render();
    })
    .catch(() => {
      grid.innerHTML = '<div class="ag-loading pixel-text">// не удалось загрузить игры — обнови страницу</div>';
    });
})();
