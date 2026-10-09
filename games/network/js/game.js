/* ============================================================
   СЕТЕВОЙ МАРШРУТ — клиент

   Партию ведёт сервер (api/network.php): он генерирует задания,
   проверяет ответы и считает очки. Браузер только рисует задание,
   отправляет номер выбранного варианта и показывает результат.
   Правильный ответ приходит с сервера уже ПОСЛЕ ответа игрока.

    1. Утилиты и звук          6. Отрисовка заданий (схемы, кнопки)
    2. Звёздный фон            7. Ответ, таймер, подсказка
    3. Геккон-сисадмин         8. Конец партии и разбор ошибок
    4. Иконки устройств        9. Клавиши и запуск
    5. Меню и старт партии
   ============================================================ */
(function () {
  'use strict';

  const GAME_ID = 'network';
  const API = '../../api/network.php';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const LEVEL_COLORS = { 1: '#39ff14', 2: '#f5d800', 3: '#ff4d6d' };

  // ============================================================
  // 1. ЗВУК — 8-битные «пики» без файлов
  // ============================================================
  let audioCtx = null;
  let soundOn = true;
  try { soundOn = localStorage.getItem('gc_net_sound') !== '0'; } catch (e) { /* приватный режим */ }

  function beep(freq, dur, shape = 'square', vol = 0.12, delay = 0) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = shape; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(t); osc.stop(t + dur);
    } catch (e) { /* без звука */ }
  }
  const sfx = {
    click: () => beep(440, 0.04, 'square', 0.07),
    send:  () => beep(880, 0.05, 'sine', 0.08),
    right: () => { beep(523, 0.06); beep(659, 0.06, 'square', 0.12, 0.07); beep(784, 0.14, 'square', 0.12, 0.14); },
    wrong: () => { beep(220, 0.08); beep(160, 0.16, 'square', 0.12, 0.08); },
    tick:  () => beep(1200, 0.03, 'square', 0.05),
    win:   () => [523, 659, 784, 1047].forEach((n, i) => beep(n, 0.12, 'square', 0.12, i * 0.09)),
    lose:  () => [300, 250, 200, 150].forEach((n, i) => beep(n, 0.14, 'sawtooth', 0.1, i * 0.1)),
    hint:  () => { beep(660, 0.05, 'triangle', 0.1); beep(990, 0.08, 'triangle', 0.1, 0.06); },
  };
  function renderSoundBtn() { $('btn-sound').textContent = soundOn ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ'; }
  $('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('gc_net_sound', soundOn ? '1' : '0'); } catch (e) { /* ок */ }
    renderSoundBtn(); sfx.click();
  });
  renderSoundBtn();

  // ============================================================
  // 2. ЗВЁЗДНЫЙ ФОН
  // ============================================================
  (function stars() {
    const canvas = $('stars-canvas');
    const ctx = canvas.getContext('2d');
    let list = [];
    function resize() {
      canvas.width = innerWidth; canvas.height = innerHeight;
      list = Array.from({ length: 110 }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.3, a: Math.random(), s: Math.random() * 0.008 + 0.003,
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of list) {
        s.a += s.s; if (s.a > 1 || s.a < 0) s.s *= -1;
        ctx.fillStyle = `rgba(200,216,240,${s.a * 0.45})`;
        ctx.fillRect(s.x, s.y, s.r * 1.4, s.r * 1.4);
      }
      requestAnimationFrame(draw);
    }
    addEventListener('resize', resize);
    resize(); draw();
  })();

  // ============================================================
  // 3. ГЕККОН-СИСАДМИН — покадровая анимация реакций
  // ============================================================
  const FRAMES = ['front', 'arm', 'happy', 'happy2', 'sad0', 'sad', 'sad2', 'sad3'];
  FRAMES.forEach(f => { const i = new Image(); i.src = 'assets/img/admin-' + f + '.png'; });
  const SEQ = {
    happyIn: [['arm', 80], ['happy', 120]],
    happyLoop: [['happy2', 170], ['happy', 170]],
    sadIn: [['sad0', 160]],
    sadLoop: [['sad', 200], ['sad2', 200], ['sad3', 180], ['sad0', 260]],
  };
  let geckoTimer = null;
  function gecko(el, mood, holdMs) {
    clearTimeout(geckoTimer);
    const set = f => { el.src = 'assets/img/admin-' + f + '.png'; };
    if (mood === 'idle') { set('front'); return; }
    const intro = SEQ[mood + 'In'], loop = SEQ[mood + 'Loop'];
    const until = performance.now() + holdMs;
    let i = 0, inIntro = true;
    (function step() {
      const seq = inIntro ? intro : loop;
      if (!inIntro && performance.now() > until) { set('front'); return; }
      const f = seq[i];
      set(f[0]);
      i++;
      if (i >= seq.length) { i = 0; inIntro = false; }
      geckoTimer = setTimeout(step, f[1]);
    })();
  }
  function say(text, kind) {
    const b = $('game-bubble');
    b.innerHTML = text;
    b.className = 'bubble' + (kind ? ' ' + kind : '');
  }
  const TIPS = {
    same_subnet: ['Сравни адреса по маске: совпадают биты сети — значит, соседи.', 'Маска говорит, сколько бит адреса — номер сети.'],
    net_addr: ['Адрес сети — это IP, у которого все биты узла обнулены.', 'Найди блок, в который попадает адрес, — его начало и есть адрес сети.'],
    broadcast: ['Broadcast — последний адрес подсети: все биты узла — единицы.'],
    hosts: ['Посчитай биты узла: 32 минус префикс. И не забудь про два служебных адреса.'],
    mask: ['Префикс — это число единиц в маске подряд.', '255 — восемь единиц, 0 — восемь нулей.'],
    gateway: ['Шлюз должен быть в той же подсети, что и компьютер.'],
    private: ['Частных диапазонов всего три — вспомни их.', '«Серые» адреса не видны из интернета.'],
    fault: ['Проверь у каждого: своя ли подсеть, та ли маска, правильный ли шлюз.'],
    route: ['Роутер выбирает самый длинный подходящий префикс.', 'Если ничего не подошло — пакет уходит по маршруту 0.0.0.0/0.'],
    theory: ['Тут без вычислений — вспоминай теорию!'],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ============================================================
  // 4. ИКОНКИ — пиксельные устройства 12×12 в SVG
  // ============================================================
  const PAL = { a: '#6f8db0', b: '#22324d', c: '#1fb6d6', d: '#39ff14', w: '#e8eef8', y: '#f5d800', p: '#ff4d6d' };
  const ICONS = {
    pc:      ['aaaaaaaaaaaa', 'acccccccccca', 'acccccccccca', 'acccccccccca', 'acccccccccca', 'acccccccccca', 'aaaaaaaaaaaa', '.....bb.....', '.....bb.....', '...bbbbbb...'],
    laptop:  ['............', '..aaaaaaaa..', '..acccccca..', '..acccccca..', '..acccccca..', '..acccccca..', '..aaaaaaaa..', '.bbbbbbbbbb.', 'aaaaaaaaaaaa'],
    server:  ['..aaaaaaaa..', '..abbbbbba..', '..abddbbba..', '..aaaaaaaa..', '..abbbbbba..', '..abddbbba..', '..aaaaaaaa..', '..abbbbbba..', '..abddbbba..', '..aaaaaaaa..'],
    printer: ['...aaaaaa...', '...awwwwa...', '...awwwwa...', '.aaaaaaaaaa.', '.abbbbbbbba.', '.abbbbbbdba.', '.abbbbbbbba.', '.aaaaaaaaaa.', '...awwwwa...', '...aaaaaa...'],
    phone:   ['....aaaa....', '...abbbba...', '...acccca...', '...acccca...', '...acccca...', '...acccca...', '...acccca...', '...abddba...', '...aaaaaa...'],
    camera:  ['............', 'aaaaaaaa....', 'abbbbbbaaa..', 'abbaabbacca.', 'abaccabacca.', 'abaccabacca.', 'abbaabbaaa..', 'aaaaaaaa....', '...aa.......', '..aaaa......'],
    tv:      ['..a......a..', '...a....a...', 'aaaaaaaaaaaa', 'acccccccccca', 'acccccccccca', 'acccccccccca', 'acccccccccca', 'aaaaaaaaaaaa', '..bb....bb..'],
    router:  ['.d........d.', '.a........a.', '.a........a.', '.a........a.', 'aaaaaaaaaaaa', 'abbbbbbbbbba', 'abdbdbdbybba', 'abbbbbbbbbba', 'aaaaaaaaaaaa'],
    switch:  ['............', '............', 'aaaaaaaaaaaa', 'abbbbbbbbbba', 'acdcdcdcdcda', 'acacacacacaa', 'abbbbbbbbbba', 'aaaaaaaaaaaa'],
    cloud:   ['............', '....aaaa....', '...awwwwa...', '.aaawwwwaaa.', 'awwwwwwwwwwa', 'awwwwwwwwwwa', 'awwwwwwwwwwa', '.aaaaaaaaaa.'],
    packet:  ['............', 'aaaaaaaaaaaa', 'ayyyyyyyyyya', 'aayyyyyyyyaa', 'ayayyyyyyaya', 'ayyaayyaayya', 'ayyyyaayyyya', 'ayyyyyyyyyya', 'aaaaaaaaaaaa'],
    shield:  ['..aaaaaaaa..', '.apppppppppa', '.appwwwwppa.', '.appwppwppa.', '.apppwwppa..', '..apppppa...', '...apppa....', '....aaa.....'],
  };
  function icon(kind) {
    const rows = ICONS[kind] || ICONS.pc;
    let rects = '';
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = PAL[row[x]];
        if (c) rects += `<rect x="${x}" y="${y + (12 - rows.length)}" width="1" height="1" fill="${c}"/>`;
      }
    });
    return `<svg class="ico" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }
  const HEART = '<svg class="heart" viewBox="0 0 9 8" shape-rendering="crispEdges"><path fill="#ff4d6d" d="M1 0h2v1h1v1h1V1h1V0h2v1h1v3H8v1H7v1H6v1H5v1H4V7H3V6H2V5H1V4H0V1h1z"/><path fill="#ffb3c1" d="M1 1h1v1H1z"/></svg>';

  // ============================================================
  // 5. МЕНЮ И СТАРТ ПАРТИИ
  // ============================================================
  const screens = { menu: $('s-menu'), howto: $('s-howto'), game: $('s-game'), result: $('s-result') };
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
    if (name === 'howto') startHowto(); else stopHowto();
    document.body.classList.toggle('in-game', name === 'game');
    if (name === 'menu') refreshLeaderboard();
  }
  function refreshLeaderboard() {
    if (typeof renderLeaderboard === 'function') renderLeaderboard($('lb-network'), GAME_ID, 5);
  }

  let LEVELS = [];
  async function loadLevels() {
    try {
      const r = await fetch(API + '?action=levels', { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json();
      if (!d || !d.ok) throw new Error('bad');
      LEVELS = d.levels;
      renderLevels();
    } catch (e) {
      $('level-cards').innerHTML = '<div class="level-loading pixel-text">// не удалось загрузить игру — обнови страницу</div>';
    }
  }
  function renderLevels() {
    $('level-cards').innerHTML = LEVELS.map(l => `
      <button class="level-card" type="button" data-level="${l.id}" style="--c:${LEVEL_COLORS[l.id]}">
        <span class="lc-name">${esc(l.name)}</span>
      </button>`).join('');
  }
  $('level-cards').addEventListener('click', e => {
    const b = e.target.closest('[data-level]');
    if (b) startLevel(Number(b.dataset.level));
  });

  const TYPE_HELP = [
    ['СВОЙ ИЛИ ЧУЖОЙ', 'Отправь пакет устройству из своей подсети — или найди чужое.'],
    ['АДРЕС СЕТИ / BROADCAST', 'Первый и последний адрес подсети.'],
    ['СКОЛЬКО УЗЛОВ', 'Сколько устройств поместится в сеть /N.'],
    ['МАСКА', 'Перевести префикс /N в маску и обратно.'],
    ['ШЛЮЗ', 'Какой адрес можно поставить компьютеру шлюзом.'],
    ['ЧАСТНЫЙ ИЛИ ПУБЛИЧНЫЙ', '«Серые» и «белые» IP-адреса.'],
    ['НАЙДИ ПОЛОМКУ', 'У одного устройства неверный адрес, маска или шлюз.'],
    ['МАРШРУТИЗАЦИЯ', 'Куда роутер отправит пакет по своей таблице.'],
    ['ТЕОРИЯ', 'DNS, DHCP, NAT, порты, модель OSI.'],
  ];
  $('howto-types').innerHTML = TYPE_HELP.map(t => `<div class="howto-type"><b>${t[0]}</b>${t[1]}</div>`).join('');
  // ---------- анимация на экране «Как играть» ----------
  // Две сцены по кругу: клик по устройству своей подсети и выбор ответа клавишей.
  const HOWTO_CYCLE = 3600;
  const howtoImg = {};
  ['front', 'happy'].forEach(f => { const i = new Image(); i.src = 'assets/img/admin-' + f + '.png'; howtoImg[f] = i; });
  let howtoRaf = 0, howtoT0 = 0;
  function cvText(ctx, str, x, y, size, color, align) {
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }
  function cvIcon(ctx, kind, x, y, px) {
    const rows = ICONS[kind] || ICONS.pc;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const c = PAL[row[rx]];
        if (c) { ctx.fillStyle = c; ctx.fillRect(x + rx * px, y + (ry + 12 - rows.length) * px, px, px); }
      }
    });
  }
  function cvBox(ctx, x, y, w, h, border, fill) {
    ctx.fillStyle = fill || '#0d1626'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  function cvGecko(ctx, happy, x, y, w) {
    const img = howtoImg[happy ? 'happy' : 'front'];
    if (img.complete && img.naturalWidth) ctx.drawImage(img, x, y, w, w * 232 / 210);
  }
  function drawHowto(now) {
    const cv = $('howto-pic');
    // холст в 2 раза крупнее логических 480×170 — пиксельный шрифт остаётся чётким
    const ctx = cv.getContext('2d'), W = 480, H = 170;
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#080c14'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(26,58,107,0.35)';
    for (let x = 0; x < W; x += 20) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 20) ctx.fillRect(0, y, W, 1);
    const t = now - howtoT0;
    const scene = Math.floor(t / HOWTO_CYCLE) % 2;
    const k = (t % HOWTO_CYCLE) / HOWTO_CYCLE;
    const ease = v => v < 0 ? 0 : v > 1 ? 1 : v * v * (3 - 2 * v);

    if (scene === 0) {
      // Сцена 1: отправитель, три устройства, курсор кликает «своего», пакет летит
      cvBox(ctx, 14, 60, 128, 50, '#b24bff');
      cvIcon(ctx, 'pc', 22, 70, 2.5);
      cvText(ctx, 'ОТПРАВИТЕЛЬ', 56, 74, 6, '#c8d8f0');
      cvText(ctx, '192.168.1.10', 56, 87, 6, '#ffffff');
      cvText(ctx, '/24', 56, 99, 6, '#00e5ff');
      const devs = [['192.168.1.25', 'laptop'], ['192.168.2.7', 'server'], ['10.0.0.5', 'phone']];
      const clicked = k > 0.32, done = k > 0.62;
      devs.forEach((d, i) => {
        const y = 6 + i * 50;
        ctx.strokeStyle = (done && i === 0) ? '#39ff14' : (clicked && i === 0 ? '#00e5ff' : '#2a5fbf');
        ctx.setLineDash(done && i === 0 ? [] : [5, 5]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(142, 85); ctx.lineTo(318, y + 21); ctx.stroke();
        ctx.setLineDash([]);
        const border = i === 0 ? (done ? '#39ff14' : clicked ? '#00e5ff' : '#2a5fbf') : '#2a5fbf';
        cvBox(ctx, 318, y, 148, 42, border);
        cvIcon(ctx, d[1], 326, y + 6, 2.5);
        cvText(ctx, d[0], 362, y + 21, 6, '#ffffff');
      });
      // пакет
      if (k > 0.32 && k < 0.62) {
        const p = ease((k - 0.32) / 0.3);
        const px = 142 + (318 - 142) * p, py = 85 + (27 - 85) * p;
        ctx.fillStyle = '#f5d800'; ctx.fillRect(px - 5, py - 5, 10, 10);
      }
      if (done) cvText(ctx, '+45', 236, 46 - 16 * ease((k - 0.62) / 0.3), 8, '#39ff14', 'center');
      // курсор
      const cx = 250 + (390 - 250) * ease(k / 0.3), cy = 150 + (27 - 150) * ease(k / 0.3);
      if (k < 0.62) {
        ctx.fillStyle = '#ffffff';
        [[0,0,2,12],[2,2,2,8],[4,4,2,6],[6,6,2,4],[8,8,2,2]].forEach(r => ctx.fillRect(cx + r[0], cy + r[1], r[2], r[3]));
        if (k > 0.3 && k < 0.4) { ctx.strokeStyle = '#00e5ff'; ctx.strokeRect(cx - 8, cy - 8, 16, 16); }
      }
      cvGecko(ctx, done, 156, 112, 46);
      cvText(ctx, 'КЛИКНИ УСТРОЙСТВО ИЗ СВОЕЙ ПОДСЕТИ', 240, 161, 7, '#8fb0d8', 'center');
    } else {
      // Сцена 2: вопрос с вариантами, ответ клавишей
      cvText(ctx, 'АДРЕС СЕТИ ДЛЯ 10.0.5.77/24?', 16, 18, 8, '#ffffff');
      const opts = ['10.0.5.255', '10.0.0.0', '10.0.5.0', '10.0.5.77'];
      const pressed = k > 0.38, done = k > 0.5;
      opts.forEach((o, i) => {
        const x = 16 + (i % 2) * 204, y = 36 + Math.floor(i / 2) * 50;
        let border = '#2a5fbf';
        if (i === 2 && pressed) border = done ? '#39ff14' : '#00e5ff';
        cvBox(ctx, x, y, 194, 40, border, (i === 2 && pressed && !done) ? '#13284a' : null);
        cvBox(ctx, x + 8, y + 9, 22, 22, border);
        cvText(ctx, String(i + 1), x + 19, y + 21, 7, i === 2 && pressed ? '#ffffff' : '#5a7a9a', 'center');
        cvText(ctx, o, x + 40, y + 21, 7, '#ffffff');
      });
      // «нажатая» клавиша 3
      const keyDown = k > 0.3 && k < 0.42;
      cvBox(ctx, 16, 140 + (keyDown ? 2 : 0), 26, 24, keyDown ? '#00e5ff' : '#2a5fbf', '#111e35');
      cvText(ctx, '3', 29, 152 + (keyDown ? 2 : 0), 8, keyDown ? '#00e5ff' : '#c8d8f0', 'center');
      cvText(ctx, 'ИЛИ ЖМИ 1-4 НА КЛАВИАТУРЕ', 52, 152, 7, '#8fb0d8');
      if (done) cvText(ctx, '+45', 330, 150 - 14 * ease((k - 0.5) / 0.3), 8, '#39ff14', 'center');
      cvGecko(ctx, done, 422, 40, 50);
    }
    howtoRaf = requestAnimationFrame(drawHowto);
  }
  function startHowto() {
    cancelAnimationFrame(howtoRaf);
    // На телефоне холст скрыт (mobile.css) — анимацию не крутим вовсе
    if (!$('howto-pic').offsetWidth) return;
    howtoT0 = performance.now(); howtoRaf = requestAnimationFrame(drawHowto);
  }
  function stopHowto() { cancelAnimationFrame(howtoRaf); }

  $('btn-howto').addEventListener('click', () => { sfx.click(); show('howto'); });
  $('btn-howto-back').addEventListener('click', () => { sfx.click(); show('menu'); });

  let run = null;
  let starting = false;

  async function api(action, extra) {
    const res = await fetch(API, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action, run_id: run.cred.run_id, run_token: run.cred.run_token }, extra || {})),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* не JSON */ }
    if (!res.ok || !data || data.ok !== true) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }
  async function apiRetry(action, extra) {
    try { return await api(action, extra); }
    catch (e) { await sleep(700); return api(action, extra); }
  }

  async function startLevel(level) {
    if (starting) return;
    if (typeof pingGame !== 'function') { alert('Не загрузился модуль сайта. Обнови страницу.'); return; }
    starting = true;
    sfx.click();
    try {
      // Подписанный ран — как у всех игр сайта (js/leaderboard.js, api/ping-game.php)
      await pingGame(GAME_ID);
      const cred = JSON.parse(sessionStorage.getItem('gc_run_' + GAME_ID) || 'null');
      if (!cred || !cred.run_id) throw new Error('Не удалось начать партию');
      run = { cred };
      const st = await api('start', { level });
      Object.assign(run, {
        level, name: st.name, total: st.total, lives: st.lives, maxLives: st.lives,
        score: 0, streak: 0, best: 0, right: 0, wrong: 0, hints: 0,
        task: null, locked: true, mistakes: [], finished: false, won: false,
      });
    } catch (e) {
      run = null;
      starting = false;
      alert('Не получилось начать игру: ' + e.message);
      return;
    }
    starting = false;
    document.documentElement.style.setProperty('--lvl', LEVEL_COLORS[level]);
    $('h-level').textContent = run.name;
    updateHud();
    show('game');
    gecko($('game-admin'), 'idle');
    say('Поехали! ' + pick(['Я на связи.', 'Пакеты уже в очереди.', 'Сеть на тебе.']));
    nextTask();
  }

  function updateHud() {
    $('h-score').textContent = run.score;
    $('h-task').textContent = Math.min(run.total, (run.task ? run.task.index + 1 : 1)) + '/' + run.total;
    $('h-progress').style.width = ((run.task ? run.task.index : 0) / run.total * 100) + '%';
    const st = $('h-streak');
    st.textContent = run.streak > 1 ? 'x' + run.streak : run.streak;
    st.classList.toggle('hot', run.streak >= 3);
    $('h-hearts').innerHTML = Array.from({ length: run.maxLives }, (_, i) =>
      HEART.replace('class="heart"', `class="heart${i < run.lives ? '' : ' lost'}"`)).join('');
  }

  // ============================================================
  // 6. ОТРИСОВКА ЗАДАНИЙ
  // ============================================================
  let links = [];          // пары [откуда, куда] для линий схемы
  let source = null;       // откуда летит пакет
  let targets = [];        // элементы-варианты по индексу

  async function nextTask() {
    $('btn-next').classList.add('hidden');
    clearTimeout(autoNext);
    let task;
    try { task = await apiRetry('next'); }
    catch (e) { say('Связь с сервером пропала: ' + esc(e.message) + '. Обнови страницу.', 'bad'); return; }
    run.task = task;
    run.hinted = !!task.hint;
    renderTask(task);
    updateHud();
    run.locked = false;
    startTimer(task.time);
  }

  function renderTask(t) {
    $('task-label').textContent = t.label;
    $('task-text').textContent = t.text;
    $('task-hintmark').classList.toggle('hidden', !run.hinted);
    $('task-chips').innerHTML = ((t.data && t.data.chips) || [])
      .map(c => `<span class="chip"><i>${esc(c.label)}</i>${esc(c.value)}</span>`).join('');
    $('btn-calc').disabled = !t.calc;
    calcShow(false);
    if (t.calc) renderCalc(t.calc);
    say(pick(TIPS[t.type] || ['Не торопись — но и не спи.']));
    gecko($('game-admin'), 'idle');

    const body = $('arena-body');
    links = []; source = null; targets = [];
    if (t.type === 'same_subnet') body.innerHTML = viewSubnet(t);
    else if (t.type === 'fault') body.innerHTML = viewFault(t);
    else if (t.type === 'route') body.innerHTML = viewRoute(t);
    else body.innerHTML = viewOptions(t);

    targets = Array.from(body.querySelectorAll('[data-i]')).sort((a, b) => a.dataset.i - b.dataset.i);
    source = body.querySelector('[data-src]');
    if (source) targets.forEach(el => links.push([source, el]));
    requestAnimationFrame(drawLines);
  }

  function nodeBtn(i, kind, name, ipHtml, sub) {
    return `<button class="node" type="button" data-i="${i}">
      <span class="key">${i + 1}</span>${icon(kind)}
      <span><span class="nm">${esc(name)}</span><span class="ip">${ipHtml}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span>
    </button>`;
  }

  function viewSubnet(t) {
    const s = t.data.sender;
    return `<div class="map-subnet">
      <div class="col-src"><div class="node src" data-src>${icon('pc')}
        <span><span class="nm">Отправитель</span><span class="ip">${esc(s.ip)}/${s.prefix}</span><span class="sub">маска ${esc(s.mask)}</span></span>
      </div></div>
      <div class="col-dev">${t.data.devices.map((d, i) => nodeBtn(i, d.kind, d.name, esc(d.ip))).join('')}</div>
    </div>`;
  }

  function viewFault(t) {
    const o = t.data.office;
    return `<div class="map-fault">
      <div class="row-top"><div class="node router" data-src><span class="head">${icon('switch')}
        <span><span class="nm">Коммутатор офиса</span><span class="ip">${esc(o.net)}</span><span class="sub">шлюз ${esc(o.gw)}</span></span></span>
      </div></div>
      <div class="row-dev">${t.data.devices.map((d, i) => `
        <button class="node" type="button" data-i="${i}">
          <span class="key">${i + 1}</span>
          <span class="head">${icon(d.kind)}<span class="nm">${esc(d.name)}</span></span>
          <span class="cfg"><i>IP</i> ${esc(d.ip)}/${d.prefix}<br><i>ШЛЮЗ</i> ${esc(d.gw)}</span>
          <span class="fix">ВОТ ЗДЕСЬ ОШИБКА</span>
        </button>`).join('')}</div>
    </div>`;
  }

  function viewRoute(t) {
    const kindFor = label => label === 'Интернет' ? 'cloud' : label === 'VPN' ? 'shield' : 'switch';
    return `<div class="map-route">
      <div class="col-pkt"><div class="node src">${icon('packet')}
        <span><span class="nm">Пакет для</span><span class="ip">${esc(t.data.dest)}</span></span></div></div>
      <div class="col-rt"><div class="node router" data-src>
        <span class="head">${icon('router')}<span class="nm">Таблица маршрутизации</span></span>
        <table class="rtable"><thead><tr><th>СЕТЬ НАЗНАЧЕНИЯ</th><th>ИНТЕРФЕЙС</th></tr></thead>
        <tbody>${t.data.table.map((r, i) => `<tr data-row="${i}"><td>${esc(r.dest)}</td><td>${esc(r.iface)}</td></tr>`).join('')}</tbody></table>
      </div></div>
      <div class="col-dev">${t.data.table.map((r, i) => nodeBtn(i, kindFor(r.label), r.label, esc(r.iface))).join('')}</div>
    </div>`;
  }

  function viewOptions(t) {
    const mono = t.options.every(o => /^[\d./ ]+$/.test(o));
    return `<div class="opts">${t.options.map((o, i) =>
      `<button class="opt${mono ? ' mono' : ''}" type="button" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(o)}</span></button>`
    ).join('')}</div>`;
  }

  function center(el) {
    const a = $('arena').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
  }
  function drawLines() {
    const svg = $('arena-lines');
    svg.innerHTML = links.map(([from, to], k) => {
      const p = center(from), q = center(to);
      return `<line data-k="${k}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`;
    }).join('');
  }
  function lineTo(i) { return $('arena-lines').querySelector(`line[data-k="${i}"]`); }
  addEventListener('resize', () => { if (links.length) drawLines(); });
  // Калькулятор и реплики меняют высоту низа — схема сдвигается, линии перерисовываем
  if (window.ResizeObserver) new ResizeObserver(() => { if (links.length) drawLines(); }).observe($('arena'));

  function flyPacket(i) {
    const p = $('packet');
    if (!source || !targets[i]) return Promise.resolve();
    const a = center(source), b = center(targets[i]);
    p.classList.remove('fly');
    p.style.transform = `translate(${a.x}px, ${a.y}px)`;
    void p.offsetWidth;
    p.classList.add('fly');
    p.style.transform = `translate(${b.x}px, ${b.y}px)`;
    sfx.send();
    return sleep(560).then(() => { p.classList.remove('fly'); p.style.opacity = ''; });
  }

  // ============================================================
  // 7. ОТВЕТ, ТАЙМЕР, ПОДСКАЗКА
  // ============================================================
  let timerRaf = 0, timerEnd = 0, timerLimit = 1, lastTick = -1;
  function startTimer(sec) {
    cancelAnimationFrame(timerRaf);
    timerLimit = sec * 1000;
    timerEnd = performance.now() + timerLimit;
    lastTick = -1;
    const fill = $('timer-fill'), box = fill.parentElement, txt = $('timer-text');
    (function frame() {
      const left = Math.max(0, timerEnd - performance.now());
      fill.style.transform = `scaleX(${left / timerLimit})`;
      const s = Math.ceil(left / 1000);
      txt.textContent = s;
      box.classList.toggle('warn', left < timerLimit * 0.5 && left >= 5000);
      box.classList.toggle('crit', left < 5000);
      if (left < 5000 && s !== lastTick && s > 0) { lastTick = s; sfx.tick(); }
      if (left <= 0) { choose(-1); return; }
      timerRaf = requestAnimationFrame(frame);
    })();
  }
  function stopTimer() { cancelAnimationFrame(timerRaf); }

  $('arena-body').addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (b && !b.disabled) choose(Number(b.dataset.i));
  });

  let autoNext = 0;
  async function choose(i) {
    if (!run || run.locked || !run.task) return;
    run.locked = true;
    stopTimer();
    const t = run.task;
    targets.forEach(el => { el.disabled = true; });
    if (i >= 0) { sfx.click(); const ln = lineTo(i); if (ln) ln.classList.add('hot'); }

    const fly = (i >= 0 && source) ? flyPacket(i) : sleep(i >= 0 ? 150 : 0);
    let res;
    try {
      [res] = await Promise.all([apiRetry('answer', { index: t.index, choice: i }), fly]);
    } catch (e) {
      say('Сервер не принял ответ: ' + esc(e.message) + '. Обнови страницу.', 'bad');
      return;
    }
    showResult(t, i, res);
  }

  function showResult(t, i, res) {
    calcShow(false);
    Object.assign(run, { score: res.score, lives: res.lives, streak: res.streak, finished: res.finished, won: res.won });
    run.best = Math.max(run.best, res.streak);
    if (res.correct) run.right++; else run.wrong++;

    targets.forEach((el, k) => {
      if (k === res.right) el.classList.add('right');
      else if (k === i) el.classList.add('wrong');
      else el.classList.add('dim');
    });
    const good = lineTo(res.right); if (good) good.setAttribute('class', 'good');
    if (i >= 0 && i !== res.right) { const bad = lineTo(i); if (bad) bad.setAttribute('class', 'bad'); }
    if (t.type === 'route') markRoutes(t);

    if (res.correct) {
      sfx.right();
      toast(res.points > 0 ? '+' + res.points + (res.hinted ? ' (1/2)' : '') : (res.late ? 'ВЕРНО, НО ПОЗДНО: 0' : 'ВЕРНО'), res.points > 0 ? '' : 'gold');
      if (res.combo > 0 && res.streak >= 3 && [3, 6, 9].includes(res.streak)) toast('СЕРИЯ ×' + res.streak + '!', 'gold');
      gecko($('game-admin'), 'happy', 1800);
      say('<b>' + pick(['Верно!', 'Точно!', 'Отлично!', 'Так держать!']) + '</b> ' + esc(res.explain), 'good');
    } else {
      sfx.wrong();
      toast(i < 0 ? 'ВРЕМЯ ВЫШЛО: -1 ЖИЗНЬ' : 'МИМО: -1 ЖИЗНЬ', 'bad');
      gecko($('game-admin'), 'sad', 2400);
      say('<b>' + (i < 0 ? 'Время вышло.' : 'Не то.') + '</b> ' + esc(res.explain), 'bad');
      run.mistakes.push({
        label: t.label, text: t.text, yours: i >= 0 ? t.options[i] : 'не успел', right: res.right_text, explain: res.explain,
      });
    }
    updateHud();
    $('h-progress').style.width = ((t.index + 1) / run.total * 100) + '%';

    const btn = $('btn-next');
    btn.textContent = res.finished ? 'ИТОГИ >' : 'ДАЛЕЕ >';
    btn.classList.remove('hidden');
    btn.focus({ preventScroll: true });
    // Верный ответ — дальше сами через пару секунд, ошибку — даём дочитать
    if (res.correct) autoNext = setTimeout(goNext, res.finished ? 2200 : 3600);
  }

  function goNext() {
    clearTimeout(autoNext);
    if (!run || !run.locked) return;
    $('btn-next').classList.add('hidden');
    if (run.finished) endGame();
    else nextTask();
  }
  $('btn-next').addEventListener('click', () => { sfx.click(); goNext(); });

  // Подсветка строк таблицы, подходящих под адрес получателя
  function ipInt(s) { return s.split('.').reduce((a, o) => (a * 256 + Number(o)), 0); }
  function sameNet(a, b, p) { if (p === 0) return true; const m = Math.pow(2, 32 - p); return Math.floor(a / m) === Math.floor(b / m); }
  function markRoutes(t) {
    const dest = ipInt(t.data.dest);
    t.data.table.forEach((r, k) => {
      const [net, p] = r.dest.split('/');
      const row = $('arena-body').querySelector(`tr[data-row="${k}"]`);
      if (row && sameNet(dest, ipInt(net), Number(p))) row.classList.add('match');
    });
  }

  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  // ---------- калькулятор-подсказка ----------
  function bits(ip) { return ip.split('.').map(o => Number(o).toString(2).padStart(8, '0')).join(''); }
  function renderCalc(rows) {
    $('calc-rows').innerHTML = rows.map(r => {
      const b = bits(r.ip);
      let html = '';
      for (let k = 0; k < 32; k++) {
        if (k && k % 8 === 0) html += '<span class="calc-sep">.</span>';
        const cls = r.prefix > 0 ? (k < r.prefix ? 'net' : 'host') : '';
        html += `<span class="bit ${cls}">${b[k]}</span>`;
      }
      return `<div class="calc-row"><span class="lbl">${esc(r.label)}<span class="dec">${esc(r.ip)}${r.prefix > 0 ? '/' + r.prefix : ''}</span></span><span class="bin">${html}</span></div>`;
    }).join('');
  }
  function calcShow(on) {
    $('calc').classList.toggle('hidden', !on);
    document.querySelector('.admin-box').classList.toggle('calc-open', on);
  }
  async function openCalc() {
    if (!run || !run.task || !run.task.calc) return;
    if (!run.hinted) {
      if (run.locked) return;
      try { await api('hint', { index: run.task.index }); }
      catch (e) { toast('Калькулятор недоступен', 'bad'); return; }
      run.hinted = true; run.hints++;
      $('task-hintmark').classList.remove('hidden');
      sfx.hint();
    }
    calcShow(true);
  }
  $('btn-calc').addEventListener('click', () => {
    if ($('calc').classList.contains('hidden')) openCalc(); else calcShow(false);
  });
  $('calc-close').addEventListener('click', () => calcShow(false));

  // ============================================================
  // 8. КОНЕЦ ПАРТИИ И РАЗБОР ОШИБОК
  // ============================================================
  async function endGame() {
    stopTimer();
    calcShow(false);
    const won = run.won;
    won ? sfx.win() : sfx.lose();
    const box = $('res-title');
    box.textContent = won ? 'УРОВЕНЬ ПРОЙДЕН!' : 'СЕТЬ УПАЛА';
    box.classList.toggle('lose', !won);
    $('res-admin').src = 'assets/img/admin-' + (won ? 'happy' : 'sad') + '.png';
    $('res-sub').innerHTML = esc(run.name) + (won && run.level < 3 ? ' · можно на следующий уровень' : '');
    const answered = run.right + run.wrong;
    const acc = answered ? Math.round(run.right / answered * 100) : 0;
    const stats = [
      ['ОЧКИ', run.score, 'big'], ['ВЕРНО', run.right], ['ОШИБКИ', run.wrong], ['ТОЧНОСТЬ', acc + '%'],
      ['ЛУЧШАЯ СЕРИЯ', run.best], ['ПОДСКАЗКИ', run.hints],
    ];
    $('res-stats').innerHTML = stats.map(s => `<div class="rs ${s[2] || ''}"><div class="n">${s[1]}</div><div class="l">${s[0]}</div></div>`).join('');
    $('res-review').innerHTML = run.mistakes.length
      ? '<h3 class="pixel-text">// РАЗБОР ОШИБОК</h3>' + run.mistakes.map(m => `
        <div class="rv"><span class="t">${esc(m.label)}</span><span class="q">${esc(m.text)}</span>
          <span class="a">Твой ответ: <span class="yours">${esc(m.yours)}</span> · верно: <span class="right">${esc(m.right)}</span></span>
          <span class="e">${esc(m.explain)}</span></div>`).join('')
      : '<div class="review-ok">Ни одной ошибки — сеть работает как часы!</div>';
    $('btn-nextlvl').classList.toggle('hidden', !(won && run.level < 3));
    $('res-saved').textContent = 'Сохраняю результат...';
    show('result');

    const data = typeof submitScore === 'function' ? await submitScore(GAME_ID, {}).catch(() => null) : null;
    if (!data) $('res-saved').textContent = 'Результат не сохранился — проверь соединение.';
    else if (data.pending) $('res-saved').textContent = 'Войди или зарегистрируйся, чтобы результат попал в таблицу лидеров.';
    else $('res-saved').textContent = 'Результат сохранён' + (data.is_record ? ' · всего в игре: ' + data.total_game_score : '') + '.';
  }
  $('btn-again').addEventListener('click', () => run && startLevel(run.level));
  $('btn-nextlvl').addEventListener('click', () => run && startLevel(Math.min(3, run.level + 1)));
  $('btn-res-menu').addEventListener('click', () => { sfx.click(); show('menu'); });

  function leaveGame() {
    if (!run || run.finished) { show('menu'); return; }
    if (!confirm('Выйти в меню? Эта партия не сохранится.')) return;
    stopTimer(); clearTimeout(autoNext);
    run = null;
    calcShow(false);
    show('menu');
  }
  $('btn-esc').addEventListener('click', leaveGame);

  // ============================================================
  // 9. КЛАВИШИ И ЗАПУСК
  // ============================================================
  addEventListener('keydown', e => {
    if (!screens.game.classList.contains('active') || !run) {
      if (e.key === 'Escape' && screens.howto.classList.contains('active')) show('menu');
      return;
    }
    if (e.key >= '1' && e.key <= '4' && !run.locked) { e.preventDefault(); choose(Number(e.key) - 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && !$('btn-next').classList.contains('hidden')) { e.preventDefault(); goNext(); }
    else if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
      if ($('calc').classList.contains('hidden')) openCalc(); else calcShow(false);
    }
    else if (e.key === 'Escape') {
      if (!$('calc').classList.contains('hidden')) calcShow(false); else leaveGame();
    }
  });

  // Для автотестов: состояние партии (ответов в нём нет — их знает только сервер)
  window.__net = { get run() { return run; } };

  loadLevels();
  refreshLeaderboard();
})();
