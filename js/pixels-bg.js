/**
 * Фон всех страниц: тусклые мерцающие пиксельные звёзды в цветах сайта.
 *
 * Те же звёзды, что в hero на главной (js/hero-sky.js), но заметно
 * тише — фон не должен спорить с текстом. Canvas неподвижен (position:
 * fixed), поэтому при прокрутке звёзды остаются на месте, а страница
 * едет поверх них.
 *
 * 10 кадров в секунду: мерцанию ступеньками больше не нужно. У тех, кто
 * отключил анимации в системе, звёзды просто стоят.
 */
(function () {
  'use strict';

  const P = 4;                  // размер пикселя, px
  const DENSITY = 15000;        // одна звезда на столько px² экрана
  const LEVELS = [0.38, 0.2, 0.07];   // яркость: втрое тише, чем в hero
  const PALETTE = ['#00e5ff', '#00e5ff', '#b24bff', '#b24bff', '#39ff14', '#f5d800', '#ff4d6d', '#ff8c1a'];
  const pick = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const snap = (v) => Math.round(v / P) * P;

  function init() {
    const canvas = document.createElement('canvas');
    canvas.id = 'pixelsBgCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:0;image-rendering:pixelated;';
    document.body.insertBefore(canvas, document.body.firstChild);
    if (!canvas.getContext) return;

    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, ctx = null, stars = [], raf = 0, last = 0;

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      // Высота в пикселях, а не 100%: иначе при появлении адресной строки
      // браузер растянул бы картинку и звёзды стали бы неквадратными
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      stars = [];
      const n = Math.min(160, Math.round(W * H / DENSITY));
      for (let i = 0; i < n; i++) {
        stars.push({
          x: snap(Math.random() * W), y: snap(Math.random() * H),
          col: pick(), plus: Math.random() < 0.22,
          phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 1.2,
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        const k = Math.sin(t * 0.001 * s.speed + s.phase);
        const lvl = k > 0.6 ? 0 : k > -0.2 ? 1 : 2;
        ctx.globalAlpha = LEVELS[lvl];
        ctx.fillStyle = s.col;
        if (s.plus && lvl === 0) {
          ctx.fillRect(s.x - P, s.y, P * 3, P);
          ctx.fillRect(s.x, s.y - P, P, P * 3);
        } else {
          ctx.fillRect(s.x, s.y, P, P);
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (t - last < 100) return;
      last = t;
      draw(t);
    }

    size();
    draw(0);
    if (!still) raf = requestAnimationFrame(frame);

    // Перестраиваем только при смене ширины: на телефоне высота окна
    // меняется от адресной строки, и звёзды не должны прыгать
    let lastW = W, timer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (window.innerWidth !== lastW || window.innerHeight > H) {
          lastW = window.innerWidth; size(); draw(performance.now());
        }
      }, 150);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
