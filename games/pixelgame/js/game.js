const playerSprites = {
  left: new Image(),
  right: new Image(),
  up: new Image(),
  down: new Image()
};

// Корректные пути к 4 разным направлениям
playerSprites.left.src = 'assets/player/left.png';
playerSprites.right.src = 'assets/player/right.png';
playerSprites.up.src = 'assets/player/up.png';
playerSprites.down.src = 'assets/player/down.png';

const finishIcon = new Image();
finishIcon.src = 'assets/icons/computer.png';

// ═══════════════════════════════════════════════════
//   НАСТРОЙКИ АНИМАЦИИ ПЕРСОНАЖА
// ═══════════════════════════════════════════════════
const animState = {
  currentFrame: 0,       // Текущий кадр (0, 1, 2 или 3)
  frameTimer: 0,         // Счётчик времени для смены кадров
  frameSpeed: 8,         // Скорость смены кадров (чем меньше, тем быстрее)
  frameCount: 4,         // Всего кадров в каждом направлении
  lastDirection: 'down'  // Направление по умолчанию (вниз)
};

function updatePlayerAnimation() {
  // 1. Берем направление напрямую из встроенной физики персонажа
  animState.lastDirection = state.player.dir || 'down';

  // 2. Проверяем, движется ли персонаж в этот самый момент.
  // В твоем игровом объекте за это отвечает флаг state.player.moving
  if (state.player.moving) {
    // Наращиваем таймер кадров
    animState.frameTimer++;

    if (animState.frameTimer >= animState.frameSpeed) {
      animState.frameTimer = 0;
      // Переключаем кадры по кругу: 0 -> 1 -> 2 -> 3 -> 0
      animState.currentFrame = (animState.currentFrame + 1) % animState.frameCount;
    }
  } else {
    // Если остановился — строго первый кадр покоя
    animState.currentFrame = 0;
    animState.frameTimer = 0;
  }
}

// ═══════════════════════════════════════════════════
//   ЗВУКОВАЯ СИСТЕМА (Web Audio API)
// ═══════════════════════════════════════════════════
const Audio = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function beep(freq, dur, type='square', vol=0.15, delay=0) {
    try {
      const ac = getCtx();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = type; o.frequency.value = freq;
      const t = ac.currentTime + delay;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.01);
    } catch(e) {}
  }
  function noise(dur=0.08, vol=0.08) {
    try {
      const ac = getCtx();
      const buf = ac.createBuffer(1, ac.sampleRate*dur, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
      const src = ac.createBufferSource();
      const g = ac.createGain(); const f = ac.createBiquadFilter();
      src.buffer=buf; f.type='bandpass'; f.frequency.value=300;
      src.connect(f); f.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
      src.start(); src.stop(ac.currentTime+dur+0.01);
    } catch(e) {}
  }

  return {
    // Открытие сундука
    chest: () => { beep(440,0.08,'square',0.12); beep(660,0.12,'square',0.12,0.09); beep(880,0.2,'sine',0.1,0.2); },
    // Правильный ответ
    correct: () => { beep(523,0.07,'square',0.1); beep(659,0.07,'square',0.1,0.08); beep(784,0.15,'sine',0.12,0.16); beep(1047,0.25,'sine',0.1,0.31); },
    // Неверный ответ
    wrong: () => { beep(220,0.05,'sawtooth',0.12); beep(196,0.05,'sawtooth',0.12,0.06); beep(164,0.2,'sawtooth',0.1,0.12); },
    // Урон / ловушка
    damage: () => { noise(0.12,0.15); beep(150,0.15,'sawtooth',0.15,0.05); },
    // Агр врага
    aggro: () => { beep(300,0.04,'sawtooth',0.1); beep(250,0.04,'sawtooth',0.1,0.05); beep(200,0.1,'sawtooth',0.12,0.1); },
    // Победа над врагом
    kill: () => { beep(400,0.05,'square',0.1); beep(600,0.05,'square',0.1,0.06); beep(800,0.1,'sine',0.1,0.12); },
    // Подбор предмета
    pickup: () => { beep(660,0.06,'sine',0.1); beep(880,0.06,'sine',0.1,0.07); beep(1100,0.12,'sine',0.08,0.14); },
    // Шаги (тихий стук)
    step: () => { beep(60+Math.random()*20, 0.04, 'sine', 0.04); },
    // Финал / победа
    victory: () => {
      [0,0.15,0.3,0.45,0.6,0.8].forEach((d,i)=>{
        const notes=[523,659,784,1047,1319,1568];
        beep(notes[i],0.2,'sine',0.12,d);
      });
    },
    // Кнопка
    click: () => { beep(440,0.04,'square',0.08); },
    // Game over
    gameover: () => {
      beep(400,0.1,'sawtooth',0.12); beep(300,0.1,'sawtooth',0.12,0.12);
      beep(200,0.2,'sawtooth',0.12,0.25); beep(100,0.4,'sawtooth',0.1,0.46);
    },
  };
})();

// ═══════════════════════════════════════════════════
//   АНИМАЦИЯ МЕНЮ (пиксельная карта на фоне)
// ═══════════════════════════════════════════════════
function initMenuAnimation() {
  const mc = document.getElementById('menu-canvas');
  if (!mc) return;
  mc.width  = window.innerWidth;
  mc.height = window.innerHeight;
  const mx = mc.getContext('2d');

  // Рисуем мини-лабиринт на фоне
  const tsize = 24;
  const cols = Math.ceil(mc.width / tsize) + 1;
  const rows = Math.ceil(mc.height / tsize) + 1;
  
  let menuAnimFrame;
  function menuLoop() {
    drawMenuBg();
    menuAnimFrame = requestAnimationFrame(menuLoop);
  }
  menuLoop();

  // ── Герой: рисуем из PNG-спрайта ──────────────────────────────────
  const villainCanvas = document.getElementById('menu-villain-canvas');
  let villainAnimFrame;

  // ── Злодей: Глитч-призрак тип 0 (зелёный) ─────────────────────────
  // Запускаем сразу через setTimeout чтобы гарантировать что DOM готов
  setTimeout(function() {
    const vc = document.getElementById('menu-villain-canvas');
    if (!vc) return;
    const vCtx = vc.getContext('2d');
    // Убеждаемся что canvas имеет правильный размер
    vc.width = 72; vc.height = 72;
    let startTime = null;

    function villainLoop(ts) {
      if (!startTime) startTime = ts;
      const t = ts - startTime;
      vCtx.clearRect(0, 0, 72, 72);

      const bob = Math.sin(t / 320) * 4;
      const rotate = Math.sin(t / 640) * 0.06;

      // Тень (в screen-space, до transform)
      vCtx.fillStyle = 'rgba(0,0,0,0.3)';
      vCtx.beginPath();
      vCtx.ellipse(36, 70, 12, 4, 0, 0, Math.PI * 2);
      vCtx.fill();

      // Спрайт 48x48 масштабируем в 72x72 (x1.5), центруем с бобом
      vCtx.save();
      vCtx.translate(36, 36 + bob);
      vCtx.rotate(rotate);
      vCtx.scale(1.5, 1.5);
      vCtx.translate(-24, -24);

      // Тело призрака (тёмный контур)
      vCtx.fillStyle = '#003a18';
      vCtx.fillRect(8, 6, 24, 26);
      // Тело (светлее)
      vCtx.fillStyle = '#005530';
      vCtx.fillRect(10, 4, 20, 24);
      // Волнистый низ — 3 зубца
      const gw = Math.sin(t / 200) > 0 ? 1 : -1;
      vCtx.fillStyle = '#005530';
      vCtx.fillRect(8,  28, 8, 6 + gw * 3);
      vCtx.fillRect(20, 28, 8, 6 - gw * 3);
      vCtx.fillRect(32, 28, 8, 6 + gw * 3);
      vCtx.fillStyle = '#003a18';
      vCtx.fillRect(16, 28, 4, 4);
      vCtx.fillRect(28, 28, 4, 4);
      // Глаза — крестики
      vCtx.fillStyle = '#00ff88';
      vCtx.fillRect(13, 10, 2, 6); vCtx.fillRect(11, 12, 6, 2);
      vCtx.fillRect(23, 10, 2, 6); vCtx.fillRect(21, 12, 6, 2);
      // Пиксельный распад
      vCtx.fillStyle = 'rgba(0,255,100,0.2)';
      const seed = Math.floor(t / 300);
      for (let i = 0; i < 6; i++) {
        vCtx.fillRect(4 + ((seed * 7 + i * 13) % 5) * 8,
                      2 + ((seed * 11 + i * 7) % 5) * 8, 6, 6);
      }
      // Мерцание
      if (Math.sin(t / 150) > 0.6) {
        vCtx.fillStyle = 'rgba(0,255,100,0.35)';
        vCtx.fillRect(8, 4, 24, 3);
      }
      // Полосы помех
      vCtx.fillStyle = 'rgba(0,220,100,0.15)';
      vCtx.fillRect(8, 14, 24, 2);
      vCtx.fillRect(8, 20, 24, 2);

      vCtx.restore();
      villainAnimFrame = requestAnimationFrame(villainLoop);
    }
    villainAnimFrame = requestAnimationFrame(villainLoop);
  }, 0);

  // Останавливаем при старте игры
  window._stopMenuAnim = () => {
    cancelAnimationFrame(menuAnimFrame);
    cancelAnimationFrame(villainAnimFrame);
  };
}



const FINAL_PROGRAM = {
  sourceIntro:'',
  sourceOutro:'',
  output:
`Битва началась!

Игрок наносит 24 урона!
HP босса: 76

Босс наносит 11 урона!
HP игрока: 89

Игрок наносит 27 урона!
HP босса: 49

Босс наносит 18 урона!
HP игрока: 71

Игрок наносит 30 урона!
HP босса: 19

Босс наносит 9 урона!
HP игрока: 62

Игрок наносит 21 урона!
HP босса: -2

Игрок победил!`,
  explain:
`<b>Random rnd</b> создаёт генератор случайных чисел для урона игрока и босса.<br>
<b>while</b> держит бой активным, пока у обоих есть здоровье.<br>
<b>Ход игрока</b> уменьшает HP босса и может досрочно завершить цикл через <b>break</b>.<br>
<b>Ход босса</b> выполняется только если босс пережил атаку игрока.<br>
<b>Финальная проверка</b> после цикла выводит, кто победил.`
};

