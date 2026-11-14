/**
 * Фон hero на главной: пиксельное звёздное небо в цветах сайта.
 *
 * Звёзды — точки и «плюсики» размером в крупный пиксель P×P, мерцают
 * ступеньками (три уровня яркости), а не плавно. Всё на одном canvas.
 * Анимация стоит, когда hero не виден, а у тех, кто отключил анимации
 * в системе, звёзды просто стоят на месте.
 */
(function () {
  'use strict';

  const P = 4;                 // размер пикселя, px
  const DENSITY = 11000;       // одна звезда на столько px² площади
  // Цвета сайта (css/style.css :root); голубой и фиолетовый — чаще остальных
  const PALETTE = ['#00e5ff', '#00e5ff', '#b24bff', '#b24bff', '#39ff14', '#f5d800', '#ff4d6d', '#ff8c1a'];
  const pick = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const snap = (v) => Math.round(v / P) * P;

  function init() {
    const wrap = document.getElementById('heroWrap');
    const cv = wrap && wrap.querySelector('.hero-sky');
    if (!cv || !cv.getContext) return;
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0, H = 0, ctx = null, stars = [];
    let raf = 0, last = 0, visible = true;

    function size() {
      W = wrap.clientWidth; H = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      stars = [];
      const n = Math.round(W * H / DENSITY);
      for (let i = 0; i < n; i++) {
        stars.push({
          x: snap(Math.random() * W), y: snap(Math.random() * H),
          col: pick(), plus: Math.random() < 0.28,
          phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 1.4,
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
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

    // Мерцанию хватает 10 кадров в секунду — меньше работы для телефона
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (t - last < 100) return;
      last = t;
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
