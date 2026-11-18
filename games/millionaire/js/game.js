/* ============================================================
   КТО ХОЧЕТ СТАТЬ ПРОГРАММИСТОМ — Python и C++
   15 вопросов, лестница очков, 2 несгораемые суммы, 4 подсказки.
   Партию ведёт сервер (api/millionaire.php): браузер получает вопрос
   без ответа, отправляет выбор и только тогда узнаёт верный вариант.
   Подсказки тоже считает сервер — иначе 50:50 выдавал бы ответ.

   1. Звук             6. Вопрос и таймер
   2. Звёздный фон     7. Ответ и подтверждение
   3. Пиксельные иконки 8. Подсказки
   4. Данные и сервер  9. Пояснение, выход, итог
   5. Меню и «Как играть»
   ============================================================ */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pad2 = n => String(n).padStart(2, '0');
  const LETTERS = ['A', 'B', 'C', 'D'];

  // ============================================================
  // 1. ЗВУК — 8-битные «пики» без файлов, выключатель как в других играх
  // ============================================================
  let audioCtx = null;
  let soundOn = true;
  try { soundOn = localStorage.getItem('gc_millionaire_sound') !== '0'; } catch (e) { /* приватный режим */ }

  function beep(freq, dur, shape = 'square', vol = 0.12, delay = 0) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
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
    click:   () => beep(440, 0.04, 'square', 0.07),
    pick:    () => { beep(660, 0.05, 'square', 0.08); beep(880, 0.07, 'square', 0.07, 0.06); },
    think:   () => [330, 392, 494, 392].forEach((n, i) => beep(n, 0.07, 'sine', 0.1, i * 0.22)),
    right:   () => [523, 659, 784, 1047].forEach((n, i) => beep(n, 0.1, 'square', 0.11, i * 0.08)),
    safe:    () => [784, 880, 1047, 1319].forEach((n, i) => beep(n, 0.13, 'sine', 0.13, i * 0.1)),
    win:     () => [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((n, i) => beep(n, 0.12, 'square', 0.11, i * 0.11)),
    wrong:   () => { beep(220, 0.1, 'sawtooth', 0.12); beep(150, 0.22, 'sawtooth', 0.12, 0.11); },
    saved:   () => { beep(300, 0.06, 'square', 0.09); beep(600, 0.08, 'sine', 0.1, 0.08); beep(900, 0.1, 'sine', 0.09, 0.17); },
    lose:    () => [300, 250, 200, 150].forEach((n, i) => beep(n, 0.15, 'sawtooth', 0.12, i * 0.12)),
    hint:    () => { beep(880, 0.05, 'sine', 0.12); beep(1100, 0.08, 'sine', 0.1, 0.06); },
    tick:    (hi) => beep(hi ? 1200 : 900, 0.03, 'square', 0.05),
    timeout: () => { beep(400, 0.12, 'square', 0.1); beep(300, 0.12, 'square', 0.1, 0.13); beep(200, 0.25, 'square', 0.1, 0.26); },
  };
  function renderSoundBtn() { $('btn-sound').textContent = soundOn ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ'; }
  $('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('gc_millionaire_sound', soundOn ? '1' : '0'); } catch (e) { /* ок */ }
    renderSoundBtn(); sfx.click();
  });
  renderSoundBtn();

  // ============================================================
  // 2. ЗВЁЗДНЫЙ ФОН — тот же, что в «Сетевом маршруте»
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
  // 3. ПИКСЕЛЬНЫЕ ИКОНКИ — вместо эмодзи, чтобы всё было в одном стиле
  // ============================================================
  const PIX = {
    shield: ['XXXXXXXXX', 'X.......X', 'X..XXX..X', 'X..XXX..X', 'X.......X', '.X.....X.', '..X...X..', '...X.X...', '....X....'],
    bolt:   ['.....XXX', '....XXX.', '...XXX..', '..XXX...', '.XXXXXXX', 'XXXXXXX.', '...XXX..', '..XXX...', '.XXX....', 'XXX.....'],
    crowd:  ['XX...XX...XX', 'XX...XX...XX', '............', 'XXX.XXXX.XXX', 'XXX.XXXX.XXX', 'XXX.XXXX.XXX'],
    swap:   ['......X...', '......XX..', 'XXXXXXXXX.', '......XX..', '......X...', '...X......', '..XX......', '.XXXXXXXXX', '..XX......', '...X......'],
    lock:   ['..XXXX..', '.X....X.', '.X....X.', 'XXXXXXXX', 'XXXXXXXX', 'XXX..XXX', 'XXX..XXX', 'XXXXXXXX'],
    check:  ['........X', '.......XX', 'X.....XX.', 'XX...XX..', '.XX.XX...', '..XXX....', '...X.....'],
    cross:  ['XX...XX', 'XXX.XXX', '.XXXXX.', '..XXX..', '.XXXXX.', 'XXX.XXX', 'XX...XX'],
    trophy: ['XXXXXXXXXX', 'X.XXXXXX.X', 'X.XXXXXX.X', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....', '....XX....', '..XXXXXX..', '..XXXXXX..'],
    clock:  ['..XXXXX..', '.X.....X.', 'X...X...X', 'X...X...X', 'X...XXX.X', 'X.......X', 'X.......X', '.X.....X.', '..XXXXX..'],
    door:   ['XXXXXXX', 'X.....X', 'X.....X', 'X...X.X', 'X.....X', 'X.....X', 'XXXXXXX'],
  };
  // SVG из «картинки» строками; соседние пиксели склеиваются в полоски
  function pix(name, color, cls = 'px-ico') {
    const rows = PIX[name];
    const w = rows[0].length, h = rows.length;
    let rects = '';
    rows.forEach((row, y) => {
      for (let x = 0; x < w; x++) {
        if (row[x] !== 'X') continue;
        let x2 = x; while (x2 + 1 < w && row[x2 + 1] === 'X') x2++;
        rects += `<rect x="${x}" y="${y}" width="${x2 - x + 1}" height="1"/>`;
        x = x2;
      }
    });
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" fill="${color}" aria-hidden="true">${rects}</svg>`;
  }
  function pixOnCanvas(ctx, name, x, y, size, color) {
    ctx.fillStyle = color;
    PIX[name].forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'X') ctx.fillRect(x + i * size, y + j * size, size, size); });
  }

  // ============================================================
  // 4. ДАННЫЕ И СВЯЗЬ С СЕРВЕРОМ
  // ============================================================
  const TOTAL = 15;
  const QUESTION_SEC = 60;
  const PRIZES = [1, 2, 3, 5, 10, 20, 40, 80, 160, 320, 400, 500, 650, 800, 1000];
  const SAFE = { 5: 10, 10: 320 };              // после 5-го и 10-го вопроса
  const isSafe = q => q in SAFE;
  const safeFor = correct => correct >= 10 ? 320 : correct >= 5 ? 10 : 0;   // как mil_score на сервере

  const HINTS = [
    { id: 'immunity', name: 'ПРАВО НА ОШИБКУ', short: 'ОШИБКА', icon: 'shield', color: '#00e5ff', desc: 'Одна неверная попытка не считается — вариант уберётся' },
    { id: 'fifty',    name: '50:50',           short: '50:50',  icon: 'bolt',   color: '#f5d800', desc: 'Убирает два неверных ответа' },
    { id: 'audience', name: 'ПОМОЩЬ ЗАЛА',     short: 'ЗАЛ',    icon: 'crowd',  color: '#39ff14', desc: 'Показывает, как проголосовал зал' },
    { id: 'swap',     name: 'ЗАМЕНА ВОПРОСА',  short: 'ЗАМЕНА', icon: 'swap',   color: '#b24bff', desc: 'Новый вопрос той же сложности' },
  ];

  const API = '../../api/millionaire.php';
  let run = null;   // { run_id, run_token } — выдаёт api/ping-game.php

  async function api(action, extra) {
    if (!run) throw new Error('Партия не начата');
    const res = await fetch(API, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action, run_id: run.run_id, run_token: run.run_token }, extra || {})),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* не JSON */ }
    if (!res.ok || !data || data.ok !== true) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }
  // Одна повторная попытка — для запросов, которые безопасно повторить
  async function apiRetry(action, extra) {
    try { return await api(action, extra); }
    catch (e) { await sleep(700); return api(action, extra); }
  }

  // ============================================================
  // ЭКРАНЫ И ТОСТЫ
  // ============================================================
  let screen = 'menu';
  function show(name) {
    screen = name;
    ['menu', 'howto', 'game', 'result'].forEach(s => $('s-' + s).classList.toggle('active', s === name));
    document.body.classList.toggle('in-game', name === 'game');
    if (name === 'howto') startHowto(); else stopHowto();
  }

  function toast(msg, type = 'cyan', ms = 2600) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.style.setProperty('--life', (ms / 1000) + 's');
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), ms + 450);
  }

  // Пиксели разлетаются из элемента (верный ответ — вверх, ошибка — во все стороны)
  function sparks(el, colors, n = 26, up = false) {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'px-particle';
      const x = r.left + Math.random() * r.width, y = r.top + Math.random() * r.height;
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 70;
      p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;animation-delay:${Math.random() * 0.12}s`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 950);
    }
  }
  function floatText(el, text) {
    const r = el.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'burst pixel-text';
    b.textContent = text;
    b.style.left = (r.left + r.width / 2) + 'px';
    b.style.top = (r.top - 6) + 'px';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 900);
  }

  // ============================================================
  // 5. МЕНЮ И «КАК ИГРАТЬ»
  // ============================================================
  function buildHowto() {
    $('howto-hints').innerHTML = HINTS.map(h =>
      `<div class="howto-hint" style="--c:${h.color}">${pix(h.icon, h.color)}<div><b>${h.name}</b><span>${h.desc}.</span></div></div>`
    ).join('');
    $('howto-ladder').innerHTML = PRIZES.map((p, i) => {
      const q = i + 1;
      const cls = q === TOTAL ? 'top' : isSafe(q) ? 'safe' : '';
      return `<div class="hl-cell ${cls}"><span>${pad2(q)}</span><b>${p}</b></div>`;
    }).join('');
  }

  // Анимация в «Как играть»: ответ с подтверждением, 50:50, таймер
  const HT = { raf: 0, t0: 0 };
  const HOWTO_SCENE = 4600;
  function startHowto() { stopHowto(); HT.t0 = performance.now(); HT.raf = requestAnimationFrame(drawHowto); }
  function stopHowto() { cancelAnimationFrame(HT.raf); HT.raf = 0; }

  function drawHowto(now) {
    const cv = $('howto-pic'), ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const el = now - HT.t0, scene = Math.floor(el / HOWTO_SCENE) % 3, k = (el % HOWTO_SCENE) / HOWTO_SCENE;
    const F = s => `${s}px "Press Start 2P", monospace`;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080c14'; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'middle';

    // вопрос
    const qx = 30, qy = 44, qw = 640;
    ctx.fillStyle = '#0d1626'; ctx.fillRect(qx, qy, qw, 70);
    ctx.strokeStyle = '#2a5fbf'; ctx.lineWidth = 2; ctx.strokeRect(qx, qy, qw, 70);
    ctx.font = F(9); ctx.fillStyle = '#f5d800'; ctx.textAlign = 'left';
    ctx.fillText('■ question_07.py', qx + 14, qy + 16);
    ctx.font = F(13); ctx.fillStyle = '#fff';
    ctx.fillText('Что выведет print(2 ** 3)?', qx + 14, qy + 48);

    // таймер (третья сцена — тает быстро)
    const tLeft = scene === 2 ? Math.max(0, 10 - k * 13) : 42;
    const tFrac = tLeft / 60;
    ctx.fillStyle = '#111e35'; ctx.fillRect(qx, 16, qw, 12);
    ctx.fillStyle = tLeft <= 10 ? '#ff4d6d' : '#39ff14';
    ctx.fillRect(qx + 2, 18, (qw - 4) * (scene === 2 ? tLeft / 10 * 0.17 : tFrac), 8);
    ctx.font = F(10); ctx.textAlign = 'right';
    ctx.fillStyle = tLeft <= 10 && Math.floor(el / 250) % 2 ? 'rgba(255,77,109,.3)' : (tLeft <= 10 ? '#ff4d6d' : '#fff');
    ctx.fillText(String(Math.ceil(tLeft)), qx + qw + 36, 23);

    // ответы
    const opts = ['6', '8', '9', '23'];
    const cols = ['#00e5ff', '#f5d800', '#b24bff', '#ff8c1a'];
    const pos = i => ({ x: qx + (i % 2) * 326, y: 130 + Math.floor(i / 2) * 62, w: 314, h: 52 });
    for (let i = 0; i < 4; i++) {
      const p = pos(i);
      let border = '#1a3a6b', fill = '#0d1626', key = cols[i], alpha = 1, gone = false;
      if (scene === 0) {
        if (i === 1 && k > 0.3 && k < 0.56) { border = Math.floor(el / 250) % 2 ? '#f5d800' : '#8a7a00'; key = '#f5d800'; }
        if (i === 1 && k >= 0.56 && k < 0.72) { border = '#f5d800'; key = '#f5d800'; fill = Math.floor(el / 120) % 2 ? '#1e2410' : '#0d1626'; }
        if (i === 1 && k >= 0.72) { border = '#39ff14'; key = '#39ff14'; fill = '#0f2a12'; }
        if (i !== 1 && k >= 0.56) alpha = 0.4;
      }
      if (scene === 1 && (i === 0 || i === 3) && k > 0.42) { gone = true; alpha = 0.3; }
      if (scene === 2 && k > 0.8) { if (i === 1) { border = '#39ff14'; key = '#39ff14'; fill = '#0f2a12'; } else alpha = 0.4; }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = border; ctx.setLineDash(gone ? [6, 4] : []); ctx.strokeRect(p.x, p.y, p.w, p.h); ctx.setLineDash([]);
      ctx.fillStyle = gone ? '#1a3a6b' : key; ctx.fillRect(p.x + 10, p.y + 12, 28, 28);
      ctx.font = F(11); ctx.textAlign = 'center'; ctx.fillStyle = '#080c14';
      ctx.fillText(LETTERS[i], p.x + 24, p.y + 27);
      ctx.textAlign = 'left'; ctx.fillStyle = gone ? '#5a7a9a' : '#c8d8f0';
      ctx.fillText(gone ? '// убран' : opts[i], p.x + 52, p.y + 27);
      ctx.globalAlpha = 1;
    }

    // подсказки
    HINTS.forEach((h, i) => {
      const x = qx + i * 162, y = 268;
      const used = scene === 1 && i === 1 && k > 0.42;
      ctx.globalAlpha = used ? 0.3 : 1;
      ctx.fillStyle = '#0d1626'; ctx.fillRect(x, y, 152, 44);
      ctx.strokeStyle = scene === 1 && i === 1 && k > 0.25 && k <= 0.42 ? h.color : '#1a3a6b'; ctx.strokeRect(x, y, 152, 44);
      pixOnCanvas(ctx, h.icon, x + 10, y + 12, 2, h.color);
      ctx.font = F(8); ctx.fillStyle = h.color; ctx.textAlign = 'left';
      ctx.fillText(h.short, x + 42, y + 23);
      ctx.globalAlpha = 1;
    });

    // лестница справа
    const lx = 730, rowH = 18;
    const cur = scene === 0 && k > 0.78 ? 5 : 4;
    for (let q = 15; q >= 1; q--) {
      const y = 22 + (15 - q) * rowH;
      const isCur = q === cur, passed = q < cur;
      if (isCur) { ctx.fillStyle = '#f5d800'; ctx.fillRect(lx, y, 200, rowH - 2); }
      ctx.font = F(8); ctx.textAlign = 'left';
      ctx.fillStyle = isCur ? '#080c14' : passed ? '#39ff14' : isSafe(q) ? '#f5d800' : q === 15 ? '#b24bff' : '#5a7a9a';
      ctx.fillText(pad2(q), lx + 8, y + 9);
      ctx.textAlign = 'right'; ctx.fillText(String(PRIZES[q - 1]), lx + 192, y + 9);
    }

    // курсор и подписи
    let cx = -50, cy = -50, caption = '';
    if (scene === 0) {
      const a = pos(1);
      if (k < 0.3) { const e = k / 0.3; cx = 520 - (520 - (a.x + 160)) * e; cy = 320 - (320 - (a.y + 30)) * e; }
      else if (k < 0.5) { cx = a.x + 160; cy = a.y + 30; }
      else { cx = 410; cy = 252; }
      caption = k < 0.56 ? 'ВЫБЕРИ ОТВЕТ И ПОДТВЕРДИ' : k < 0.72 ? 'ПРОВЕРЯЮ...' : 'ВЕРНО! ВОПРОС 5 — НЕСГОРАЕМАЯ СУММА';
      if (k > 0.36 && k < 0.56) {
        ctx.font = F(9); ctx.textAlign = 'left'; ctx.fillStyle = '#f5d800'; ctx.fillText('ОТВЕТ B — ОКОНЧАТЕЛЬНЫЙ?', 120, 254);
        ctx.strokeStyle = '#39ff14'; ctx.strokeRect(372, 242, 70, 24); ctx.fillStyle = '#39ff14'; ctx.fillText('[ ДА ]', 380, 254);
      }
    } else if (scene === 1) {
      const e = Math.min(1, k / 0.25);
      cx = 520 - (520 - (qx + 162 + 76)) * e; cy = 330 - (330 - 290) * e;
      caption = k > 0.42 ? '50:50 — ДВА НЕВЕРНЫХ УБРАНЫ' : 'ПОДСКАЗКА 50:50';
    } else {
      caption = k > 0.8 ? 'ВРЕМЯ ВЫШЛО — ЭТО ОШИБКА' : 'НА ОТВЕТ — 60 СЕКУНД';
    }
    if (cx > 0) {
      ctx.fillStyle = '#fff';
      [[0, 0, 2, 16], [2, 2, 2, 12], [4, 4, 2, 9], [6, 6, 2, 6], [8, 8, 2, 4], [10, 10, 2, 2]].forEach(([x, y, w, h]) => ctx.fillRect(cx + x, cy + y, w, h));
    }
    ctx.font = F(9); ctx.textAlign = 'center';
    ctx.fillStyle = caption.startsWith('ВЕРНО') || caption.startsWith('50') ? '#39ff14' : caption.startsWith('ВРЕМЯ') ? '#ff4d6d' : '#c8d8f0';
    ctx.fillText(caption, qx + qw / 2, 330);

    HT.raf = requestAnimationFrame(drawHowto);
  }

  $('btn-howto').addEventListener('click', () => { sfx.click(); show('howto'); });
  $('btn-howto-back').addEventListener('click', () => { sfx.click(); show('menu'); });

  // ============================================================
  // ИГРОВОЕ ПОЛЕ: варианты, подсказки, лестница — строятся один раз
  // ============================================================
  const ansBtns = LETTERS.map((L, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ans pixel-text'; b.dataset.i = i;
    b.innerHTML = `<span class="ans-aud"></span><span class="ans-key">${L}</span><span class="ans-txt"></span><span class="ans-pct"></span>`;
    b.addEventListener('click', () => onAnswerClick(i));
    $('answers').appendChild(b);
    return b;
  });
  const hintBtns = {};
  HINTS.forEach(h => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hint pixel-text'; b.style.setProperty('--c', h.color);
    b.title = h.name + ' — ' + h.desc;
    b.innerHTML = `${pix(h.icon, h.color)}<span><span class="hint-name">${h.short}</span><span class="hint-desc">${h.desc}</span></span>`;
    b.addEventListener('click', () => useHint(h.id));
    $('hints').appendChild(b);
    hintBtns[h.id] = b;
  });
  $('ladder').innerHTML = '<div class="ladder-title pixel-text">// ЛЕСТНИЦА</div>' +
    PRIZES.map((p, i) => i + 1).reverse().map(q =>
      `<div class="lad pixel-text${isSafe(q) ? ' safe' : ''}${q === TOTAL ? ' top' : ''}" data-q="${q}">` +
      `<span class="lad-n">${pad2(q)}</span>${isSafe(q) ? pix('lock', '#f5d800') : ''}<span class="lad-p">${PRIZES[q - 1]}</span></div>`
    ).join('');
  const ladRows = [...document.querySelectorAll('#ladder .lad')];
  function buildSteps(box) {
    box.innerHTML = PRIZES.map((p, i) => `<div class="st${isSafe(i + 1) ? ' safe' : ''}" data-q="${i + 1}"></div>`).join('');
    return [...box.children];
  }
  const stepCells = buildSteps($('steps'));
  const resultSteps = buildSteps($('r-steps'));

  // ============================================================
  // СОСТОЯНИЕ ПАРТИИ
  // ============================================================
  let game = null;
  let starting = false;

  function newGame() {
    return {
      current: null, idx: 0, correct: 0,
      hints: { immunity: false, fifty: false, audience: false, swap: false },
      shield: false,          // право на ошибку включено и ещё не сработало
      busy: false, over: false,
      pending: null,          // выбранный, но не подтверждённый вариант
      deadline: 0, timer: 0, lastSec: 0,
      after: null,            // что делать после пояснения: next | win | lose
      reason: '',             // почему партия кончилась: wrong | time | exit | tab
      startedAt: Date.now(),
    };
  }
  const alive = my => my === game && !my.over;

  function serverError(my, e) {
    if (my !== game) return;
    console.error(e);
    stopTimer();
    my.over = true;
    hideOverlays();
    toast('Нет связи с сервером — партия прервана', 'pink', 3200);
    show('menu');
  }

  // ---------- HUD, лестница, подсказки ----------
  function renderHud() {
    const my = game;
    $('h-num').textContent = `${my.idx + 1}/${TOTAL}`;
    $('h-prize').textContent = PRIZES[my.idx];
    $('h-safe').textContent = safeFor(my.correct);
  }
  function renderLadder(lostQ = 0) {
    // подсветка — на ступени, за которую сейчас играем: после верного ответа сразу поднимается
    const cur = game.over ? 0 : game.correct + 1;
    const mark = el => {
      const q = +el.dataset.q;
      el.classList.toggle('passed', q <= game.correct);
      el.classList.toggle('current', q === cur && !lostQ);
      el.classList.toggle('lost', q === lostQ);
    };
    ladRows.forEach(mark);
    stepCells.forEach(mark);
  }
  function renderHints() {
    const my = game;
    HINTS.forEach(h => {
      const b = hintBtns[h.id];
      const shieldOn = h.id === 'immunity' && my && my.shield;
      const used = !!(my && my.hints[h.id]) && !shieldOn;
      b.classList.toggle('used', used);
      b.classList.toggle('on', shieldOn);
      b.disabled = !my || used || shieldOn;
    });
    $('shield-on').innerHTML = pix('shield', '#00e5ff') + 'ЩИТ';
    $('shield-on').classList.toggle('hidden', !(my && my.shield));
  }
  function setStatus(text, warn = false) {
    $('status-msg').textContent = text;
    $('status-msg').classList.toggle('warn', warn);
    $('status-msg').classList.remove('hidden');
    $('confirm').classList.add('hidden');
  }

  // ============================================================
  // 6. ВОПРОС И ТАЙМЕР
  // ============================================================
  // Вопрос приходит с сервера уже с перемешанными вариантами.
  // prefetched — вопрос, который сервер прислал сам (после замены).
  async function loadQuestion(prefetched) {
    const my = game;
    my.busy = true;
    my.pending = null;
    stopTimer();
    setStatus('ЗАГРУЖАЮ ВОПРОС...');
    let q = prefetched;
    if (!q) {
      try { q = await apiRetry('next'); }
      catch (e) { serverError(my, e); return; }
    }
    if (!alive(my)) return;

    my.current = q;
    my.idx = q.index;
    renderQuestion(q);
    renderHud();
    renderLadder();
    renderHints();
    my.busy = false;
    setStatus('ВЫБЕРИ ОТВЕТ');
    startTimer();
  }

  function renderQuestion(q) {
    const num = q.index + 1;
    const cpp = q.lang === 'cpp';
    const card = $('q-card');
    card.classList.toggle('cpp', cpp);
    $('q-file').textContent = `question_${pad2(num)}.${cpp ? 'cpp' : 'py'}`;
    const diff = $('q-diff');
    diff.textContent = q.difficulty === 'easy' ? 'ЛЁГКИЙ' : q.difficulty === 'medium' ? 'СРЕДНИЙ' : 'СЛОЖНЫЙ';
    diff.className = 'q-diff pixel-text ' + q.difficulty;
    $('q-text').textContent = q.q;
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');

    ansBtns.forEach((b, i) => {
      b.className = 'ans pixel-text';
      b.disabled = false;
      b.querySelector('.ans-txt').textContent = q.options[i];
      b.querySelector('.ans-pct').textContent = '';
      b.querySelector('.ans-aud').style.width = '0';
    });
    // варианты, которые сервер уже убрал (повторная выдача после обрыва сети)
    (q.removed || []).forEach(setGone);
  }
  function setGone(i) {
    const b = ansBtns[i];
    b.classList.remove('pending', 'dim');
    b.classList.add('gone');
    b.disabled = true;
    b.querySelector('.ans-pct').textContent = '';
    b.querySelector('.ans-aud').style.width = '0';
  }

  // Таймер считается от дедлайна, а не тиками: не «плывёт», если вкладка тормозит.
  // Подтверждение ответа его не останавливает — иначе можно было бы думать бесконечно.
  function startTimer(sec = QUESTION_SEC) {
    stopTimer();
    const my = game;
    my.deadline = performance.now() + sec * 1000;
    my.lastSec = sec + 1;
    $('timer').classList.remove('stop');
    const tick = () => {
      if (!alive(my)) { stopTimer(); return; }
      const left = Math.max(0, (my.deadline - performance.now()) / 1000);
      const sec = Math.ceil(left);
      $('timer-fill').style.width = (left / QUESTION_SEC * 100) + '%';
      $('timer-val').textContent = sec;
      $('timer').classList.toggle('mid', left <= 20 && left > 10);
      $('timer').classList.toggle('low', left <= 10);
      if (sec !== my.lastSec) { my.lastSec = sec; if (sec <= 10 && sec > 0) sfx.tick(sec <= 5); }
      if (left <= 0) { stopTimer(); timeUp(); }
    };
    tick();
    my.timer = setInterval(tick, 100);
  }
  function stopTimer() {
    if (game && game.timer) { clearInterval(game.timer); game.timer = 0; }
    $('timer').classList.add('stop');
  }

  // Время вышло — ошибка (право на ошибку от таймера не спасает)
  async function timeUp() {
    const my = game;
    if (!alive(my) || my.busy) return;
    my.busy = true;
    my.pending = null;
    $('exit-ov').classList.add('hidden');
    ansBtns.forEach(b => { b.classList.remove('pending'); b.disabled = true; });
    setStatus('ВРЕМЯ ВЫШЛО', true);
    sfx.timeout();
    let r;
    try { r = await api('answer', { index: my.current.index, choice: -1 }); }
    catch (e) { serverError(my, e); return; }
    if (!alive(my)) return;
    ansBtns.forEach((b, i) => { if (i === r.right) b.classList.add('correct'); else if (!b.classList.contains('gone')) b.classList.add('dim'); });
    my.reason = 'time';
    renderLadder(my.idx + 1);
    await sleep(900);
    if (alive(my)) showExplanation('time', r);
  }

  // ============================================================
  // 7. ОТВЕТ: выбрать → подтвердить → сервер проверяет
  // ============================================================
  function onAnswerClick(i) {
    const my = game;
    if (!alive(my) || my.busy || ansBtns[i].disabled) return;
    if (my.pending === i) { confirmAnswer(); return; }   // второй клик по тому же — подтверждение
    my.pending = i;
    ansBtns.forEach((b, j) => b.classList.toggle('pending', j === i));
    $('cf-letter').textContent = LETTERS[i];
    $('status-msg').classList.add('hidden');
    $('confirm').classList.remove('hidden');
    sfx.pick();
  }
  function cancelPending() {
    const my = game;
    if (!my || my.pending === null) return;
    my.pending = null;
    ansBtns.forEach(b => b.classList.remove('pending'));
    if (!my.busy) setStatus('ВЫБЕРИ ОТВЕТ');
  }
  function confirmAnswer() {
    const my = game;
    if (!alive(my) || my.busy || my.pending === null) return;
    const i = my.pending;
    my.pending = null;
    submitAnswer(my, i);
  }
  $('cf-yes').addEventListener('click', confirmAnswer);
  $('cf-no').addEventListener('click', () => { sfx.click(); cancelPending(); });

  async function submitAnswer(my, i) {
    my.busy = true;
    stopTimer();
    const b = ansBtns[i];
    ansBtns.forEach((x, j) => {
      x.classList.remove('pending');
      x.disabled = true;
      if (j !== i && !x.classList.contains('gone')) x.classList.add('dim');
    });
    b.classList.add('checking');
    setStatus('ПРОВЕРЯЮ ОТВЕТ...', true);
    sfx.think();

    // Ответ проверяет сервер; пауза «думаем» идёт параллельно
    let r;
    try {
      const send = () => api('answer', { index: my.current.index, choice: i });
      [r] = await Promise.all([
        // совсем мгновенный ответ сервер просит повторить чуть позже
        send().catch(async e => {
          if (e.message !== 'Слишком рано') throw e;
          await sleep(800);
          return send();
        }),
        sleep(1300),
      ]);
    } catch (e) { serverError(my, e); return; }
    if (!alive(my)) return;
    b.classList.remove('checking');

    if (r.correct) {
      const q = my.idx + 1;
      my.correct++;
      b.classList.add('correct');
      renderLadder();
      $('h-safe').textContent = safeFor(my.correct);   // несгораемая сумма — сразу
      sparks(b, ['#39ff14', '#b6ff9e', '#ffffff'], 30, true);
      floatText(b, '+' + PRIZES[my.idx]);
      if (q === TOTAL) sfx.win(); else if (isSafe(q)) sfx.safe(); else sfx.right();
      setStatus(q === TOTAL ? 'ПОБЕДА!' : 'ВЕРНО!');
      await sleep(800);
      if (alive(my)) showExplanation(q === TOTAL ? 'win' : 'ok', r);
      return;
    }

    if (r.saved) {
      // Право на ошибку спасло (решил сервер): вариант убираем, верный не раскрываем
      my.shield = false;
      b.classList.add('wrong');
      sparks(b, ['#ff4d6d', '#00e5ff', '#5a7a9a'], 22);
      sfx.saved();
      renderHints();
      await sleep(650);
      if (!alive(my)) return;
      setGone(i);
      ansBtns.forEach(x => { if (!x.classList.contains('gone')) { x.classList.remove('dim'); x.disabled = false; } });
      toast('ЩИТ СРАБОТАЛ: неверный вариант убран, выбери снова', 'cyan', 2600);
      my.busy = false;
      setStatus('ВЫБЕРИ ОТВЕТ');
      startTimer();
      return;
    }

    // Неверно — конец партии
    b.classList.add('wrong');
    const right = ansBtns[r.right];
    if (right) { right.classList.remove('dim'); right.classList.add('correct'); }
    sparks(b, ['#ff4d6d', '#ff9aae', '#3a0f1c'], 30);
    sfx.wrong();
    my.reason = 'wrong';
    renderLadder(my.idx + 1);
    setStatus('НЕВЕРНО', true);
    await sleep(1000);
    if (alive(my)) showExplanation('bad', r);
  }

  // ============================================================
  // 8. ПОДСКАЗКИ — каждую считает сервер
  // ============================================================
  async function useHint(id) {
    const my = game;
    if (!alive(my) || my.busy || my.hints[id] || !my.current) return;
    cancelPending();
    my.hints[id] = true;         // флаг сразу — от двойного клика
    my.busy = true;
    renderHints();
    let r;
    try { r = await api('hint', { index: my.current.index, type: id }); }
    catch (e) {
      if (my !== game) return;
      my.hints[id] = false;
      my.busy = false;
      renderHints();
      toast('Подсказка недоступна: ' + e.message, 'yellow');
      return;
    }
    if (!alive(my)) return;
    sfx.hint();
    my.busy = false;

    if (id === 'immunity') {
      my.shield = true;
      renderHints();
      sparks(hintBtns.immunity, ['#00e5ff', '#ffffff'], 16, true);
      toast('ЩИТ ВКЛЮЧЁН: одна неверная попытка не засчитается', 'cyan');
    } else if (id === 'fifty') {
      (r.remove || []).forEach(i => { sparks(ansBtns[i], ['#5a7a9a', '#1a3a6b', '#f5d800'], 16); setGone(i); });
      toast('50:50 — два неверных ответа убраны', 'yellow');
    } else if (id === 'audience') {
      const pcts = r.pcts || [25, 25, 25, 25];
      ansBtns.forEach((b, i) => {
        if (b.classList.contains('gone')) return;
        b.querySelector('.ans-aud').style.width = pcts[i] + '%';
        countUp(b.querySelector('.ans-pct'), pcts[i], '%');
      });
      toast('ЗАЛ ПРОГОЛОСОВАЛ — проценты на вариантах', 'green');
    } else if (id === 'swap' && r.question) {
      toast('ВОПРОС ЗАМЕНЁН', 'cyan');
      await loadQuestion(r.question);
    }
  }

  function countUp(el, to, suffix = '', ms = 900) {
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      el.textContent = Math.round(to * k) + suffix;
      if (k >= 1) clearInterval(id);
    }, 30);
    el.textContent = '0' + suffix;
  }
  // 1 очко, 2 очка, 5 очков
  function pts(n) {
    const a = n % 10, b = n % 100;
    const w = a === 1 && b !== 11 ? 'очко' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'очка' : 'очков';
    return `${n} ${w}`;
  }

  // ============================================================
  // 9. ПОЯСНЕНИЕ, ВЫХОД, ИТОГ
  // ============================================================
  function showExplanation(kind, r) {
    const my = game;
    const q = my.idx + 1;
    const box = $('exp-box');
    const safe = safeFor(my.correct);
    box.className = 'ov-box exp-box ' + (kind === 'ok' ? 'ok' : kind === 'win' ? 'win' : 'bad');
    let icon, title, color, prize, btn;
    if (kind === 'win') {
      icon = pix('trophy', '#f5d800'); title = 'ПОБЕДА! 1000 ОЧКОВ'; color = 'var(--yellow)';
      prize = 'Все 15 вопросов пройдены.'; btn = '[ К ИТОГУ ]'; my.after = 'win';
    } else if (kind === 'ok') {
      icon = isSafe(q) ? pix('lock', '#f5d800') : pix('check', '#39ff14');
      title = 'ВЕРНО!'; color = 'var(--green)';
      prize = `Вопрос ${q} взят: ${pts(PRIZES[q - 1])}.` + (isSafe(q) ? ` Это несгораемая сумма — ${pts(SAFE[q])} уже твои.` : '');
      btn = `[ ВОПРОС ${q + 1} ]`; my.after = 'next';
    } else {
      icon = kind === 'time' ? pix('clock', '#ff4d6d') : pix('cross', '#ff4d6d');
      title = kind === 'time' ? 'ВРЕМЯ ВЫШЛО' : 'НЕВЕРНО'; color = 'var(--pink)';
      prize = safe ? `Остаётся несгораемая сумма: ${pts(safe)}.` : 'До первой несгораемой суммы (5-й вопрос) не дошёл — 0 очков.';
      btn = '[ К ИТОГУ ]'; my.after = 'lose';
    }
    $('exp-icon').innerHTML = icon;
    $('exp-title').textContent = title;
    $('exp-title').style.color = color;
    $('exp-prize').textContent = prize;
    $('exp-text').textContent = r && r.explain ? r.explain : '';
    $('btn-next').textContent = btn;
    $('exp-ov').classList.remove('hidden');
  }

  function proceed() {
    const my = game;
    if (!alive(my) || $('exp-ov').classList.contains('hidden')) return;
    sfx.click();
    $('exp-ov').classList.add('hidden');
    if (my.after === 'next') { my.after = null; loadQuestion(); }
    else if (my.after === 'win') endGame('win');
    else endGame(my.reason || 'wrong');
  }
  $('btn-next').addEventListener('click', proceed);

  function hideOverlays() {
    $('exp-ov').classList.add('hidden');
    $('exit-ov').classList.add('hidden');
  }

  // Выход посреди партии: сервер засчитывает проигрыш, остаётся несгораемая сумма
  function askExit() {
    const my = game;
    if (!alive(my)) { show('menu'); return; }
    if (my.after === 'win' || my.after === 'lose') { proceed(); return; }   // партия уже решена
    sfx.click();
    cancelPending();
    const safe = safeFor(my.correct);
    $('exit-text').textContent = (safe ? `Партия закончится, а ты получишь несгораемую сумму: ${pts(safe)}.` : 'Партия закончится — несгораемая сумма ещё не набрана, будет 0 очков.') + ' Таймер не останавливается.';
    $('exit-ov').classList.remove('hidden');
  }
  $('btn-esc').addEventListener('click', askExit);
  $('exit-no').addEventListener('click', () => { sfx.click(); $('exit-ov').classList.add('hidden'); });
  $('exit-yes').addEventListener('click', () => forfeit('exit'));

  function forfeit(reason) {
    const my = game;
    if (!alive(my)) return;
    stopTimer();
    my.busy = true;
    hideOverlays();
    // Если пояснение уже показано — сервер партию закрыл сам
    if (my.after === 'win') { endGame('win'); return; }
    if (my.after === 'lose') { endGame(my.reason || 'wrong'); return; }
    api('forfeit').catch(() => {}).finally(() => { if (alive(my)) endGame(reason); });
  }

  // Смена вкладки — проигрыш (как и раньше)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || screen !== 'game' || !alive(game)) return;
    toast('Смена вкладки — игра остановлена', 'yellow', 2800);
    forfeit('tab');
  });

  function endGame(reason) {
    const my = game;
    if (!my || my.over) return;
    my.over = true;
    stopTimer();
    hideOverlays();

    const won = reason === 'win';
    // на каком вопросе остановился: после верного ответа — уже на следующем
    const reached = won ? TOTAL : Math.min(TOTAL, my.correct + 1);
    const prize = won ? PRIZES[TOTAL - 1] : safeFor(my.correct);
    const elapsed = Math.max(0, Date.now() - my.startedAt);

    $('r-saved').textContent = '';
    if (typeof submitScore === 'function') {
      submitScore('millionaire', { reached, won, elapsed_ms: elapsed }).then(res => {
        if (!res || my !== game) return;
        if (typeof res.total_game_score === 'number') $('r-saved').textContent = `Очки добавлены. Всего в этой игре: ${res.total_game_score}`;
        else if (res.is_record) $('r-saved').textContent = 'Новый рекорд!';
      }).catch(() => {});
    }

    const SUB = {
      win:   'Все 15 вопросов пройдены. Ты — программист!',
      wrong: `Неверный ответ на вопрос ${reached}.`,
      time:  `Время на вопрос ${reached} вышло.`,
      exit:  `Ты вышел из игры на вопросе ${reached}.`,
      tab:   'Смена вкладки засчитана как проигрыш.',
    };
    $('s-result').querySelector('.result-box').classList.toggle('win', won);
    $('r-icon').innerHTML = won ? pix('trophy', '#f5d800')
      : reason === 'time' ? pix('clock', '#ff4d6d')
      : reason === 'exit' || reason === 'tab' ? pix('door', '#ff4d6d')
      : pix('cross', '#ff4d6d');
    $('r-title').textContent = won ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА';
    $('r-sub').textContent = SUB[reason] || '';
    $('r-prize').textContent = '0';
    resultSteps.forEach(el => {
      const q = +el.dataset.q;
      el.classList.toggle('passed', q <= my.correct);
      el.classList.toggle('lost', !won && q === reached);
    });
    $('r-ok').textContent = my.correct;
    $('r-reached').textContent = reached;
    $('r-hints').textContent = `${Object.values(my.hints).filter(Boolean).length}/4`;
    const s = Math.round(elapsed / 1000);
    $('r-time').textContent = `${Math.floor(s / 60)}:${pad2(s % 60)}`;

    show('result');
    countUp($('r-prize'), prize, '', 1100);
    if (won) sfx.win(); else sfx.lose();
    if (typeof renderLeaderboard === 'function') renderLeaderboard($('lb-millionaire'), 'millionaire', 5);
  }

  // ============================================================
  // СТАРТ
  // ============================================================
  async function startGame() {
    if (starting) return;
    starting = true;
    sfx.click();
    try {
      if (typeof pingGame !== 'function') throw new Error('не загрузился модуль сайта');
      await pingGame('millionaire');
      run = JSON.parse(sessionStorage.getItem('gc_run_millionaire') || 'null');
      if (!run || !run.run_id) throw new Error('сервер не выдал партию');
      await api('start');
    } catch (e) {
      run = null;
      starting = false;
      toast('Не получилось начать игру: ' + e.message, 'pink', 3200);
      return;
    }
    starting = false;

    if (game) stopTimer();
    game = newGame();
    hideOverlays();
    renderHints();
    renderHud();
    renderLadder();
    $('q-text').textContent = '';
    ansBtns.forEach(b => { b.className = 'ans pixel-text'; b.disabled = true; b.querySelector('.ans-txt').textContent = ''; });
    show('game');
    loadQuestion();
  }
  $('btn-play').addEventListener('click', startGame);
  $('btn-retry').addEventListener('click', startGame);
  $('btn-menu').addEventListener('click', () => { sfx.click(); show('menu'); });

  // Клавиши: Enter — подтвердить/дальше, Esc — отменить выбор или выйти
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (screen === 'howto') { show('menu'); return; }
      if (screen !== 'game') return;
      if (!$('exit-ov').classList.contains('hidden')) { $('exit-ov').classList.add('hidden'); return; }
      if (game && game.pending !== null) { cancelPending(); return; }
      askExit();
      return;
    }
    if (e.key === 'Enter' && screen === 'game') {
      if (!$('exp-ov').classList.contains('hidden')) { e.preventDefault(); proceed(); }
      else if (game && game.pending !== null && $('exit-ov').classList.contains('hidden')) { e.preventDefault(); confirmAnswer(); }
    }
  });

  buildHowto();
  renderHints();
  show('menu');
  if (typeof renderLeaderboard === 'function') renderLeaderboard($('lb-millionaire'), 'millionaire', 5);
})();