// ═══ КАРТА 33x23 (все объекты достижимы, BFS ✓) ═══
const FINAL_EXPLAIN_BLOCKS = [
  {
    title: '1. Подготовка игры',
    text: 'Первая часть создаёт `Random`, задаёт стартовое HP игрока и босса и выводит сообщение о начале битвы.'
  },
  {
    title: '2. Цикл боя',
    text: 'Цикл `while` повторяет раунды, пока и игрок, и босс ещё живы.'
  },
  {
    title: '3. Ход игрока',
    text: 'Игрок получает случайный урон от 10 до 30, наносит его боссу и при необходимости завершает бой через `break`.'
  },
  {
    title: '4. Ход босса',
    text: 'Если босс выжил, он отвечает ударом на 5–20 урона и уменьшает HP игрока.'
  },
  {
    title: '5. Конец игры',
    text: 'После выхода из цикла программа проверяет, кто остался жив, и объявляет победителя.'
  }
];

const FINAL_SUMMARY = 'Все пять фрагментов собираются в одну Go-программу пошаговой битвы: подготовка, цикл боя, ход игрока, ход босса и объявление победителя.';

let MAP = [
  'WWWWWWWWWWWWWWWWWWWWW',
  'WP..W.......W.....W.W',
  'W.W.W.WWWWW.W.W.W.W.W',
  'W.W.W.W.E.W.C.W.W...W', // Вот он, верхний сундук на месте!
  'W.W...W.W.W.WWW.WWW.W',
  'W.WWWWW.W.W...W...W.W',
  'W.....W.W.WWW.W.W.W.W',
  'W.WWW.W.W...W.W.W.E.W',
  'W.W.C.W.W.E.W.W.WWWWW',
  'W.W.WWW.W...W.W.....W',
  'W.W.....WWWWW.WWWWW.W',
  'W.WWWWWWW...W.E...W.W',
  'W.......W.W.W.WWW.C.W',
  'W.WWWWW.W.W.W.W.W.W.W',
  'W.E.W.C.W.W.W...W.W.W',
  'W.W.W.WWW.W.WWWWW.W.W',
  'W.W.W.....W.....W.C.W',
  'W.W.WWWWWWW.W.W.W.W.W',
  'W.W.........W.E.W...W',
  'W.WWWWWWWWWWW.W.WWWFW',
  'WWWWWWWWWWWWWWWWWWWWW',
];

// Сохраняем дефолтную карту чтобы можно было откатиться
const MAP_DEFAULT = MAP.slice();

const TILE = 48;
const TOTAL_CHESTS = 5; // используем первые 5 вопросов

const DEFAULT_LEVEL_CARDS = [
  { level: 1, name: 'УРОВЕНЬ 1', title: 'Основы Go — вывод и пакеты' },
  { level: 2, name: 'УРОВЕНЬ 2', title: 'Переменные и типы данных' },
  { level: 3, name: 'УРОВЕНЬ 3', title: 'Операторы и ввод данных' },
  { level: 4, name: 'УРОВЕНЬ 4', title: 'Условные конструкции' },
];

function getMenuLevels() {
  return DEFAULT_LEVEL_CARDS.map(item => ({ ...item, available: true }));
}

function renderLevelCards() {
  const grid = document.querySelector('.level-grid');
  if (!grid) return;
  const levels = getMenuLevels();
  grid.innerHTML = '';
  levels.forEach((lv, idx) => {
    const btn = document.createElement('button');
    const accent = `level-accent-${(idx % 4) + 1}`;
    btn.type = 'button';
    btn.className = `level-card level-available ${accent}`;
    btn.dataset.level = lv.level;

    const num = document.createElement('div');
    num.className = 'level-num pixel-text';
    num.textContent = String(lv.level).padStart(2, '0');

    const name = document.createElement('div');
    name.className = 'level-name pixel-text';
    name.textContent = lv.name;

    const desc = document.createElement('div');
    desc.className = 'level-desc';
    desc.textContent = lv.title;

    const badge = document.createElement('div');
    badge.className = 'level-badge level-badge-open pixel-text';
    badge.textContent = 'ДОСТУПЕН';

    btn.append(num, name, desc, badge);
    btn.addEventListener('click', async () => {
      Audio.click();
      try {
        await startLevel(lv.level);
      } catch (error) {
        handleLevelLoadError(lv.level, error);
      }
    });
    grid.appendChild(btn);
  });
}

function handleLevelLoadError(levelNumber, error) {
  console.error(error);
  showLoadError('ОШИБКА ЗАГРУЗКИ', 'Не удалось загрузить вопросы уровня.',
    `<div style="text-align:left">Возможные причины:<ul style="text-align:left;margin-top:6px"><li>Запуск из файловой системы — запусти локальный сервер (например: <code>npx http-server</code> или <code>python -m http.server</code>).</li><li>Файл <strong>data/levels/level${levelNumber}.json</strong> отсутствует или повреждён.</li><li>Права доступа или CORS при удалённой загрузке.</li></ul></div>`
  );
  showScreen('levels');
}

// ═══ СОСТОЯНИЕ ═══
const state = {
  hp:5, maxHp:5, score:0, totalChests:0,
  currentLevel:1, levelData:null, monsterQuestions:null,
  availableMonsterQuestionIds:[],
  inventory:[], keys:{},
  player:{ x:0, y:0, dir:'down', moving:false, slow:0 },
  enemies:[], chests:[], traps:[],
  finish:{x:0,y:0},
  gameActive:false,
  openedChests:new Set(), defeatedEnemies:new Set(),
  animFrame:null, lastTime:0, invincible:0,
  camX:0, camY:0,
  // Туман войны — Set видимых клеток
  explored: new Set(),
  // ── Метрики для серверного подсчёта очков (api/score.php) ──
  wrongChestAnswers:0,      // неверные ответы на вопросы сундуков
  monsterBattlesWon:0,      // выигранные бои с вирусами
  monsterBattlesTotal:0,    // всего начатых боёв
  startedAtMs:0,            // Date.now() на старте уровня
  scoreSubmitted:false,     // защита от повторной отправки
};

let noticeCallback = null;

/**
 * Применяет карту уровня из данных (если есть) или дефолтную.
 * Поддерживает два формата: массив строк ('W','.','P','F','E','C','X')
 * и числовые массивы из редактора (0..7).
 */
function applyLevelMap(mapData) {
  try {
    if (Array.isArray(mapData) && mapData.length) {
      if (typeof mapData[0] === 'string') {
        MAP = mapData.slice();
        return;
      }
      const numToChar = { 0: '.', 1: 'W', 4: 'E', 5: 'C', 7: 'X' };
      let playerSeen = false, exitSeen = false;
      MAP = mapData.map(row => {
        return row.map(n => {
          if (n === 2) {
            if (playerSeen) return '.';
            playerSeen = true; return 'P';
          }
          if (n === 3) {
            if (exitSeen) return '.';
            exitSeen = true; return 'F';
          }
          return numToChar[n] || '.';
        }).join('');
      });
      return;
    }
  } catch (e) {
    console.warn('Failed to apply level map:', e);
  }
  MAP = MAP_DEFAULT.slice();
}

/**
 * Загружает уровень: сначала через API сайта (Postgres + Redis-кэш),
 * при недоступности API — фолбэк на статический JSON рядом с игрой.
 */
