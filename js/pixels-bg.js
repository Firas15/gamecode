(function () {
  const COLORS = [
    '#39ff14', // green
    '#00e5ff', // cyan
    '#b24bff', // purple/accent
    '#f5d800', // yellow
    '#ff4d6d', // pink
    '#ffffff',  // white (редко)
  ];

  // Вероятность цвета (белый реже)
  const COLOR_WEIGHTS = [22, 22, 22, 18, 14, 2];

  function weightedColor() {
    const total = COLOR_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < COLORS.length; i++) {
      r -= COLOR_WEIGHTS[i];
      if (r <= 0) return COLORS[i];
    }
    return COLORS[0];
  }

  // Типы частиц
  const TYPES = ['drift', 'shoot', 'blink'];

  class Pixel {
    constructor(canvas) {
      this.canvas = canvas;
      this.reset(true);
    }

    reset(initial = false) {
      const W = this.canvas.width;
      const H = this.canvas.height;

      this.type = TYPES[Math.floor(Math.random() * TYPES.length)];
      this.color = weightedColor();
      this.size = Math.random() < 0.6
        ? Math.floor(Math.random() * 2 + 1) * 2  
        : Math.floor(Math.random() * 3 + 1) * 2;

      if (this.type === 'drift') {
        // Медленно дрейфует вверх и вбок
        this.x = Math.random() * W;
        this.y = initial ? Math.random() * H : H + this.size;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = -(Math.random() * 0.5 + 0.2);
        this.alpha = Math.random() * 0.35 + 0.1;
        this.alphaDecay = 0;
        this.life = 1;

      } else if (this.type === 'shoot') {
        // Быстро летит по диагонали
        const fromLeft = Math.random() < 0.5;
        this.x = fromLeft ? -this.size : W + this.size;
        this.y = Math.random() * H * 0.7;
        const speed = Math.random() * 2 + 1.5;
        this.vx = fromLeft ? speed : -speed;
        this.vy = Math.random() * 0.8 - 0.4;
        this.alpha = Math.random() * 0.5 + 0.2;
        this.alphaDecay = 0.002;
        this.life = 1;
        this.size = Math.ceil(this.size / 2) * 2;

      } else {
        // Мигает на месте
        this.x = Math.random() * W;
        this.y = initial ? Math.random() * H : Math.random() * H;
        this.vx = 0;
        this.vy = 0;
        this.alpha = 0;
        this.alphaDecay = 0;
        this.blinkSpeed = Math.random() * 0.02 + 0.005;
        this.blinkDir = 1;
        this.blinkMax = Math.random() * 0.4 + 0.1;
        this.life = 1;
      }
    }

    update() {
      if (this.type === 'drift') {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y < -this.size || this.x < -20 || this.x > this.canvas.width + 20) {
          this.reset();
        }

      } else if (this.type === 'shoot') {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.alphaDecay;
        if (this.alpha <= 0 || this.x < -50 || this.x > this.canvas.width + 50) {
          this.reset();
        }

      } else {
        // blink
        this.alpha += this.blinkSpeed * this.blinkDir;
        if (this.alpha >= this.blinkMax) { this.blinkDir = -1; }
        if (this.alpha <= 0) {
          this.blinkDir = 1;
          // иногда переезжаем на новое место
          if (Math.random() < 0.3) {
            this.x = Math.random() * this.canvas.width;
            this.y = Math.random() * this.canvas.height;
            this.color = weightedColor();
          }
        }
      }
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
      ctx.fillStyle = this.color;
      // Пиксельный квадрат (без сглаживания)
      ctx.fillRect(
        Math.round(this.x),
        Math.round(this.y),
        this.size,
        this.size
      );
    }
  }

  // INIT CANVAS
  function init() {
    const canvas = document.createElement('canvas');
    canvas.id = 'pixelsBgCanvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
      image-rendering: pixelated;
    `;
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let W, H, pixels;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;

      const count = Math.floor((W * H) / 14000); // плотность
      pixels = Array.from({ length: Math.min(count, 120) }, () => new Pixel(canvas));
    }

    function loop() {
      ctx.clearRect(0, 0, W, H);
      pixels.forEach(p => { p.update(); p.draw(ctx); });
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize);
    loop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
