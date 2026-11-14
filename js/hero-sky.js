/**
 * Фон hero на главной.
 *
 * Обычная тема — мерцающие пиксельные звёзды в цветах сайта (точки и
 * «плюсики», мерцают ступеньками). Новогодняя тема (js/theme.js) —
 * вместо звёзд падает пиксельный снег.
 *
 * Анимация стоит, когда hero не виден, а у тех, кто отключил анимации
 * в системе, звёзды и снежинки просто стоят на месте.
 */
(function () {
  'use strict';

  const P = 4;                 // размер пикселя, px
  const DENSITY = 11000;       // одна звезда на столько px² площади
  const SNOW_DENSITY = 5500;   // одна снежинка на столько px²
  // Цвета сайта (css/style.css :root); голубой и фиолетовый — чаще остальных
  const PALETTE = ['#00e5ff', '#00e5ff', '#b24bff', '#b24bff', '#39ff14', '#f5d800', '#ff4d6d', '#ff8c1a'];
  const SNOW = ['#ffffff', '#ffffff', '#e6f3ff', '#bfe9ff', '#9cc7ef'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const snap = (v) => Math.round(v / P) * P;
  const themeNow = () => {
    if (document.documentElement.dataset.theme) return document.documentElement.dataset.theme;
    try { return localStorage.getItem('gc_theme') || 'original'; } catch (e) { return 'original'; }
  };

  function init() {
    const wrap = document.getElementById('heroWrap');
    const cv = wrap && wrap.querySelector('.hero-sky');
    if (!cv || !cv.getContext) return;
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0, H = 0, ctx = null, stars = [], flakes = [], snow = false;
    let raf = 0, last = 0, visible = true;

    function newFlake(anyY) {
      const big = Math.random() < 0.3;
      return {
        x: Math.random() * W, y: anyY ? Math.random() * H : -P * 2,
        s: big ? P * 2 : P, v: big ? 1.6 + Math.random() * 0.8 : 0.7 + Math.random() * 0.7,
        sway: Math.random() * Math.PI * 2, col: pick(SNOW), a: big ? 0.95 : 0.7,
      };
    }

    function size() {
      W = wrap.clientWidth; H = wrap.clientHeight;
      snow = themeNow() === 'newyear';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      stars = []; flakes = [];
      if (snow) {
        const n = Math.round(W * H / SNOW_DENSITY);
        for (let i = 0; i < n; i++) flakes.push(newFlake(true));
        return;
      }
      const n = Math.round(W * H / DENSITY);
      for (let i = 0; i < n; i++) {
        stars.push({
          x: snap(Math.random() * W), y: snap(Math.random() * H),
          col: pick(PALETTE), plus: Math.random() < 0.28,
          phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 1.4,
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      if (snow) {
        for (const f of flakes) {
          ctx.globalAlpha = f.a; ctx.fillStyle = f.col;
          ctx.fillRect(snap(f.x + Math.sin(f.sway) * 6), snap(f.y), f.s, f.s);
        }
        ctx.globalAlpha = 1;
        return;
      }
      for (const s of stars) {
        const k = Math.sin(t * 0.001 * s.speed + s.phase);
        const a = k > 0.6 ? 1 : k > -0.2 ? 0.55 : 0.2;   // три ступени яркости
        ctx.globalAlpha = a;
        ctx.fillStyle = s.col;
        if (s.plus && a > 0.5) {
          ctx.fillRect(s.x - P, s.y, P * 3, P);
          ctx.fillRect(s.x, s.y - P, P, P * 3);
        } else {
          ctx.fillRect(s.x, s.y, P, P);
        }
      }
      ctx.globalAlpha = 1;
    }

    function step() {
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.v; f.sway += 0.04;
        if (f.y > H) flakes[i] = newFlake(false);
      }
    }

    // Звёздам хватает 10 кадров в секунду, снегу — 25: он движется
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (t - last < (snow ? 40 : 100)) return;
      last = t;
      if (snow) step();
      draw(t);
    }

    function play() { if (!still && visible && !raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    size();
    draw(0);
    play();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) play(); else stop(); }).observe(wrap);
    }

    // Тему сменили — перерисовываем: звёзды ↔ снег
    window.addEventListener('gc:theme', () => { size(); draw(performance.now()); });

    // Перестраиваем при смене размеров самого блока (ширина экрана,
    // подгрузились карточки), но не от адресной строки телефона.
    let timer = 0;
    const rebuild = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (wrap.clientWidth !== W || wrap.clientHeight !== H) { size(); draw(performance.now()); }
      }, 150);
    };
    if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(wrap);
    else window.addEventListener('resize', rebuild);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
