/* =========================================================
   ГЛЮК-АТАКА — отрисовка поля (canvas).
   Здесь только рисование и «физика» эффектов (частицы, лазеры, всплывающий текст).
   Правила игры — в game.js.
   ========================================================= */
(function () {
  'use strict';

  const C = {
    bg: '#080c14', card: '#0d1626', card2: '#111e35', border: '#1a3a6b', glow: '#2a5fbf',
    cyan: '#00e5ff', green: '#39ff14', orange: '#ff8c1a', pink: '#ff4d6d', purple: '#b24bff',
    yellow: '#f5d800', white: '#ffffff', text: '#c8d8f0', dim: '#5a7a9a',
  };
  const FONT = '"Press Start 2P", monospace';

  // Палитры призрака. BLUE — ровно как в CodeQuest (drawMonster, тип 2).
  const PAL = {
    blue: { dark: '#003a44', body: '#005566', eye: '#00ffff', fx: '0,229,255' },
    red:  { dark: '#5a0018', body: '#a0002a', eye: '#ff4d6d', fx: '255,77,109' },
    cyan: { dark: '#00303a', body: '#00808f', eye: '#aaffff', fx: '0,229,255' },
  };

  // Палитра призрака из цвета темы: глаза — сам цвет (чуть светлее), тело и тень — он же, затемнённый.
  // Пропорции взяты из голубого призрака CodeQuest (#00ffff → #005566 → #003a44).
  const palCache = {};
  function palFromColor(hex) {
    if (palCache[hex]) return palCache[hex];
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const mix = (k, w) => '#' + [r, g, b].map(c => Math.round(Math.min(255, c * k + 255 * w)).toString(16).padStart(2, '0')).join('');
    const p = { dark: mix(0.27, 0), body: mix(0.41, 0), eye: mix(0.85, 0.15), fx: `${r},${g},${b}` };
    p.flash = { dark: mix(0.45, 0.05), body: mix(0.6, 0.1), eye: '#ffffff', fx: p.fx };
    return (palCache[hex] = p);
  }

  // ---------- спрайт призрака ----------
  // Перенос drawMonster (тип 2) из games/pixelgame/js/game.js: рисуем в маленький
  // холст 48×44 «в клетках» и масштабируем без сглаживания.
  // Время анимации — из игрового цикла (в мс), а не Date.now(), чтобы пауза его тоже останавливала.
  const SPR_W = 48, SPR_H = 44;
  function makeSprite() { const c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H; return c; }
  const sprites = { a: makeSprite(), b: makeSprite(), c: makeSprite() };

  function paintGhost(cv, tMs, walk, pal) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, SPR_W, SPR_H);
    // пиксельный распад
    g.fillStyle = `rgba(${pal.fx},0.15)`;
    const seed = Math.floor(tMs / 300);
    for (let i = 0; i < 6; i++) {
      const rx = 4 + (((seed * 7 + i * 13) % 5) * 8);
      const ry = 2 + (((seed * 11 + i * 7) % 5) * 8);
      g.fillRect(rx, ry, 6, 6);
    }
    // тело
    g.fillStyle = pal.dark; g.fillRect(8, 6, 24, 26);
    g.fillStyle = pal.body; g.fillRect(10, 4, 20, 24);
    // волнистый низ
    const wb = walk * 3;
    g.fillStyle = pal.body;
    g.fillRect(8, 28, 8, 6 + wb); g.fillRect(20, 28, 8, 6 - wb); g.fillRect(32, 28, 8, 6 + wb);
    g.fillStyle = pal.dark; g.fillRect(16, 28, 4, 4); g.fillRect(28, 28, 4, 4);
    // глаза-крестики
    g.fillStyle = pal.eye;
    [[13, 10], [23, 10]].forEach(([ex, ey]) => { g.fillRect(ex, ey, 2, 6); g.fillRect(ex - 2, ey + 2, 6, 2); });
    // мерцание
    if (Math.sin(tMs / 150) > 0.6) { g.fillStyle = `rgba(${pal.fx},0.3)`; g.fillRect(8, 4 + walk * 2, 24, 3); }
    // полосы помех
    g.fillStyle = `rgba(${pal.fx},0.12)`; g.fillRect(8, 14, 24, 2); g.fillRect(8, 20, 24, 2);
    return cv;
  }
  // центр тела призрака в клетках спрайта
  const GC_X = 24, GC_Y = 19;

  function drawGhost(ctx, x, y, s, tMs, alpha, pal) {
    const walk = Math.floor(tMs / 260) % 2;
    paintGhost(sprites.a, tMs, walk, pal || PAL.blue);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(x - 12 * s), Math.round(y + 17 * s), Math.round(24 * s), Math.max(2, Math.round(2 * s)));
    ctx.drawImage(sprites.a, Math.round(x - GC_X * s), Math.round(y - GC_Y * s), Math.round(SPR_W * s), Math.round(SPR_H * s));
    ctx.restore();
  }

  // Босс: тот же призрак, но огромный, с RGB-расслоением и сдвигом строк.
  function drawBoss(ctx, b, tMs) {
    const s = b.s, walk = Math.floor(tMs / 200) % 2;
    const x0 = Math.round(b.x - GC_X * s), y0 = Math.round(b.y - GC_Y * s);
    const bp = b.pal || PAL.blue;
    paintGhost(sprites.a, tMs, walk, b.flash > 0 ? (bp.flash || PAL.cyan) : bp);
    paintGhost(sprites.b, tMs, walk, PAL.red);
    const jit = Math.round(Math.sin(tMs / 90) * 3 * (s / 8)) + Math.round(6 * s / 8);
    ctx.save();
    ctx.globalAlpha = (b.alpha == null ? 1 : b.alpha) * 0.55;
    ctx.drawImage(sprites.b, x0 - jit, y0, SPR_W * s, SPR_H * s);
    ctx.globalAlpha = (b.alpha == null ? 1 : b.alpha) * 0.35;
    ctx.drawImage(sprites.a, x0 + jit, y0 + 2, SPR_W * s, SPR_H * s);
    ctx.globalAlpha = b.alpha == null ? 1 : b.alpha;
    // строки по 2 клетки; некоторые сдвигаются — «глитч»
    const tick = Math.floor(tMs / 110);
    for (let row = 0; row < SPR_H; row += 2) {
      const h = hash(row * 31 + tick * 7);
      const glitchy = (b.flash > 0) || h > 0.86;
      const dx = glitchy ? Math.round((hash(row + tick) - 0.5) * 10) * Math.round(s / 2) : 0;
      ctx.drawImage(sprites.a, 0, row, SPR_W, 2, x0 + dx, y0 + row * s, SPR_W * s, 2 * s);
    }
    ctx.restore();

    // полоска здоровья над боссом
    const segW = Math.round(Math.max(36, s * 9)), segH = Math.max(10, Math.round(s * 2)), gap = Math.round(segW * 0.12);
    const total = b.maxHp * segW + (b.maxHp - 1) * gap;
    const bx = Math.round(b.x - total / 2), by = Math.round(y0 - segH - Math.max(14, s * 3));
    for (let i = 0; i < b.maxHp; i++) {
      ctx.fillStyle = i < b.hp ? C.pink : '#2a1a26';
      ctx.fillRect(bx + i * (segW + gap), by, segW, segH);
    }
    const fs = Math.max(8, Math.round(segH * 0.8));
    text(ctx, 'ГЛЮК-ЯДРО', bx - 10, by + segH / 2 - fs / 2, fs, C.pink, 'right');
  }

  // ---------- мелкие помощники ----------
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function text(ctx, t, x, y, px, color, align, glow) {
    ctx.font = `${px}px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = align || 'left';
    if (glow) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = glow; ctx.fillStyle = color; ctx.fillText(t, x, y); ctx.restore(); }
    ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  function bitmap(ctx, rows, x, y, u, pal) {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const col = pal[r[i]];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x + i * u, y + j * u, u, u); }
      }
    }
  }
  function tag(ctx, label, cx, y, px, color) {
    ctx.font = `${px}px ${FONT}`;
    const w = Math.round(ctx.measureText(label).width + px * 1.6), h = Math.round(px * 2.2), b = Math.max(2, Math.round(px / 5));
    const x = Math.round(cx - w / 2);
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.bg; ctx.fillRect(x + b, y + b, w - 2 * b, h - 2 * b);
    text(ctx, label, cx, y + Math.round((h - px) / 2) + 1, px, color, 'center');
  }

  // ---------- пушка ----------
  const CANNON = [
    '....BBB....',
    '....DLD....',
    '....DLD....',
    '....DLD....',
    '...KDLDK...',
    '..KPPPPPK..',
    '.KPPWPPPPK.',
    '.KPPPPPPPK.',
    'KKKKKKKKKKK',
    'KGGGGGGGGGK',
    'KGGLGGGLGGK',
    'KKKKKKKKKKK',
  ];
  function drawCannon(ctx, cx, bottom, u, flash, flashColor, label) {
    const on = flash > 0;
    const recoil = on ? Math.round(u * 0.6 * flash) : 0;
    const x = Math.round(cx - 5.5 * u), y = Math.round(bottom - 12 * u + recoil);
    bitmap(ctx, CANNON, x, y, u, {
      B: on ? flashColor : C.glow, D: C.border, L: on ? flashColor : C.glow, K: '#05080e',
      P: on ? '#7a2bd0' : '#4a1f80', W: C.purple, G: C.card2,
    });
    if (on) {
      ctx.save(); ctx.globalAlpha = flash; ctx.shadowColor = flashColor; ctx.shadowBlur = u * 5;
      ctx.fillStyle = flashColor; ctx.fillRect(Math.round(cx - 2 * u), y - u, 4 * u, 2 * u); ctx.restore();
    }
    if (label) text(ctx, label, cx, y + 9 * u + 1, Math.max(6, Math.round(u * 1.5)), on ? flashColor : C.dim, 'center');
    return { x: cx, y: y }; // кончик ствола
  }

  // ---------- сердечко (для HUD, в DOM через SVG) ----------
  const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  function heartSVG(full) {
    let r = '';
    HEART.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') r += `<rect x="${i}" y="${j}" width="1" height="1"/>`; }));
    return `<svg class="heart" viewBox="0 0 7 6" shape-rendering="crispEdges" fill="${full ? C.pink : '#2a1a26'}">${r}</svg>`;
  }
  function speakerSVG(muted) {
    const body = '<rect x="0" y="4" width="3" height="5"/><rect x="3" y="3" width="1" height="7"/><rect x="4" y="2" width="1" height="9"/><rect x="5" y="1" width="1" height="11"/>';
    const waves = muted
      ? '<rect x="8" y="4" width="1" height="1"/><rect x="9" y="5" width="1" height="1"/><rect x="10" y="6" width="1" height="1"/><rect x="11" y="7" width="1" height="1"/><rect x="12" y="8" width="1" height="1"/><rect x="12" y="4" width="1" height="1"/><rect x="11" y="5" width="1" height="1"/><rect x="9" y="7" width="1" height="1"/><rect x="8" y="8" width="1" height="1"/>'
      : '<rect x="7" y="5" width="1" height="3"/><rect x="9" y="3" width="1" height="7"/><rect x="11" y="1" width="1" height="11"/>';
    return `<svg class="spk" viewBox="0 0 13 13" shape-rendering="crispEdges" fill="currentColor">${body}${waves}</svg>`;
  }

  // ---------- фон ----------
  const stars = [];
  for (let i = 0; i < 140; i++) stars.push({ x: hash(i * 3.1), y: hash(i * 7.7), s: hash(i * 1.3) < 0.8 ? 1 : 2, tw: hash(i * 9.9) * 6.28, c: hash(i * 5.5) < 0.5 });

  function drawBackground(ctx, W, H, tMs, top, danger) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const cell = W < 820 ? 32 : 48;
    ctx.fillStyle = 'rgba(26,58,107,0.28)';
    for (let x = 0; x <= W; x += cell) ctx.fillRect(x, top, 1, H - top);
    for (let y = top; y <= H; y += cell) ctx.fillRect(0, y, W, 1);
    const px = W < 820 ? 2 : 3;
    stars.forEach(st => {
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(tMs / 700 + st.tw));
      ctx.fillStyle = st.c ? `rgba(0,229,255,${a})` : `rgba(200,216,240,${a})`;
      ctx.fillRect(Math.round(st.x * W), Math.round(top + st.y * (H - top)), st.s * px, st.s * px);
    });
    if (danger > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(255,40,80,0)'); g.addColorStop(1, `rgba(255,40,80,${0.32 * danger})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
  function drawCRT(ctx, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  }

  // ---------- сервер ----------
  function drawServer(ctx, W, y, h, tMs, hit, mobile) {
    ctx.fillStyle = C.card; ctx.fillRect(0, y, W, h);
    ctx.fillStyle = hit > 0 ? C.pink : C.glow; ctx.fillRect(0, y, W, Math.max(2, Math.round(h / 16)));
    const slot = mobile ? 18 : 34, sw = mobile ? 14 : 26, pad = Math.round(h * 0.2);
    const label = mobile ? '' : 'СЕРВЕР GAMECODE';
    ctx.font = `${Math.round(h * 0.26)}px ${FONT}`;
    const lw = label ? ctx.measureText(label).width + 40 : 0;
    const tick = Math.floor(tMs / 240);
    for (let x = 12, i = 0; x < W - sw; x += slot, i++) {
      if (label && Math.abs(x + sw / 2 - W / 2) < lw / 2) continue;
      ctx.fillStyle = C.card2; ctx.fillRect(x, y + pad, sw, h - 2 * pad);
      const r = hash(i * 13 + Math.floor((tick + i * 3) / 4));
      ctx.fillStyle = hit > 0 && r < 0.6 ? C.pink : (r < 0.7 ? C.green : r < 0.85 ? C.cyan : C.orange);
      const led = Math.max(2, Math.round(h * 0.1));
      ctx.fillRect(x + 3, y + pad + 3, led, led);
      if (!mobile) { ctx.fillStyle = C.border; ctx.fillRect(x + 4, y + h * 0.55, sw - 8, 2); ctx.fillRect(x + 4, y + h * 0.66, sw - 8, 2); }
    }
    if (label) text(ctx, label, W / 2, y + h / 2 - h * 0.13, Math.round(h * 0.26), hit > 0 ? C.pink : C.cyan, 'center');
    if (hit > 0) { ctx.fillStyle = `rgba(255,77,109,${0.25 * hit})`; ctx.fillRect(0, y, W, h); }
  }

  // ---------- эффекты ----------
  function drawLaser(ctx, L) {
    const k = L.life / L.max;               // 1 → 0
    const step = Math.max(4, Math.round(L.w * 1.2));
    const n = Math.max(1, Math.round(Math.hypot(L.x2 - L.x1, L.y2 - L.y1) / step));
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.6);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i <= n; i++) {
        const x = Math.round((L.x1 + (L.x2 - L.x1) * i / n) / 2) * 2, y = Math.round((L.y1 + (L.y2 - L.y1) * i / n) / 2) * 2;
        if (pass === 0) { ctx.fillStyle = L.glowColor; ctx.fillRect(x - L.w * 1.2, y - L.w * 1.2, L.w * 2.4, L.w * 2.4); }
        else { ctx.fillStyle = L.color; ctx.fillRect(x - L.w / 2, y - L.w / 2, L.w, L.w);
               ctx.fillStyle = '#efffe8'; ctx.fillRect(x - L.w / 5, y - L.w / 5, L.w / 2.5, L.w / 2.5); }
      }
    }
    ctx.restore();
  }

  // Призрак рассыпается: частицы цвета тела и глаз.
  function burst(world, x, y, s, pal, count) {
    pal = pal || PAL.blue;
    const colors = [pal.body, pal.body, pal.dark, pal.eye, '#ffffff'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 260) * (s / 3.5);
      world.particles.push({
        x: x + (Math.random() - 0.5) * 24 * s, y: y + (Math.random() - 0.5) * 24 * s,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80 * (s / 3.5),
        size: Math.max(2, Math.round(s * (1.5 + Math.random() * 2))),
        color: colors[(Math.random() * colors.length) | 0], life: 0.7 + Math.random() * 0.5, max: 1.2, g: 300 * (s / 3.5),
      });
    }
  }
  function sparks(world, x, y, count, colors, spread) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, sp = 80 + Math.random() * (spread || 260);
      world.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 3 + (Math.random() * 4 | 0),
        color: colors[(Math.random() * colors.length) | 0], life: 0.5 + Math.random() * 0.5, max: 1, g: 500 });
    }
  }
  function updateEffects(world, dt) {
    world.particles = world.particles.filter(p => {
      p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.life > 0;
    });
    world.lasers = world.lasers.filter(L => (L.life -= dt) > 0);
    world.popups = world.popups.filter(p => { p.life -= dt; p.y -= 40 * dt; return p.life > 0; });
    world.bolts = world.bolts.filter(b => { b.t += dt; return b.t < b.dur; });
    for (let i = 0; i < 4; i++) world.cannonFlash[i] = Math.max(0, world.cannonFlash[i] - dt * 2.5);
    world.serverHit = Math.max(0, world.serverHit - dt * 1.6);
    world.shake = Math.max(0, world.shake - dt * 2.2);
  }


  // ---------- Пиксель ----------
  // Все кадры лежат в одинаковых клетках 210×232 (ноги на одной линии, центр тела x=100),
  // поэтому кадр просто подменяется. Какой кадр показать — решает game.js (world.gecko).
  const GECKO_WAG = ['back', 'backR1', 'backR2', 'backR2', 'backR1', 'back', 'backL1', 'backL2', 'backL2', 'backL1'];
  const GECKO_WAG_MS = 85;
  const GECKO_CELL_W = 210, GECKO_CELL_H = 232, GECKO_CX = 100, GECKO_REF_H = 220;
  function drawGecko(ctx, world, imgs, L, tMs) {
    const g = world.gecko || {};
    let frame = g.frame || 'back';
    // спиной Пиксель виляет хвостом: покадровый цикл по игровому времени (на паузе замирает)
    if (frame === 'back') frame = GECKO_WAG[Math.floor(tMs / GECKO_WAG_MS) % GECKO_WAG.length];
    const img = imgs['gecko_' + frame];
    if (!img || !img.complete || !img.naturalWidth) return;
    const k = L.geckoH / GECKO_REF_H;                       // высота «спины» = geckoH
    const w = Math.round(GECKO_CELL_W * k), h = Math.round(GECKO_CELL_H * k);
    const idle = (g.frame || 'back') === 'back' ? Math.sin(tMs / 400) * 0.006 : 0;
    const dy = Math.round(((g.dy || 0) + idle) * L.geckoH);
    ctx.drawImage(img, Math.round(L.geckoX - GECKO_CX * k), Math.round(L.geckoBottom - h + dy), w, h);
  }

  // ---------- кадр ----------
  function frame(ctx, world, imgs) {
    const L = world.layout, W = L.W, H = L.H, t = world.tMs;
    ctx.save();
    if (world.shake > 0) {
      const a = Math.round(world.shake * (L.mobile ? 6 : 12));
      ctx.translate(Math.round((Math.random() - 0.5) * a), Math.round((Math.random() - 0.5) * a));
    }
    drawBackground(ctx, W, H, t, L.top, world.danger);

    if (world.mode === 'menu') {
      // декоративные призраки в меню
      world.deco.forEach((d, i) => {
        const x = (d.x + Math.sin(t / 2400 + i) * 0.03) * W, y = (d.y + Math.sin(t / 900 + i * 2) * 0.01) * H;
        drawGhost(ctx, x, y, d.s * L.decoScale, t + i * 500, d.a, d.color ? palFromColor(d.color) : null);
      });
      drawCRT(ctx, W, H); ctx.restore(); return;
    }

    // очередь призраков
    world.ghosts.forEach(g => {
      if (g.state === 'queue' || g.state === 'approach' || g.state === 'active' || g.state === 'dive') {
        drawGhost(ctx, g.x, g.y, g.s, t + g.seed, g.alpha, g.pal);
        if (g.state === 'queue' && g.tag) tag(ctx, g.tag, g.x, Math.round(g.y - 16 * g.s - L.tagPx * 2.2 - 6), L.tagPx, g.tagColor);
      }
    });

    // босс
    if (world.boss && world.boss.state !== 'gone') drawBoss(ctx, world.boss, t);

    // снаряды босса и «пике» призрака оставляют след
    world.bolts.forEach(b => {
      const k = b.t / b.dur, x = b.x + (b.tx - b.x) * k, y = b.y + (b.ty - b.y) * k * k;
      const sz = b.size;
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = `rgba(255,77,109,${0.12 + j * 0.12})`;
        const kk = Math.max(0, k - (4 - j) * 0.03);
        ctx.fillRect(Math.round(b.x + (b.tx - b.x) * kk - sz / 2), Math.round(b.y + (b.ty - b.y) * kk * kk - sz / 2), sz, sz);
      }
      ctx.save(); ctx.shadowColor = C.pink; ctx.shadowBlur = sz; ctx.fillStyle = C.pink;
      ctx.fillRect(Math.round(x - sz * 0.7), Math.round(y - sz * 0.7), Math.round(sz * 1.4), Math.round(sz * 1.4)); ctx.restore();
    });

    // пушки
    L.cannonsX.forEach((cx, i) => {
      const tip = drawCannon(ctx, cx, L.cannonBottom, L.cannonU, world.cannonFlash[i], world.cannonColor[i], '');
      L.tips[i] = tip;
    });

    world.lasers.forEach(Ls => drawLaser(ctx, Ls));

    // сервер и Пиксель
    drawServer(ctx, W, L.serverY, L.serverH, t, world.serverHit, L.mobile);
    if (L.geckoH > 0) drawGecko(ctx, world, imgs, L, t);

    // частицы и всплывающие очки
    world.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5));
      ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    });
    ctx.globalAlpha = 1;
    world.popups.forEach(p => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 2));
      text(ctx, p.text, p.x, p.y, p.size, p.color, 'center', 14);
    });
    ctx.globalAlpha = 1;

    drawCRT(ctx, W, H);
    ctx.restore();
  }

  // ---------- картинка для экрана «Как играть» ----------
  function drawHowto(cv, tMs) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(26,58,107,0.35)';
    for (let x = 0; x < W; x += 20) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 20) ctx.fillRect(0, y, W, 1);
    const k = (tMs % 2600) / 2600;                         // цикл анимации
    const gy = 20 + 36 * Math.min(1, k / 0.55);
    const hitNow = k > 0.55;
    if (!hitNow) drawGhost(ctx, 290, gy, 1.6, tMs, 1);
    ['1', '2', '3', '4'].forEach((n, i) => {
      const cx = 70 + i * 50;
      drawCannon(ctx, cx, 140, 3, (hitNow && i === 1) ? 1 - (k - 0.55) / 0.45 : 0, C.green, null);
      text(ctx, n, cx, 128 - 3 * 12 - 14, 9, i === 1 ? C.cyan : C.dim, 'center');
    });
    if (hitNow && k < 0.75) {
      drawLaser(ctx, { x1: 120, y1: 104, x2: 290, y2: 56, w: 4, color: C.green, glowColor: 'rgba(57,255,20,0.25)', life: 1, max: 1 });
      ctx.fillStyle = C.cyan;
      for (let i = 0; i < 14; i++) ctx.fillRect(290 + (hash(i) - 0.5) * 70 * (k - 0.5) * 4, 56 + (hash(i + 9) - 0.5) * 60 * (k - 0.5) * 4, 4, 4);
      text(ctx, '+150', 340, 36, 10, C.green, 'left', 8);
    }
    text(ctx, 'жми 1–4 / тап', 300, 118, 8, C.text, 'center');
    ctx.fillStyle = C.glow; ctx.fillRect(0, 142, W, 2);
    ctx.fillStyle = C.card; ctx.fillRect(0, 144, W, 6);
  }

  window.GlitchRender = { C, PAL, palFromColor, frame, updateEffects, burst, sparks, heartSVG, speakerSVG, drawHowto, GC_Y };
})();
