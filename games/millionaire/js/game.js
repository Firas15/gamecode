/*
   СТРУКТУРА:
   1.  ЗВУКИ          — Web Audio API
   2.  ЗВЁЗДНЫЙ ФОН   — canvas анимация
   3.  ТАБЛИЦА ПРИЗОВ — 15 ступеней, 3 гарантии
   4.  СОСТОЯНИЕ      — объект state
   5.  ЗАГРУЗКА ВОПРОСОВ — fetch questions.json
   6.  ЭКРАНЫ         — showScreen()
   7.  МЕНЮ           — buildMenu()
   8.  ЛЕСТНИЦА ПРИЗОВ — buildLadder()
   9.  ЗАГРУЗКА ВОПРОСА — loadQuestion()
  10.  ПОДСКАЗКИ      — immunity, 5050, audience, swap
  11.  ОБРАБОТКА ОТВЕТА — handleAnswer()
  12.  ПОЯСНЕНИЕ      — showExplanation()
  13.  СЛЕДУЮЩИЙ ВОПРОС — nextQuestion()
  14.  КОНЕЦ ИГРЫ     — endGame()
  15.  КНОПКИ И КЛАВИШИ
  16.  ЗАПУСК         — init()
 */

/* 
   1. ЗВУКИ
 */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function beep(freq, dur, shape = 'square', vol = 0.15) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = shape;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function soundClick()   { beep(440, 0.05, 'square', 0.08); }
function soundSelect()  { beep(660, 0.06); setTimeout(() => beep(880, 0.08), 80); }
function soundThink()   {

  [330, 392, 494].forEach((n,i) => setTimeout(() => beep(n, 0.06, 'sine', 0.1), i * 120));
}
function soundCorrect() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n,i) => setTimeout(() => beep(n, 0.1), i * 80));
}
function soundWrong() {
  beep(220, 0.1, 'sawtooth');
  setTimeout(() => beep(150, 0.2, 'sawtooth'), 110);
}
function soundSafe()    {
  [784, 880, 1047, 1175].forEach((n,i) => setTimeout(() => beep(n, 0.12, 'sine', 0.12), i * 100));
}
function soundFinal()   {
  const melody = [523,659,784,1047,784,659,523,659,784,1047];
  melody.forEach((n,i) => setTimeout(() => beep(n, 0.1, 'sine', 0.12), i * 120));
}
function soundHint()    { beep(880, 0.05, 'sine', 0.12); setTimeout(() => beep(1100, 0.08, 'sine', 0.1), 60); }
function soundLose()    {
  [300,250,200,150].forEach((n,i) => setTimeout(() => beep(n, 0.15, 'sawtooth', 0.18), i * 120));
}


/* 
   2. ЗВЁЗДНЫЙ ФОН
 */
