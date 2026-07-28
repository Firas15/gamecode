/*
 * Использование:
 *   <div id="bg-root"></div>
 *   <script src="codequest-bg.js"></script>
 *   <script>CodeQuestBG.mount(document.getElementById('bg-root'));</script>
 * Опции:
 *   seed     (int)    7      — раскладка лабиринта
 *   chests   (int)    6      — сундуков
 *   monsters (int)    5      — глитч-призраков
 *   glow     (float)  1      — сила неона/bloom
 *   showCode (bool)   true   — плавающие фрагменты Go-кода
 *   animate  (bool)   true
 *   purple   (hex)  '#b24bff' — цвет стен
 *   cyan     (hex)  '#00e5ff' — цвет части стен/тумана
 *   dim      (float)  0.42   — ровное затемнение поверх фона
 *
 */
(function (root) {
  var W = 400, H = 304, CELL = 16, COLS = 25, ROWS = 19;

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hexA(h, a) {
    var n = parseInt(h.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var GT = [
    { b: '#005530', s: '#003a18', e: '#00ff88' },
    { b: '#660040', s: '#44002a', e: '#ff69b4' },
    { b: '#005566', s: '#003a44', e: '#00ffff' }
  ];
  var ST = { 1: 3, 2: 2, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1, 9: 2, 10: 3 };
  var POOL = ['func main()', 'fmt.Println', 'go func()', 'if err != nil', ':= range', 'chan<-',
    'package main', 'defer', '101101', '0x1F4A', '11010011', 'return nil', 'var x int', '}',
    'for i :=', 'make([]byte)'];

  function mount(host, opts) {
    opts = opts || {};
    var P = {
      seed: opts.seed != null ? opts.seed : 7,
      chests: opts.chests != null ? opts.chests : 6,
      monsters: opts.monsters != null ? opts.monsters : 5,
      glow: opts.glow != null ? opts.glow : 1,
      showCode: opts.showCode !== false,
      animate: opts.animate !== false,
      purple: opts.purple || '#b24bff',
      cyan: opts.cyan || '#00e5ff',
      dim: opts.dim != null ? opts.dim : 0.42
    };
    var PU = P.purple, CY = P.cyan;

    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.overflow = 'hidden';
    host.style.background = '#080c14';

    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
      'image-rendering:pixelated;display:block';
    host.appendChild(cv);

    // Скан-линии
    var scan = document.createElement('div');
    scan.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;' +
      'background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,' +
      'rgba(0,0,0,0.22) 3px,rgba(0,0,0,0.22) 4px)';
    host.appendChild(scan);

    // Виньетка + ровное затемнение
    var vig = document.createElement('div');
    vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;' +
      'background:radial-gradient(ellipse 70% 60% at 50% 45%,rgba(8,12,20,0.5) 0%,' +
      'rgba(6,9,16,0.74) 62%,rgba(4,6,11,0.95) 100%)';
    host.appendChild(vig);

    var dim = document.createElement('div');
    dim.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:rgba(6,9,16,' + P.dim + ')';
    host.appendChild(dim);

    var ctx = cv.getContext('2d');
    var g, chests, monsters, runes, fog, staticC, bloomC, raf, last = 0;

    function accent() { return PU; }

    function build() {
      var R = rng((P.seed | 0) * 2654435761 + 11), r, c;

      g = [];
      for (r = 0; r < ROWS; r++) { g.push([]); for (c = 0; c < COLS; c++) g[r].push(1); }
      g[1][1] = 0;
      var st = [[1, 1]];
      while (st.length) {
        var cur = st[st.length - 1], cr = cur[0], cc = cur[1];
        var d = [[0, 2], [0, -2], [2, 0], [-2, 0]].sort(function () { return R() - 0.5; });
        var moved = false;
        for (var i = 0; i < 4; i++) {
          var nr = cr + d[i][0], nc = cc + d[i][1];
          if (nr > 0 && nc > 0 && nr < ROWS - 1 && nc < COLS - 1 && g[nr][nc] === 1) {
            g[cr + d[i][0] / 2][cc + d[i][1] / 2] = 0; g[nr][nc] = 0;
            st.push([nr, nc]); moved = true; break;
          }
        }
        if (!moved) st.pop();
      }
      for (r = 1; r < ROWS - 1; r++) for (c = 1; c < COLS - 1; c++)
        if (g[r][c] === 1 && R() < 0.11) g[r][c] = 0;

      var open = [];
      for (r = 1; r < ROWS - 1; r++) for (c = 1; c < COLS - 1; c++) {
        if (g[r][c]) continue;
        var n = 0;
        if (!g[r - 1][c]) n++; if (!g[r + 1][c]) n++;
        if (!g[r][c - 1]) n++; if (!g[r][c + 1]) n++;
        if (n <= 2) open.push([r, c]);
      }
      open.sort(function () { return R() - 0.5; });
      chests = open.slice(0, P.chests).map(function (p) { return { r: p[0], c: p[1], p: R() * 6.28 }; });
      monsters = open.slice(P.chests, P.chests + P.monsters).map(function (p) {
        return { r: p[0], c: p[1], p: R() * 6.28, sp: 0.6 + R() * 0.8, ty: (R() * 3) | 0 };
      });

      runes = [];
      for (var k = 0; k < 30; k++) runes.push({
        x: R() * W, y: R() * H, v: 0.05 + R() * 0.16,
        t: POOL[(R() * POOL.length) | 0], s: R() < 0.4 ? 9 : 7,
        c: R() < 0.5 ? CY : (R() < 0.6 ? PU : '#39ff14'),
        a: 0.10 + R() * 0.30
      });
      fog = [];
      for (var f = 0; f < 5; f++) fog.push({
        x: R() * W, y: R() * H, r: 60 + R() * 90, ph: R() * 6.28, c: R() < 0.5 ? CY : PU
      });

      drawStatic(R);
    }

    function drawStatic(R) {
      var sc = document.createElement('canvas'); sc.width = W; sc.height = H;
      var x2 = sc.getContext('2d'); x2.imageSmoothingEnabled = false;
      x2.fillStyle = '#070b12'; x2.fillRect(0, 0, W, H);
      var r, c, x, y, col;

      // Пол
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (g[r][c]) continue;
        x = c * CELL; y = r * CELL; col = accent();
        x2.fillStyle = '#0a1119'; x2.fillRect(x, y, CELL, CELL);
        if (R() < 0.5) {
          x2.fillStyle = hexA(col, 0.10);
          if (R() < 0.5) x2.fillRect(x, y + 8, CELL, 1); else x2.fillRect(x + 8, y, 1, CELL);
        }
        if (R() < 0.14) { x2.fillStyle = hexA(col, 0.38); x2.fillRect(x + 7, y + 7, 2, 2); }
      }

      // Стены
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (!g[r][c]) continue;
        x = c * CELL; y = r * CELL; col = accent();
        var dp = 0.30 + 0.70 * (r / (ROWS - 1));
        var up = r > 0 && !g[r - 1][c], dn = r < ROWS - 1 && !g[r + 1][c];
        var lf = c > 0 && !g[r][c - 1], rt = c < COLS - 1 && !g[r][c + 1];
        if (dn) {
          x2.fillStyle = '#080e18'; x2.fillRect(x, y + CELL, CELL, 5);
          x2.fillStyle = hexA(col, 0.10 * dp);
          x2.fillRect(x + 3, y + CELL + 1, 1, 4); x2.fillRect(x + 11, y + CELL + 1, 1, 4);
        }
        x2.fillStyle = '#0c1420'; x2.fillRect(x, y, CELL, CELL);
        x2.fillStyle = hexA(col, 0.07 * dp); x2.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
        x2.fillStyle = hexA(col, 0.95 * dp);
        if (up) x2.fillRect(x, y, CELL, 1);
        if (dn) x2.fillRect(x, y + CELL - 1, CELL, 1);
        if (lf) x2.fillRect(x, y, 1, CELL);
        if (rt) x2.fillRect(x + CELL - 1, y, 1, CELL);
        if (dn) { x2.fillStyle = hexA(col, 0.55 * dp); x2.fillRect(x, y + CELL, CELL, 1); }
      }

      // Сундуки (статичная часть)
      for (var i = 0; i < chests.length; i++) {
        var ch = chests[i], cx = ch.c * CELL + 2, cy = ch.r * CELL + 3;
        x2.fillStyle = '#7a5219'; x2.fillRect(cx + 1, cy + 2, 10, 3);
        x2.fillStyle = '#5c3d11'; x2.fillRect(cx + 1, cy + 5, 10, 6);
        x2.fillStyle = '#c89a30';
        x2.fillRect(cx + 1, cy + 2, 10, 1); x2.fillRect(cx + 1, cy + 4, 10, 1); x2.fillRect(cx + 1, cy + 10, 10, 1);
        x2.fillStyle = '#ffd600'; x2.fillRect(cx + 5, cy + 4, 3, 3);
        x2.fillStyle = '#fff176'; x2.fillRect(cx + 6, cy + 5, 1, 1);
      }

      var gr = x2.createLinearGradient(0, 0, 0, H * 0.7);
      gr.addColorStop(0, 'rgba(8,12,20,0.8)'); gr.addColorStop(1, 'rgba(8,12,20,0)');
      x2.fillStyle = gr; x2.fillRect(0, 0, W, H * 0.7);

      staticC = sc;
      var b1 = document.createElement('canvas'); b1.width = W / 2 | 0; b1.height = H / 2 | 0;
      b1.getContext('2d').drawImage(sc, 0, 0, b1.width, b1.height);
      var b2 = document.createElement('canvas'); b2.width = W / 4 | 0; b2.height = H / 4 | 0;
      b2.getContext('2d').drawImage(b1, 0, 0, b2.width, b2.height);
      bloomC = b2;
    }

    function halo(c2, x, y, r, col, a) {
      var gd = c2.createRadialGradient(x, y, 0, x, y, r);
      gd.addColorStop(0, hexA(col, a)); gd.addColorStop(1, hexA(col, 0));
      c2.fillStyle = gd; c2.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Глитч-призрак 12x12
    function ghost(c2, x, y, t, v) {
      var T = GT[v.ty || 0], cx, ry;
      for (cx = 1; cx <= 10; cx++) {
        var grp = cx <= 3 ? 0 : (cx <= 7 ? 1 : 2);
        var bot = 8 + Math.round(1.6 + 1.4 * Math.sin(t * 3 + v.p + grp * 2.1));
        for (ry = ST[cx]; ry <= bot; ry++) {
          c2.fillStyle = (cx >= 9 || ry >= bot - 1) ? T.s : T.b;
          c2.fillRect(x + cx, y + ry, 1, 1);
        }
      }
      c2.fillStyle = 'rgba(0,0,0,0.30)';
      c2.fillRect(x + 1, y + 3, 10, 1); c2.fillRect(x + 1, y + 7, 10, 1);
      c2.fillStyle = T.e;
      [2, 7].forEach(function (ex) {
        c2.fillRect(x + ex, y + 3, 1, 1); c2.fillRect(x + ex + 2, y + 3, 1, 1);
        c2.fillRect(x + ex + 1, y + 4, 1, 1);
        c2.fillRect(x + ex, y + 5, 1, 1); c2.fillRect(x + ex + 2, y + 5, 1, 1);
      });
      for (var k = 0; k < 3; k++) {
        var a = 0.25 + 0.35 * Math.sin(t * 2.1 + k * 2.3 + v.p);
        if (a <= 0.05) continue;
        c2.fillStyle = hexA(T.e, a);
        c2.fillRect(x + 6 + Math.round(Math.cos(t * 1.3 + k * 2.3 + v.p) * 7),
                    y + 5 + Math.round(Math.sin(t * 1.7 + k * 2.3 + v.p) * 6), 1, 1);
      }
      if (Math.sin(t * 2.7 + v.p * 3) > 0.93) {
        c2.fillStyle = hexA(T.e, 0.55);
        c2.fillRect(x + 3, y + 1 + ((t * 9 | 0) % 3), 11, 2);
      }
    }

    function frame(now) {
      if (!staticC) return;
      var t = now / 1000, G = P.glow, i;
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(staticC, 0, 0);

      for (i = 0; i < monsters.length; i++) {
        var v = monsters[i], by = Math.round(Math.sin(t * v.sp + v.p) * 1.5);
        ghost(ctx, v.c * CELL + 2, v.r * CELL + 2 + by, t, v);
      }

      ctx.font = 'bold 8px "JetBrains Mono", ui-monospace, monospace';
      for (i = 0; i < chests.length; i++) {
        var ch = chests[i], qb = Math.round(Math.sin(t * 2 + ch.p) * 1.5);
        ctx.fillStyle = hexA('#ffd600', 0.55 + 0.35 * Math.sin(t * 2 + ch.p));
        ctx.fillText('?', ch.c * CELL + 6, ch.r * CELL + qb);
      }

      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < chests.length; i++) {
        var c3 = chests[i], pu = 0.5 + 0.5 * Math.sin(t * 1.4 + c3.p);
        halo(ctx, c3.c * CELL + 8, c3.r * CELL + 8, 16, '#ffd600', (0.06 + 0.08 * pu) * G);
      }
      for (i = 0; i < monsters.length; i++) {
        var m = monsters[i];
        halo(ctx, m.c * CELL + 8, m.r * CELL + 8, 13, GT[m.ty || 0].e, 0.08 * G);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = (0.42 + 0.06 * Math.sin(t * 0.9)) * G;
      ctx.drawImage(bloomC, 0, 0, W, H);
      ctx.globalAlpha = 1;

      for (i = 0; i < fog.length; i++) {
        var f = fog[i];
        halo(ctx, f.x + Math.sin(t * 0.07 + f.ph) * 40, f.y + Math.cos(t * 0.05 + f.ph) * 22, f.r, f.c, 0.028);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;

      if (P.showCode) {
        for (i = 0; i < runes.length; i++) {
          var rn = runes[i];
          rn.y -= rn.v;
          if (rn.y < -6) { rn.y = H + 6; rn.x = Math.random() * W; }
          ctx.font = rn.s + 'px "JetBrains Mono", ui-monospace, monospace';
          ctx.fillStyle = hexA(rn.c, rn.a * (0.6 + 0.4 * Math.sin(t * 0.8 + rn.x)));
          ctx.fillText(rn.t, rn.x, rn.y);
        }
      }
    }

    function loop(now) {
      if (!P.animate) { frame(now); return; }
      if (now - last > 33) { frame(now); last = now; }
      raf = requestAnimationFrame(loop);
    }

    build();
    loop(0);

    return {
      destroy: function () {
        cancelAnimationFrame(raf);
        [cv, scan, vig, dim].forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      },
      exportPng: function (scale) {
        var s = scale || 4, o = document.createElement('canvas');
        o.width = W * s; o.height = H * s;
        var oc = o.getContext('2d'); oc.imageSmoothingEnabled = false;
        oc.drawImage(cv, 0, 0, o.width, o.height);
        var a = document.createElement('a');
        a.download = 'codequest-dungeon-bg.png'; a.href = o.toDataURL('image/png'); a.click();
      }
    };
  }

  root.CodeQuestBG = { mount: mount };
})(window);
