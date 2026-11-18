/* ═══ «ПЕРЕЗАГРУЗКА» ПЕРЕД УРОВНЕМ ═══
   Пока уровень грузится с сервера, экран загружается как старый компьютер:
   строки проверки, точки, OK, мигающий курсор. Каждый раз глюк-вирус сбивает
   одну строку — её нужно «перезапустить» (кнопка, тап, Enter/R; или сама
   через 3 секунды). Тап/клавиша в обычный момент — ускорить загрузку.

   Boot.start({ level, title (строка или функция), short }) → { finished, close(), abort() }
     finished — промис: анимация доиграла (игру можно показывать);
     close()  — гасит экран «выключением кинескопа» поверх уже готовой игры;
     abort()  — убрать сразу (ошибка загрузки).
   Зависит от game.js только во время работы: Audio и drawMonster. */
const Boot = (() => {
  const AUTO_RESTART_SEC = 3;
  const JUNK = '#%@&$!?/\\|<>01=+*';

  let ov = null, linesEl = null, hintEl = null;
  let run = null;                 // текущий запуск (чтобы старый не мешал новому)

  function ensure() {
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'boot-ov hidden';
    ov.innerHTML = '<div class="boot-scr"><div class="boot-lines"></div></div>' +
                   '<div class="boot-hint pixel-text"></div>';
    document.body.appendChild(ov);
    linesEl = ov.querySelector('.boot-lines');
    hintEl = ov.querySelector('.boot-hint');
    ov.addEventListener('pointerdown', e => { e.preventDefault(); run && run.poke(); });
    document.addEventListener('keydown', e => {
      if (!run || ov.classList.contains('hidden')) return;
      if (e.code === 'Enter' || e.code === 'KeyR' || e.code === 'Space' || e.code === 'Escape') run.poke();
    });
  }

  function snd(kind) {
    if (typeof Audio === 'undefined' || !Audio.boot) return;
    try { Audio.boot(kind); } catch (e) {}
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  // длина «точек» до статуса: на телефоне короче, чтобы рядом поместились ошибка и вирус
  function dotsBase() { return ov && ov.clientWidth < 600 ? 14 : 22; }

  function start({ level, title, short }) {
    ensure();
    if (run) run.cancel();
    linesEl.innerHTML = '';
    ov.classList.remove('hidden', 'boot-out', 'boot-shake');
    hintEl.textContent = 'ТАП — БЫСТРЕЕ';

    let cancelled = false, fast = false, pendingFix = null;
    const timers = new Set();
    const sleep = ms => new Promise(res => {
      if (cancelled) return;                       // отменённый запуск просто замирает
      const id = setTimeout(() => { timers.delete(id); res(); }, fast ? Math.min(ms, 8) : ms);
      timers.add(id);
    });

    const me = run = {
      poke() {
        if (pendingFix) { const f = pendingFix; pendingFix = null; f(); return; }
        fast = true;
        hintEl.textContent = '';
      },
      cancel() { cancelled = true; timers.forEach(clearTimeout); timers.clear(); },
    };

    function addLine(cls) {
      const row = document.createElement('div');
      row.className = 'boot-line' + (cls ? ' ' + cls : '');
      row.innerHTML = '<span class="bl-text"></span><span class="bl-dots"></span><span class="bl-st"></span>';
      linesEl.appendChild(row);
      return row;
    }

    async function type(el, text, perChar = 9) {
      // по прошедшему времени, а не «буква за тик»: таймеры в Windows тикают раз в ~15 мс
      const t0 = performance.now();
      let shown = 0;
      while (shown < text.length && !fast && !cancelled) {
        shown = Math.max(shown + 1, Math.floor((performance.now() - t0) / perChar));
        el.textContent = text.slice(0, shown);
        await sleep(16);
      }
      el.textContent = text;
    }

    // Обычная строка: «ТЕКСТ ....... OK»
    async function check(label, status = 'OK', cls = '') {
      const row = addLine('bl-check');
      await type(row.querySelector('.bl-text'), label);
      row.querySelector('.bl-dots').textContent = ' ' + '.'.repeat(Math.max(3, dotsBase() - label.length)) + ' ';
      await sleep(70 + Math.random() * 90);
      const st = row.querySelector('.bl-st');
      st.textContent = status;
      if (cls) st.classList.add(cls);
      snd(cls === 'st-warn' ? 'warn' : 'ok');
      return row;
    }

    // Строку сбил глюк: её текст рассыпается, вирус сидит рядом, нужна «перезагрузка»
    async function glitchedCheck(label) {
      const row = addLine('bl-check');
      await type(row.querySelector('.bl-text'), label);
      row.querySelector('.bl-dots').textContent = ' ' + '.'.repeat(Math.max(3, dotsBase() - label.length)) + ' ';
      await sleep(260);
      if (cancelled) return;

      const wasFast = fast; fast = false;          // этот момент не проматываем
      hintEl.textContent = '';
      const textEl = row.querySelector('.bl-text');
      const st = row.querySelector('.bl-st');
      const ghost = spawnGhost(row);
      snd('glitch');
      ov.classList.add('boot-shake');
      row.classList.add('bl-glitched');
      for (let f = 0; f < 10; f++) {                // текст «съедается»
        textEl.textContent = label.split('').map(ch => ch === ' ' || Math.random() < 0.35 ? ch : JUNK[Math.random() * JUNK.length | 0]).join('');
        await sleep(55);
      }
      ov.classList.remove('boot-shake');
      st.textContent = 'ОШИБКА 0xG1TCH';
      st.classList.add('st-err');
      snd('err');

      const fix = document.createElement('div');
      fix.className = 'bl-fix';
      fix.innerHTML = '<button type="button" class="bl-btn pixel-text">[ ПЕРЕЗАПУСТИТЬ СТРОКУ ]</button><span class="bl-auto pixel-text"></span>';
      linesEl.appendChild(fix);
      const autoEl = fix.querySelector('.bl-auto');

      // ждём игрока (кнопка / тап / Enter / R) или автоперезапуск
      await new Promise(res => {
        let left = AUTO_RESTART_SEC;
        pendingFix = () => { pendingFix = null; res(); };
        const tick = () => {
          if (cancelled || !pendingFix) return;
          if (left <= 0) { pendingFix(); return; }
          autoEl.textContent = `САМА ЧЕРЕЗ ${left--}`;
          const id = setTimeout(tick, 1000); timers.add(id);
        };
        tick();
      });
      if (cancelled) return;

      fix.remove();
      snd('fix');
      shooGhost(ghost);
      row.classList.remove('bl-glitched');
      st.textContent = ''; st.classList.remove('st-err');
      textEl.textContent = '';
      await sleep(180);
      await type(textEl, label, 10);
      await sleep(160);
      st.textContent = 'ПОВТОР — OK';
      snd('ok');
      fast = wasFast;
    }

    const finished = (async () => {
      const lv = pad(level);
      // title — строка или функция: название берём в момент печати, когда уровень уже загружен
      const titleNow = () => String((typeof title === "function" ? title() : title) || "").toUpperCase();
      if (short) {
        await check(`ПЕРЕЗАПУСК УРОВНЯ ${lv}`);
        await glitchedCheck('ЛАБИРИНТ');         // глюк — при каждой загрузке
        if (cancelled) return;
      } else {
        const head = addLine('bl-head');
        await type(head.querySelector('.bl-text'), 'CODEQUEST BIOS v4.04 — ВНУТРИ КОМПЬЮТЕРА', 6);
        snd('ok');
        await sleep(160);

        // проверка памяти — счётчик, как у старых BIOS
        const mem = addLine('bl-check');
        const memText = mem.querySelector('.bl-text');
        for (let k = 0; k <= 640; k += 64) { memText.textContent = `ПАМЯТЬ: ${k}K`; await sleep(16); }
        mem.querySelector('.bl-st').textContent = ' OK';
        snd('ok');

        const lines = ['ПРОЦЕССОР', 'ДИСК C:', 'КОМПИЛЯТОР GO', 'ЛАБИРИНТ', 'СУНДУКИ С КОДОМ'];
        // глюк сбивает одну строку при каждой загрузке — какую, решает случай
        const bad = 1 + (Math.random() * (lines.length - 1) | 0);
        for (let i = 0; i < lines.length; i++) {
          if (i === 2) {                              // перед лабиринтом — какой уровень грузим
            await sleep(80);
            const lvRow = addLine('bl-level');
            await type(lvRow.querySelector('.bl-text'), titleNow() ? `УРОВЕНЬ ${lv}: ${titleNow()}` : `УРОВЕНЬ ${lv}`, 8);
            snd('ok');
            await sleep(120);
          }
          if (i === bad) await glitchedCheck(lines[i]);
          else await check(lines[i]);
          if (cancelled) return;
        }
        await check('ВИРУСЫ', 'ОБНАРУЖЕНЫ', 'st-warn');
      }
      const go = addLine('bl-go');
      await type(go.querySelector('.bl-text'), '> ЗАПУСК', 18);
      go.querySelector('.bl-st').innerHTML = '<span class="bl-cursor">_</span>';
      await sleep(fast ? 60 : 300);
      hintEl.textContent = '';
    })();

    return {
      finished,
      close() {
        if (run !== me) return;
        snd('on');
        ov.classList.add('boot-out');
        const id = setTimeout(() => { if (run === me) { ov.classList.add('hidden'); run = null; } }, 420);
        timers.add(id);
      },
      abort() {
        if (run !== me) return;
        me.cancel();
        ov.classList.add('hidden');
        run = null;
      },
    };
  }

  // ── Вирус: собирается из пикселей справа от строки, потом убегает рассыпаясь ──
  function spawnGhost(row) {
    const cv = document.createElement('canvas');
    cv.width = 44; cv.height = 40;
    cv.className = 'boot-ghost';
    ov.appendChild(cv);
    const r = row.getBoundingClientRect();
    const o = ov.getBoundingClientRect();
    const dots = row.querySelector('.bl-dots').getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(row).fontSize) || 11;
    const gw = cv.offsetWidth || 88, gh = cv.offsetHeight || 80;
    // сразу за «ОШИБКА 0xG1TCH» (14 знаков), но не за краем экрана
    const x = Math.min(o.width - gw - 6, dots.right - o.left + fs * 14 + 12);
    cv.style.left = Math.max(8, x) + 'px';
    cv.style.top = (r.top - o.top + r.height / 2 - gh / 2 - 6) + 'px';
    const c = cv.getContext('2d');
    const t0 = performance.now();
    const paint = () => {
      if (!cv.isConnected) return;
      const t = performance.now() - t0;
      c.clearRect(0, 0, 44, 40);
      if (typeof drawMonster === 'function') drawMonster(c, 0, 0, 1, Math.sin(t / 160) > 0 ? 1 : 0, true, false, t);
      cv._raf = setTimeout(paint, 90);
    };
    paint();
    burst(cv, 'in');
    requestAnimationFrame(() => cv.classList.add('on'));
    return cv;
  }

  function shooGhost(cv) {
    if (!cv) return;
    burst(cv, 'out');
    clearTimeout(cv._raf);
    cv.remove();
  }

  function burst(cv, dir) {
    const o = ov.getBoundingClientRect();
    const r = cv.getBoundingClientRect();
    const w = r.width || 88, h = r.height || 80;
    const x0 = r.left - o.left, y0 = r.top - o.top;
    const colors = ['#ff4d6d', '#660040', '#ff9ad0', '#00e5ff'];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('div');
      p.className = 'boot-px ' + (dir === 'in' ? 'px-in' : 'px-out');
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      p.style.cssText = `left:${x0 + Math.random() * w}px;top:${y0 + Math.random() * h}px;` +
        `background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
      ov.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  return { start };
})();