(function initStars() {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  let stars    = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      a: Math.random(),
      s: Math.random() * 0.007 + 0.003,
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(st => {
      st.a += st.s;
      if (st.a > 1 || st.a < 0) st.s *= -1;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,216,240,${st.a * 0.45})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize();
  draw();
})();


const AudienceSystem = { setCorrect: () => {}, setWrong: () => {} };




/* 
   3. ТАБЛИЦА ПРИЗОВ
 */
const QUESTION_TIME_SEC = 60;
let questionTimerInterval = null;
let pendingAnswerIdx      = null;

const PRIZES = [
  { q: 1,  prize: '1',    safe: false },
  { q: 2,  prize: '2',    safe: false },
  { q: 3,  prize: '3',    safe: false },
  { q: 4,  prize: '5',    safe: false },
  { q: 5,  prize: '10',   safe: true  },  // первая гарантия
  { q: 6,  prize: '20',   safe: false },
  { q: 7,  prize: '40',   safe: false },
  { q: 8,  prize: '80',   safe: false },
  { q: 9,  prize: '160',  safe: false },
  { q: 10, prize: '320',  safe: true  },  // вторая гарантия
  { q: 11, prize: '400',  safe: false },
  { q: 12, prize: '500',  safe: false },
  { q: 13, prize: '650',  safe: false },
  { q: 14, prize: '800',  safe: false },
  { q: 15, prize: '1000', safe: true  },
];


/* 
   4. СОСТОЯНИЕ ИГРЫ
 */
const state = {
  currentIdx:       0,    
  correctCount:     0,
  wrongCount:       0,
  selectedAnswer:   null, 
  safeAmount:       '0',  
  busy:             false,
  startedAtMs:      0,

  hints: {
    immunity: false, 
    immunity_active: false, 
    fiveOfifty: false,
    audience:  false,
    swap:      false,
  },

  timeLeft:     60,
  timerPaused:  false,

  
  shuffledAnswers: [],
  current:         null,  // вопрос от сервера: index, q, options, difficulty, lang
  lastCorrect:     false, // результат последнего ответа (решает сервер)
  starting:        false,
};


/* 
   5. СВЯЗЬ С СЕРВЕРОМ
   Вопросы и правильные ответы знает только сервер (api/millionaire.php).
   Браузер получает вопрос без ответа, отправляет выбранный вариант
   и только после этого узнаёт, какой был верным. Подсказки тоже
   считает сервер — иначе 50:50 выдавал бы ответ заранее.
 */
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
  catch (e) { await new Promise(r => setTimeout(r, 700)); return api(action, extra); }
}

function serverError(e) {
  console.error(e);
  clearQuestionTimer();
  closeAnswerConfirm();
  state.busy = false;
  showToast('Нет связи с сервером — партия прервана', 'pink', 3200);
  showScreen('menu');
}


/* 
   6. ЭКРАНЫ
 */
const screens = {
  menu:   document.getElementById('s-menu'),
  game:   document.getElementById('s-game'),
  result: document.getElementById('s-result'),
};

function clearQuestionTimer() {
  if (questionTimerInterval) {
    clearInterval(questionTimerInterval);
    questionTimerInterval = null;
  }
}

function closeAnswerConfirm() {
  const overlay = document.getElementById('answer-confirm');
  if (overlay) overlay.classList.remove('visible');
  state.timerPaused = false;
  pendingAnswerIdx = null;
}

function startQuestionTimer() {
  clearQuestionTimer();
  const el = document.getElementById('question-timer');
  state.timeLeft = QUESTION_TIME_SEC;
  state.timerPaused = false;
  if (el) el.textContent = String(state.timeLeft);

  questionTimerInterval = setInterval(() => {
    if (!screens.game.classList.contains('active')) {
      clearQuestionTimer();
      return;
    }
    if (state.timerPaused) return;
    state.timeLeft--;
    if (el) el.textContent = String(Math.max(0, state.timeLeft));
    if (state.timeLeft <= 0) {
      clearQuestionTimer();
      handleTimeUp();
    }
  }, 1000);
}

/** Время вышло — засчитывается как ошибка (иммунитет не спасает) */
async function handleTimeUp() {
  if (!screens.game.classList.contains('active')) return;
  if (state.busy || state.selectedAnswer !== null) return;
  if (state.timerPaused) return;

  state.busy = true;
  [0, 1, 2, 3].forEach(i => {
    const b = document.getElementById(`ans-${i}`);
    if (b) b.disabled = true;
  });

  let r;
  try { r = await api('answer', { index: state.current.index, choice: -1 }); }
  catch (e) { serverError(e); return; }

  const correct = r.right;
  const wrongIdx = correct === 0 ? 1 : 0;
  state.selectedAnswer = wrongIdx;
  state.lastCorrect = false;

  const wBtn = document.getElementById(`ans-${wrongIdx}`);
  const cBtn = document.getElementById(`ans-${correct}`);
  if (wBtn) wBtn.classList.add('wrong');
  if (cBtn) cBtn.classList.add('correct');
  state.wrongCount++;
  soundWrong();
  if (AudienceSystem && AudienceSystem.setWrong) AudienceSystem.setWrong();
  showExplanation(false, r.explain);
}

