/* =========================================================
   ГЛЮК-АТАКА — игровая логика
   Экраны: MENU → (HOWTO) → PLAYING ⇄ PAUSED → RESULT
   Внутри партии: волны призраков → босс «Глюк-ядро» → итоги.

   ПАРТИЮ ВЕДЁТ СЕРВЕР (api/glitch.php). Браузер не знает ни
   вопросов заранее, ни правильных ответов: вопрос приходит
   по одному, верный вариант — только после ответа. Очки,
   жизни, серию и босса считает сервер; здесь только картинка.
   ========================================================= */
(function () {
  'use strict';

  // ---------- баланс — всё здесь ----------
  // Время на вопрос, число жизней и минимум вопросов приходят с сервера
  // (includes/glitch.php) — здесь только значения по умолчанию.
  const CONFIG = {
    lives: 4,
    waveTimes: [18, 16, 14, 12, 10],   // секунд на спуск призрака в волне N
    bossQuestions: 3,
    bossTime: 12,            // секунд на вопрос босса
    minQuestions: 10,        // меньше — кнопка СТАРТ неактивна
    waveBannerMs: 1500,
    bossBannerMs: 2200,
    approachMs: 550,         // призрак из очереди выходит на позицию (сервер учитывает это время)
    okPauseMs: 750,          // пауза после верного ответа
    badPauseMs: 1300,        // после ошибки: видно верный ответ
    queueSlots: 3,           // сколько призраков видно в очереди
    geckoHappySec: 0.9,      // сколько Пиксель показывает лайк
    geckoSadSec: 1.2,        // сколько грустит после ошибки
  };

  const R = window.GlitchRender, A = window.GlitchAudio;
  const API = '../../api/glitch.php';
  const GAME_ID = 'glitch';
  let THEMES = [];                 // приходят с сервера: [{id, name, color, count}]
  const THEME = {};
  let menuState = 'loading';       // loading | ready | error

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const canvas = $('field'), ctx = canvas.getContext('2d');
  const screens = { menu: $('s-menu'), howto: $('s-howto'), game: $('s-game'), pause: $('s-pause'), result: $('s-result') };
  const el = {
    themes: $('themes'), qCount: $('q-count'), warn: $('themes-warn'), start: $('btn-start'),
    hud: document.querySelector('.hud'), score: $('hud-score'), wave: $('hud-wave'), combo: $('hud-combo'), comboWrap: $('hud-combo-wrap'), hearts: $('hud-hearts'),
    question: $('question'), qTag: $('q-tag'), qText: $('q-text'), qTimer: $('q-timer'),
    answers: $('answers'), ansBtns: Array.from(document.querySelectorAll('.ans')),
    banner: $('banner'), spField: $('sp-field'), spQueue: document.querySelector('.sp-queue'),
    spCannons: document.querySelector('.sp-cannons'), spServer: document.querySelector('.sp-server'), ansGap: document.querySelector('.ans-gap'),
    howtoPic: $('howto-pic'), lb: $('lb-glitch'), resCoins: $('res-coins'),
  };
  // Пиксель: спиной, «лайк» и «грусть»
  const imgs = {};
  ['back', 'backL1', 'backL2', 'backR1', 'backR2', 'side', 'front', 'arm', 'happy', 'happy2', 'sad0', 'sad', 'sad2', 'sad3']
    .forEach(m => { imgs['gecko_' + m] = new Image(); imgs['gecko_' + m].src = `assets/img/gecko-${m}.png`; });

  // ---------- мир (то, что рисует render.js) ----------
  const world = {
    mode: 'menu', tMs: 0, layout: { tips: [] },
    ghosts: [], boss: null, lasers: [], particles: [], popups: [], bolts: [],
    cannonFlash: [0, 0, 0, 0], cannonColor: [R.C.green, R.C.green, R.C.green, R.C.green],
    serverHit: 0, shake: 0, danger: 0, dangerTarget: 0,
    gecko: { frame: 'back', dy: 0 },
    deco: [ { x: .12, y: .22, s: 1.0, a: .55 }, { x: .88, y: .3, s: 1.3, a: .5 }, { x: .2, y: .78, s: 1.5, a: .4 },
            { x: .84, y: .8, s: 0.9, a: .45 }, { x: .5, y: .1, s: 0.8, a: .3 } ]
      .map((d, i) => Object.assign(d, { color: ['#00e5ff', '#f5d800', '#b24bff', '#4da3ff', '#39ff14'][i] })),
  };

  let screen = 'menu';
  let run = null;                          // текущая партия
  const selected = new Set();

  // =========================================================
  // РАЗМЕТКА ПОЛЯ — берётся из DOM, поэтому ПК и телефон считаются одинаково
  // =========================================================
  let dpr = 1;
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const half = v => Math.round(v * 2) / 2;

  function computeLayout() {
    const L = world.layout;
    L.W = window.innerWidth; L.H = window.innerHeight;
    L.mobile = L.W <= 820;
    L.decoScale = L.mobile ? 2 : 3.2;
    if (screen === 'menu' || screen === 'howto' || !run) { L.top = 0; return L; }

    const r = e => e.getBoundingClientRect();
    const hud = r(el.hud), q = r(el.question), cn = r(el.spCannons), sv = r(el.spServer);
    const btn = el.ansBtns.map(r);
    L.top = hud.bottom;
    L.queueTop = hud.bottom; L.queueBottom = q.top;
    L.fieldTop = q.bottom; L.fieldBottom = cn.top;
    L.cannonBottom = cn.bottom - 2;
    L.cannonU = Math.max(2, Math.floor((cn.height - 6) / 12));
    L.serverY = sv.top; L.serverH = sv.height;
    L.tagPx = L.mobile ? 7 : (L.W < 1500 ? 10 : 12);

    const oneRow = Math.abs(btn[0].top - btn[2].top) < 4;
    L.cannonsX = oneRow ? btn.map(b => b.left + b.width / 2) : [0.11, 0.3, 0.7, 0.89].map(f => f * L.W);
    if (oneRow && el.ansGap.offsetWidth > 0) {
      const g = r(el.ansGap);
      L.geckoX = g.left + g.width / 2; L.geckoBottom = sv.top + 2; L.geckoH = Math.round((sv.top - cn.top) * 0.98);
    } else {
      // телефон: Пиксель стоит между 2-й и 3-й пушкой и заметно выше их
      L.geckoX = L.W / 2; L.geckoBottom = cn.bottom + 1; L.geckoH = Math.round(clamp(cn.height * 2.6, 90, 150));
    }
    if (!L.tips || L.tips.length !== 4) L.tips = L.cannonsX.map(x => ({ x, y: cn.top }));

    const fieldH = Math.max(40, L.fieldBottom - L.fieldTop);
    const queueH = Math.max(30, L.queueBottom - L.queueTop);
    L.ghostS = half(clamp(Math.min(fieldH * 0.42 / 34, L.W / (L.mobile ? 150 : 260)), 1.5, 4.5));
    L.queueS = half(clamp((queueH - L.tagPx * 2.2 - 20) / 32, 0.8, 2.6));
    L.startY = L.fieldTop + 15 * L.ghostS + 10;
    L.endY = Math.max(L.startY + 10, L.fieldBottom - 15 * L.ghostS);
    L.bossS = half(clamp(Math.min(fieldH * 0.6 / 34, L.W * 0.5 / 48), 2.5, 9));
    L.bossY = L.fieldTop + fieldH * 0.55;
    L.laserW = L.mobile ? 4 : Math.max(5, Math.round(L.cannonU * 1.1));
    L.popPx = L.mobile ? 14 : 28;
    return L;
  }

  // =========================================================
  // МЕНЮ
  // =========================================================
  function countSelected() { return THEMES.filter(t => selected.has(t.id)).reduce((a, t) => a + t.count, 0); }

  function renderThemes() {
    if (menuState !== 'ready') {
      el.themes.innerHTML = menuState === 'error'
        ? '<span class="themes-msg c-pink">Нет связи с сервером. Обнови страницу.</span>'
        : '<span class="themes-msg">// загрузка тем...</span>';
      el.qCount.textContent = '—';
      el.start.disabled = true;
      el.warn.classList.remove('show');
      return;
    }
    const total = THEMES.reduce((a, t) => a + t.count, 0);
    const all = THEMES.every(t => selected.has(t.id));
    let html = `<button class="theme all ${all ? 'on' : ''}" type="button" data-theme="*">ВСЕ <span class="n">${total}</span></button>`;
    THEMES.forEach(t => {
      html += `<button class="theme ${selected.has(t.id) ? 'on' : ''}" type="button" data-theme="${esc(t.id)}" style="--c:${esc(t.color)}">${esc(t.name)} <span class="n">${t.count}</span></button>`;
    });
    el.themes.innerHTML = html;
    const n = countSelected();
    el.qCount.textContent = n;
    el.start.disabled = n < CONFIG.minQuestions || starting;
    el.warn.classList.toggle('show', n < CONFIG.minQuestions);
  }

  async function loadThemes() {
    try {
      const res = await fetch(API + '?action=themes', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      if (!data || data.ok !== true || !Array.isArray(data.themes)) throw new Error('bad themes');
      THEMES = data.themes;
      THEMES.forEach(t => { THEME[t.id] = t; });
      if (data.min) CONFIG.minQuestions = data.min;
      THEMES.forEach(t => selected.add(t.id));
      menuState = 'ready';
    } catch (e) {
      menuState = 'error';
    }
    renderThemes();
  }

  function refreshLeaderboard() {
    if (el.lb && typeof renderLeaderboard === 'function') renderLeaderboard(el.lb, GAME_ID, 5);
  }

  // Запрос к серверу игры. Бросает Error с текстом сервера, если что-то не так.
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
  // Одна повторная попытка — на случай короткого обрыва сети
  async function apiRetry(action, extra) {
    try { return await api(action, extra); }
    catch (e) { await new Promise(r => setTimeout(r, 700)); return api(action, extra); }
  }
  el.themes.addEventListener('click', e => {
    const b = e.target.closest('[data-theme]'); if (!b) return;
    A.init(); A.sfx('click');
    const id = b.dataset.theme;
    if (id === '*') {
      const all = THEMES.every(t => selected.has(t.id));
      THEMES.forEach(t => all ? selected.delete(t.id) : selected.add(t.id));
    } else if (selected.has(id)) selected.delete(id); else selected.add(id);
    renderThemes();
  });

  function show(name) {
    screen = name;
    Object.keys(screens).forEach(k => {
      const visible = k === name || (name === 'pause' && k === 'game');
      screens[k].classList.toggle('out', !visible);
    });
    world.mode = (name === 'menu' || name === 'howto') ? 'menu' : 'play';
  }

  // =========================================================
  // ПАРТИЯ
  // =========================================================
  let starting = false;

  async function startGame() {
    if (starting || menuState !== 'ready' || countSelected() < CONFIG.minQuestions) return;
    if (typeof pingGame !== 'function') { alert('Не загрузился модуль сайта. Обнови страницу.'); return; }
    starting = true;
    A.init(); A.sfx('click');
    el.start.disabled = true; el.start.textContent = '[ ЗАГРУЗКА... ]';
    $('btn-again').disabled = true;
    try {
      // Подписанный ран — как у всех игр сайта (js/leaderboard.js → api/ping-game.php)
      await pingGame(GAME_ID);
      const cred = JSON.parse(sessionStorage.getItem('gc_run_' + GAME_ID) || 'null');
      if (!cred || !cred.run_id) throw new Error('Не удалось начать партию');
      run = { cred };
      const plan = await api('start', { themes: Array.from(selected) });
      if (plan.times) {
        if (Array.isArray(plan.times.waves)) CONFIG.waveTimes = plan.times.waves;
        if (plan.times.boss) CONFIG.bossTime = plan.times.boss;
        if (plan.times.approach_ms) CONFIG.approachMs = plan.times.approach_ms;
      }
      if (plan.lives) CONFIG.lives = plan.lives;
      Object.assign(run, {
        themes: new Set(selected), waves: plan.waves, bossThemes: plan.boss || [],
        wave: -1, lives: CONFIG.lives, score: 0, streak: 0, combo: 0, bestStreak: 0,
        phase: 'idle', phaseT: 0, paused: false, log: [], current: null,
        qT: 0, qDur: 1, bossIndex: 0, bossKilled: false, ended: false, finished: false, won: false,
      });
    } catch (e) {
      run = null;
      starting = false;
      el.start.textContent = '[ СТАРТ ]'; $('btn-again').disabled = false;
      renderThemes();
      alert('Не получилось начать игру: ' + e.message);
      return;
    }
    starting = false;
    el.start.textContent = '[ СТАРТ ]'; $('btn-again').disabled = false;
    world.ghosts = []; world.boss = null; world.lasers = []; world.particles = []; world.popups = []; world.bolts = [];
    world.dangerTarget = 0; world.danger = 0; world.serverHit = 0; world.shake = 0;
    geckoReset();
    el.question.classList.remove('boss');
    lastHearts = -1;
    updateHud();
    show('game');
    computeLayout();
    A.setSong('normal'); A.startMusic('normal');
    startWave(0);
  }

  // ---------- волна ----------
  function startWave(w) {
    run.wave = w;
    const L = computeLayout();
    world.ghosts = run.waves[w].map((theme, i) => ({
      theme, state: 'queue', slot: i, seed: Math.random() * 3000,
      x: L.W * (0.2 + 0.3 * (i % 3)), y: L.queueTop - 80 - i * 30, s: L.queueS, alpha: 1,
      tag: themeOf(theme).name, tagColor: themeOf(theme).color,
      pal: R.palFromColor(themeOf(theme).color),          // цвет глюка = цвет рамки его темы
      xf: [0.5, 0.36, 0.62, 0.44, 0.58, 0.4][i % 6],
    }));
    setQuestionIdle('> ГЛЮКИ НА ПОДХОДЕ...');
    updateHud();
    banner(`ВОЛНА ${w + 1}`, `из ${run.waves.length}`, false);
    A.sfx('wave');
    setPhase('banner', CONFIG.waveBannerMs, nextGhost);
  }

  function themeOf(id) { return THEME[id] || { id, name: String(id).toUpperCase(), color: '#00e5ff' }; }

  function setPhase(name, ms, then) { run.phase = name; run.phaseT = 0; run.phaseMs = ms || 0; run.then = then || null; }

  function queueGhosts() { return world.ghosts.filter(g => g.state === 'queue'); }

  function nextGhost() {
    hideBanner();
    const q = queueGhosts();
    if (!q.length) {
      if (run.wave + 1 < run.waves.length) return startWave(run.wave + 1);
      return startBoss();
    }
    const g = q[0];
    g.state = 'approach'; g.k = 0; g.from = { x: g.x, y: g.y, s: g.s };
    q.slice(1).forEach((o, i) => { o.slot = i; });
    run.qDur = CONFIG.waveTimes[Math.min(run.wave, CONFIG.waveTimes.length - 1)];
    run.qT = 0;
    run.ghost = g;
    requestQuestion();
    setPhase('approach', CONFIG.approachMs, () => { g.state = 'active'; g.p = 0; run.approachDone = true; tryAsk(); });
  }

  // Вопрос запрашивается, пока призрак выходит на позицию: сеть успевает за анимацию.
  // Таймер стартует, только когда есть и вопрос, и закончилась анимация.
  function requestQuestion() {
    run.current = null; run.approachDone = false;
    setQuestionIdle('> ПЕРЕХВАТ СИГНАЛА...', true);
    const myRun = run;
    apiRetry('next').then(d => {
      if (run !== myRun || run.ended) return;
      run.current = { index: d.index, q: d.q, options: d.options, theme: d.theme, boss: !!d.boss };
      if (d.time) run.qDur = d.time;
      if (world.boss) world.boss.pal = R.palFromColor(themeOf(d.theme).color);   // ядро — в цвет темы вопроса
      showQuestion(run.current, true, world.boss ? `ВОПРОС ${run.bossIndex + 1}/${run.bossThemes.length}` : '');
      tryAsk();
    }).catch(e => connectionLost(e));
  }
  function tryAsk() {
    if (run && run.approachDone && run.current && run.phase !== 'ask' && run.phase !== 'wait' && !run.ended) beginAsk();
  }

  function beginAsk() {
    run.qT = 0;
    el.question.classList.remove('pending');
    el.answers.classList.remove('locked');
    el.ansBtns.forEach(b => { b.disabled = false; b.classList.remove('ok', 'bad'); });
    run.phase = 'ask';
  }

  // ---------- ответ ----------
  function answer(i) {
    if (!run || run.paused || run.phase !== 'ask' || screen !== 'game') return;
    resolve(i);
  }

  // Ответ уходит на сервер; анимация начинается, когда он скажет, верно ли.
  function resolve(choice) {
    const cur = run.current;
    run.phase = 'wait';
    el.answers.classList.add('locked');
    el.ansBtns.forEach(b => { b.disabled = true; });
    if (choice >= 0) el.ansBtns[choice].classList.add('sel');
    const myRun = run;
    apiRetry('answer', { index: cur.index, choice }).then(res => {
      if (run !== myRun || run.ended) return;
      applyAnswer(choice, res);
    }).catch(e => connectionLost(e));
  }

  function applyAnswer(choice, res) {
    const cur = run.current, L = world.layout;
    const ok = !!res.correct;
    run.phase = 'resolve';
    el.ansBtns.forEach(b => b.classList.remove('sel'));
    if (res.right >= 0 && res.right <= 3) el.ansBtns[res.right].classList.add('ok');
    if (choice >= 0 && !ok) el.ansBtns[choice].classList.add('bad');

    run.log.push({
      theme: cur.theme, q: cur.q, ok,
      chosen: choice >= 0 ? cur.options[choice] : null,
      right: res.right_text || (cur.options[res.right] || ''), explain: res.explain || '', boss: !!world.boss,
    });
    run.score = res.score;
    run.streak = res.streak;
    run.combo = res.combo || 0;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    run.serverLives = res.lives;
    run.finished = !!res.finished; run.won = !!res.won;

    const isBoss = !!world.boss;
    const target = isBoss ? { x: world.boss.x, y: world.boss.y } : { x: run.ghost.x, y: run.ghost.y };
    if (choice >= 0) {
      const tip = L.tips[choice] || { x: L.cannonsX[choice], y: L.fieldBottom };
      world.cannonFlash[choice] = 1;
      world.cannonColor[choice] = ok ? R.C.green : R.C.pink;
      const miss = ok ? 0 : (choice < 2 ? -1 : 1) * (isBoss ? 120 : 70) * (L.mobile ? 0.5 : 1);
      world.lasers.push({ x1: tip.x, y1: tip.y, x2: target.x + miss, y2: target.y + (ok ? 0 : -30), w: L.laserW,
        color: ok ? R.C.green : R.C.pink, glowColor: ok ? 'rgba(57,255,20,0.22)' : 'rgba(255,77,109,0.22)', life: 0.32, max: 0.32 });
      A.sfx('shot');
    }

    geckoMood(ok ? 'happy' : 'sad', ok ? CONFIG.geckoHappySec : CONFIG.geckoSadSec);
    const ptsText = res.late ? '+0 ПОЗДНО' : `+${res.points}`;

    if (ok) {
      if (isBoss) {
        const b = world.boss;
        b.hp = res.boss_hp; b.flash = 0.5;
        popup(ptsText, b.x, b.y - 18 * b.s - 30, R.C.green);
        R.burst(world, b.x, b.y, b.s / 3, b.pal, 26);
        A.sfx('bossHit');
      } else {
        const g = run.ghost;
        g.state = 'dead';
        R.burst(world, g.x, g.y, g.s, g.pal, L.mobile ? 34 : 56);
        popup(ptsText, g.x, g.y - 22 * g.s, R.C.green);
        if (run.combo > 0 && !res.late) popup(`КОМБО +${run.combo}`, g.x, g.y - 22 * g.s + L.popPx * 1.4, R.C.yellow, 0.6);
        A.sfx('hit');
      }
      updateHud(true);
      setPhase('resolve', CONFIG.okPauseMs, afterResolve);
    } else {
      if (choice < 0) A.sfx('wrong'); else setTimeout(() => A.sfx('wrong'), 120);
      if (isBoss) {
        const b = world.boss;
        world.bolts.push({ x: b.x, y: b.y + 12 * b.s, tx: L.geckoX + (Math.random() - 0.5) * L.W * 0.4, ty: L.serverY + L.serverH / 2,
          t: 0, dur: 0.55, size: L.mobile ? 8 : 16, onHit: serverDamage });
      } else {
        const g = run.ghost;
        g.state = 'dive'; g.d = -0.5; g.dFrom = { x: g.x, y: g.y };   // полсекунды «зависает», потом пикирует
      }
      updateHud();
      setPhase('resolve', CONFIG.badPauseMs, afterResolve);
    }
  }

  // Сервер не ответил даже со второй попытки — партия обрывается честно:
  // результат не засчитывается, игрок видит, почему.
  function connectionLost(e) {
    if (!run || run.ended) return;
    console.warn('[glitch] нет связи с сервером:', e && e.message);
    run.netError = (e && e.message) || 'нет связи';
    endGame(false);
  }

  function popup(text, x, y, color, delay) {
    world.popups.push({ text, x, y, color, size: world.layout.popPx * (delay ? 0.6 : 1), life: 1.1, max: 1.1 });
  }

  // удар по серверу: призрак долетел или попал снаряд босса
  function serverDamage(x) {
    const L = world.layout;
    if (!run) return;
    run.lives = Math.max(run.serverLives != null ? run.serverLives : 0, run.lives - 1);
    world.serverHit = 1; world.shake = 1;
    R.sparks(world, x, L.serverY, L.mobile ? 18 : 30, [R.C.pink, R.C.orange, '#ffffff'], L.mobile ? 160 : 300);
    popup('-1', x, L.serverY - L.popPx * 2, R.C.pink);
    el.hud.classList.remove('hit'); void el.hud.offsetWidth; el.hud.classList.add('hit');
    A.sfx('server');
    updateHud();
  }

  function afterResolve() {
    if (run.finished && !run.won) return endGame(false);
    if (world.boss) return run.finished ? bossFinish() : bossNext();
    nextGhost();
  }

  // ---------- босс ----------
  function startBoss() {
    const L = computeLayout();
    run.wave = run.waves.length;
    world.ghosts = [];
    const bossN = run.bossThemes.length || CONFIG.bossQuestions;
    world.boss = { x: L.W / 2, y: -200, s: L.bossS, hp: bossN, maxHp: bossN, flash: 0, state: 'enter', k: 0, alpha: 1, pal: R.PAL.blue };
    world.dangerTarget = 1;
    el.question.classList.add('boss');
    setQuestionIdle('> ЯДРО ЗАГРУЖАЕТСЯ...');
    banner('!! БОСС: ГЛЮК-ЯДРО !!', 'три вопроса подряд', true);
    A.sfx('boss'); A.setSong('boss');
    updateHud();
    run.bossIndex = 0;
    setPhase('banner', CONFIG.bossBannerMs, () => { hideBanner(); bossAsk(); });
  }

  function bossAsk() {
    world.boss.flash = Math.max(world.boss.flash, 0.25);
    run.qDur = CONFIG.bossTime; run.qT = 0;
    requestQuestion();
    setPhase('approach', CONFIG.approachMs, () => { run.approachDone = true; tryAsk(); });
  }

  function bossNext() {
    run.bossIndex++;
    bossAsk();
  }

  function bossFinish() {
    const b = world.boss;
    if (b.hp <= 0) {
      run.bossKilled = true;
      b.state = 'gone';
      R.burst(world, b.x, b.y, b.s, b.pal, 160);
      R.burst(world, b.x, b.y, b.s * 0.7, R.PAL.red, 60);
      popup('БОСС ПОВЕРЖЕН', b.x, b.y - 30, R.C.yellow);
      world.shake = 0.8;
      A.sfx('hit'); A.sfx('bossHit');
    } else {
      b.state = 'leave'; b.k = 0;
      popup('ЯДРО СБЕЖАЛО', b.x, b.y - 18 * b.s - 30, R.C.pink);
    }
    world.dangerTarget = 0;
    updateHud();
    setQuestionIdle(run.bossKilled ? '> ЯДРО УНИЧТОЖЕНО' : '> ЯДРО УШЛО В СЕТЬ...');
    setPhase('outro', 1600, () => endGame(true));
  }

  // ---------- Пиксель: покадровая анимация ----------
  // Кадр: [имя, мс, сдвиг по y в долях роста (минус — вверх)].
  // Поворот: спина → профиль → анфас; потом эмоция; потом обратно.
  const GECKO_SEQ = {
    turnIn:  [['side', 70, -0.03], ['front', 70, -0.015]],
    happyIn: [['arm', 70, 0], ['happy', 90, -0.07], ['happy', 70, -0.03], ['happy', 70, 0]],
    happyLoop: [['happy2', 160, 0], ['happy', 160, 0]],
    happyOut: [['front', 70, 0], ['side', 70, -0.02], ['back', 1, 0]],
    sadIn:   [['sad0', 140, 0.01], ['sad0', 120, 0.025]],
    sadLoop: [['sad', 200, 0.025], ['sad2', 200, 0.025], ['sad3', 170, 0.025], ['sad0', 260, 0.025]],
    sadOut:  [['sad0', 60, 0.01], ['side', 70, -0.02], ['back', 1, 0]],
  };
  const seqLen = seq => seq.reduce((a, f) => a + f[1], 0);

  function geckoReset() { world.gecko = { frame: 'back', dy: 0, mood: 'back', phase: 'idle', t: 0, hold: 0, facing: false }; }

  // Пиксель поворачивается к игроку: лайк (верно) или грусть (ошибка), потом снова спиной
  function geckoMood(mood, sec) {
    const g = world.gecko;
    const intro = (g.facing ? [] : GECKO_SEQ.turnIn).concat(GECKO_SEQ[mood + 'In']);
    Object.assign(g, { mood, phase: 'in', seq: intro, t: 0, hold: sec, facing: true });
  }

  function frameAt(seq, t) {
    for (const f of seq) { if (t < f[1]) return f; t -= f[1]; }
    return seq[seq.length - 1];
  }

  function updateGecko(dt) {
    const g = world.gecko;
    if (g.phase === 'idle') { g.frame = 'back'; g.dy = 0; return; }
    g.t += dt * 1000;
    if (g.phase === 'in' && g.t >= seqLen(g.seq)) {
      g.t -= seqLen(g.seq); g.phase = 'loop'; g.seq = GECKO_SEQ[g.mood + 'Loop'];
    }
    if (g.phase === 'loop') {
      g.hold -= dt;
      if (g.hold <= 0) { g.phase = 'out'; g.t = 0; g.seq = GECKO_SEQ[g.mood + 'Out']; g.facing = false; }
      else g.t %= seqLen(g.seq);
    }
    if (g.phase === 'out' && g.t >= seqLen(g.seq)) { geckoReset(); return; }
    const f = frameAt(g.seq, g.t);
    g.frame = f[0]; g.dy = f[2];
  }

  // =========================================================
  // ОБНОВЛЕНИЕ КАДРА
  // =========================================================
  const ease = k => 1 - Math.pow(1 - k, 3);

  function update(dt) {
    const L = world.layout;
    run.phaseT += dt * 1000;

    // таймер вопроса
    if (run.phase === 'ask') {
      run.qT += dt;
      const left = Math.max(0, 1 - run.qT / run.qDur);
      el.qTimer.style.width = (left * 100).toFixed(1) + '%';
      el.qTimer.classList.toggle('low', left < 0.3);
      if (run.qT >= run.qDur) resolve(-1);
    }

    // призраки
    const queue = queueGhosts();
    const slotsX = L.mobile ? [0.2, 0.5, 0.8] : [0.25, 0.5, 0.75];
    world.ghosts.forEach(g => {
      if (g.state === 'queue') {
        const idx = queue.indexOf(g);
        const visible = idx < CONFIG.queueSlots;
        const tx = L.W * slotsX[Math.min(idx, 2)];
        const ty = visible ? L.queueTop + L.tagPx * 2.2 + 12 + 15 * L.queueS + Math.sin(world.tMs / 600 + g.seed) * 3 : L.queueTop - 120;
        const k = Math.min(1, dt * 5);
        g.x += (tx - g.x) * k; g.y += (ty - g.y) * k; g.s = L.queueS;
      } else if (g.state === 'approach') {
        g.k = Math.min(1, run.phaseT / CONFIG.approachMs);
        const e = ease(g.k), tx = L.W * g.xf;
        g.x = g.from.x + (tx - g.from.x) * e; g.y = g.from.y + (L.startY - g.from.y) * e; g.s = g.from.s + (L.ghostS - g.from.s) * e;
      } else if (g.state === 'active') {
        const p = run.phase === 'ask' ? Math.min(1, run.qT / run.qDur) : g.p;
        g.p = p;
        g.x = L.W * g.xf + Math.sin(world.tMs / 700 + g.seed) * 10 * (L.mobile ? 0.5 : 1);
        g.y = L.startY + (L.endY - L.startY) * p; g.s = L.ghostS;
      } else if (g.state === 'dive') {
        g.d += dt / 0.4;
        const k = g.d <= 0 ? 0 : Math.min(1, g.d * g.d);
        g.y = g.dFrom.y + (L.serverY - g.dFrom.y) * k;
        if (g.d >= 1) { g.state = 'gone'; serverDamage(g.x); R.burst(world, g.x, L.serverY - 10, g.s * 0.8, g.pal, 20); }
      }
    });

    // босс
    const b = world.boss;
    if (b) {
      b.s = L.bossS;
      b.flash = Math.max(0, b.flash - dt);
      if (b.state === 'enter') {
        b.k = Math.min(1, b.k + dt / 1.2);
        b.y = -150 + (L.bossY + 150) * ease(b.k); b.x = L.W / 2;
        if (b.k >= 1) b.state = 'idle';
      } else if (b.state === 'idle') {
        b.x = L.W / 2 + Math.sin(world.tMs / 900) * L.W * 0.04;
        b.y = L.bossY + Math.sin(world.tMs / 500) * 6;
      } else if (b.state === 'leave') {
        b.k += dt / 1.2; b.alpha = Math.max(0, 1 - b.k); b.y -= dt * 260;
      }
    }

    // снаряды босса
    world.bolts.forEach(bo => { if (!bo.done && bo.t + dt >= bo.dur) { bo.done = true; bo.onHit && bo.onHit(bo.tx); } });

    world.danger += (world.dangerTarget - world.danger) * Math.min(1, dt * 2);

    // смена фаз по времени
    if (run.phaseMs && run.phaseT >= run.phaseMs && run.then) {
      const fn = run.then; run.then = null; fn();
    }
  }

  // =========================================================
  // DOM: вопрос, HUD, баннер
  // =========================================================
  function showQuestion(cur, pending, tagText) {
    const t = themeOf(cur.theme);
    el.qTag.textContent = tagText ? `${t.name} · ${tagText}` : t.name;
    el.qTag.style.setProperty('--c', t.color);
    el.qTag.style.visibility = 'visible';
    el.qText.textContent = cur.q;
    el.qTimer.style.width = '100%'; el.qTimer.classList.remove('low');
    el.question.classList.toggle('pending', !!pending);
    el.ansBtns.forEach((b, i) => {
      b.querySelector('.ans-text').textContent = cur.options[i];
      b.classList.remove('ok', 'bad', 'sel'); b.disabled = true;
    });
    el.answers.classList.add('locked');
  }
  function setQuestionIdle(textLine, keepTimer) {
    el.qTag.style.visibility = 'hidden';
    el.qText.textContent = textLine;
    el.question.classList.add('pending');
    el.qTimer.style.width = keepTimer ? '100%' : '0%'; el.qTimer.classList.remove('low');
    el.ansBtns.forEach(b => { b.querySelector('.ans-text').textContent = '…'; b.disabled = true; b.classList.remove('ok', 'bad', 'sel'); });
    el.answers.classList.add('locked');
  }

  let lastHearts = -1;
  function updateHud(bump) {
    if (!run) return;
    el.score.textContent = run.score.toLocaleString('ru-RU');
    el.wave.textContent = world.boss || run.wave >= run.waves.length ? 'БОСС' : `${Math.max(1, run.wave + 1)}/${run.waves.length}`;
    el.combo.textContent = run.combo ? '+' + run.combo : '—';
    if (bump && run.combo > 0) { el.comboWrap.classList.remove('bump'); void el.comboWrap.offsetWidth; el.comboWrap.classList.add('bump'); }
    if (lastHearts !== run.lives) {
      lastHearts = run.lives;
      let h = ''; for (let i = 0; i < CONFIG.lives; i++) h += R.heartSVG(i < run.lives);
      el.hearts.innerHTML = h;
    }
  }

  let bannerTimer = null;
  function banner(text, sub, boss) {
    el.banner.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    el.banner.classList.toggle('boss', !!boss);
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
  }
  function hideBanner() { el.banner.classList.remove('show'); }

  // =========================================================
  // ПАУЗА
  // =========================================================
  function pause() {
    if (!run || run.paused || screen !== 'game' || run.ended) return;
    run.paused = true;
    A.pause();
    show('pause');
  }
  function resume() {
    if (!run || !run.paused) return;
    run.paused = false;
    A.resume(); A.sfx('click');
    show('game');
    lastTime = performance.now();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // =========================================================
  // ИТОГИ
  // =========================================================
  function endGame(won) {
    if (run.ended) return;
    run.ended = true; run.won = won; run.phase = 'over';
    A.stopMusic();
    A.sfx(won ? 'win' : 'lose');
    geckoMood(won ? 'happy' : 'sad', 99);
    if (!won) {
      world.ghosts.forEach(g => { if (g.state !== 'gone' && g.state !== 'dead') { g.state = 'dead'; R.burst(world, g.x, g.y, g.s, g.pal, 20); } });
      world.shake = 1;
    }
    // Итог записывает сервер из своего же состояния партии (api/score.php);
    // payload пустой — подсказывать серверу очки браузеру нечем и незачем.
    const finished = run.finished && !run.netError;
    const saving = finished && typeof submitScore === 'function'
      ? submitScore(GAME_ID, {}).catch(() => null)
      : Promise.resolve(null);
    const myRun = run;
    Promise.all([saving, new Promise(r => setTimeout(r, won ? 400 : 900))]).then(([saved]) => {
      if (run !== myRun) return;
      showResult(won, saved, finished);
    });
  }

  function showResult(won, saved, finished) {
    const log = run.log, right = log.filter(x => x.ok).length, wrong = log.length - right;
    const acc = log.length ? Math.round(right / log.length * 100) : 0;

    $('res-title').innerHTML = won ? '&gt;&gt; ВОЛНЫ ОТБИТЫ &lt;&lt;' : '&gt;&gt; СЕРВЕР ПАЛ &lt;&lt;';
    $('res-title').classList.toggle('lose', !won);
    $('res-sub').textContent = run.netError ? 'Связь с сервером потеряна — эта партия не засчитана.'
      : !won ? 'Глюки захватили сервер. Попробуй ещё раз!'
      : run.bossKilled ? 'Сервер GameCode спасён. Глюк-ядро рассыпалось на пиксели.'
      : 'Сервер GameCode спасён, но Глюк-ядро сбежало. В следующий раз добей его!';

    const stats = [
      ['ОЧКИ', (saved && saved.score != null ? Number(saved.score) : run.score).toLocaleString('ru-RU'), 'var(--white)'],
      ['ВЕРНО', right, 'var(--green)'],
      ['ОШИБКИ', wrong, 'var(--pink)'],
      ['ТОЧНОСТЬ', acc + '%', 'var(--cyan)'],
      ['ЛУЧШАЯ СЕРИЯ', run.bestStreak, 'var(--yellow)'],
    ];
    $('res-stats').innerHTML = stats.map(([k, v, c]) => `<div class="stat"><span class="stat-k">${k}</span><span class="stat-v" style="color:${c}">${v}</span></div>`).join('');

    // Пиксель коины показывает общая плашка сайта (js/leaderboard.js), как во всех играх.
    // Здесь — только подсказки, если результат не попал в аккаунт.
    let coinsHtml = '';
    if (saved && saved.guest) {
      coinsHtml = '<span class="res-note">Войди или зарегистрируйся — результат и пиксель коины сохранятся</span>';
    } else if (finished && !saved) {
      coinsHtml = '<span class="res-note c-pink">Результат не сохранён: нет связи с сервером</span>';
    }
    el.resCoins.innerHTML = coinsHtml;
    el.resCoins.style.display = coinsHtml ? '' : 'none';

    // твои темы — только сыгранные
    const by = {};
    log.forEach(x => { by[x.theme] = by[x.theme] || { n: 0, ok: 0 }; by[x.theme].n++; if (x.ok) by[x.theme].ok++; });
    $('res-topics').innerHTML = Object.keys(by).map(themeOf).map(t => {
      const s = by[t.id], pct = Math.round(s.ok / s.n * 100), filled = Math.round(pct / 10);
      let bar = ''; for (let i = 0; i < 10; i++) bar += `<i style="${i < filled ? `background:${t.color}` : ''}"></i>`;
      return `<div class="topic"><span class="topic-name">${esc(t.name)}<span class="topic-cnt">${s.ok} из ${s.n}</span></span>
        <span class="topic-bar">${bar}</span><span class="topic-pct" style="${pct === 100 ? `color:${t.color}` : ''}">${pct}%</span></div>`;
    }).join('') || '<div class="no-mist">Ни одного вопроса не сыграно.</div>';

    // разбор ошибок
    const mistakes = log.filter(x => !x.ok);
    $('res-mist-title').textContent = mistakes.length ? `РАЗБОР ОШИБОК (${mistakes.length})` : 'РАЗБОР ОШИБОК';
    $('res-mistakes').innerHTML = mistakes.length ? mistakes.map(m => `
      <div class="mist">
        <div class="mist-q">${esc(m.q)}</div>
        <div class="mist-row mist-you">Ты: ${m.chosen ? '«' + esc(m.chosen) + '»' : 'не успел'}</div>
        <div class="mist-row mist-ok">Верно: «${esc(m.right)}»</div>
        ${m.explain ? `<div class="mist-row mist-ex">${esc(m.explain)}</div>` : ''}
      </div>`).join('') : '<div class="no-mist">Ошибок нет — чистая победа!</div>';

    show('result');
    $('s-result').scrollTop = 0;

    refreshLeaderboard();
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // =========================================================
  // УПРАВЛЕНИЕ
  // =========================================================
  el.ansBtns.forEach(b => {
    b.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      A.init();
      answer(Number(b.dataset.i));
    });
  });

  document.addEventListener('keydown', e => {
    A.init();
    const k = e.key;
    // Enter на кнопке в фокусе и так её нажмёт — не дублируем
    if (k === 'Enter' && e.target && e.target.tagName === 'BUTTON') return;
    if (screen === 'game') {
      if (k >= '1' && k <= '4') { answer(Number(k) - 1); e.preventDefault(); }
      else if (k === 'p' || k === 'P' || k === 'з' || k === 'З' || k === 'Escape') { pause(); e.preventDefault(); }
    } else if (screen === 'pause') {
      if (k === 'p' || k === 'P' || k === 'з' || k === 'З' || k === 'Escape' || k === 'Enter') { resume(); e.preventDefault(); }
    } else if (screen === 'menu') {
      if (k === 'Enter' && !el.start.disabled) startGame();
    } else if (screen === 'howto') {
      if (k === 'Escape' || k === 'Enter') { show('menu'); e.preventDefault(); }
    } else if (screen === 'result') {
      if (k === 'Enter') startGame(); else if (k === 'Escape') toMenu();
    }
  });

  function toMenu() {
    if (run) { run.ended = true; run.paused = false; }
    A.resume(); A.stopMusic();
    run = null; world.ghosts = []; world.boss = null; world.particles = []; world.lasers = []; world.popups = []; world.bolts = [];
    world.danger = world.dangerTarget = 0;
    hideBanner();
    show('menu');
    renderThemes();
    refreshLeaderboard();
  }

  el.start.addEventListener('click', startGame);
  $('btn-howto').addEventListener('click', () => { A.init(); A.sfx('click'); show('howto'); });
  $('btn-howto-back').addEventListener('click', () => { A.sfx('click'); show('menu'); });
  $('btn-pause').addEventListener('click', () => { A.init(); pause(); });
  $('btn-resume').addEventListener('click', resume);
  $('btn-pause-menu').addEventListener('click', () => { A.sfx('click'); toMenu(); });
  $('btn-again').addEventListener('click', startGame);
  $('btn-res-menu').addEventListener('click', () => { A.sfx('click'); toMenu(); });

  // звук
  function renderSound() {
    const m = A.isMuted();
    document.querySelectorAll('[data-sound]').forEach(b => {
      b.innerHTML = R.speakerSVG(m) + (b.classList.contains('sound-btn') ? `<span>${m ? 'ЗВУК ВЫКЛ' : 'ЗВУК ВКЛ'}</span>` : '');
      b.setAttribute('aria-label', m ? 'Включить звук' : 'Выключить звук');
    });
  }
  document.querySelectorAll('[data-sound]').forEach(b => b.addEventListener('click', () => {
    A.init(); A.setMuted(!A.isMuted()); renderSound(); A.sfx('click');
  }));

  // =========================================================
  // ЦИКЛ
  // =========================================================
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    computeLayout();
    const playing = run && !run.paused && (screen === 'game');
    if (playing || world.mode === 'menu') world.tMs += dt * 1000;
    if (playing && !run.ended) update(dt);
    if (playing || (run && run.ended)) { R.updateEffects(world, dt); updateGecko(dt); }
    R.frame(ctx, world, imgs);
    if (screen === 'howto') R.drawHowto(el.howtoPic, world.tMs);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  renderThemes();
  renderSound();
  show('menu');
  requestAnimationFrame(loop);
  loadThemes();
  refreshLeaderboard();

  // для автотестов и отладки из консоли (правильных ответов здесь нет — они на сервере)
  window.__glitch = { CONFIG, get run() { return run; }, world, answer, startGame, pause, resume, toMenu };
})();