async function loadLevel(levelNumber) {
  let fileData = null;

  try {
    const response = await fetch(`../../api/pixelgame-level.php?level=${levelNumber}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.chests)) fileData = data;
    }
  } catch (e) {
    console.warn('Pixelgame level API unavailable, falling back to static JSON:', e);
  }

  if (!fileData) {
    const response = await fetch(`data/levels/level${levelNumber}.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load level ${levelNumber}`);
    fileData = await response.json();
  }

  if (!fileData || !Array.isArray(fileData.chests)) {
    throw new Error(`Invalid level data for level ${levelNumber}`);
  }

  applyLevelMap(fileData.map);

  const levelData = {
    ...fileData,
    level: fileData.level || levelNumber,
    title: fileData.title || `Level ${levelNumber}`,
    name: fileData.name || fileData.title || `Level ${levelNumber}`,
    chests: fileData.chests,
    final: fileData.final || null,
  };

  state.currentLevel = levelNumber;
  state.levelData = levelData;
  state.totalChests = levelData.chests.length;
}

/**
 * Загружает вопросы для боёв: API сайта → фолбэк на статический JSON.
 */
async function loadMonsterQuestions() {
  let questionData = null;

  try {
    const response = await fetch('../../api/pixelgame-questions.php', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.questions)) questionData = data;
    }
  } catch (e) {
    console.warn('Pixelgame questions API unavailable, falling back to static JSON:', e);
  }

  if (!questionData) {
    const response = await fetch('data/monster-questions.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load monster questions');
    questionData = await response.json();
  }

  if (!questionData || !Array.isArray(questionData.questions)) {
    throw new Error('Invalid monster question data');
  }

  state.monsterQuestions = questionData.questions;
}

function getChestContent(index) {
  return state.levelData?.chests?.[index] || null;
}

function getChestRewardLabel(index) {
  return getChestContent(index)?.reward?.label || 'next block';
}

function getChestQuestionText(data) {
  return data?.question ?? data?.text ?? data?.q?.text ?? '';
}

function getLevelFinal() {
  if (state.levelData?.final) return state.levelData.final;
  return {
    output: FINAL_PROGRAM.output,
    summary: FINAL_SUMMARY,
    explain: FINAL_EXPLAIN_BLOCKS
  };
}

function getBattleQuestionPool() {
  return state.monsterQuestions || [];
}

function shuffleArray(items) {
  const result=[...items];
  for (let i=result.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function resetBattleQuestionSession() {
  state.availableMonsterQuestionIds = shuffleArray(
    getBattleQuestionPool().map(question => question.id)
  );
}

function getBattleQuestionById(questionId) {
  return getBattleQuestionPool().find(question => question.id === questionId) || null;
}

function getUniqueBattleQuestionForEnemy(enemy) {
  if (enemy.questionId != null) {
    return getBattleQuestionById(enemy.questionId);
  }

  if (!state.availableMonsterQuestionIds.length) {
    return null;
  }

  const nextQuestionId = state.availableMonsterQuestionIds.shift();
  enemy.questionId = nextQuestionId;
  return getBattleQuestionById(nextQuestionId);
}

function showNotice(message, header='УВЕДОМЛЕНИЕ', onClose=null) {
  noticeCallback = onClose;
  document.getElementById('notice-header').textContent = header;
  document.getElementById('notice-text').textContent = message;
  document.getElementById('dialog-notice').classList.remove('hidden');
}

function hideNotice() {
  // remove any dynamic action buttons added by showLoadError
  const actions = document.querySelector('#dialog-notice .dialog-actions');
  if (actions) {
    const dyn = actions.querySelectorAll('.dynamic-action');
    dyn.forEach(d=>d.remove());
  }
  document.getElementById('dialog-notice').classList.add('hidden');
  const callback = noticeCallback;
  noticeCallback = null;
  if (callback) callback();
}

// Показывает расширённый баннер ошибки загрузки уровня
function showLoadError(title, message, detailsHtml='') {
  noticeCallback = null;
  document.getElementById('notice-header').textContent = title || 'ОШИБКА ЗАГРУЗКИ';
  const text = document.getElementById('notice-text');
  text.innerHTML = `<div style="margin-bottom:8px;font-weight:700">${message}</div>${detailsHtml}`;
  const actions = document.querySelector('#dialog-notice .dialog-actions');
  // add Retry button
  const retry = document.createElement('button');
  retry.className = 'pixel-btn dynamic-action'; retry.id = 'notice-retry'; retry.textContent = 'ПОВТОРИТЬ';
  retry.addEventListener('click', ()=>{ Audio.click(); hideNotice(); location.reload(); });
  actions.appendChild(retry);

  document.getElementById('dialog-notice').classList.remove('hidden');
}

let confirmCallback = null;
let confirmPausedGame = false;

function showConfirm(message, header='ПОДТВЕРЖДЕНИЕ', onYes=null) {
  confirmCallback = onYes;
  confirmPausedGame = false;
  if (state.gameActive) {
    state.gameActive = false;
    confirmPausedGame = true;
  }
  document.getElementById('confirm-header').textContent = header;
  document.getElementById('confirm-text').textContent = message;
  document.getElementById('dialog-confirm').classList.remove('hidden');
}

function hideConfirm() {
  document.getElementById('dialog-confirm').classList.add('hidden');
  confirmCallback = null;
  if (confirmPausedGame) {
    state.gameActive = true;
    confirmPausedGame = false;
  }
}

function goToMainMenu() {
  state.gameActive = false;
  cancelAnimationFrame(state.animFrame);
  hideDialog('dialog-question');
  hideDialog('dialog-battle');
  hideConfirm();
  showScreen('menu');
  initMenuAnimation();
}

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
// Offscreen для тени (lighting)
const lightCanvas = document.createElement('canvas');
const lctx        = lightCanvas.getContext('2d');

function resizeCanvas() {
  const hudH = document.getElementById('hud').offsetHeight || 56;
  canvas.style.top = hudH + 'px';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight - hudH;
  lightCanvas.width  = canvas.width;
  lightCanvas.height = canvas.height;
}

// ═══ ЭКРАНЫ ═══
const screens = {
  menu:document.getElementById('screen-menu'),
  levels:document.getElementById('screen-levels'),
  how:document.getElementById('screen-how'),
  game:document.getElementById('screen-game'),
  final:document.getElementById('screen-final'),
  gameover:document.getElementById('screen-gameover'),
};
function showScreen(n) {
  Object.values(screens).forEach(s=>s.classList.remove('active'));
  if(screens[n]) screens[n].classList.add('active');
}

// ═══ INIT MAP ═══
function initMap() {
  state.enemies=[]; state.chests=[]; state.traps=[];
  state.openedChests.clear(); state.defeatedEnemies.clear();
  state.explored.clear();
  let ci=0, ei=0;
  for (let row=0;row<MAP.length;row++) {
    for (let col=0;col<MAP[row].length;col++) {
      const ch=MAP[row][col], px=col*TILE, py=row*TILE;
      if (ch==='P') { state.player.x=px; state.player.y=py; }
      else if (ch==='C' && ci<state.totalChests) {
        state.chests.push({x:px,y:py,id:`c${ci}`,qIdx:ci,open:false}); ci++;
      } else if (ch==='E') {
        state.enemies.push({
          x:px, y:py, id:`e${ei}`, type:ei%3,
          frame:0, frameTimer:0, moveTimer:0,
          dx:0, dy:0, defeated:false, questionId:null,
          // Агрессия
          aggroed:false, aggroTimer:0,
          homeX:px, homeY:py,  // точка патруля
        }); ei++;
      } else if (ch==='X') { state.traps.push({x:px,y:py}); }
      else if (ch==='F') { state.finish.x=px; state.finish.y=py; }
    }
  }
  state.camX = state.player.x - canvas.width/2 + TILE/2;
  state.camY = state.player.y - canvas.height/2 + TILE/2;
}

// ═══ КАМЕРА (плавная) ═══
function updateCamera() {
  const tx=state.player.x-canvas.width/2+TILE/2;
  const ty=state.player.y-canvas.height/2+TILE/2;
  state.camX += (tx-state.camX)*0.09;
  state.camY += (ty-state.camY)*0.09;
}

// ═══ ТЕКСТУРЫ ═══
let texWall=null, texFloor=null, texFloorB=null;

function buildTextures() {
  texWall  = buildWallTex();
  texFloor = buildFloorTex(false);
  texFloorB= buildFloorTex(true);
}

function buildWallTex() {
  const cv=document.createElement('canvas'); cv.width=TILE; cv.height=TILE;
  const x=cv.getContext('2d');
  // Основа
  x.fillStyle='#0e1928'; x.fillRect(0,0,TILE,TILE);
  // Кирпичи
  const bH=11, bW=TILE/2+1;
  for (let row=0;row<Math.ceil(TILE/bH)+1;row++) {
    const off=(row%2)*bW/2;
    for (let col=-1;col<3;col++) {
      const bx=col*bW+off, by=row*bH;
      const lum=13+(row*3+col*2)%6;
      x.fillStyle=`hsl(220,42%,${lum}%)`;
      x.fillRect(bx+1,by+1,bW-2,bH-2);
      // Шов
      x.fillStyle='#050c18'; x.fillRect(bx,by,bW,1); x.fillRect(bx,by,1,bH);
      // Блик
      x.fillStyle='rgba(255,255,255,0.04)'; x.fillRect(bx+2,by+2,4,2);
    }
  }
  // Верхний свет
  const g=x.createLinearGradient(0,0,0,9);
  g.addColorStop(0,'rgba(0,229,255,0.2)'); g.addColorStop(1,'rgba(0,229,255,0)');
  x.fillStyle=g; x.fillRect(0,0,TILE,9);
  // Контур
  x.strokeStyle='rgba(0,229,255,0.08)'; x.lineWidth=1; x.strokeRect(0,0,TILE,TILE);
  return cv;
}

function buildFloorTex(alt) {
  const cv=document.createElement('canvas'); cv.width=TILE; cv.height=TILE;
  const x=cv.getContext('2d');
  x.fillStyle=alt?'#080f1a':'#0a1422'; x.fillRect(0,0,TILE,TILE);
  // Рамка плитки
  x.strokeStyle='rgba(0,229,255,0.08)'; x.lineWidth=1; x.strokeRect(2,2,TILE-4,TILE-4);
  // Углы
  const corner=(bx,by)=>{ x.fillStyle='rgba(0,229,255,0.14)'; x.fillRect(bx,by,3,3); };
  corner(3,3); corner(TILE-6,3); corner(3,TILE-6); corner(TILE-6,TILE-6);
  if (!alt) {
    // Диагональный узор
    x.strokeStyle='rgba(0,229,255,0.04)'; x.lineWidth=1;
    x.beginPath(); x.moveTo(0,TILE); x.lineTo(TILE,0); x.stroke();
    x.beginPath(); x.moveTo(TILE/2,0); x.lineTo(TILE,TILE/2); x.stroke();
  }
  x.fillStyle=alt?'rgba(178,75,255,0.07)':'rgba(0,229,255,0.06)';
  x.beginPath(); x.arc(TILE/2,TILE/2,2,0,Math.PI*2); x.fill();
  return cv;
}

// ═══ ТУМАН ВОЙНЫ / ОСВЕЩЕНИЕ ═══
const LIGHT_RADIUS = 5; // радиус в тайлах, который хорошо видно

function updateFog() {
  const pr = Math.floor((state.player.y+TILE/2)/TILE);
  const pc = Math.floor((state.player.x+TILE/2)/TILE);
  for (let dr=-LIGHT_RADIUS;dr<=LIGHT_RADIUS;dr++) {
    for (let dc=-LIGHT_RADIUS;dc<=LIGHT_RADIUS;dc++) {
      if (dr*dr+dc*dc <= LIGHT_RADIUS*LIGHT_RADIUS) {
        state.explored.add(`${pr+dr},${pc+dc}`);
      }
    }
  }
}

function drawLighting(cam) {
  lctx.clearRect(0,0,lightCanvas.width,lightCanvas.height);

  const px = state.player.x - cam.x + TILE/2;
  const py = state.player.y - cam.y + TILE/2;
  const lightPx = LIGHT_RADIUS * TILE;

  // Тёмный фон
  lctx.fillStyle = 'rgba(0,0,0,0.92)';
  lctx.fillRect(0,0,lightCanvas.width,lightCanvas.height);

  // Исследованные клетки — полутьма
  const pr=Math.floor((state.player.y+TILE/2)/TILE);
  const pc=Math.floor((state.player.x+TILE/2)/TILE);
  const explRadius=LIGHT_RADIUS+8;
  lctx.globalCompositeOperation='destination-out';
  state.explored.forEach(key=>{
    const [er,ec]=key.split(',').map(Number);
    const dx=ec-pc, dy=er-pr;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if (dist>explRadius) return;
    const sx=ec*TILE-cam.x, sy=er*TILE-cam.y;
    if (sx<-TILE||sy<-TILE||sx>canvas.width+TILE||sy>canvas.height+TILE) return;
    // Полутьма для исследованного
    lctx.fillStyle='rgba(0,0,0,0.55)';
    lctx.fillRect(sx,sy,TILE+1,TILE+1);
  });

  // Яркий круг вокруг игрока
  const grad=lctx.createRadialGradient(px,py,0,px,py,lightPx);
  grad.addColorStop(0.0,'rgba(0,0,0,1.0)');
  grad.addColorStop(0.4,'rgba(0,0,0,0.95)');
  grad.addColorStop(0.7,'rgba(0,0,0,0.7)');
  grad.addColorStop(1.0,'rgba(0,0,0,0)');
  lctx.fillStyle=grad;
  lctx.fillRect(px-lightPx,py-lightPx,lightPx*2,lightPx*2);

  lctx.globalCompositeOperation='source-over';

  // Рисуем lighting-слой на основной канвас
  ctx.drawImage(lightCanvas,0,0);

  // Свечение вокруг игрока (тёплое)
  ctx.globalCompositeOperation='screen';
  const glow=ctx.createRadialGradient(px,py,0,px,py,lightPx*0.5);
  glow.addColorStop(0,'rgba(0,229,255,0.06)');
  glow.addColorStop(0.5,'rgba(0,100,180,0.03)');
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glow;
  ctx.fillRect(px-lightPx,py-lightPx,lightPx*2,lightPx*2);
  ctx.globalCompositeOperation='source-over';
}

// ═══ ОТРИСОВКА КАРТЫ ═══
function drawMap(cam) {
  if (!texWall) buildTextures();
  ctx.imageSmoothingEnabled=false;
  for (let row=0;row<MAP.length;row++) {
    for (let col=0;col<MAP[row].length;col++) {
      const sx=col*TILE-cam.x, sy=row*TILE-cam.y;
      if (sx<-TILE||sy<-TILE||sx>canvas.width+TILE||sy>canvas.height+TILE) continue;
      const ch=MAP[row][col];
      if (ch==='W') {
        ctx.drawImage(texWall,sx,sy);
        ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(sx,sy+TILE-5,TILE,5);
      } else {
        ctx.drawImage((row+col)%2===0?texFloor:texFloorB,sx,sy);
      }
    }
  }
  // Тонкая сетка
  ctx.strokeStyle='rgba(0,229,255,0.025)'; ctx.lineWidth=1;
  const sc=Math.floor(cam.x/TILE), ec=sc+Math.ceil(canvas.width/TILE)+2;
  const sr=Math.floor(cam.y/TILE), er=sr+Math.ceil(canvas.height/TILE)+2;
  for (let c=sc;c<ec;c++) { ctx.beginPath(); ctx.moveTo(c*TILE-cam.x,0); ctx.lineTo(c*TILE-cam.x,canvas.height); ctx.stroke(); }
  for (let r=sr;r<er;r++) { ctx.beginPath(); ctx.moveTo(0,r*TILE-cam.y); ctx.lineTo(canvas.width,r*TILE-cam.y); ctx.stroke(); }
}

// ═══ СУНДУКИ ═══
function drawChests(cam) {
  state.chests.forEach(ch=>{
    if (ch.open) return;
    const sx=ch.x-cam.x, sy=ch.y-cam.y;
    if (sx<-TILE*2||sy<-TILE*2||sx>canvas.width+TILE||sy>canvas.height+TILE) return;
    const t=Date.now(), glow=0.1+Math.sin(t/600)*0.07;
    // Ореол
    ctx.fillStyle=`rgba(255,214,0,${glow})`; ctx.beginPath(); ctx.arc(sx+TILE/2,sy+TILE/2,26,0,Math.PI*2); ctx.fill();
    // Тело
    ctx.fillStyle='#5c3d11'; ctx.fillRect(sx+5,sy+16,TILE-10,TILE-20);
    ctx.fillStyle='#c89a30'; ctx.fillRect(sx+5,sy+TILE-8,TILE-10,3);
    // Крышка
    ctx.fillStyle='#7a5219'; ctx.fillRect(sx+5,sy+10,TILE-10,9);
    ctx.fillStyle='#c89a30'; ctx.fillRect(sx+5,sy+10,TILE-10,2); ctx.fillRect(sx+5,sy+17,TILE-10,2);
    // Замок
    ctx.fillStyle='#ffd600'; ctx.fillRect(sx+TILE/2-5,sy+14,10,10);
    ctx.fillStyle='#fff176'; ctx.fillRect(sx+TILE/2-3,sy+15,4,4);
    // Знак ?
    const p=0.6+Math.sin(t/400)*0.4; ctx.globalAlpha=p;
    ctx.fillStyle='#ffd600'; ctx.font='bold 11px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText('?',sx+TILE/2,sy-2); ctx.globalAlpha=1;
  });
}

// Перемешивает варианты ответов (Fisher-Yates), возвращает новый массив и новый индекс правильного
function shuffleOptions(options, correctIndex) {
  const indexed = options.map((opt, i) => ({ opt, correct: i === correctIndex }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  return {
    options: indexed.map(x => x.opt),
    correct: indexed.findIndex(x => x.correct),
  };
}

// ═══ ВРАГИ — ПИКСЕЛЬНЫЕ ПЕРСОНАЖИ С АГРЕССИЕЙ ═══
const AGGRO_RANGE   = TILE * 4.5;  // дистанция агра
const DEAGGRO_RANGE = TILE * 7;    // дистанция сброса агра
const ENEMY_SPEED   = 120;         // скорость при преследовании
const PATROL_SPEED  = 65;          // скорость патруля

// Проверка прямой видимости: нет ли стены на пути от (x1,y1) до (x2,y2)
function hasLineOfSight(x1, y1, x2, y2) {
  const steps = Math.ceil(Math.hypot(x2-x1, y2-y1) / (TILE * 0.4));
  if (steps === 0) return true;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    const col = Math.floor(cx / TILE);
    const row = Math.floor(cy / TILE);
    if (row < 0 || row >= MAP.length || col < 0 || col >= MAP[0].length) return false;
    if (MAP[row][col] === 'W') return false;
  }
  return true;
}

function updateEnemyAI(e, dt) {
  if (e.defeated) return;
  const px=state.player.x+TILE/2, py=state.player.y+TILE/2;
  const ex=e.x+TILE/2, ey=e.y+TILE/2;
  const dist=Math.hypot(px-ex,py-ey);

  // Смена состояния агра — только если монстр видит игрока (нет стены между ними)
  if (!e.aggroed && dist<AGGRO_RANGE && hasLineOfSight(ex, ey, px, py)) {
    e.aggroed=true;
    Audio.aggro();
    // Эффект восклицания
    e.showAlert=true; setTimeout(()=>e.showAlert=false,800);
  }
  if (e.aggroed && dist>DEAGGRO_RANGE) {
    e.aggroed=false;
  }

  if (e.aggroed) {
    // Преследование игрока
    const angle=Math.atan2(py-ey,px-ex);
    const speed=ENEMY_SPEED*dt/1000;
    const nx=e.x+Math.cos(angle)*speed;
    const ny=e.y+Math.sin(angle)*speed;
    if (!collides(nx,e.y)) e.x=nx; else { e.dx=0; }
    if (!collides(e.x,ny)) e.y=ny; else { e.dy=0; }
  } else {
    // Патруль — всегда двигается, меняет направление по таймеру или при ударе о стену
    e.moveTimer += dt;
    const period = 700 + (e.id.charCodeAt(1) % 6) * 90; // 700–1150 мс, у каждого монстра своё
    if (e.moveTimer > period) {
      e.moveTimer = 0;
      const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      e.dx = d.dx; e.dy = d.dy;
    }
    const speed = PATROL_SPEED * dt / 1000;
    const nx = e.x + e.dx * speed, ny = e.y + e.dy * speed;
    const PATROL_DIRS = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    if (!collides(nx, e.y)) {
      e.x = nx;
    } else {
      const d = PATROL_DIRS[Math.floor(Math.random() * PATROL_DIRS.length)];
      e.dx = d.dx; e.dy = d.dy;
      e.moveTimer = period; // сразу перевыбрать на следующем кадре
    }
    if (!collides(e.x, ny)) {
      e.y = ny;
    } else {
      const d = PATROL_DIRS[Math.floor(Math.random() * PATROL_DIRS.length)];
      e.dx = d.dx; e.dy = d.dy;
      e.moveTimer = period;
    }
  }

  // Анимация
  e.frameTimer+=dt; if(e.frameTimer>280){e.frame=(e.frame+1)%2;e.frameTimer=0;}
}

// Рисует одного монстра-вируса (тип 0,1,2 — разный дизайн)
function drawMonster(ctx, sx, sy, type, walk, aggroed, showAlert, t) {
  if (type === 0) {
    // ═══ ТИП 0: ГЛИТЧ-ПРИЗРАК (зелёный) ═══

    // Пиксельный распад (случайные квадраты)
    ctx.fillStyle='rgba(0,255,100,0.15)';
    const seed=Math.floor(t/300);
    for(let i=0;i<6;i++){
      const rx=sx+4+(((seed*7+i*13)%5)*8);
      const ry=sy+2+(((seed*11+i*7)%5)*8);
      ctx.fillRect(rx,ry,6,6);
    }

    // Тело-призрак
    ctx.fillStyle='#003a18';
    ctx.fillRect(sx+8,sy+6,24,26);
    ctx.fillStyle='#005530';
    ctx.fillRect(sx+10,sy+4,20,24);
    // Волнистый низ (3 «зубца»)
    const ghostWobble0 = walk*3;
    ctx.fillStyle='#005530';
    ctx.fillRect(sx+8, sy+28, 8, 6+ghostWobble0);
    ctx.fillRect(sx+20,sy+28, 8, 6-ghostWobble0);
    ctx.fillRect(sx+32,sy+28, 8, 6+ghostWobble0);
    ctx.fillStyle='#003a18';
    ctx.fillRect(sx+16,sy+28,4,4);
    ctx.fillRect(sx+28,sy+28,4,4);

    // Глаза — крестики
    ctx.fillStyle='#00ff88';
    [[sx+13,sy+10],[sx+23,sy+10]].forEach(([ex,ey])=>{
      ctx.fillRect(ex,ey,2,6); ctx.fillRect(ex-2,ey+2,6,2);
    });
    // Мерцание
    const glitch0 = Math.sin(t/150)>0.6;
    if(glitch0){
      ctx.fillStyle='rgba(0,255,100,0.3)';
      ctx.fillRect(sx+8,sy+4+walk*2,24,3);
    }
    // Полосы помех
    ctx.fillStyle='rgba(0,229,100,0.12)';
    ctx.fillRect(sx+8,sy+14,24,2);
    ctx.fillRect(sx+8,sy+20,24,2);

  } else if (type === 1) {
    // ═══ ТИП 1: ГЛИТЧ-ПРИЗРАК (розовый) ═══

    // Пиксельный распад (случайные квадраты)
    ctx.fillStyle='rgba(255,100,180,0.15)';
    const seed1=Math.floor(t/300);
    for(let i=0;i<6;i++){
      const rx=sx+4+(((seed1*7+i*13)%5)*8);
      const ry=sy+2+(((seed1*11+i*7)%5)*8);
      ctx.fillRect(rx,ry,6,6);
    }

    // Тело-призрак
    ctx.fillStyle='#44002a';
    ctx.fillRect(sx+8,sy+6,24,26);
    ctx.fillStyle='#660040';
    ctx.fillRect(sx+10,sy+4,20,24);
    // Волнистый низ (3 «зубца»)
    const ghostWobble1 = walk*3;
    ctx.fillStyle='#660040';
    ctx.fillRect(sx+8, sy+28, 8, 6+ghostWobble1);
    ctx.fillRect(sx+20,sy+28, 8, 6-ghostWobble1);
    ctx.fillRect(sx+32,sy+28, 8, 6+ghostWobble1);
    ctx.fillStyle='#44002a';
    ctx.fillRect(sx+16,sy+28,4,4);
    ctx.fillRect(sx+28,sy+28,4,4);

    // Глаза — крестики
    ctx.fillStyle='#ff69b4';
    [[sx+13,sy+10],[sx+23,sy+10]].forEach(([ex,ey])=>{
      ctx.fillRect(ex,ey,2,6); ctx.fillRect(ex-2,ey+2,6,2);
    });
    // Мерцание
    const glitch1 = Math.sin(t/150)>0.6;
    if(glitch1){
      ctx.fillStyle='rgba(255,100,180,0.3)';
      ctx.fillRect(sx+8,sy+4+walk*2,24,3);
    }
    // Полосы помех
    ctx.fillStyle='rgba(255,100,180,0.12)';
    ctx.fillRect(sx+8,sy+14,24,2);
    ctx.fillRect(sx+8,sy+20,24,2);

  } else {
    // ═══ ТИП 2: ГЛИТЧ-ПРИЗРАК (голубой, оригинал) ═══

    // Пиксельный распад (случайные квадраты)
    ctx.fillStyle='rgba(0,229,255,0.15)';
    const seed=Math.floor(t/300);
    for(let i=0;i<6;i++){
      const rx=sx+4+(((seed*7+i*13)%5)*8);
      const ry=sy+2+(((seed*11+i*7)%5)*8);
      ctx.fillRect(rx,ry,6,6);
    }

    // Тело-призрак
    ctx.fillStyle='#003a44';
    ctx.fillRect(sx+8,sy+6,24,26);
    ctx.fillStyle='#005566';
    ctx.fillRect(sx+10,sy+4,20,24);
    // Волнистый низ (3 «зубца»)
    const ghostWobble = walk*3;
    ctx.fillStyle='#005566';
    ctx.fillRect(sx+8, sy+28, 8, 6+ghostWobble);
    ctx.fillRect(sx+20,sy+28, 8, 6-ghostWobble);
    ctx.fillRect(sx+32,sy+28, 8, 6+ghostWobble);
    ctx.fillStyle='#003a44';
    ctx.fillRect(sx+16,sy+28,4,4);
    ctx.fillRect(sx+28,sy+28,4,4);

    // Глаза — крестики
    ctx.fillStyle='#00ffff';
    [[sx+13,sy+10],[sx+23,sy+10]].forEach(([ex,ey])=>{
      ctx.fillRect(ex,ey,2,6); ctx.fillRect(ex-2,ey+2,6,2); // крест
    });
    // Мерцание
    const glitch = Math.sin(t/150)>0.6;
    if(glitch){
      ctx.fillStyle='rgba(0,255,255,0.3)';
      ctx.fillRect(sx+8,sy+4+walk*2,24,3);
    }
    // Полосы помех
    ctx.fillStyle='rgba(0,229,255,0.12)';
    ctx.fillRect(sx+8,sy+14,24,2);
    ctx.fillRect(sx+8,sy+20,24,2);
  }
}

function drawEnemies(cam) {
  const t=Date.now();
  state.enemies.forEach(e=>{
    if (e.defeated) return;
    const sx=e.x-cam.x, sy=e.y-cam.y;
    if (sx<-TILE*2||sy<-TILE*2||sx>canvas.width+TILE||sy>canvas.height+TILE) return;

    // Тень
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx+TILE/2,sy+TILE-3,11,4,0,0,Math.PI*2); ctx.fill();

    drawMonster(ctx,sx,sy,e.type,e.frame,e.aggroed,e.showAlert,t);

    // Знак ! при обнаружении
    if (e.showAlert) {
      ctx.fillStyle='#ffff00'; ctx.font='bold 14px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('!',sx+TILE/2,sy-14);
    }
    // Знак ! при агре (постоянный)
    if (e.aggroed && !e.showAlert) {
      const blink=Math.sin(t/200)>0;
      if(blink){
        ctx.fillStyle='#ff4444'; ctx.font='bold 10px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('!',sx+TILE/2,sy-6);
      }
    }
  });
}

// ═══ ЛОВУШКИ ═══
function drawTraps(cam) {
  state.traps.forEach(t=>{
    const sx=t.x-cam.x,sy=t.y-cam.y;
    if(sx<-TILE*2||sy<-TILE*2||sx>canvas.width+TILE||sy>canvas.height+TILE) return;
    const p=0.4+Math.sin(Date.now()/350)*0.35;
    ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(sx+4,sy+4,TILE-8,TILE-8);
    ctx.fillStyle=`rgba(255,77,109,${p*0.3})`; ctx.fillRect(sx+4,sy+4,TILE-8,TILE-8);
    ctx.strokeStyle=`rgba(255,77,109,${p})`; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.strokeRect(sx+4,sy+4,TILE-8,TILE-8); ctx.setLineDash([]);
    ctx.fillStyle=`rgba(255,77,109,${p})`; ctx.font='14px serif'; ctx.textAlign='center';
    ctx.fillText('⚠',sx+TILE/2,sy+TILE/2+5);
  });
}

// ═══ ФИНИШ ═══
function drawFinish(cam) {
  const sx=state.finish.x-cam.x,sy=state.finish.y-cam.y;
  const iconSize=TILE+7;
  if(finishIcon.complete && finishIcon.naturalWidth){
    ctx.drawImage(finishIcon, sx+TILE/2-iconSize/2, sy+TILE/2-iconSize/2, iconSize, iconSize);
  }
  const ready=state.score>=state.totalChests;
  ctx.fillStyle=ready?'#39ff14':'rgba(57,255,20,0.4)'; ctx.font='7px "Press Start 2P"';
  ctx.textAlign='center';
  ctx.fillText(ready?'ФИНАЛ!':`${state.score}/${state.totalChests}`,sx+TILE/2,sy-8);
}

// ═══ ИГРОК ═══
function drawPlayer(cam) {
  const currentImg = playerSprites[animState.lastDirection];
  
  if (!currentImg || !currentImg.complete) return;

  // Координаты на экране
  const sx = state.player.x - cam.x;
  const sy = state.player.y - cam.y;

  if (sx < -TILE || sy < -TILE || sx > canvas.width + TILE || sy > canvas.height + TILE) return;

  // ═══════════════════════════════════════════════════
  // АВТОМАТИЧЕСКИЙ РАСЧЕТ РАЗМЕРА КАДРА ИЗ ТВОЕЙ КАРТИНКИ
  // ═══════════════════════════════════════════════════
  // Делим полную ширину файла на 4 кадра, чтобы узнать точную ширину одного кадра в png
  const spriteWidth = currentImg.width / animState.frameCount; 
  const spriteHeight = currentImg.height; // Высота файла — это и есть высота кадра

  // Рассчитываем, откуда именно в файле вырезать текущий кадр
  const sourceX = animState.currentFrame * spriteWidth;
  const sourceY = 0;

  // Эффект мерцания при уроне
  if (state.invincible > 0 && Math.floor(Date.now() / 100) % 2 === 0) return;

  // Отрисовка
  ctx.drawImage(
    currentImg,
    sourceX, sourceY,            // Координаты начала кадра в файле png
    spriteWidth, spriteHeight,    // Реальный размер кадра в файле png (авто-расчет)
    sx, sy,                       // Координаты рисования на экране
    TILE, TILE                    // Финальный размер персонажа в игре (48х48)
  );
}

// ═══ МИНИ-КАРТА ═══
function drawMinimap() {
  const mw=130,mh=80,mx=canvas.width-mw-10,my=10;
  const scX=mw/(MAP[0].length*TILE), scY=mh/(MAP.length*TILE);
  ctx.fillStyle='rgba(6,10,20,0.88)'; ctx.fillRect(mx-2,my-2,mw+4,mh+4);
  ctx.strokeStyle='rgba(0,229,255,0.3)'; ctx.lineWidth=1; ctx.strokeRect(mx-2,my-2,mw+4,mh+4);
  // Туман на мини-карте
  ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(mx,my,mw,mh);
  // Только исследованные
  for (let row=0;row<MAP.length;row++) {
    for (let col=0;col<MAP[row].length;col++) {
      if (!state.explored.has(`${row},${col}`)) continue;
      const ch=MAP[row][col], tx=mx+col*TILE*scX, ty=my+row*TILE*scY, tw=TILE*scX+0.5, th=TILE*scY+0.5;
      if(ch==='W')      ctx.fillStyle='#1a2a4a';
      else if(ch==='C') ctx.fillStyle='#ffd600';
      else if(ch==='X') ctx.fillStyle='#ff4d6d';
      else if(ch==='E') ctx.fillStyle='#cc0000';
      else if(ch==='F') ctx.fillStyle='#39ff14';
      else              ctx.fillStyle='#0a1422';
      ctx.fillRect(tx,ty,tw,th);
    }
  }
  // Открытые сундуки — серые
  state.chests.forEach(c=>{
    if(!c.open) return;
    ctx.fillStyle='#2a2a2a';
    ctx.fillRect(mx+(c.x/TILE)*TILE*scX,my+(c.y/TILE)*TILE*scY,TILE*scX+1,TILE*scY+1);
  });
  // Игрок
  const ppx=mx+(state.player.x/TILE)*TILE*scX+TILE*scX/2;
  const ppy=my+(state.player.y/TILE)*TILE*scY+TILE*scY/2;
  ctx.fillStyle='#00e5ff'; ctx.beginPath(); ctx.arc(ppx,ppy,3,0,Math.PI*2); ctx.fill();
}

// ═══ КОЛЛИЗИИ ═══
function isWall(px,py) {
  const col=Math.floor(px/TILE), row=Math.floor(py/TILE);
  if(row<0||row>=MAP.length||col<0||col>=MAP[0].length) return true;
  return MAP[row][col]==='W';
}
function collides(nx,ny) {
  const m=7;
  return isWall(nx+m,ny+m)||isWall(nx+TILE-m,ny+m)||isWall(nx+m,ny+TILE-m)||isWall(nx+TILE-m,ny+TILE-m);
}

// ═══ ДВИЖЕНИЕ ИГРОКА ═══
function movePlayer(dt) {
  const p=state.player, speed=p.slow>0?100:210, dist=speed*dt/1000;
  let dx=0,dy=0;
  if(state.keys['ArrowUp']   ||state.keys['KeyW']){dy=-1;p.dir='up';}
  if(state.keys['ArrowDown'] ||state.keys['KeyS']){dy= 1;p.dir='down';}
  if(state.keys['ArrowLeft'] ||state.keys['KeyA']){dx=-1;p.dir='left';}
  if(state.keys['ArrowRight']||state.keys['KeyD']){dx= 1;p.dir='right';}
  if(dx&&dy){dx*=0.707;dy*=0.707;}
  p.moving=dx!==0||dy!==0;
  if(p.moving && Math.floor(Date.now()/220)!==p._lastStep){ p._lastStep=Math.floor(Date.now()/220); Audio.step(); }
  if(p.moving){
    const nx=p.x+dx*dist,ny=p.y+dy*dist;
    if(!collides(nx,p.y)) p.x=nx;
    if(!collides(p.x,ny)) p.y=ny;
  }
  if(p.slow>0) p.slow-=dt;
}

// ═══ ВЗАИМОДЕЙСТВИЯ ═══
function checkInteractions() {
  const p=state.player,cx=p.x+TILE/2,cy=p.y+TILE/2;
  state.chests.forEach(ch=>{
    if(ch.open) return;
    if(Math.hypot(cx-(ch.x+TILE/2),cy-(ch.y+TILE/2))<TILE*1.1) openChest(ch);
  });
  if(state.invincible<=0){
    state.enemies.forEach(e=>{
      if(e.defeated) return;
      if(Math.hypot(cx-(e.x+TILE/2),cy-(e.y+TILE/2))<TILE*0.8) startBattle(e);
    });
    state.traps.forEach(t=>{
      if(Math.hypot(cx-(t.x+TILE/2),cy-(t.y+TILE/2))<TILE*0.6) triggerTrap();
    });
  }
  if(state.score>=state.totalChests&&Math.hypot(cx-(state.finish.x+TILE/2),cy-(state.finish.y+TILE/2))<TILE) triggerFinish();
}

// ═══ СУНДУК ═══
function openChest(chest) {
  if(state.openedChests.has(chest.id)) return;
  state.gameActive=false;
  const data=getChestContent(chest.qIdx);
  if (data && !data.q) {
    data.q = {
      text: data.question,
      code: data.code,
      options: data.options,
      correct: data.correct,
      hint: data.hint
    };
  }
  document.getElementById('q-header').textContent='СУНДУК НАЙДЕН!';
  const question=getChestQuestionText(data);
  const code=data?.code ?? data?.q?.code ?? '';
  const options=data?.options ?? data?.q?.options ?? [];
  const correctIndex=Number.isInteger(data?.correct) ? data.correct : data?.q?.correct;
  if(!data || !options.length){ state.gameActive=true; return; }
  document.getElementById('q-text').textContent=question;
  document.getElementById('q-code').textContent=code;
  document.getElementById('q-hint').textContent='Ответь правильно — получишь часть кода!';
  const opts=document.getElementById('q-options'); opts.innerHTML='';
  const shuffled=shuffleOptions(options, correctIndex);
  shuffled.options.forEach((opt,i)=>{
    const btn=document.createElement('button'); btn.className='q-opt'; btn.textContent=opt;
    btn.addEventListener('click',()=>{
      opts.querySelectorAll('.q-opt').forEach(b=>b.style.pointerEvents='none');
      if(i===shuffled.correct){
        Audio.correct();
        btn.classList.add('correct');
        document.getElementById('q-hint').textContent='Верно!';
        setTimeout(()=>{
          chest.open=true; state.openedChests.add(chest.id); state.score++;
          state.inventory.push({...data.reward,idx:chest.qIdx});
          Audio.pickup();
          updateHUD(); updateInventory(); hideDialog('dialog-question'); state.gameActive=true;
        },700);
      } else {
        Audio.wrong();
        state.wrongChestAnswers++;
        loseHP(1);
        btn.classList.add('wrong');
        document.getElementById('q-hint').textContent='Неверно. Попробуй еще.';
        if(state.hp<=0){
          hideDialog('dialog-question');
          return;
        }
        setTimeout(()=>{
          btn.classList.add('gone');
          opts.querySelectorAll('.q-opt').forEach(b=>b.style.pointerEvents='auto');
        },500);
      }
    }); opts.appendChild(btn);
  });
  Audio.chest(); document.getElementById('dialog-question').classList.remove('hidden');
}

// ═══ БИТВА ═══
function startBattle(enemy) {
  if(state.defeatedEnemies.has(enemy.id)) return;
  state.gameActive=false; state.invincible=1000;
  const q=getUniqueBattleQuestionForEnemy(enemy);
  if (!q) {
    state.gameActive=true;
    return;
  }
  const names=['ГЛИТЧ','ГЛИТЧ','ГЛИТЧ'];
  document.getElementById('battle-enemy-sprite').textContent='';
  document.getElementById('b-text').textContent=`${names[enemy.type]} атакует! ${q.text}`;
  document.getElementById('b-code').textContent=q.code||'';
  document.getElementById('b-hint').textContent='Ответь правильно, чтобы победить врага.';
  const opts=document.getElementById('b-options'); opts.innerHTML='';
  q.options.forEach((opt,i)=>{
    const btn=document.createElement('button'); btn.className='q-opt'; btn.textContent=opt;
    btn.addEventListener('click',()=>{
      opts.querySelectorAll('.q-opt').forEach(b=>b.style.pointerEvents='none');
      if(i===q.correct){
        btn.classList.add('correct');
        Audio.correct();
        document.getElementById('b-hint').textContent='Победа! '+q.hint;
        setTimeout(()=>{enemy.defeated=true;state.defeatedEnemies.add(enemy.id);Audio.kill();hideDialog('dialog-battle');state.gameActive=true;state.invincible=2000;setStatus(names[enemy.type]+' уничтожен!');},900);
      } else {
        btn.classList.add('wrong'); Audio.wrong(); opts.querySelectorAll('.q-opt')[q.correct]?.classList.add('correct');
        document.getElementById('b-hint').textContent='✗ '+q.hint;
        setTimeout(()=>{hideDialog('dialog-battle');state.gameActive=true;loseHP(1);state.invincible=2500;},1200);
      }
    }); opts.appendChild(btn);
  });
  document.getElementById('dialog-battle').classList.remove('hidden');
}

startBattle = function(enemy) {
  if(state.defeatedEnemies.has(enemy.id)) return;
  state.gameActive=false;
  state.invincible=1000;
  state.monsterBattlesTotal++;

  const battleQuestions=getBattleQuestionPool();
  const q=battleQuestions[Math.floor(Math.random()*battleQuestions.length)];
  const names=['ГЛИТЧ','ГЛИТЧ','ГЛИТЧ'];
  document.getElementById('battle-enemy-sprite').textContent='';
  document.getElementById('b-text').textContent=`${names[enemy.type]} атакует! ${q.text}`;
  document.getElementById('b-code').textContent=q.code || '';
  document.getElementById('b-hint').textContent='Ответь правильно, чтобы победить врага.';

  const opts=document.getElementById('b-options');
  opts.innerHTML='';

  const shuffledB=shuffleOptions(q.options, q.correct);
  shuffledB.options.forEach((opt,i)=>{
    const btn=document.createElement('button');
    btn.className='q-opt';
    btn.textContent=opt;

    btn.addEventListener('click',()=>{
      opts.querySelectorAll('.q-opt').forEach(b=>b.style.pointerEvents='none');

      if(i===shuffledB.correct){
        btn.classList.add('correct');
        Audio.correct();
        state.monsterBattlesWon++;
        document.getElementById('b-hint').textContent='Победа!';

        setTimeout(()=>{
          enemy.defeated=true;
          state.defeatedEnemies.add(enemy.id);
          Audio.kill();
          hideDialog('dialog-battle');
          state.gameActive=true;
          state.invincible=2000;
          setStatus(`${names[enemy.type]} уничтожен!`);
        },700);
        return;
      }

      Audio.wrong();
      loseHP(1);
      btn.classList.add('wrong');
      document.getElementById('b-hint').textContent='Неверно. Попробуй еще.';

      if(state.hp<=0){
        hideDialog('dialog-battle');
        return;
      }

      setTimeout(()=>{
        btn.classList.add('gone');
        opts.querySelectorAll('.q-opt').forEach(b=>b.style.pointerEvents='auto');
      },500);
    });

    opts.appendChild(btn);
  });

  document.getElementById('dialog-battle').classList.remove('hidden');
};

// ═══ ЛОВУШКА ═══
function triggerTrap() {
  state.invincible=2500;
  Audio.damage(); const ov=document.createElement('div'); ov.className='trap-overlay'; document.body.appendChild(ov); setTimeout(()=>ov.remove(),400);
  const eff=Math.floor(Math.random()*3);
  if(eff===0){loseHP(1);setStatus('БАГ! −1 HP!');}
  else if(eff===1){state.player.slow=3000;setStatus('БАГ! Замедление 3 сек!');}
  else{state.player.x=TILE;state.player.y=TILE;setStatus('ГЛИТЧ! Телепорт к старту!');}
}

function loseHP(n) {
  state.hp=Math.max(0,state.hp-n); Audio.damage(); updateHUD();
  if(state.hp<=0){state.gameActive=false;cancelAnimationFrame(state.animFrame);Audio.gameover();setTimeout(()=>showScreen('gameover'),400);}
}

function triggerFinish() {
  state.gameActive=false; cancelAnimationFrame(state.animFrame); Audio.victory(); setTimeout(()=>showFinalScreen(),300);
}

// ═══ HUD ═══
const HEART_GRID = [
  [0,1,1,0,0,0,1,1,0],
  [1,1,1,1,0,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,0,0,0],
  [0,0,0,0,1,0,0,0,0],
];
function drawPixelHeart(canvas, isEmpty) {
  const PS=3, COLS=HEART_GRID[0].length, ROWS=HEART_GRID.length;
  canvas.width=COLS*PS; canvas.height=ROWS*PS;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(!HEART_GRID[r][c]) continue;
      ctx.fillStyle=isEmpty?'#2a3a5c':'#ff3366';
      ctx.fillRect(c*PS,r*PS,PS,PS);
      if(!isEmpty&&r===0&&(c===1||c===6)){
        ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.fillRect(c*PS,r*PS,PS,PS);
      }
    }
  }
}
function updateHUD() {
  const h=document.getElementById('hp-hearts');
  while(h.children.length<state.maxHp){const cv=document.createElement('canvas');cv.className='px-heart-canvas';h.appendChild(cv);}
  while(h.children.length>state.maxHp){h.removeChild(h.lastChild);}
  Array.from(h.children).forEach((cv,i)=>{
    const lost=i>=state.hp;
    drawPixelHeart(cv,lost);
    cv.style.opacity=lost?'0.3':'1';
  });
  document.getElementById('score-count').textContent=`${state.score}/${state.totalChests}`;
  document.getElementById('hud-level').textContent=`УРОВЕНЬ ${state.currentLevel}`;
  const mult=[1.0,1.2,1.4,1.6][Math.min(state.currentLevel-1,3)];
  const damageTaken=state.maxHp-state.hp;
  const base=Math.max(0,state.score*20+state.monsterBattlesWon*15-damageTaken*15-state.wrongChestAnswers*15);
  document.getElementById('pts-count').textContent=Math.round(base*mult);
}
const SCROLL_ICON_SVG = `
<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="3" width="20" height="18" fill="#e8dcc4"/>
  <rect x="4" y="2" width="24" height="3" fill="#cdbb96"/>
  <rect x="4" y="19" width="24" height="3" fill="#cdbb96"/>
  <rect x="4" y="2" width="3" height="20" fill="#a89873"/>
  <rect x="25" y="2" width="3" height="20" fill="#a89873"/>
  <rect x="10" y="6" width="12" height="1.6" fill="#00e5ff"/>
  <rect x="10" y="9" width="8" height="1.6" fill="#00e5ff"/>
  <rect x="14" y="9" width="1.6" height="4" fill="#00e5ff"/>
  <rect x="10" y="12" width="10" height="1.6" fill="#00e5ff"/>
  <rect x="10" y="15" width="6" height="1.6" fill="#00e5ff"/>
  <rect x="10" y="15" width="1.6" height="3" fill="#00e5ff"/>
  <rect x="9" y="18" width="9" height="1.6" fill="#00e5ff"/>
  <rect x="25" y="8" width="6" height="4" fill="#2a3f8f"/>
  <rect x="25" y="12" width="4" height="2" fill="#1c2c66"/>
</svg>`.trim();
function updateInventory() {
  const inv=document.getElementById('inv-items'); inv.innerHTML='';
  const totalSlots = state.totalChests || 5;
  for (let i=0;i<totalSlots;i++){
    const slot=document.createElement('div');
    slot.className='inv-slot';
    const item=state.inventory[i];
    if(item){
      slot.classList.add('filled');
      slot.title=item.label||'';
      slot.innerHTML=SCROLL_ICON_SVG;
    }
    inv.appendChild(slot);
  }
}
function setStatus(msg) {
  const el=document.getElementById('hud-status'); el.textContent=msg;
  setTimeout(()=>{if(el.textContent===msg)el.textContent='';},3000);
}
function hideDialog(id){document.getElementById(id).classList.add('hidden');}

// ═══ ФИНАЛ ═══
function ensureFinalAssemblyLayout() {
  const finalAssembly=document.querySelector('.final-assembly');
  const title=finalAssembly?.querySelector('.assembly-title');
  const slots=document.getElementById('assembly-slots');
  const runBtn=document.getElementById('btn-run');
  if (!finalAssembly || !title || !slots || !runBtn) return;
  if (document.getElementById('assembly-preview')) return;

  const workbench=document.createElement('div');
  workbench.className='assembly-workbench';

  const partsPanel=document.createElement('div');
  partsPanel.className='assembly-panel';
  partsPanel.innerHTML='<div class="assembly-panel-title">[ БЛОКИ КОДА ]</div>';
  partsPanel.appendChild(slots);

  const previewPanel=document.createElement('div');
  previewPanel.className='assembly-panel preview-panel';
  previewPanel.innerHTML='<div class="assembly-panel-title">[ ПРОГРАММА ]</div><pre id="assembly-preview" class="assembly-preview"></pre>';

  const error=document.createElement('div');
  error.id='assembly-error';
  error.className='hidden';

  workbench.append(partsPanel, previewPanel);
  title.after(workbench);
  workbench.after(error);
}

function getAssemblySlots() {
  return [...document.querySelectorAll('#assembly-slots .assembly-slot')];
}

function getAssemblyOrder() {
  return getAssemblySlots().map(slot=>parseInt(slot.dataset.idx,10));
}

function getCorrectAssemblyOrder() {
  return Array.from({length: state.inventory.length}, (_, idx) => idx);
}

function hideAssemblyError() {
  const error=document.getElementById('assembly-error');
  if (!error) return;
  error.classList.add('hidden');
  error.innerHTML='';
}

function formatProgramBlock(code, indent='        ') {
  return code.split('\n').map(line=>`${indent}${line}`).join('\n');
}

function buildAssemblyPreview(items) {
  const blocks=items.map(item=>formatProgramBlock(item.code)).join('\n\n');
  return `${FINAL_PROGRAM.sourceIntro}\n${blocks}\n${FINAL_PROGRAM.sourceOutro}`;
}

function renderFinalExplanation() {
  const finalData=getLevelFinal();
  const explain=document.getElementById('result-explain');
  explain.innerHTML=`
    <div class="explain-summary">${finalData.summary}</div>
    <div class="explain-grid">
      ${finalData.explain.map(block=>`
        <div class="explain-card">
          <div class="explain-card-title">${block.title}</div>
          <div class="explain-card-text">${block.text}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function updateAssemblyState() {
  const slots=getAssemblySlots();
  const correctOrder=getCorrectAssemblyOrder();
  const preview=document.getElementById('assembly-preview');
  const status=document.getElementById('assembly-status');
  const progress=document.getElementById('assembly-progress-text');
  const currentItems=slots.map(slot=>({
    idx: parseInt(slot.dataset.idx,10),
    code: slot.dataset.code,
    label: slot.dataset.label
  }));

  let correctCount=0;
  slots.forEach((slot,index)=>{
    const isCorrect=parseInt(slot.dataset.idx,10)===correctOrder[index];
    slot.classList.toggle('is-correct', isCorrect);
    slot.classList.toggle('is-wrong', !isCorrect);
    slot.querySelector('.slot-num').textContent=index+1;
    if (isCorrect) correctCount++;
  });

  if (status) status.textContent=`${correctCount}/${correctOrder.length}`;
  if (preview) preview.textContent=buildAssemblyPreview(currentItems);

  if (progress) {
    if (correctCount===correctOrder.length) {
      progress.textContent='Все элементы найдены. Теперь программу можно запускать.';
    } else {
      const firstMismatchIndex=slots.findIndex((slot,index)=>parseInt(slot.dataset.idx,10)!==correctOrder[index]);
      const expectedIdx=correctOrder[firstMismatchIndex];
      const expectedLabel=getChestRewardLabel(expectedIdx);
      progress.textContent=`Position ${firstMismatchIndex+1} should contain: ${expectedLabel}.`;
    }
  }
}

function showFinalScreen() {
  showScreen('final');
  ensureFinalAssemblyLayout();
  const slots=document.getElementById('assembly-slots');
  slots.innerHTML='';
  hideAssemblyError();
  document.getElementById('final-result').classList.add('hidden');

  const shuffled=[...state.inventory].sort(()=>Math.random()-0.5);
  shuffled.forEach((item,i)=>{
    const slot=document.createElement('div');
    slot.className='assembly-slot';
    slot.draggable=true;
    slot.dataset.code=item.code;
    slot.dataset.label=item.label;
    slot.dataset.idx=item.idx;
    slot.innerHTML=`<span class="slot-num">${i+1}</span><div class="slot-content">
      <div class="slot-label">${item.label}</div>
      <div class="slot-code">${item.code.replace(/\n/g,'<br>')}</div></div>`;
    slot.addEventListener('dragstart',()=>slot.classList.add('dragging'));
    slot.addEventListener('dragend',()=>{
      slot.classList.remove('dragging');
      hideAssemblyError();
      updateAssemblyState();
    });

    // Touch drag support for mobile
    let touchDragging = null;
    let touchClone = null;
    slot.addEventListener('touchstart', () => {
      touchDragging = slot;
      slot.classList.add('dragging');
      touchClone = slot.cloneNode(true);
      const rect = slot.getBoundingClientRect();
      touchClone.style.cssText = `
        position:fixed; z-index:9999; pointer-events:none; opacity:0.85;
        width:${rect.width}px; left:${rect.left}px; top:${rect.top}px;
        margin:0; transform:scale(1.04); box-shadow:0 8px 32px rgba(0,229,255,0.3);
        transition:none;
      `;
      document.body.appendChild(touchClone);
    }, { passive: true });

    slot.addEventListener('touchmove', e => {
      if (!touchDragging || !touchClone) return;
      e.preventDefault();
      const t = e.touches[0];
      const rect = touchClone.getBoundingClientRect();
      touchClone.style.left = (t.clientX - rect.width / 2) + 'px';
      touchClone.style.top  = (t.clientY - rect.height / 2) + 'px';
      touchClone.style.display = 'none';
      const el = document.elementFromPoint(t.clientX, t.clientY);
      touchClone.style.display = '';
      const tgt = el && el.closest('.assembly-slot');
      slots.querySelectorAll('.assembly-slot').forEach(s => s.classList.remove('touch-over'));
      if (tgt && tgt !== touchDragging) tgt.classList.add('touch-over');
    }, { passive: false });

    slot.addEventListener('touchend', e => {
      if (!touchDragging || !touchClone) return;
      const t = e.changedTouches[0];
      touchClone.style.display = 'none';
      const el = document.elementFromPoint(t.clientX, t.clientY);
      touchClone.style.display = '';
      const tgt = el && el.closest('.assembly-slot');
      if (tgt && tgt !== touchDragging) {
        const rect = tgt.getBoundingClientRect();
        const after = t.clientY > rect.top + rect.height / 2;
        slots.insertBefore(touchDragging, after ? tgt.nextSibling : tgt);
      }
      slots.querySelectorAll('.assembly-slot').forEach(s => s.classList.remove('touch-over'));
      touchDragging.classList.remove('dragging');
      touchClone.remove();
      touchClone = null;
      touchDragging = null;
      hideAssemblyError();
      updateAssemblyState();
    });

    slots.appendChild(slot);
  });

  if (!slots.dataset.bound) {
    slots.addEventListener('dragover',e=>{
      e.preventDefault();
      const drag=slots.querySelector('.dragging');
      const tgt=e.target.closest('.assembly-slot');
      if (drag && tgt && tgt!==drag) {
        const rect=tgt.getBoundingClientRect();
        const shouldInsertAfter=e.clientY > rect.top + rect.height / 2;
        slots.insertBefore(drag, shouldInsertAfter ? tgt.nextSibling : tgt);
      }
    });
    slots.dataset.bound='true';
  }

  updateAssemblyState();
  document.getElementById('btn-run').onclick=runProgram;
}

function runProgram(){
  const order=getAssemblyOrder();
  const correct=getCorrectAssemblyOrder();
  const isCorrect=order.length===correct.length && order.every((value,index)=>value===correct[index]);
  const btn=document.getElementById('btn-run');

  hideAssemblyError();

  if (!isCorrect) {
    Audio.wrong();
    const error = document.getElementById('assembly-error');
    error.classList.remove('hidden');
    error.innerHTML = `<strong>Ошибка!</strong> Один из кусков кода стоит не на своем месте.`;
    error.scrollIntoView({behavior: 'smooth', block: 'center'});
    btn.style.borderColor = 'var(--pink)';
    btn.style.color = 'var(--pink)';
    setTimeout(() => { btn.style.borderColor = ''; btn.style.color = ''; }, 1500);
    return;
}

  Audio.correct();
  document.getElementById('result-output').textContent=getLevelFinal().output;
  renderFinalExplanation();
  document.getElementById('final-result').classList.remove('hidden');
  // Показываем кнопку следующего уровня только если есть следующий
  const nextBtn=document.getElementById('btn-next-level');
  if(nextBtn) nextBtn.style.display=state.currentLevel<4?'':'none';
  setTimeout(()=>document.getElementById('final-result').scrollIntoView({behavior:'smooth'}),100);
  submitPixelgameScore();
}

/**
 * Отправка результата на сервер (очки считает api/score.php).
 * Payload — сырые игровые метрики, а не готовый счёт.
 */
function submitPixelgameScore() {
  if (state.scoreSubmitted) return;
  if (typeof submitScore !== 'function') return; // игра запущена вне сайта
  state.scoreSubmitted = true;

  const elapsedMs = Math.max(0, Date.now() - (state.startedAtMs || Date.now()));
  submitScore('pixelgame', {
    level: state.currentLevel,
    chests_opened: state.score,
    total_chests: state.totalChests,
    wrong_chest_answers: state.wrongChestAnswers,
    monster_battles_won: state.monsterBattlesWon,
    monster_battles_total: state.monsterBattlesTotal,
    hp_remaining: state.hp,
    elapsed_ms: elapsedMs,
    completed: true,
  }).then(res => {
    if (!res) return;
    const resultBox = document.getElementById('final-result');
    if (resultBox && !document.getElementById('score-saved-note')) {
      const note = document.createElement('div');
      note.id = 'score-saved-note';
      note.className = 'result-title';
      note.style.marginTop = '18px';
      note.textContent = typeof res.total_game_score === 'number'
        ? `[ 🏆 ОЧКИ СОХРАНЕНЫ: +${res.score} — ВСЕГО В ИГРЕ: ${res.total_game_score} ]`
        : '[ 🏆 ОЧКИ СОХРАНЕНЫ ]';
      resultBox.appendChild(note);
    }
    refreshPixelgameLeaderboard();
  });
}

/** Виджет топа игроков в главном меню (общий js/leaderboard.js). */
function refreshPixelgameLeaderboard() {
  const lbEl = document.getElementById('lb-pixelgame');
  if (lbEl && typeof renderLeaderboard === 'function') renderLeaderboard(lbEl, 'pixelgame', 5);
}

// ═══ ИГРОВОЙ ЦИКЛ ═══
function gameLoop(ts) {
  const dt=Math.min(ts-state.lastTime,50); state.lastTime=ts;
  if(state.invincible>0) state.invincible-=dt;

  if(state.gameActive){
    movePlayer(dt);
    updatePlayerAnimation();
    state.enemies.forEach(e=>updateEnemyAI(e,dt));
    checkInteractions();
    updateCamera();
    updateFog();
  }

  ctx.clearRect(0,0,canvas.width,canvas.height);
  const cam={x:state.camX,y:state.camY};
  drawMap(cam);
  drawTraps(cam);
  drawChests(cam);
  drawFinish(cam);
  drawEnemies(cam);
  drawPlayer(cam);
  drawLighting(cam);  // Туман войны поверх всего
  drawMinimap();

  state.animFrame=requestAnimationFrame(gameLoop);
}

// ═══ СТАРТ ═══
async function startLevel(levelNumber) {
  state.currentLevel = levelNumber;
  state.levelData = null;
  await startGame();
}

async function startGame() {
  if (!state.levelData || state.levelData.level !== state.currentLevel) {
    await loadLevel(state.currentLevel);
  }
  if (!state.monsterQuestions) {
    await loadMonsterQuestions();
  }
  resetBattleQuestionSession();
  state.hp=state.maxHp; state.score=0; state.inventory=[];
  state.keys={}; state.invincible=0; state.player.slow=0;
  // Сброс метрик для серверного подсчёта очков
  state.wrongChestAnswers=0;
  state.monsterBattlesWon=0;
  state.monsterBattlesTotal=0;
  state.startedAtMs=Date.now();
  state.scoreSubmitted=false;
  // Регистрируем игровой ран на сервере (античит-токен, общий js/leaderboard.js)
  if (typeof pingGame === 'function') pingGame('pixelgame');
   state.gameActive = true;
  cancelAnimationFrame(state.animFrame);
  resizeCanvas(); initMap(); buildTextures();
  updateHUD(); updateInventory();
  showScreen('game');
  state.lastTime=performance.now();
  state.animFrame=requestAnimationFrame(gameLoop);
  setTimeout(()=>setStatus('WASD — движение  |  Исследуй лабиринт, ищи сундуки'),600);
}

document.addEventListener('keydown',e=>{state.keys[e.code]=true;e.preventDefault();});
document.addEventListener('keyup',  e=>{state.keys[e.code]=false;});
window.addEventListener('resize',()=>{if(screens.game.classList.contains('active')){resizeCanvas();buildTextures();}});

// ═══ HUD TOGGLE (мобильный) ═══
document.getElementById('hud-toggle')?.addEventListener('click', () => {
  const hud = document.getElementById('hud');
  hud.classList.toggle('hud-open');
  resizeCanvas();
});

// ═══ ПЛАВАЮЩИЙ ДЖОЙСТИК (мобильные устройства) ═══
(function(){
  const zone  = document.getElementById('joystick-zone');
  const base  = document.getElementById('joystick-base');
  const knob  = document.getElementById('joystick-knob');
  if (!zone) return;

  const RADIUS = 55;   // макс. смещение стика (px)
  const DEAD   = 0.25; // мёртвая зона (доля от RADIUS)
  let active = false;
  let originX = 0, originY = 0;

  function clearKeys() {
    ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].forEach(k => state.keys[k] = false);
  }

  function applyDir(dx, dy) {
    const dist = Math.hypot(dx, dy);
    if (dist < RADIUS * DEAD) { clearKeys(); return; }
    const nx = dx / dist, ny = dy / dist;
    state.keys['ArrowLeft']  = nx < -0.4;
    state.keys['ArrowRight'] = nx >  0.4;
    state.keys['ArrowUp']    = ny < -0.4;
    state.keys['ArrowDown']  = ny >  0.4;
  }

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    active = true;
    const t = e.touches[0];
    const rect = base.getBoundingClientRect();
    originX = rect.left + rect.width  / 2;
    originY = rect.top  + rect.height / 2;
    const dx = Math.max(-RADIUS, Math.min(RADIUS, t.clientX - originX));
    const dy = Math.max(-RADIUS, Math.min(RADIUS, t.clientY - originY));
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    applyDir(dx, dy);
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    if (!active) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = Math.max(-RADIUS, Math.min(RADIUS, t.clientX - originX));
    const dy = Math.max(-RADIUS, Math.min(RADIUS, t.clientY - originY));
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    applyDir(dx, dy);
  }, { passive: false });

  function onEnd() {
    active = false;
    knob.style.transform = 'translate(-50%, -50%)';
    clearKeys();
  }

  zone.addEventListener('touchend',    onEnd);
  zone.addEventListener('touchcancel', onEnd);
})();
document.getElementById('notice-ok').addEventListener('click',()=>{ Audio.click(); hideNotice(); });
document.getElementById('btn-start').addEventListener('click',()=>{
  Audio.click();
  if(window._stopMenuAnim) window._stopMenuAnim();
  renderLevelCards();
  showScreen('levels');
});
document.getElementById('btn-to-menu').addEventListener('click', () => {
  Audio.click();
  showConfirm(
    'Выйти в главное меню? Текущий прогресс уровня будет потерян.',
    'ВЫХОД В МЕНЮ',
    goToMainMenu
  );
});
document.getElementById('confirm-yes').addEventListener('click', () => {
  Audio.click();
  const callback = confirmCallback;
  confirmCallback = null;
  confirmPausedGame = false;
  document.getElementById('dialog-confirm').classList.add('hidden');
  if (callback) callback();
});
document.getElementById('confirm-no').addEventListener('click', () => {
  Audio.click();
  hideConfirm();
});
document.getElementById('btn-levels-back').addEventListener('click',()=>{
  Audio.click();
  showScreen('menu');
  initMenuAnimation();
});
document.getElementById('btn-how').addEventListener('click',()=>{ Audio.click(); showScreen('how'); });
document.getElementById('btn-back').addEventListener('click',()=>{ Audio.click(); showScreen('menu'); initMenuAnimation(); });
document.getElementById('btn-gameover-restart').addEventListener('click',async ()=>{
  Audio.click();
  try {
    await startGame();
  } catch (error) {
    console.error(error);
    showLoadError('ОШИБКА ЗАГРУЗКИ', 'Не удалось перезапустить уровень из-за ошибки загрузки данных.',
      `<div style="text-align:left">Попробуй:<ul style="text-align:left;margin-top:6px"><li>Запустить локальный сервер (<code>npx http-server</code> или <code>python -m http.server</code>).</li><li>Проверить файл <strong>data/levels/level${state.currentLevel}.json</strong>.</li></ul></div>`
    );
  }
});
document.getElementById('btn-restart').addEventListener('click',()=>{cancelAnimationFrame(state.animFrame);showScreen('menu');
initMenuAnimation();});
document.getElementById('btn-next-level').addEventListener('click',async()=>{
  Audio.click();
  try {
    await startLevel(state.currentLevel+1);
  } catch(error) {
    handleLevelLoadError(state.currentLevel+1, error);
  }
});

renderLevelCards();
showScreen('menu');
refreshPixelgameLeaderboard();