function openAnswerConfirm(idx) {
  if (state.busy || state.selectedAnswer !== null) return;
  const overlay = document.getElementById('answer-confirm');
  if (!overlay) {
    soundSelect();
    handleAnswer(idx);
    return;
  }
  pendingAnswerIdx = idx;
  state.timerPaused = true;
  const letters = ['A', 'B', 'C', 'D'];
  const letterEl = document.getElementById('ac-letter');
  const textEl = document.getElementById('ac-text');
  if (letterEl) letterEl.textContent = letters[idx];
  if (textEl) textEl.textContent = state.shuffledAnswers[idx];
  overlay.classList.add('visible');
  soundClick();
}

function forfeitOnHiddenTab() {
  if (!document.hidden) return;
  if (!screens.game.classList.contains('active')) return;
  clearQuestionTimer();
  closeAnswerConfirm();
  showToast('Смена вкладки — игра остановлена', 'yellow', 2800);
  // Сначала сервер фиксирует проигрыш, потом отправляем итог
  api('forfeit').catch(() => {}).finally(() => endGame(false));
}

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('active', k === name);
  });
  if (name !== 'game') {
    clearQuestionTimer();
    closeAnswerConfirm();
    state.timerPaused = false;
  }
}


/* 
   7. МЕНЮ — мини-лестница
 */
function buildMenu() {
  const container = document.getElementById('ladder-mini');
  container.innerHTML = '';

  PRIZES.forEach(p => {
    const item = document.createElement('div');
    const cls  = p.safe ? 'safe'
               : p.q >= 11 ? 'hard'
               : p.q >= 6  ? 'medium'
               : 'easy';
    item.className = `ladder-mini-item ${cls}`;
    item.innerHTML = `
      <span>${p.q < 10 ? '0' + p.q : p.q}</span>
      <span>${p.prize} pts${p.safe ? ' 🔒' : ''}</span>
    `;
    container.appendChild(item);
  });
}


/* 
   8. ЛЕСТНИЦА ПРИЗОВ (правая колонка в игре)
 */
function buildLadder() {
  const container = document.getElementById('ladder-list');
  container.innerHTML = '';

  PRIZES.forEach(p => {
    const item = document.createElement('div');
    item.className = 'ladder-item' + (p.safe ? ' safe-level' : '');
    item.id = `ladder-${p.q}`;
    item.innerHTML = `
      <span class="l-num">${p.q < 10 ? '0' + p.q : p.q}</span>
      <span class="l-prize">${p.prize}</span>
      ${p.safe ? '<span class="l-safe">🔒</span>' : ''}
    `;
    container.appendChild(item);
  });

  updateLadder();
}

function updateLadder() {
  const current = state.currentIdx + 1;
  PRIZES.forEach(p => {
    const el = document.getElementById(`ladder-${p.q}`);
    if (!el) return;
    el.classList.remove('current', 'passed');
    if (p.q === current) el.classList.add('current');
    if (p.q < current)  el.classList.add('passed');
  });

  // Найти текущий гарантированный приз (последний safe-level до текущего)
  let safe = '0';
  for (let i = current - 2; i >= 0; i--) {
    if (PRIZES[i] && PRIZES[i].safe) { safe = PRIZES[i].prize; break; }
  }
  state.safeAmount = safe;
  document.getElementById('safe-prize').textContent = safe + ' pts';
}


/* 
   9. ЗАГРУЗКА ВОПРОСА
 */

