/* ============================================================
   СОРТИРОВЩИК — Python
   Сверху падает блок кода, игрок бросает его в одну из 5 корзин.
   Партию ведёт сервер (api/sorter.php): браузер получает только
   текст блока и узнаёт, верно ли его бросили, — ответов в коде нет.

   1. Звук            5. Корзины
   2. Звёздный фон    6. Падающий блок
   3. Меню            7. Перетаскивание (мышь и палец)
   4. Как играть      8. Ответ, HUD, пауза, результат
   ============================================================ */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ============================================================
  // 1. ЗВУК — 8-битные «пики» без файлов, выключатель как в «Сетевом маршруте»
  // ============================================================
  let audioCtx = null;
  let soundOn = true;
  try { soundOn = localStorage.getItem('gc_sorter_sound') !== '0'; } catch (e) { /* приватный режим */ }

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
  // Белый шум через фильтр — для «сбоев» и глюка (как в «Глюк-атаке»)
  let noiseBuf = null;
  function noise(dur, opts = {}) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (!noiseBuf) {
        noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = audioCtx.currentTime + (opts.delay || 0);
      const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
      src.buffer = noiseBuf;
      f.type = opts.filter || 'bandpass';
      f.frequency.setValueAtTime(opts.freq || 1500, t);
      if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
      g.gain.setValueAtTime(opts.vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(audioCtx.destination);
      src.start(t); src.stop(t + dur);
    } catch (e) { /* без звука */ }
  }
  const sfx = {
    click: () => beep(440, 0.04, 'square', 0.07),
    pick:  () => beep(520, 0.04, 'square', 0.06),
    right: () => { beep(523, 0.06); beep(659, 0.06, 'square', 0.12, 0.07); beep(784, 0.12, 'square', 0.12, 0.14); },
    wrong: () => { beep(220, 0.08); beep(160, 0.16, 'square', 0.12, 0.08); },
    miss:  () => { beep(150, 0.08, 'sawtooth', 0.12); beep(120, 0.15, 'sawtooth', 0.1, 0.08); },
    win:   () => [523, 659, 784, 1047].forEach((n, i) => beep(n, 0.12, 'square', 0.12, i * 0.09)),
    lose:  () => [300, 250, 200, 150].forEach((n, i) => beep(n, 0.14, 'sawtooth', 0.1, i * 0.1)),
    pause: () => { beep(440, 0.05); beep(330, 0.08, 'square', 0.12, 0.06); },
    // блок в руке «сбоит»: треск помех и короткий писк
    glitchTick: (hard) => {
      noise(0.05, { freq: 2500 + Math.random() * 3500, vol: hard ? 0.1 : 0.06, filter: 'highpass' });
      beep(60 + Math.random() * 140, 0.04, 'square', hard ? 0.05 : 0.03);
    },
    // глюк собирается из пикселей
    ghostIn: () => { noise(0.45, { freq: 300, to: 4000, vol: 0.14 }); beep(110, 0.4, 'sawtooth', 0.05); beep(990, 0.05, 'square', 0.04, 0.38); },
    // глюк уничтожает блок
    crunch: () => { noise(0.35, { freq: 4000, to: 250, vol: 0.32 }); beep(140, 0.22, 'sawtooth', 0.1); beep(70, 0.25, 'square', 0.08, 0.08); },
    // глюк рассыпается
    ghostOut: () => noise(0.45, { freq: 3000, to: 200, vol: 0.1 }),
  };
  function renderSoundBtn() { $('btn-sound').textContent = soundOn ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ'; }
  $('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('gc_sorter_sound', soundOn ? '1' : '0'); } catch (e) { /* ок */ }
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
  // ДАННЫЕ
  // ============================================================
  const CATEGORIES = [
    { id: 'functions',  label: 'ФУНКЦИИ',   icon: 'f()', color: '#00e5ff', ex: 'print(), len(), input()' },
    { id: 'operators',  label: 'ОПЕРАТОРЫ', icon: '+-',  color: '#ff4d6d', ex: '+, ==, =' },
    { id: 'data_types', label: 'ТИПЫ',      icon: '{}',  color: '#f5d800', ex: 'int, str, list' },
    { id: 'loops',      label: 'ЦИКЛЫ',     icon: '>>',   color: '#39ff14', ex: 'for, while' },
    { id: 'conditions', label: 'УСЛОВИЯ',   icon: '?:',   color: '#b24bff', ex: 'if, elif, and' },
  ];
  // Цель и скорость дублируют сервер (includes/sorter.php) только для показа
  const LEVELS = [
    { id: 1, name: 'НОВИЧОК', color: '#39ff14', speed: 55,  target: 10, lives: 3 },
    { id: 2, name: 'ПРАКТИК', color: '#f5d800', speed: 90,  target: 15, lives: 3 },
    { id: 3, name: 'ЭКСПЕРТ', color: '#ff4d6d', speed: 130, target: 20, lives: 3 },
  ];
  // Скорость в уровне задана для поля высотой ~560 px. На телефоне поле
  // ниже — без поправки блок падал бы до низа заметно быстрее, чем на ПК.
  const REF_FIELD_H = 560;
  // За сколько секунд до падения блок начинает мигать красным
  const DANGER_SEC = 1.5;
  // Защита от затягивания: сколько блок можно держать в руке (суммарно
  // за все захваты этого блока). С HOLD_WARN_MS блок «сбоит», на
  // HOLD_LIMIT_MS прилетает глюк из «Глюк-атаки» и уничтожает его.
  const HOLD_WARN_MS = 3000;
  const HOLD_HARD_MS = 4200;
  const HOLD_LIMIT_MS = 5000;

  // ---------- глюк: спрайт из «Глюк-атаки» (games/glitch/js/render.js) ----------
  const SPR_W = 48, SPR_H = 44, GC_X = 24, GC_Y = 19;
  const GHOST_PAL = { dark: '#003a44', body: '#005566', eye: '#00ffff', fx: '0,229,255' };
  const GHOST_COLORS = ['#00e5ff', '#005566', '#00ffff', '#003a44'];
  function paintGhost(cv, tMs) {
    const pal = GHOST_PAL, walk = Math.floor(tMs / 260) % 2;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, SPR_W, SPR_H);
    g.fillStyle = `rgba(${pal.fx},0.15)`;                         // пиксельный распад вокруг
    const seed = Math.floor(tMs / 300);
    for (let i = 0; i < 6; i++) g.fillRect(4 + (((seed * 7 + i * 13) % 5) * 8), 2 + (((seed * 11 + i * 7) % 5) * 8), 6, 6);
    g.fillStyle = pal.dark; g.fillRect(8, 6, 24, 26);                // тело
    g.fillStyle = pal.body; g.fillRect(10, 4, 20, 24);
    const wb = walk * 3;                                              // волнистый низ
    g.fillRect(8, 28, 8, 6 + wb); g.fillRect(20, 28, 8, 6 - wb); g.fillRect(32, 28, 8, 6 + wb);
    g.fillStyle = pal.dark; g.fillRect(16, 28, 4, 4); g.fillRect(28, 28, 4, 4);
    g.fillStyle = pal.eye;                                            // глаза-крестики
    [[13, 10], [23, 10]].forEach(([ex, ey]) => { g.fillRect(ex, ey, 2, 6); g.fillRect(ex - 2, ey + 2, 6, 2); });
    if (Math.sin(tMs / 150) > 0.6) { g.fillStyle = `rgba(${pal.fx},0.3)`; g.fillRect(8, 4 + walk * 2, 24, 3); }
    g.fillStyle = `rgba(${pal.fx},0.12)`; g.fillRect(8, 14, 24, 2); g.fillRect(8, 20, 24, 2);   // помехи
    return cv;
  }
  const ghostSprite = (() => { const c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H; return c; })();

  const HEART = '<svg class="heart" viewBox="0 0 9 8" shape-rendering="crispEdges"><path fill="#ff4d6d" d="M1 0h2v1h1v1h1V1h1V0h2v1h1v3H8v1H7v1H6v1H5v1H4V7H3V6H2V5H1V4H0V1h1z"/><path fill="#ffb3c1" d="M1 1h1v1H1z"/></svg>';

  // ============================================================
  // ЭКРАНЫ
  // ============================================================
  const screens = { menu: $('s-menu'), howto: $('s-howto'), game: $('s-game'), result: $('s-result') };
  let screen = 'menu';
  function show(name) {
    screen = name;
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
    if (name === 'howto') startHowto(); else stopHowto();
    document.body.classList.toggle('in-game', name === 'game');
    if (name === 'menu') refreshLeaderboard();
  }
  function refreshLeaderboard() {
    if (typeof renderLeaderboard === 'function') renderLeaderboard($('lb-sorter'), 'sorter', 5);
  }
  function toast(text, bad) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3100);
  }

  // ============================================================
  // 3. МЕНЮ
  // ============================================================
  $('level-cards').innerHTML = LEVELS.map(l => `
    <button class="level-card" type="button" data-level="${l.id}" style="--c:${l.color}">
      <span class="lc-name">${l.name}</span>
    </button>`).join('');
  $('level-cards').addEventListener('click', e => {
    const b = e.target.closest('[data-level]');
    if (b) { sfx.click(); startLevel(Number(b.dataset.level)); }
  });

  // ============================================================
  // 4. КАК ИГРАТЬ — описание корзин и анимация
  // ============================================================
  $('howto-cats').innerHTML = CATEGORIES.map(c =>
    `<div class="howto-cat" style="--c:${c.color}"><b>${c.icon} ${c.label}</b><code>${esc(c.ex)}</code></div>`).join('');

  // Три сцены по кругу: блок брошен в верную корзину (+очки), в неверную
  // (минус жизнь и подсказка) и блок держат слишком долго — его съедает глюк.
  // Холст 960×340, логика 480×170.
  const HOWTO_CYCLE = 4200;
  let howtoRaf = 0, howtoT0 = 0;
  function cvText(ctx, str, x, y, size, color, align) {
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }
  function cvBox(ctx, x, y, w, h, border, fill) {
    ctx.fillStyle = fill || '#0d1626'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  function cvHeart(ctx, x, y, on) {
    const rows = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
    ctx.fillStyle = on ? '#ff4d6d' : '#2a3a5c';
    rows.forEach((r, ry) => [...r].forEach((c, rx) => { if (c === 'x') ctx.fillRect(x + rx * 2, y + ry * 2, 2, 2); }));
  }
  function drawHowto(now) {
    const cv = $('howto-pic');
    const ctx = cv.getContext('2d'), W = 480, H = 170;
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#080c14'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(26,58,107,0.35)';
    for (let x = 0; x < W; x += 20) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < 120; y += 20) ctx.fillRect(0, y, W, 1);

    const t = now - howtoT0;
    const scene = Math.floor(t / HOWTO_CYCLE) % 3;
    const k = (t % HOWTO_CYCLE) / HOWTO_CYCLE;
    const ease = v => v < 0 ? 0 : v > 1 ? 1 : v * v * (3 - 2 * v);

    // корзины внизу
    const bw = 84, gap = 10, bx0 = (W - (bw * 5 + gap * 4)) / 2, by = 126;
    const target = scene === 0 ? 0 : scene === 1 ? 2 : -1;   // куда бросают блок в этой сцене
    const dropped = k > 0.62;
    // корзины всегда своего цвета; ярче — та, над которой держат блок
    CATEGORIES.forEach((c, i) => {
      const x = bx0 + i * (bw + gap);
      const border = (i === target && k > 0.5 && !dropped) ? c.color : c.color + '88';
      cvBox(ctx, x, by, bw, 38, border);
      cvText(ctx, c.label, x + bw / 2, by + 19, 6, c.color, 'center');
    });

    if (scene === 2) {
      drawGlitchScene(ctx, k, t, W, ease);
      howtoRaf = requestAnimationFrame(drawHowto);
      return;
    }

    // блок: падает, его хватают, переносят и бросают
    const text = scene === 0 ? 'print()' : 'while';
    const startX = scene === 0 ? 300 : 120;
    const grabAt = 0.24, dropAt = 0.6;
    let x, y;
    if (k < grabAt) { x = startX; y = -10 + 70 * (k / grabAt); }
    else {
      const p = ease((k - grabAt) / (dropAt - grabAt));
      const tx = bx0 + target * (bw + gap) + bw / 2 - 40;
      x = startX + (tx - startX) * p; y = 60 + (by - 6 - 60) * p;
    }
    if (!dropped) {
      const holding = k >= grabAt;
      cvBox(ctx, x, y, 80, 26, holding ? '#00e5ff' : '#2a5fbf', holding ? '#111e35' : null);
      ctx.fillStyle = '#00e5ff'; ctx.fillRect(x, y, 3, 26);
      cvText(ctx, text, x + 44, y + 13, 7, '#ffffff', 'center');
      // палец/курсор: подходит к блоку и держит его ровно в точке захвата
      const hx = holding ? x + 54 : startX + 54 + (1 - ease(k / grabAt)) * 60;
      const hy = holding ? y + 18 : y + 18 + (1 - ease(k / grabAt)) * 40;
      ctx.fillStyle = '#ffffff';
      [[0,0,2,12],[2,2,2,8],[4,4,2,6],[6,6,2,4],[8,8,2,2]].forEach(r => ctx.fillRect(hx + r[0], hy + r[1], r[2], r[3]));
      if (k > grabAt - 0.03 && k < grabAt + 0.06) { ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1; ctx.strokeRect(hx - 6, hy - 6, 14, 14); }
    }

    // итог: верный блок уходит в корзину, неверный рассыпается красными пикселями
    const fade = ease((k - 0.62) / 0.25);
    if (dropped && k < 0.75) {
      const q = ease((k - 0.62) / 0.13);
      const tx = bx0 + target * (bw + gap) + bw / 2 - 40;
      if (scene === 0) {
        const s2 = 1 - 0.8 * q, w2 = 80 * s2, h2 = 26 * s2;
        ctx.globalAlpha = 1 - q;
        cvBox(ctx, tx + 40 - w2 / 2, by - 6 + 13 + 19 * q - h2 / 2, w2, h2, '#00e5ff', '#111e35');
        ctx.globalAlpha = 1;
      } else {
        const reds = ['#ff4d6d', '#c2183c', '#ff8fa3'];
        ctx.globalAlpha = 1 - q;
        for (let py = 0; py < 26; py += 6) for (let px = 0; px < 80; px += 6) {
          const spread = (px - 40) / 40;
          ctx.fillStyle = reds[(px + py) % 3];
          ctx.fillRect(tx + px + spread * 26 * q, by - 6 + py + 40 * q * (0.6 + ((px * 7 + py) % 5) / 10), 4, 4);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (dropped && scene === 0) {
      cvText(ctx, '+10', bx0 + bw / 2, by - 12 - 16 * fade, 8, '#39ff14', 'center');
      cvText(ctx, 'ВЕРНО: print() — ФУНКЦИЯ', W / 2, 20, 7, '#39ff14', 'center');
    }
    if (dropped && scene === 1) {
      cvText(ctx, 'НЕ ТА КОРЗИНА: while — ЭТО ЦИКЛ', W / 2, 20, 7, '#ff4d6d', 'center');
    }
    // жизни справа сверху: во второй сцене одна гаснет
    for (let i = 0; i < 3; i++) cvHeart(ctx, W - 54 + i * 17, 36, !(scene === 1 && dropped && i === 2));
    if (!dropped) cvText(ctx, scene === 0 ? 'ПЕРЕТАЩИ БЛОК В ЕГО КОРЗИНУ' : 'ОШИБКА СТОИТ ЖИЗНИ', W / 2, 20, 7, '#8fb0d8', 'center');

    howtoRaf = requestAnimationFrame(drawHowto);
  }
  // Сцена 3: блок держат, на 3-й секунде он «сбоит», на 5-й из пикселей
  // собирается глюк, подлетает и съедает блок, затем рассыпается сам.
  function drawGlitchScene(ctx, k, tMs, W, ease) {
    const bx = 170, by0 = 50, grabAt = 0.12, holdEnd = 0.52, eatAt = 0.72;
    const sec = clamp((k - grabAt) / (holdEnd - grabAt) * 5, 0, 5);
    const eaten = k >= eatAt;
    const hard = sec >= 4.2;
    let x = bx, y = k < grabAt ? -10 + (by0 + 10) * (k / grabAt) : by0;
    if (!eaten) {
      if (sec >= 3) { x += Math.round((Math.random() - 0.5) * (hard ? 6 : 3)); y += Math.round((Math.random() - 0.5) * (hard ? 4 : 2)); }
      cvBox(ctx, x, y, 80, 26, k >= grabAt ? '#00e5ff' : '#2a5fbf', '#111e35');
      ctx.fillStyle = '#00e5ff'; ctx.fillRect(x, y, 3, 26);
      if (sec >= 3) {                                           // RGB-расслоение и полосы помех
        cvText(ctx, 'for', x + 42, y + 13, 7, '#ff4d6d', 'center');
        cvText(ctx, 'for', x + 46, y + 13, 7, '#00e5ff', 'center');
        ctx.fillStyle = 'rgba(0,229,255,0.25)';
        for (let i = 0; i < 3; i++) ctx.fillRect(x, y + ((Math.floor(tMs / 60) + i * 9) % 26), 80, 2);
      }
      cvText(ctx, 'for', x + 44, y + 13, 7, '#ffffff', 'center');
      if (k >= grabAt) {                                        // палец держит блок
        ctx.fillStyle = '#ffffff';
        [[0,0,2,12],[2,2,2,8],[4,4,2,6],[6,6,2,4],[8,8,2,2]].forEach(r => ctx.fillRect(x + 54 + r[0], y + 18 + r[1], r[2], r[3]));
        cvText(ctx, 'ДЕРЖИШЬ: ' + Math.floor(sec) + ' С', x + 40, y - 12, 6, sec >= 3 ? '#ff4d6d' : '#8fb0d8', 'center');
      }
    }
    // глюк: собирается из пикселей справа, летит к блоку, кусает, рассыпается
    const gx0 = 400, gy0 = 44, gx1 = bx + 40, gy1 = by0 + 12;
    const inP = ease((k - holdEnd) / 0.08), fly = ease((k - 0.6) / 0.1), outP = ease((k - 0.86) / 0.1);
    const gx = gx0 + (gx1 - gx0) * fly, gy = gy0 + (gy1 - gy0) * fly;
    if (k >= holdEnd && k < 0.6) {
      for (let i = 0; i < 28; i++) {
        const tx = gx - 18 + (i % 7) * 6, ty = gy - 16 + Math.floor(i / 7) * 8;
        const sx = tx + Math.cos(i * 2.4) * 70, sy = ty + Math.sin(i * 1.7) * 50;
        ctx.fillStyle = GHOST_COLORS[i % GHOST_COLORS.length];
        ctx.fillRect(sx + (tx - sx) * inP, sy + (ty - sy) * inP, 4, 4);
      }
    }
    if (k >= 0.58 && k < 0.86) {
      ctx.drawImage(paintGhost(ghostSprite, tMs), Math.round(gx - GC_X), Math.round(gy - GC_Y), SPR_W, SPR_H);
    }
    if (k >= 0.86 && outP < 1) {
      ctx.globalAlpha = 1 - outP;
      for (let i = 0; i < 28; i++) {
        const sx = gx - 18 + (i % 7) * 6, sy = gy - 16 + Math.floor(i / 7) * 8;
        ctx.fillStyle = GHOST_COLORS[i % GHOST_COLORS.length];
        ctx.fillRect(sx + Math.cos(i * 2.4) * 60 * outP, sy + Math.sin(i * 1.7) * 40 * outP, 4, 4);
      }
      ctx.globalAlpha = 1;
    }
    // блок рассыпается на пиксели цветов глюка
    if (eaten && k < 0.86) {
      const q = ease((k - eatAt) / 0.14);
      ctx.globalAlpha = 1 - q;
      const cols = ['#00e5ff', '#ff4d6d', '#ffffff', '#005566'];
      for (let py = 0; py < 26; py += 6) for (let px = 0; px < 80; px += 6) {
        ctx.fillStyle = cols[(px + py) % 4];
        ctx.fillRect(bx + px + (px - 40) / 40 * 30 * q, by0 + py + 40 * q * (0.6 + ((px * 7 + py) % 5) / 10), 4, 4);
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 3; i++) cvHeart(ctx, W - 54 + i * 17, 36, !(eaten && i === 2));
    cvText(ctx, eaten ? 'СЛИШКОМ ДОЛГО ДУМАЛ — ГЛЮК СЪЕЛ БЛОК' : 'НЕ ДЕРЖИ БЛОК ДОЛЬШЕ 5 СЕКУНД', W / 2, 20, 7, eaten ? '#ff4d6d' : '#8fb0d8', 'center');
  }

  function startHowto() {
    cancelAnimationFrame(howtoRaf);
    howtoT0 = performance.now();
    howtoRaf = requestAnimationFrame(drawHowto);
  }
  function stopHowto() { cancelAnimationFrame(howtoRaf); }
  $('btn-howto').addEventListener('click', () => { sfx.click(); show('howto'); });
  $('btn-howto-back').addEventListener('click', () => { sfx.click(); show('menu'); });

  // ============================================================
  // СЕРВЕР
  // ============================================================
  const API = '../../api/sorter.php';
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

  // ============================================================
  // СОСТОЯНИЕ ПАРТИИ
  // ============================================================
  const field = $('field');
  let game = { over: true };
  let starting = false;
  let session = 0;   // номер партии: ответы сервера от прошлой партии игнорируем

  async function startLevel(levelId) {
    if (starting) return;
    const level = LEVELS.find(l => l.id === levelId);
    starting = true;
    try {
      if (typeof pingGame !== 'function') throw new Error('не загрузился модуль сайта');
      await pingGame('sorter');
      run = JSON.parse(sessionStorage.getItem('gc_run_sorter') || 'null');
      if (!run || !run.run_id) throw new Error('сервер не выдал партию');
      await api('start', { level: levelId });
    } catch (e) {
      starting = false; run = null;
      toast('Не получилось начать игру: ' + e.message, true);
      return;
    }
    starting = false;
    stopGame();
    session++;

    game = {
      session, level,
      score: 0, correct: 0, errors: 0, lives: level.lives,
      errorLog: [],
      paused: false, over: false, answering: false, spawning: false,
      block: null, concept: null, pending: null,
      x: 0, y: 0, drag: null,
      raf: 0, spawnTimer: 0, last: 0,
      holdMs: 0, holdStart: 0, holdTimer: 0, lastTick: 0,
      fxEls: [], fxTimers: [],
    };
    document.documentElement.style.setProperty('--lvl', level.color);
    buildBaskets();
    $('tip').textContent = '';
    $('tip').className = 'tip pixel-text';
    $('pause-ov').classList.add('hidden');
    refreshHud();
    show('game');
    spawnBlock();
  }

  // Остановить всё, что относится к текущей партии
  function stopGame() {
    game.over = true;
    cancelAnimationFrame(game.raf);
    clearTimeout(game.spawnTimer);
    clearInterval(game.holdTimer);
    // глюк и его таймеры, если партию прервали посреди атаки
    (game.fxTimers || []).forEach(id => { clearTimeout(id); clearInterval(id); });
    (game.fxEls || []).forEach(el => el.remove());
    game.fxTimers = []; game.fxEls = [];
    removeBlock();
  }

  // ============================================================
  // 5. КОРЗИНЫ
  // ============================================================
  function buildBaskets() {
    $('baskets').innerHTML = CATEGORIES.map(c => `
      <div class="basket" data-cat="${c.id}">
        <span class="ico">${c.icon}</span>
        <span class="lbl">${c.label}</span>
        <span class="cnt" id="cnt-${c.id}">0</span>
      </div>`).join('');
  }
  function basketAt(x, y) {
    // elementsFromPoint видит и то, что под самим блоком в руке
    for (const el of document.elementsFromPoint(x, y)) {
      const b = el.closest && el.closest('.basket');
      if (b) return b;
    }
    return null;
  }
  function highlight(basket) {
    document.querySelectorAll('.basket.over').forEach(b => { if (b !== basket) b.classList.remove('over'); });
    if (basket) basket.classList.add('over');
  }

  // ============================================================
  // 6. ПАДАЮЩИЙ БЛОК
  // ============================================================
  async function spawnBlock() {
    const my = game;
    if (my.paused || my.over || my.spawning) return;
    removeBlock();
    my.spawning = true;
    let next;
    try { next = await api('next'); }
    catch (e) {
      my.spawning = false;
      if (my !== game || my.over) return;
      if (e.message === 'Слишком рано') { my.spawnTimer = setTimeout(spawnBlock, 300); return; }
      return connectionLost(e);
    }
    my.spawning = false;
    if (my !== game || my.over) return;
    if (next.empty) { finish(next.won ? 'win' : 'lose'); return; }
    if (my.paused) { my.pending = next; return; }
    showBlock(next);
  }

  function showBlock(concept) {
    game.concept = concept;
    game.answering = false;
    game.holdMs = 0;          // время в руке считается заново для каждого блока
    game.holdStart = 0;
    const b = document.createElement('div');
    b.className = 'block';
    b.textContent = concept.text;
    field.appendChild(b);
    game.block = b;
    // Ширина известна только после вставки — блок не должен вылезать за край
    const maxX = Math.max(0, field.clientWidth - b.offsetWidth - 8);
    game.x = 8 + Math.random() * Math.max(0, maxX - 8);
    game.y = -b.offsetHeight;
    place();
    b.addEventListener('pointerdown', onDown);
    game.last = 0;
    game.raf = requestAnimationFrame(fall);
  }

  // Позиция — через left/top: transform занят анимацией появления блока
  function place() {
    if (!game.block) return;
    game.block.style.left = Math.round(game.x) + 'px';
    game.block.style.top = Math.round(game.y) + 'px';
  }

  function fall(ts) {
    if (game.paused || game.drag || !game.block || game.answering) return;
    if (!game.last) game.last = ts;
    // Ограничиваем шаг: после зависания вкладки блок не «телепортируется» вниз
    const dt = Math.min(0.05, (ts - game.last) / 1000);
    game.last = ts;
    const k = clamp(field.clientHeight / REF_FIELD_H, 0.6, 1.15);
    const speed = game.level.speed * k;
    game.y += speed * dt;
    place();
    const left = field.clientHeight - (game.y + game.block.offsetHeight);
    if (left <= 0) {
      sfx.miss();
      answer(null, null);
      return;
    }
    // До низа меньше полутора секунд — блок и линия внизу мигают красным
    setDanger(left / speed < DANGER_SEC);
    game.raf = requestAnimationFrame(fall);
  }

  function setDanger(on) {
    if (game.block) game.block.classList.toggle('danger', on);
    field.classList.toggle('danger', on);
  }

  function removeBlock() {
    setDanger(false);
    if (game.block) {
      game.block.remove();
      game.block = null;
    }
    game.concept = null;
    game.drag = null;
    highlight(null);
  }

  // ============================================================
  // 7. ПЕРЕТАСКИВАНИЕ — мышь и палец одним кодом (pointer events)
  //
  // Пока блок в руке, он висит над всем экраном (position: fixed) и
  // двигается в координатах экрана, а точка, за которую его взяли,
  // остаётся ровно под пальцем. Раньше блок оставался внутри поля, но
  // получал координаты экрана — и уезжал от пальца на высоту панели
  // сверху, а у корзин и вовсе прятался за краем поля.
  // ============================================================
  function onDown(e) {
    const b = game.block;
    if (!b || game.paused || game.answering || game.drag || e.currentTarget !== b) return;
    if (e.button !== undefined && e.button > 0) return;   // только левая кнопка
    e.preventDefault();
    sfx.pick();
    cancelAnimationFrame(game.raf);

    const r = b.getBoundingClientRect();
    game.drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
    setDanger(false);              // блок в руке — уже не падает
    b.classList.add('dragging');
    game.holdStart = performance.now();
    clearInterval(game.holdTimer);
    game.holdTimer = setInterval(holdTick, 50);
    b.style.width = r.width + 'px';   // в fixed-режиме ширина не должна «переломиться»
    moveTo(e.clientX, e.clientY);
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* старые браузеры */ }
    b.addEventListener('pointermove', onMove);
    b.addEventListener('pointerup', onUp);
    b.addEventListener('pointercancel', onCancel);
  }

  function moveTo(cx, cy) {
    const d = game.drag, b = game.block;
    if (!d || !b) return;
    b.style.left = (cx - d.dx) + 'px';
    b.style.top = (cy - d.dy) + 'px';
    highlight(basketAt(cx, cy) || basketAt(cx - d.dx + d.w / 2, cy - d.dy + d.h / 2));
  }

  function onMove(e) {
    if (!game.drag || e.pointerId !== game.drag.id) return;
    e.preventDefault();
    moveTo(e.clientX, e.clientY);
  }

  function endDrag() {
    const b = game.block;
    if (b) {
      b.removeEventListener('pointermove', onMove);
      b.removeEventListener('pointerup', onUp);
      b.removeEventListener('pointercancel', onCancel);
      b.classList.remove('glitching', 'hard');
    }
    // время в руке копится за все захваты этого блока: отпустил на миг
    // и схватил снова — счёт продолжается, а не начинается заново
    clearInterval(game.holdTimer);
    if (game.holdStart) { game.holdMs += performance.now() - game.holdStart; game.holdStart = 0; }
    const d = game.drag;
    game.drag = null;
    highlight(null);
    return d;
  }

  function heldMs() {
    return game.holdMs + (game.holdStart ? performance.now() - game.holdStart : 0);
  }

  // Пока блок в руке: с 3-й секунды он «сбоит» и трещит, на 5-й — глюк
  function holdTick() {
    const b = game.block;
    if (!game.drag || !b || game.answering || game.over) { clearInterval(game.holdTimer); return; }
    const ms = heldMs();
    const warn = ms >= HOLD_WARN_MS, hard = ms >= HOLD_HARD_MS;
    b.classList.toggle('glitching', warn);
    b.classList.toggle('hard', hard);
    const now = performance.now();
    if (warn && now - game.lastTick > (hard ? 160 : 320)) { game.lastTick = now; sfx.glitchTick(hard); }
    if (ms >= HOLD_LIMIT_MS) timeUp();
  }

  // Слишком долго: блок вырывается из руки, глюк его съедает — это ошибка
  function timeUp() {
    const my = game, b = my.block;
    if (!b || my.answering || my.over) return;
    endDrag();
    b.classList.add('held', 'glitching', 'hard');   // остаётся там, где его держали
    let done;
    const eaten = new Promise(res => { done = res; });
    glitchAttack(my, b, done);
    // сервер получает «блок упал» сразу, а итог покажем, когда глюк доест блок
    answer(null, null, { reason: 'slow', waitFor: eaten });
  }

  // Глюк собирается из пикселей в случайном месте поля, летит к блоку,
  // уничтожает его и рассыпается сам
  function glitchAttack(my, b, done) {
    const later = (fn, ms) => { const id = setTimeout(() => { if (my === game && !my.over) fn(); }, ms); my.fxTimers.push(id); };
    const fr = field.getBoundingClientRect(), br = b.getBoundingClientRect();
    const sc = fr.width < 520 ? 1.5 : 2;
    const GW = SPR_W * sc, GH = SPR_H * sc;
    // точка появления: самая дальняя от блока из нескольких случайных
    let best = null;
    for (let i = 0; i < 10; i++) {
      const x = fr.left + 10 + Math.random() * Math.max(10, fr.width - GW - 20);
      const y = fr.top + 50 + Math.random() * Math.max(10, fr.height - GH - 60);
      const d = Math.hypot(x + GW / 2 - (br.left + br.width / 2), y + GH / 2 - (br.top + br.height / 2));
      if (!best || d > best.d) best = { x, y, d };
    }
    const cv = document.createElement('canvas');
    cv.width = SPR_W; cv.height = SPR_H;
    cv.className = 'gl-ghost';
    cv.style.cssText = `left:${Math.round(best.x)}px;top:${Math.round(best.y)}px;width:${GW}px;height:${GH}px`;
    document.body.appendChild(cv);
    my.fxEls.push(cv);
    const t0 = performance.now();
    paintGhost(cv, 0);
    const anim = setInterval(() => paintGhost(cv, performance.now() - t0), 90);
    my.fxTimers.push(anim);

    // 1) пиксели слетаются в фигуру глюка
    sfx.ghostIn();
    pixelBurst(my, best.x, best.y, GW, GH, sc * 4, 'in');
    later(() => cv.classList.add('on'), 380);
    // 2) летит к блоку (шагами, по-пиксельному)
    later(() => {
      const r = b.getBoundingClientRect();
      cv.style.left = Math.round(r.left + r.width / 2 - GW / 2) + 'px';
      cv.style.top = Math.round(r.top + r.height / 2 - GH * 0.55) + 'px';
    }, 620);
    // 3) кусает: блок рассыпается на пиксели цветов глюка
    later(() => {
      cv.classList.add('bite');
      sfx.crunch();
      dissolve(b, ['#00e5ff', '#ff4d6d', '#ffffff', '#005566', '#b24bff']);
      done();
    }, 1100);
    // 4) глюк рассыпается и исчезает
    later(() => {
      const r = cv.getBoundingClientRect();
      sfx.ghostOut();
      pixelBurst(my, r.left, r.top, r.width, r.height, sc * 4, 'out');
      cv.remove();
      clearInterval(anim);
    }, 1650);
  }

  // Пиксели глюка: 'in' — слетаются в прямоугольник, 'out' — разлетаются из него
  function pixelBurst(my, x, y, w, h, size, dir) {
    const step = Math.round(size * 2);
    for (let py = 0; py < h; py += step) {
      for (let px = 0; px < w; px += step) {
        if (Math.random() < 0.35) continue;
        const p = document.createElement('div');
        p.className = dir === 'in' ? 'gl-px' : 'px-particle';
        const a = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 90;
        p.style.cssText = `left:${Math.round(x + px)}px;top:${Math.round(y + py)}px;width:${size}px;height:${size}px;` +
          `background:${GHOST_COLORS[Math.floor(Math.random() * GHOST_COLORS.length)]};` +
          `--dx:${Math.round(Math.cos(a) * dist)}px;--dy:${Math.round(Math.sin(a) * dist)}px;animation-delay:${Math.round(Math.random() * 120)}ms`;
        document.body.appendChild(p);
        my.fxEls.push(p);
        setTimeout(() => p.remove(), 900);
      }
    }
  }

  // Вернуть блок в поле там, где его отпустили (в пределах поля)
  function backToField(cx, cy, d) {
    const b = game.block;
    if (!b) return;
    const f = field.getBoundingClientRect();
    b.classList.remove('dragging');
    b.style.left = ''; b.style.top = ''; b.style.width = '';
    game.x = clamp(cx - d.dx - f.left, 0, Math.max(0, f.width - b.offsetWidth));
    game.y = clamp(cy - d.dy - f.top, -b.offsetHeight / 2, Math.max(0, f.height - b.offsetHeight - 6));
    place();
  }

  function onUp(e) {
    if (!game.drag || e.pointerId !== game.drag.id) return;
    const d = endDrag();
    // Сначала — корзина под пальцем, потом — под серединой блока:
    // палец закрывает цель, и бросок «чуть мимо» не должен пропадать
    const basket = basketAt(e.clientX, e.clientY) || basketAt(e.clientX - d.dx + d.w / 2, e.clientY - d.dy + d.h / 2);
    if (basket && !game.paused) {
      game.block.classList.add('held');   // висит там, где отпустили, пока отвечает сервер
      answer(basket.dataset.cat, basket);
      return;
    }
    backToField(e.clientX, e.clientY, d);
    if (!game.paused) { game.last = 0; game.raf = requestAnimationFrame(fall); }
  }

  function onCancel(e) {
    if (!game.drag) return;
    const d = endDrag();
    backToField(e.clientX || 0, e.clientY || 0, d);
    if (!game.paused) { game.last = 0; game.raf = requestAnimationFrame(fall); }
  }

  // ============================================================
  // 8. ОТВЕТ
  // ============================================================
  // category === null — блок упал (или его съел глюк: opts.reason === 'slow')
  async function answer(category, basket, opts = {}) {
    const my = game, concept = my.concept;
    if (!concept || my.answering || my.over) return;
    my.answering = true;
    cancelAnimationFrame(my.raf);

    let r;
    const send = () => api('answer', { index: concept.index, category });
    try {
      try { r = await send(); }
      catch (e) {
        if (e.message !== 'Слишком рано') throw e;
        await sleep(400);
        r = await send();
      }
    } catch (e) { if (my === game && !my.over) connectionLost(e); return; }
    if (my !== game || my.over) return;
    if (opts.waitFor) {                 // ждём, пока глюк доест блок
      await opts.waitFor;
      if (my !== game || my.over) return;
    }

    const prevScore = my.score;
    my.score = r.score;
    my.correct = r.correct_count;
    my.errors = r.errors;
    const prevLives = my.lives;
    my.lives = r.lives;
    // Блок забираем у партии, но не стираем сразу — сначала его анимация
    const el = my.block;
    my.block = null;
    removeBlock();
    if (r.correct) { putInto(el, basket || document.querySelector(`.basket[data-cat="${category}"]`)); onRight(r, category); }
    else {
      if (opts.reason === 'slow') { if (el) el.remove(); }    // уже рассыпан глюком
      else dissolve(el);
      onWrong(r, category, prevScore - r.score, opts.reason);
    }
    refreshHud(prevLives);

    if (r.finished) {
      my.over = true;
      (r.won ? sfx.win : sfx.lose)();
      setTimeout(() => { if (my === game) finish(r.won ? 'win' : 'lose'); }, 700);
      return;
    }
    // после глюка — пауза подольше: он ещё рассыпается
    my.spawnTimer = setTimeout(spawnBlock, r.correct ? 550 : opts.reason === 'slow' ? 1100 : 800);
  }

  function setTip(html, kind) {
    const t = $('tip');
    t.innerHTML = html;
    t.className = 'tip pixel-text ' + kind;
  }

  function onRight(r, category) {
    sfx.right();
    const cnt = $('cnt-' + category);
    if (cnt) cnt.textContent = Number(cnt.textContent || 0) + 1;
    const el = document.querySelector(`.basket[data-cat="${category}"]`);
    if (el) {
      const rc = el.getBoundingClientRect();
      burst('+' + r.points, true, rc.left + rc.width / 2, rc.top - 6);
    }
    setTip(`<b>ВЕРНО:</b> ${esc(r.hint || r.text)}`, 'good');
  }

  function onWrong(r, category, penalty, reason) {
    const slow = reason === 'slow';
    game.errorLog.push({ text: r.text, hint: r.hint, missed: category === null && !slow, slow });
    if (slow) {
      setTip(`<b>ВЫ СЛИШКОМ ДОЛГО ДУМАЛИ:</b> ${esc(r.hint || r.text)}`, 'bad');
    } else if (category === null) {
      setTip(`<b>УПАЛ:</b> ${esc(r.hint || r.text)}`, 'bad');
    } else {
      sfx.wrong();
      setTip(`<b>НЕ ТА КОРЗИНА:</b> ${esc(r.hint || r.text)}`, 'bad');
    }
    const hud = document.querySelector('.hud');
    hud.classList.remove('shake'); void hud.offsetWidth; hud.classList.add('shake');
    const f = field.getBoundingClientRect();
    if (penalty > 0) burst('-' + penalty, false, f.left + f.width / 2, f.top + f.height * 0.4);
  }

  function burst(text, good, x, y) {
    const b = document.createElement('div');
    b.className = 'burst pixel-text ' + (good ? 'p' : 'm');
    b.textContent = text;
    b.style.left = x + 'px'; b.style.top = y + 'px';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 750);
  }
  // Верно: блок «опускается» в корзину — уменьшается и уходит в её центр.
  // Корзина при этом своего цвета не меняет.
  function putInto(el, basket) {
    if (!el) return;
    if (!basket) { el.remove(); return; }
    const r = el.getBoundingClientRect();
    const b = basket.getBoundingClientRect();
    fixAt(el, r);
    const dx = b.left + b.width / 2 - (r.left + r.width / 2);
    const dy = b.top + b.height / 2 - (r.top + r.height / 2);
    requestAnimationFrame(() => {
      el.classList.add('into');
      el.style.transform = `translate(${dx}px, ${dy}px) scale(.2)`;
    });
    setTimeout(() => el.remove(), 320);
  }

  // Ошибка: блок рассыпается на красные пиксели, и они осыпаются вниз
  function dissolve(el, palette) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.remove();
    const step = r.width > 160 ? 10 : 8;
    const colors = palette || ['#ff4d6d', '#ff4d6d', '#c2183c', '#ff8fa3'];
    for (let y = r.top; y < r.bottom - 1; y += step) {
      for (let x = r.left; x < r.right - 1; x += step) {
        const p = document.createElement('div');
        p.className = 'px-particle';
        const fromCenter = (x - (r.left + r.width / 2)) / (r.width / 2);
        const dx = Math.round(fromCenter * 30 + (Math.random() - 0.5) * 30);
        const dy = Math.round(30 + Math.random() * 70);
        p.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;width:${step - 2}px;height:${step - 2}px;` +
          `background:${colors[Math.floor(Math.random() * colors.length)]};--dx:${dx}px;--dy:${dy}px;animation-delay:${Math.round(Math.random() * 120)}ms`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 900);
      }
    }
  }

  // Закрепить блок на экране там, где он сейчас виден (анимация идёт поверх всего)
  function fixAt(el, r) {
    if (el.parentNode !== document.body) document.body.appendChild(el);
    el.classList.add('dragging');
    el.style.left = r.left + 'px';
    el.style.top = r.top + 'px';
    el.style.width = r.width + 'px';
  }

  // ============================================================
  // HUD
  // ============================================================
  function refreshHud(prevLives) {
    $('h-score').textContent = game.score;
    $('h-prog').textContent = `${game.correct}/${game.level.target}`;
    $('h-lname').textContent = `${game.level.id}. ${game.level.name}`;
    $('h-bar').style.width = Math.min(100, Math.round(game.correct / game.level.target * 100)) + '%';
    $('h-hearts').innerHTML = Array.from({ length: game.level.lives }, (_, i) => {
      const lost = i >= game.lives;
      const pop = prevLives !== undefined && i === game.lives && i < prevLives;
      return HEART.replace('class="heart"', `class="heart${lost ? ' lost' : ''}${pop ? ' pop' : ''}"`);
    }).join('');
  }

  // ============================================================
  // ПАУЗА
  // ============================================================
  function setPause(on) {
    if (screen !== 'game' || game.over || game.paused === on) return;
    game.paused = on;
    sfx.pause();
    $('pause-ov').classList.toggle('hidden', !on);
    $('btn-pause').textContent = on ? '>' : '||';
    if (on) {
      cancelAnimationFrame(game.raf);
      clearTimeout(game.spawnTimer);
      // Блок в руке на паузе возвращаем в поле
      if (game.drag && game.block) {
        const d = endDrag();
        const r = game.block.getBoundingClientRect();
        backToField(r.left + d.dx, r.top + d.dy, d);
      }
      return;
    }
    if (game.block && !game.answering) { game.last = 0; game.raf = requestAnimationFrame(fall); }
    else if (game.pending) { const c = game.pending; game.pending = null; showBlock(c); }
    else if (!game.block && !game.answering && !game.spawning) { game.spawnTimer = setTimeout(spawnBlock, 300); }
  }
  $('btn-pause').addEventListener('click', () => setPause(!game.paused));
  $('btn-resume').addEventListener('click', () => setPause(false));
  // Свернули вкладку или переключились — игра сама встаёт на паузу
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });

  // ============================================================
  // РЕЗУЛЬТАТ
  // ============================================================
  function finish(result) {
    const my = game;
    stopGame();
    const won = result === 'win';
    const total = my.correct + my.errors;
    const acc = total ? Math.round(my.correct / total * 100) : 0;

    $('r-title').textContent = won ? 'УРОВЕНЬ ПРОЙДЕН' : 'ИГРА ОКОНЧЕНА';
    $('r-title').className = 'result-title pixel-text' + (won ? '' : ' lose');
    $('r-sub').textContent = `${my.level.id}. ${my.level.name} · собрано ${my.correct} из ${my.level.target}`;
    $('r-score').textContent = my.score;
    $('r-ok').textContent = my.correct;
    $('r-err').textContent = my.errors;
    $('r-acc').textContent = acc + '%';
    $('btn-nextlvl').classList.toggle('hidden', !(won && my.level.id < LEVELS.length));

    $('r-review').innerHTML = my.errorLog.length
      ? '<h3 class="pixel-text">// РАЗБОР ОШИБОК</h3>' + my.errorLog.map(e =>
          `<div class="rv"><div class="q pixel-text">${esc(e.text)}${e.slow ? ' <span class="e">(слишком долго)</span>' : e.missed ? ' <span class="e">(упал)</span>' : ''}</div><div class="e">${esc(e.hint)}</div></div>`).join('')
      : (total ? '<div class="review-ok pixel-text">Ни одной ошибки — отличная сортировка!</div>' : '');

    // Итог берёт сервер из своей партии — payload не нужен
    $('r-saved').textContent = '';
    if (typeof submitScore === 'function') {
      submitScore('sorter', {}).then(res => {
        if (!res) return;
        if (typeof res.total_game_score === 'number') $('r-saved').textContent = `Очки сохранены. Всего в игре: ${res.total_game_score}`;
        else if (res.is_record) $('r-saved').textContent = 'Новый рекорд сохранён!';
      });
    }
    show('result');
  }

  function connectionLost(e) {
    console.error(e);
    stopGame();
    toast('Нет связи с сервером — партия прервана, попробуй ещё раз', true);
    show('menu');
  }

  // ============================================================
  // КНОПКИ И КЛАВИШИ
  // ============================================================
  function toMenu() { stopGame(); sfx.click(); show('menu'); }
  $('btn-esc').addEventListener('click', toMenu);
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-retry').addEventListener('click', () => { if (game.level) startLevel(game.level.id); });
  $('btn-nextlvl').addEventListener('click', () => { if (game.level) startLevel(game.level.id + 1); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (screen === 'menu') { location.href = '../../index.html'; return; }
      if (screen === 'howto') { show('menu'); return; }
      toMenu();
      return;
    }
    if (screen !== 'game') return;
    if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') setPause(!game.paused);
  });

  // На смену размера (поворот телефона) держим блок внутри поля
  addEventListener('resize', () => {
    if (!game.block || game.drag) return;
    game.x = clamp(game.x, 0, Math.max(0, field.clientWidth - game.block.offsetWidth));
    place();
  });

  show('menu');
})();