// Вопрос приходит с сервера уже с перемешанными вариантами.
// prefetched — вопрос, который сервер прислал сам (после замены).
async function loadQuestion(prefetched) {
  state.busy           = true;
  state.selectedAnswer = null;

  let q = prefetched;
  if (!q) {
    try { q = await apiRetry('next'); }
    catch (e) { serverError(e); return; }
  }
  if (!screens.game.classList.contains('active')) return;

  state.current         = q;
  state.currentIdx      = q.index;
  state.shuffledAnswers = q.options;
  state.busy            = false;

  const num = state.currentIdx + 1;
  const p   = PRIZES[state.currentIdx];

  // Хедер
  document.getElementById('q-num').textContent = `ВОПРОС ${num}`;

  const diffEl = document.getElementById('q-diff');
  diffEl.textContent  = q.difficulty === 'easy' ? 'ЛЁГКИЙ'
                      : q.difficulty === 'medium' ? 'СРЕДНИЙ'
                      : 'СЛОЖНЫЙ';
  diffEl.className    = `difficulty-badge pixel-text diff-${q.difficulty}`;

  const langEl = document.getElementById('q-lang');
  langEl.textContent  = q.lang.toUpperCase();

  document.getElementById('current-prize').textContent = p.prize + ' pts';
  updateLadder();

  // Вопрос
  document.getElementById('q-number-badge').textContent = (num < 10 ? '0' + num : num) + ' / 15';
  document.getElementById('question-text').textContent  = q.q;

  // Ответы (порядок случайный при каждом показе вопроса)
  const letters = ['A', 'B', 'C', 'D'];
  state.shuffledAnswers.forEach((ans, i) => {
    const btn    = document.getElementById(`ans-${i}`);
    const textEl = document.getElementById(`ans-text-${i}`);
    btn.className = 'answer-btn';
    btn.disabled  = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
    btn.querySelector('.ans-letter').textContent = letters[i];
    textEl.textContent = ans;
  });

  // Сбросить состояние подсказки immunity (не убираем саму кнопку — она могла уже использоваться)
  state.hints.immunity_active = false;
  // Сбросить любые скрытые тексты от 50:50
  [0,1,2,3].forEach(i => {
    const textEl = document.getElementById(`ans-text-${i}`);
    if (textEl) { textEl.style.opacity = ''; textEl.style.transition = ''; }
    const btn = document.getElementById(`ans-${i}`);
    if (btn) {
      const letter = btn.querySelector('.ans-letter');
      if (letter) { letter.style.opacity = ''; letter.style.transition = ''; }
    }
  });
  // Варианты, которые уже убрал сервер (повторная выдача после обрыва сети)
  (q.removed || []).forEach(eliminateAnswer);

  startQuestionTimer();
}

// Убрать вариант с экрана (50:50 или право на ошибку)
function eliminateAnswer(i) {
  const btn    = document.getElementById(`ans-${i}`);
  const textEl = document.getElementById(`ans-text-${i}`);
  if (!btn || !textEl) return;
  btn.classList.add('eliminated');
  btn.disabled = true;
  btn.style.pointerEvents = 'none';
  textEl.style.opacity = '0';
  textEl.style.transition = 'opacity 0.4s ease';
  const letter = btn.querySelector('.ans-letter');
  if (letter) { letter.style.opacity = '0'; letter.style.transition = 'opacity 0.4s ease'; }
}


/* 
   10. ПОДСКАЗКИ
 */

// Запрос подсказки у сервера. Флаг ставим сразу — от двойного клика.
async function requestHint(type, flag, btnId) {
  if (state.hints[flag] || state.busy || state.selectedAnswer !== null || !state.current) return null;
  state.hints[flag] = true;
  state.busy = true;
  try {
    const r = await api('hint', { index: state.current.index, type });
    document.getElementById(btnId).classList.add('used');
    soundHint();
    return r;
  } catch (e) {
    state.hints[flag] = false;
    showToast('Подсказка недоступна: ' + e.message, 'yellow');
    return null;
  } finally {
    state.busy = false;
  }
}

// ПРАВО НА ОШИБКУ
async function useImmunity() {
  const r = await requestHint('immunity', 'immunity', 'hint-immunity');
  if (!r) return;
  state.hints.immunity_active = true;
  showToast('🛡 ПРАВО НА ОШИБКУ АКТИВНО — следующая ошибка не засчитается!', 'cyan');
}

// 50:50 — какие два неверных убрать, решает сервер
async function useFiftyFifty() {
  const r = await requestHint('fifty', 'fiveOfifty', 'hint-5050');
  if (!r) return;
  (r.remove || []).forEach(eliminateAnswer);
  showToast('⚡ 50:50 — два неверных ответа убраны!', 'cyan');
}

// ПОМОЩЬ ЗАЛА — проценты считает сервер
async function useAudience() {
  const r = await requestHint('audience', 'audience', 'hint-audience');
  if (!r) return;
  const pcts = r.pcts || [25, 25, 25, 25];

  const popup     = document.getElementById('audience-popup');
  const barsEl    = document.getElementById('audience-bars');
  const letters   = ['A','B','C','D'];
  barsEl.innerHTML = '';

  popup.classList.add('visible');

  // Сначала 0%, потом анимируем
  pcts.forEach((pct, i) => {
    const row = document.createElement('div');
    row.className = 'audience-row';
    row.innerHTML = `
      <span class="audience-letter">${letters[i]}</span>
      <div class="audience-bar-wrap">
        <div class="audience-bar-fill" id="abar-${i}" style="width:0%"></div>
      </div>
      <span class="audience-pct">${pct}%</span>
    `;
    barsEl.appendChild(row);
  });

  setTimeout(() => {
    pcts.forEach((pct, i) => {
      document.getElementById(`abar-${i}`).style.width = pct + '%';
    });
  }, 100);
}

// ЗАМЕНИТЬ ВОПРОС — новый вопрос той же сложности выбирает сервер
async function useSwap() {
  const r = await requestHint('swap', 'swap', 'hint-swap');
  if (!r || !r.question) return;
  clearQuestionTimer();
  await loadQuestion(r.question);
  showToast('🔄 Вопрос заменён!', 'cyan');
}


/* 
   11. ОБРАБОТКА ОТВЕТА
 */
async function handleAnswer(chosenIdx) {
  if (state.busy || state.selectedAnswer !== null) return;
  clearQuestionTimer();
  state.selectedAnswer = chosenIdx;
  state.busy = true;

  const btn = document.getElementById(`ans-${chosenIdx}`);

  // Подсветить выбранный ответ
  btn.classList.add('selected');
  soundThink();

  // Ответ проверяет сервер; пауза «думаем» идёт параллельно
  let r;
  try {
    const send = () => api('answer', { index: state.current.index, choice: chosenIdx });
    [r] = await Promise.all([
      // Совсем мгновенный ответ сервер просит повторить чуть позже
      send().catch(async e => {
        if (e.message !== 'Слишком рано') throw e;
        await new Promise(res => setTimeout(res, 800));
        return send();
      }),
      new Promise(res => setTimeout(res, 1200)),
    ]);
  } catch (e) { serverError(e); return; }

  {
    // Заблокировать все кнопки
    [0,1,2,3].forEach(i => {
      document.getElementById(`ans-${i}`).disabled = true;
    });

    if (r.correct) {
      // ПРАВИЛЬНО
      btn.classList.remove('selected');
      btn.classList.add('correct');
      state.correctCount++;
      state.lastCorrect = true;

      const isLast = state.currentIdx === 14;
      if (isLast) {
        soundFinal();
      } else if (PRIZES[state.currentIdx].safe) {
        soundSafe();
      } else {
        soundCorrect();
      }

      if (AudienceSystem && AudienceSystem.setCorrect) AudienceSystem.setCorrect();

      showExplanation(true, r.explain);

    } else {
      // НЕВЕРНО

      if (r.saved) {
        // Право на ошибку спасло (решил сервер)
        soundHint();
        state.hints.immunity_active = false;
        btn.classList.remove('selected');
        btn.classList.add('wrong');
        // При праве на ошибку НЕ показываем правильный ответ
        setTimeout(() => {
          const wrongBtn = document.getElementById(`ans-${chosenIdx}`);
          const wrongText = document.getElementById(`ans-text-${chosenIdx}`);
          const wrongLetter = wrongBtn ? wrongBtn.querySelector('.ans-letter') : null;

          if (wrongBtn) {
            wrongBtn.classList.remove('wrong');
            wrongBtn.classList.add('eliminated');
            wrongBtn.disabled = true;
            wrongBtn.style.pointerEvents = 'none';
          }
          if (wrongText) {
            wrongText.style.opacity = '0';
            wrongText.style.transition = 'opacity 0.35s ease';
          }
          if (wrongLetter) {
            wrongLetter.style.opacity = '0';
            wrongLetter.style.transition = 'opacity 0.35s ease';
          }

          showToast('🛡 Неверный вариант убран. Выбери ответ снова!', 'cyan', 2200);

          // Разблокируем только оставшиеся варианты
          [0,1,2,3].forEach(i => {
            const b = document.getElementById(`ans-${i}`);
            if (!b || i === chosenIdx) return;
            b.classList.remove('selected', 'wrong', 'correct');
            if (!b.classList.contains('eliminated')) {
              b.disabled = false;
              b.style.pointerEvents = '';
            }
          });

          state.selectedAnswer = null;
          state.busy = false;
          startQuestionTimer();
        }, 650);

      } else {
        // Нет иммунитета — конец
        btn.classList.remove('selected');
        btn.classList.add('wrong');
        const cBtn = document.getElementById(`ans-${r.right}`);
        if (cBtn) cBtn.classList.add('correct');
        state.wrongCount++;
        state.lastCorrect = false;
        soundWrong();
        // Зал реагирует на неправильный ответ
        if (AudienceSystem && AudienceSystem.setWrong) AudienceSystem.setWrong();
        showExplanation(false, r.explain);
      }
    }
  }
}


/* 
   ИКОНКИ ИНТЕРФЕЙСА
   Файлы лежат рядом с index.html. Имена намеренно латиницей:
   кириллица в путях ломается при переносе Windows -> сервер.
 */
const UI_ICONS = {
  correct: 'icon-correct.png',
  wrong:   'icon-wrong.png',
  sad:     'icon-sad.png',
  trophy:  'icon-trophy.png',
  smug:    'icon-smug.png',
  cool:    'icon-cool.png',
};

function uiIcon(name, alt) {
  return '<img class="ui-icon" src="' + UI_ICONS[name] + '" alt="' + alt + '">';
}

/* 
   12. ПОЯСНЕНИЕ
 */
function showExplanation(isCorrect, explain) {
  const popup  = document.getElementById('explanation-popup');
  const inner  = popup.querySelector('.explanation-inner');
  const icon   = document.getElementById('exp-icon');
  const title  = document.getElementById('exp-title');
  const text   = document.getElementById('exp-text');
  const btnNext = document.getElementById('btn-next');

  inner.className = 'explanation-inner ' + (isCorrect ? 'correct-exp' : 'wrong-exp');

  if (isCorrect) {
    const isLast = state.currentIdx === 14;
    icon.innerHTML    = isLast ? uiIcon('trophy', 'Победа') : uiIcon('correct', 'Верно');
    title.textContent = isLast ? '[ ПОБЕДА! 1000 ОЧКОВ! ]' : '[ ВЕРНО! ]';
    title.style.color = 'var(--green)';
  } else {
    icon.innerHTML    = uiIcon('wrong', 'Неверно');
    title.textContent = '[ НЕВЕРНО ]';
    title.style.color = 'var(--pink)';
  }

  text.textContent = explain || '';

  const isLast = state.currentIdx === 14;
  btnNext.textContent = isLast || !isCorrect
    ? '[ ПОСМОТРЕТЬ ИТОГ ]'
    : '[ СЛЕДУЮЩИЙ ВОПРОС ]';

  popup.classList.add('visible');
}


/* 
   13. СЛЕДУЮЩИЙ ВОПРОС / ИТОГ
 */
function proceedAfterExplanation() {
  const popup   = document.getElementById('explanation-popup');
  popup.classList.remove('visible');

  const isCorrect = state.lastCorrect;
  const isLast    = state.currentIdx === 14;

  if (!isCorrect) {
    // Проигрыш
    endGame(false);
    return;
  }

  if (isLast) {
    // Победа — последний вопрос
    endGame(true);
    return;
  }

  // Переходим к следующему
  state.currentIdx++;
  loadQuestion();
}


/* 
   14. КОНЕЦ ИГРЫ
 */
function endGame(won) {
  showScreen('result');

  const reached   = state.currentIdx + 1;
  const prizeData = PRIZES[state.currentIdx];

  let finalPrize;
  if (won) {
    finalPrize = PRIZES[14].prize;
  } else {
    finalPrize = state.safeAmount || '0';
  }

  const elapsedMs = Math.max(0, Date.now() - (state.startedAtMs || Date.now()));
  submitScore('millionaire', {
    reached: reached,
    won: !!won,
    elapsed_ms: elapsedMs,
  }).then(res => {
    if (!res) return;
    if (typeof res.total_game_score === 'number') {
      showToast(`🏆 Очки добавлены! Всего в игре: ${res.total_game_score}`, 'yellow', 3000);
    } else if (res.is_record) {
      showToast('🏆 Новый рекорд!', 'yellow', 3000);
    }
  });
  const lbEl = document.getElementById('lb-millionaire');
  if (lbEl) renderLeaderboard(lbEl, 'millionaire', 5);

  const emoji   = won           ? uiIcon('trophy', 'Победа')
                : reached <= 5  ? uiIcon('sad', 'Мало очков')
                : reached <= 10 ? uiIcon('smug', 'Неплохо')
                : uiIcon('cool', 'Отличный результат');

  document.getElementById('r-emoji').innerHTML     = emoji;
  document.getElementById('r-title').textContent   = won ? '[ ПОБЕДИТЕЛЬ! ]' : '[ ИГРА ОКОНЧЕНА ]';
  document.getElementById('r-title').style.color   = won ? 'var(--yellow)' : 'var(--pink)';
  document.getElementById('r-prize').textContent   = finalPrize + ' pts';
  document.getElementById('r-correct').textContent = state.correctCount;
  document.getElementById('r-wrong').textContent   = state.wrongCount;
  document.getElementById('r-reached').textContent = reached;

  if (won) soundFinal(); else soundLose();
}


/* 
   ТОСТ
 */
function showToast(msg, type = 'info', duration = 2500) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    font-family:'Press Start 2P',monospace; font-size:9px;
    padding:12px 24px; border:1px solid; background:rgba(8,12,20,0.97);
    z-index:999; letter-spacing:1px; text-align:center;
    animation: none; white-space:nowrap;
    ${type === 'cyan'   ? 'color:var(--cyan);  border-color:var(--cyan);  box-shadow:0 0 20px rgba(0,229,255,0.3);'   : ''}
    ${type === 'yellow' ? 'color:var(--yellow);border-color:var(--yellow);box-shadow:0 0 20px rgba(245,216,0,0.3);' : ''}
    ${type === 'green'  ? 'color:var(--green); border-color:var(--green); box-shadow:0 0 20px rgba(57,255,20,0.3);'  : ''}
    ${type === 'pink'   ? 'color:var(--pink);  border-color:var(--pink);  box-shadow:0 0 20px rgba(255,77,109,0.3);' : ''}
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s';
    setTimeout(() => el.remove(), 400);
  }, duration);
}


/* 
   15. КНОПКИ И КЛАВИШИ
 */

// Старт игры: подписанный ран (api/ping-game.php) и партия на сервере
document.getElementById('btn-play').addEventListener('click', async () => {
  if (state.starting) return;
  state.starting = true;
  soundClick();
  try {
    if (typeof pingGame !== 'function') throw new Error('не загрузился модуль сайта');
    await pingGame('millionaire');
    run = JSON.parse(sessionStorage.getItem('gc_run_millionaire') || 'null');
    if (!run || !run.run_id) throw new Error('сервер не выдал партию');
    await api('start');
  } catch (e) {
    state.starting = false;
    run = null;
    showToast('Не получилось начать игру: ' + e.message, 'pink', 3200);
    return;
  }
  state.starting = false;

  // Сбросить состояние
  state.currentIdx     = 0;
  state.correctCount   = 0;
  state.wrongCount     = 0;
  state.selectedAnswer = null;
  state.busy           = false;
  state.safeAmount     = '0';
  state.current        = null;
  state.lastCorrect    = false;
  state.hints.immunity        = false;
  state.hints.immunity_active = false;
  state.hints.fiveOfifty      = false;
  state.hints.audience        = false;
  state.hints.swap            = false;
  state.startedAtMs           = Date.now();

  // Сбросить кнопки подсказок
  ['hint-immunity','hint-5050','hint-audience','hint-swap'].forEach(id => {
    document.getElementById(id).classList.remove('used');
    document.getElementById(id).disabled = false;
  });

  buildLadder();
  showScreen('game');
  loadQuestion();
});

// Ответы — сначала подтверждение, затем проверка
[0,1,2,3].forEach(i => {
  document.getElementById(`ans-${i}`).addEventListener('click', () => openAnswerConfirm(i));
});

const acYes = document.getElementById('ac-yes');
const acNo = document.getElementById('ac-no');
if (acYes) {
  acYes.addEventListener('click', () => {
    if (pendingAnswerIdx === null) return;
    const idx = pendingAnswerIdx;
    closeAnswerConfirm();
    soundSelect();
    handleAnswer(idx);
  });
}
if (acNo) {
  acNo.addEventListener('click', () => {
    soundClick();
    closeAnswerConfirm();
  });
}

// Подсказки
document.getElementById('hint-immunity').addEventListener('click', () => useImmunity());
document.getElementById('hint-5050').addEventListener('click',    () => useFiftyFifty());
document.getElementById('hint-audience').addEventListener('click', () => useAudience());
document.getElementById('hint-swap').addEventListener('click',     () => useSwap());

// Закрыть попап зала
document.getElementById('audience-close').addEventListener('click', () => {
  soundClick();
  document.getElementById('audience-popup').classList.remove('visible');
});

// Кнопка «Следующий вопрос» в пояснении
document.getElementById('btn-next').addEventListener('click', () => {
  soundClick();
  proceedAfterExplanation();
});

// ESC
document.getElementById('btn-esc').addEventListener('click', () => {
  soundClick();
  showScreen('menu');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const ac = document.getElementById('answer-confirm');
    if (ac && ac.classList.contains('visible')) {
      soundClick();
      closeAnswerConfirm();
      return;
    }
    soundClick();
    if (screens.menu.classList.contains('active')) {
      window.location.href = '../../index.html';
    } else {
      showScreen('menu');
    }
  }
  if (e.key === 'Enter' || e.key === ' ') {
    const popup = document.getElementById('explanation-popup');
    if (popup.classList.contains('visible')) { soundClick(); proceedAfterExplanation(); }
  }
});

// Результат
document.getElementById('btn-retry').addEventListener('click', async () => {
  soundClick();
  // Перезапуск — как btn-play
  document.getElementById('btn-play').click();
});
document.getElementById('btn-menu-res').addEventListener('click', () => {
  soundClick();
  showScreen('menu');
});


/* 
   16. ЗАПУСК
 */
async function init() {
  buildMenu();
  showScreen('menu');

  const lbEl = document.getElementById('lb-millionaire');
  if (lbEl) renderLeaderboard(lbEl, 'millionaire', 5);
}

document.addEventListener('visibilitychange', forfeitOnHiddenTab);

init();
