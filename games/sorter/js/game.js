/* 

   1. ЗВУКИ         — WEB Audio API
   2. ЗВЁЗДНЫЙ ФОН  — анимация мерцающих звёзд на canvas
   3. СЕРДЕЧКИ      — рисуем пиксельные сердечки
   4. ДАННЫЕ        — все категории, уровни и понятия Python
   5. ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ — меню / игра / результат
   6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ — тосты, частицы, встряска
   7. МЕНЮ          — кнопки выбора уровня
   8. НАЧАЛО УРОВНЯ — сброс состояния и старт
   9. КОРЗИНЫ       — создаём корзины внизу экрана
  10. ПАДАЮЩИЙ БЛОК — создаём, анимируем падение
  11. ПЕРЕТАСКИВАНИЕ — мышь и тач
  12. ПОПАДАНИЕ     — правильно / неправильно
  13. HUD           — обновляем очки, прогресс, жизни
  14. КОНЕЦ ИГРЫ    — экран результатов
  15. ПАУЗА         — пауза и возобновление
  16. КНОПКИ И КЛАВИШИ — обработчики событий
  17. СТАРТ         — запуск приложения
 */

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(freq, dur, shape = 'square', vol = 0.18) {
  const oscillator = audioContext.createOscillator(); // генератор тона
  const gainNode   = audioContext.createGain();       // регулятор громкости

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination); // выход на колонки

  oscillator.type            = shape;
  oscillator.frequency.value = freq;

  // Начинаем с полной громкости, затем плавно затихаем
  gainNode.gain.setValueAtTime(vol, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + dur);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + dur);
}

// Наборы звуков для разных игровых событий:

function playSoundCorrect() {
  playBeep(523, 0.06);
  setTimeout(() => playBeep(659, 0.06), 70);
  setTimeout(() => playBeep(784, 0.12), 140);
}

function playSoundWrong() {
  playBeep(220, 0.06);
  setTimeout(() => playBeep(180, 0.12), 70);
}

function playSoundPickUp() {
  playBeep(440, 0.04, 'square', 0.08);
}

function playSoundMissed() {
  playBeep(150, 0.08, 'sawtooth', 0.15);
  setTimeout(() => playBeep(120, 0.15, 'sawtooth', 0.12), 80);
}

function playSoundWin() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((note, i) => setTimeout(() => playBeep(note, 0.1), i * 90));
}

function playSoundGameOver() {
  const notes = [300, 250, 200, 150];
  notes.forEach((note, i) => setTimeout(() => playBeep(note, 0.12, 'sawtooth', 0.18), i * 100));
}

function playSoundStart() {
  playBeep(330, 0.06);
  setTimeout(() => playBeep(392, 0.06), 70);
  setTimeout(() => playBeep(523, 0.10), 140);
}

function playSoundPause()   { playBeep(440, 0.05); setTimeout(() => playBeep(330, 0.08), 60); }
function playSoundUnpause() { playBeep(330, 0.05); setTimeout(() => playBeep(440, 0.08), 60); }

document.addEventListener('pointerdown', () => audioContext.resume(), { once: true });
document.addEventListener('keydown',     () => audioContext.resume(), { once: true });


/* 2. ЗВЁЗДНЫЙ ФОН */

function initStarfield() {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  let stars    = [];

  // Пересоздаём звёзды при изменении размера окна
  function createStars() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x:         Math.random() * canvas.width,
        y:         Math.random() * canvas.height,
        size:      Math.random() < 0.2 ? 2 : 1,   
        phase:     Math.random(),                   // фаза мерцания
        speed:     0.2 + Math.random() * 0.4,      // скорость мерцания
      });
    }
  }

  createStars();
  window.addEventListener('resize', createStars);

  // Каждый кадр обновляем и перерисовываем все звёзды
  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const star of stars) {
      star.phase += 0.01 * star.speed;
      if (star.phase > 1) star.phase = 0;

      const brightness = Math.abs(Math.sin(star.phase * Math.PI));
      ctx.fillStyle = `rgba(0, 232, 213, ${brightness * 0.6})`;
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
    }

    requestAnimationFrame(drawFrame);
  }

  drawFrame();
}


/* 3. ПИКСЕЛЬНЫЕ СЕРДЕЧКИ */

const HEART_GRID = [
  [0, 1, 1, 0, 0, 0, 1, 1, 0],
  [1, 1, 1, 1, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0],
];

function drawHeart(canvas, isEmpty) {
  const PIXEL_SIZE   = 3; 
  const COLS         = HEART_GRID[0].length;
  const ROWS         = HEART_GRID.length;

  canvas.width  = COLS * PIXEL_SIZE;
  canvas.height = ROWS * PIXEL_SIZE;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (HEART_GRID[row][col] === 0) continue; 

      ctx.fillStyle = isEmpty ? '#2a3a5c' : '#ff3366';
      ctx.fillRect(col * PIXEL_SIZE, row * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);

      if (!isEmpty && row === 0 && (col === 1 || col === 6)) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(col * PIXEL_SIZE, row * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
  }
}

// Обновляем все сердечки в HUD
function updateHearts(currentLives, maxLives) {
  const container = document.getElementById('h-hearts');
  if (!container) return;

  // Создаём нужное количество canvas-элементов, если их ещё нет
  while (container.children.length < maxLives) {
    const heartCanvas       = document.createElement('canvas');
    heartCanvas.className   = 'px-heart-canvas';
    container.appendChild(heartCanvas);
  }

  // Перерисовываем каждое сердечко
  Array.from(container.children).forEach((heartCanvas, index) => {
    const isLost = index >= currentLives;
    drawHeart(heartCanvas, isLost);
    heartCanvas.style.opacity = isLost ? '0.3' : '1';
  });
}

// Запускает анимацию «потери» сердечка
function animateHeartLoss(newLives, maxLives) {
  const container = document.getElementById('h-hearts');
  if (!container) return;

  const dyingHeart = container.children[newLives]; // сердечко с индексом = новое кол-во жизней
  if (dyingHeart) {
    dyingHeart.classList.add('do-heart-pop');
    setTimeout(() => dyingHeart.classList.remove('do-heart-pop'), 380);
  }

  updateHearts(newLives, maxLives);
}


/* 4. ДАННЫЕ */

const CATEGORIES = [
  { id: 'functions',  label: 'Функции',   icon: 'ƒ()' },
  { id: 'operators',  label: 'Операторы', icon: '±'   },
  { id: 'data_types', label: 'Типы',      icon: '{}'  },
  { id: 'loops',      label: 'Циклы',     icon: '↻'   },
  { id: 'conditions', label: 'Условия',   icon: '?'   },
];

const LEVELS = [
  { id: 1, name: 'НОВИЧОК', cssClass: 'l1', stars: '★☆☆', desc: 'Базовые понятия',  speed: 55,  target: 10, maxErrors: 5, lives: 3, allowedLevels: [1]     },
  { id: 2, name: 'ПРАКТИК', cssClass: 'l2', stars: '★★☆', desc: 'Средний уровень',  speed: 90,  target: 15, maxErrors: 4, lives: 3, allowedLevels: [1, 2]   },
  { id: 3, name: 'ЭКСПЕРТ', cssClass: 'l3', stars: '★★★', desc: 'Продвинутый',      speed: 130, target: 20, maxErrors: 3, lives: 3, allowedLevels: [1, 2, 3] },
];

// Каждое понятие:
//   text     — текст на падающем блоке
//   category — id категории (должен совпадать с CATEGORIES)
//   hint     — подсказка, показывается при ошибке
//   level    — сложность: 1 = лёгкий, 2 = средний, 3 = сложный
const CONCEPTS = [
  // ── Функции (уровень 1) ──────────────────────────────
  { text: 'print()',    category: 'functions',  hint: 'print() — выводит данные на экран',           level: 1 },
  { text: 'len()',      category: 'functions',  hint: 'len() — возвращает длину объекта',            level: 1 },
  { text: 'input()',    category: 'functions',  hint: 'input() — получает ввод от пользователя',     level: 1 },
  { text: 'range()',    category: 'functions',  hint: 'range() — генерирует последовательность чисел', level: 1 },
  { text: 'int()',      category: 'functions',  hint: 'int() — преобразует значение в целое число',  level: 1 },
  { text: 'str()',      category: 'functions',  hint: 'str() — преобразует значение в строку',       level: 1 },
  // ── Функции (уровень 2) ──────────────────────────────
  { text: 'type()',     category: 'functions',  hint: 'type() — возвращает тип объекта',             level: 2 },
  { text: 'list()',     category: 'functions',  hint: 'list() — создаёт список',                     level: 2 },
  { text: 'sum()',      category: 'functions',  hint: 'sum() — сумма всех элементов',                level: 2 },
  { text: 'max()',      category: 'functions',  hint: 'max() — наибольшее значение',                 level: 2 },
  { text: 'min()',      category: 'functions',  hint: 'min() — наименьшее значение',                 level: 2 },
  // ── Функции (уровень 3) ──────────────────────────────
  { text: 'sorted()',   category: 'functions',  hint: 'sorted() — возвращает отсортированный список', level: 3 },
  { text: 'enumerate()',category: 'functions',  hint: 'enumerate() — добавляет счётчик к итерируемому', level: 3 },
  { text: 'zip()',      category: 'functions',  hint: 'zip() — объединяет несколько итерируемых',    level: 3 },
  { text: 'map()',      category: 'functions',  hint: 'map() — применяет функцию к каждому элементу', level: 3 },
  { text: 'filter()',   category: 'functions',  hint: 'filter() — отбирает элементы по условию',       level: 3 },
  { text: 'round()',    category: 'functions',  hint: 'round() — округляет число до нужной точности',  level: 2 },
  { text: 'abs()',      category: 'functions',  hint: 'abs() — возвращает модуль числа',               level: 2 },
  { text: 'any()',      category: 'functions',  hint: 'any() — True, если хотя бы один элемент истинен', level: 3 },
  { text: 'all()',      category: 'functions',  hint: 'all() — True, если все элементы истинны',       level: 3 },

  // ── Операторы (уровень 1) ────────────────────────────
  { text: '+',          category: 'operators',  hint: '+ — сложение или конкатенация строк',         level: 1 },
  { text: '-',          category: 'operators',  hint: '- — вычитание',                               level: 1 },
  { text: '*',          category: 'operators',  hint: '* — умножение',                               level: 1 },
  { text: '/',          category: 'operators',  hint: '/ — деление (результат всегда float)',         level: 1 },
  { text: '==',         category: 'operators',  hint: '== — проверка на равенство',                  level: 1 },
  { text: '=',          category: 'operators',  hint: '= — присваивание значения переменной',        level: 1 },
  // ── Операторы (уровень 2) ────────────────────────────
  { text: '//',         category: 'operators',  hint: '// — целочисленное деление (без остатка)',     level: 2 },
  { text: '%',          category: 'operators',  hint: '% — остаток от деления',                      level: 2 },
  { text: '**',         category: 'operators',  hint: '** — возведение в степень',                   level: 2 },
  { text: '!=',         category: 'operators',  hint: '!= — не равно',                               level: 2 },
  { text: '+=',         category: 'operators',  hint: '+= — сложение с присваиванием (x += 1)',      level: 2 },
  // ── Операторы (уровень 3) ────────────────────────────
  { text: 'in',         category: 'operators',  hint: 'in — проверяет вхождение в коллекцию',        level: 3 },
  { text: 'not in',     category: 'operators',  hint: 'not in — проверяет отсутствие в коллекции',   level: 3 },
  { text: 'is',         category: 'operators',  hint: 'is — проверяет идентичность объектов',        level: 3 },
  { text: 'is not',     category: 'operators',  hint: 'is not — проверяет, что объекты не идентичны', level: 3 },
  { text: '<=',         category: 'operators',  hint: '<= — меньше или равно',                        level: 1 },
  { text: '>=',         category: 'operators',  hint: '>= — больше или равно',                         level: 1 },
  { text: '*=',         category: 'operators',  hint: '*= — умножение с присваиванием (x *= 2)',      level: 2 },
  { text: '/=',         category: 'operators',  hint: '/= — деление с присваиванием (x /= 2)',        level: 2 },

  // ── Типы данных (уровень 1) ──────────────────────────
  { text: 'int',        category: 'data_types', hint: 'int — целое число, например: 42',             level: 1 },
  { text: 'float',      category: 'data_types', hint: 'float — число с точкой, например: 3.14',      level: 1 },
  { text: 'str',        category: 'data_types', hint: 'str — строка, например: "Hello"',             level: 1 },
  { text: 'bool',       category: 'data_types', hint: 'bool — логический тип: True или False',       level: 1 },
  { text: 'list',       category: 'data_types', hint: 'list — изменяемый список: [1, 2, 3]',         level: 1 },
  { text: 'True',       category: 'data_types', hint: 'True — булево значение «истина»',              level: 1 },
  { text: 'False',      category: 'data_types', hint: 'False — булево значение «ложь»',               level: 1 },
  // ── Типы данных (уровень 2) ──────────────────────────
  { text: 'tuple',      category: 'data_types', hint: 'tuple — неизменяемый кортеж: (1, 2, 3)',      level: 2 },
  { text: 'dict',       category: 'data_types', hint: 'dict — словарь пар ключ–значение: {"a": 1}',  level: 2 },
  { text: 'set',        category: 'data_types', hint: 'set — множество уникальных элементов',        level: 2 },
  { text: 'None',       category: 'data_types', hint: 'None — отсутствие значения',                  level: 2 },
  // ── Типы данных (уровень 3) ──────────────────────────
  { text: 'complex',    category: 'data_types', hint: 'complex — комплексное число: 3+4j',           level: 3 },
  { text: 'frozenset',  category: 'data_types', hint: 'frozenset — неизменяемое множество',          level: 3 },
  { text: 'bytes',      category: 'data_types', hint: 'bytes — последовательность байтов',           level: 3 },
  { text: 'bytearray',  category: 'data_types', hint: 'bytearray — изменяемая последовательность байтов', level: 3 },
  { text: 'memoryview', category: 'data_types', hint: 'memoryview — доступ к буферу без копирования', level: 3 },

  // ── Циклы (уровень 1) ────────────────────────────────
  { text: 'for',              category: 'loops', hint: 'for — цикл перебора элементов',              level: 1 },
  { text: 'while',            category: 'loops', hint: 'while — цикл, пока условие истинно',         level: 1 },
  { text: 'for i in range():', category: 'loops', hint: 'for i in range() — цикл со счётчиком',      level: 1 },
  { text: 'for x in list:',   category: 'loops', hint: 'for x in list: — перебор элементов списка',  level: 1 },
  // ── Циклы (уровень 2) ────────────────────────────────
  { text: 'break',      category: 'loops',      hint: 'break — выход из цикла',                      level: 2 },
  { text: 'continue',   category: 'loops',      hint: 'continue — пропуск текущей итерации',         level: 2 },
  { text: 'pass',       category: 'loops',      hint: 'pass — заглушка, ничего не делает',           level: 2 },
  { text: 'else in loop', category: 'loops',    hint: 'else в цикле — выполняется, если цикл не прерван break', level: 3 },
  // ── Циклы (уровень 3) ────────────────────────────────
  { text: 'while True:', category: 'loops',     hint: 'while True: — бесконечный цикл, прервать break', level: 3 },
  { text: 'for k,v in d.items():', category: 'loops', hint: 'перебор пар ключ–значение словаря',     level: 3 },
  { text: 'for i, x in enumerate(list):', category: 'loops', hint: 'перебор списка с индексом и значением', level: 2 },

  // ── Условия (уровень 1) ──────────────────────────────
  { text: 'if',         category: 'conditions', hint: 'if — условное выполнение блока',              level: 1 },
  { text: 'else',       category: 'conditions', hint: 'else — блок при ложном условии',              level: 1 },
  { text: 'elif',       category: 'conditions', hint: 'elif — дополнительное условие (else if)',      level: 1 },
  { text: 'and',        category: 'conditions', hint: 'and — логическое «и»: оба условия должны быть истинны', level: 1 },
  { text: 'or',         category: 'conditions', hint: 'or — логическое «или»: хотя бы одно истинно', level: 1 },
  // ── Условия (уровень 2) ──────────────────────────────
  { text: 'not',        category: 'conditions', hint: 'not — инвертирует булево значение',           level: 2 },
  { text: 'if x > 0:',  category: 'conditions', hint: 'пример условной конструкции',                 level: 2 },
  { text: 'if x in arr:', category: 'conditions', hint: 'проверка, что элемент содержится в коллекции', level: 2 },
  { text: 'if x is None:', category: 'conditions', hint: 'проверка, что переменная не содержит значение', level: 2 },
  // ── Условия (уровень 3) ──────────────────────────────
  { text: 'try/except', category: 'conditions', hint: 'try/except — обработка исключений (ошибок)',  level: 3 },
  { text: 'match/case', category: 'conditions', hint: 'match/case — сопоставление с образцом (Python 3.10+)', level: 3 },
  { text: 'try/except/finally', category: 'conditions', hint: 'finally — блок, который выполнится всегда', level: 3 },
  { text: 'if ... else ...', category: 'conditions', hint: 'тернарный оператор: value_if_true if cond else value_if_false', level: 3 },
];


/* 5. ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ */

function showScreen(screenId) {
  const allScreens = ['s-menu', 's-game', 's-result'];

  for (const id of allScreens) {
    const el = document.getElementById(id);
    // Добавляем класс 'out' = невидимый, убираем у нужного
    el.classList.toggle('out', id !== screenId);
  }
}


/* 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ */

function showToast(type, text, hint = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = hint ? `<span class="hint">${hint}</span>` : text;

  document.getElementById('toasts').appendChild(toast);

  setTimeout(() => toast.remove(), 3200);
}

function showScoreBurst(text, isPositive) {
  const burst = document.createElement('div');
  burst.className  = `burst ${isPositive ? 'p' : 'm'}`;
  burst.textContent = text;
  // Случайная позиция по горизонтали
  burst.style.cssText = `left: ${40 + Math.random() * 20}vw; top: 38vh`;

  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 700);
}

// Создаёт разлетающиеся пиксельные квадраты в точке (x, y)
function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'px-particle';

    // Случайное направление разлёта
    const angle    = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 60;
    const dx = Math.round(Math.cos(angle) * distance);
    const dy = Math.round(Math.sin(angle) * distance);
    const size = Math.random() < 0.3 ? 8 : 4; // некоторые частицы крупнее

    particle.style.cssText = `
      left: ${x}px; top: ${y}px;
      background: ${color};
      --dx: ${dx}px; --dy: ${dy}px;
      width: ${size}px; height: ${size}px;
    `;

    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 750);
  }
}

// Встряхивает элемент (эффект ошибки на HUD)
function shakeElement(el) {
  el.classList.remove('do-shake');
  void el.offsetWidth; // заставляем браузер «забыть» старую анимацию
  el.classList.add('do-shake');
  setTimeout(() => el.classList.remove('do-shake'), 320);
}


/* 7. МЕНЮ */

function initMenu() {
  const container = document.getElementById('lvl-cards');
  container.innerHTML = ''; // очищаем на случай повторного вызова

  for (const level of LEVELS) {
    const button = document.createElement('button');
    button.className = `lvl-card ${level.cssClass}`;
    button.innerHTML = `
      <div class="num">${level.id}</div>
      <div class="name">${level.name}</div>
      <div class="desc">${level.desc}</div>
      <div class="stars">${level.stars}</div>
    `;
    button.onclick = () => {
      playSoundStart();
      setTimeout(() => startLevel(level.id), 200);
    };
    container.appendChild(button);
  }

  showScreen('s-menu');
}


/* 8. СОСТОЯНИЕ ИГРЫ И СТАРТ УРОВНЯ */

let game = {};

function startLevel(levelId) {
  const levelData = LEVELS.find(l => l.id === levelId);

  // Берём только понятия нужной сложности
  const availableConcepts = CONCEPTS.filter(c => levelData.allowedLevels.includes(c.level));

  // Сбрасываем состояние в начальное
  game = {
    level:      levelData,
    score:      0,
    correct:    0,       // сколько правильно угадано
    errors:     0,       // сколько ошибок сделано
    lives:      levelData.lives,
    errorLog:   [],      // список ошибок для экрана результатов
    paused:     false,
    pool:       shuffle(availableConcepts), // перемешанный список понятий
    startedAtMs: Date.now(),
    correctByLevel: { 1: 0, 2: 0, 3: 0 },

    // Текущий падающий блок
    blockElement: null,  // DOM-элемент блока
    currentConcept: null,// объект понятия из CONCEPTS

    // Координаты блока
    blockX: 0,
    blockY: -80,

    // Перетаскивание
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,

    // Таймеры анимации
    animFrameId: null,   // id requestAnimationFrame
    spawnTimerId: null,  // id setTimeout для следующего блока
    lastTimestamp: null, // метка времени предыдущего кадра
  };

  buildBaskets();
  refreshHUD();
  showScreen('s-game');
  pingGame('sorter');
  spawnBlock();
}


/* 9. КОРЗИНЫ */

function buildBaskets() {
  const area = document.getElementById('baskets');
  area.innerHTML = '';

  for (const cat of CATEGORIES) {
    const basket = document.createElement('div');
    basket.className    = 'basket';
    basket.dataset.cat  = cat.id;
    basket.innerHTML    = `
      <span class="ico">${cat.icon}</span>
      <span class="lbl">${cat.label}</span>
      <span class="cnt" id="cnt-${cat.id}">0</span>
    `;

    // Подсветка при перетаскивании мышью (drag & drop API)
    basket.addEventListener('dragover',  e => { if (game.paused) return; e.preventDefault(); basket.classList.add('over'); });
    basket.addEventListener('dragleave', ()  => basket.classList.remove('over'));
    basket.addEventListener('drop',      e => { e.preventDefault(); basket.classList.remove('over'); if (!game.paused) handleDrop(cat.id, basket); });

    // Подсветка при перетаскивании пальцем (pointer events)
    basket.addEventListener('pointerenter', () => { if (game.isDragging) basket.classList.add('over'); });
    basket.addEventListener('pointerleave', () => basket.classList.remove('over'));

    area.appendChild(basket);
  }
}


/* 10. ПАДАЮЩИЙ БЛОК */

function spawnBlock() {
  // Не создаём блок если пауза или игра не идёт
  if (game.paused || !game.pool.length) return;

  removeCurrentBlock();

  // Берём следующее понятие из перемешанного пула (без повторов в сессии)
  game.currentConcept = game.pool.pop();

  // Случайная горизонтальная позиция
  const fieldWidth = document.getElementById('field').clientWidth;
  game.blockX = 60 + Math.random() * (fieldWidth - 260);
  game.blockY = -72; // стартуем выше экрана

  // Создаём DOM-элемент блока
  const block = document.createElement('div');
  block.className   = 'block';
  block.textContent = game.currentConcept.text;
  block.style.left  = game.blockX + 'px';
  block.style.top   = game.blockY + 'px';
  block.draggable   = false;

  // Навешиваем обработчики перетаскивания
  attachDragListeners(block);

  document.getElementById('field').appendChild(block);
  game.blockElement  = block;
  game.lastTimestamp = null;

  // Запускаем цикл падения
  game.animFrameId = requestAnimationFrame(animateFall);
}

function animateFall(timestamp) {
  // Останавливаем если пауза, блок тащат, или блок уже удалён
  if (game.paused || game.isDragging || !game.blockElement) return;

  // Первый кадр — запоминаем время
  if (!game.lastTimestamp) game.lastTimestamp = timestamp;

  // dt = сколько секунд прошло с прошлого кадра
  const dt = (timestamp - game.lastTimestamp) / 1000;
  game.lastTimestamp = timestamp;

  // Двигаем блок вниз: скорость (пикс/сек) × время (сек)
  game.blockY += game.level.speed * dt;
  game.blockElement.style.top = game.blockY + 'px';

  const fieldHeight = document.getElementById('field').clientHeight;

  if (game.blockY > fieldHeight) {
    // Блок выпал за нижний край — это ошибка
    playSoundMissed();
    handleMistake(game.currentConcept, true);
  } else {
    // Запрашиваем следующий кадр
    game.animFrameId = requestAnimationFrame(animateFall);
  }
}


/* 11. ПЕРЕТАСКИВАНИЕ */

function attachDragListeners(block) {
  block.draggable = false;

  block.addEventListener('pointerdown', e => {
    if (game.paused) return;
    playSoundPickUp();
    block.setPointerCapture(e.pointerId); // «захватываем» указатель
    cancelAnimationFrame(game.animFrameId);
    game.isDragging = true;

    // Запоминаем смещение от края блока до курсора (курсор остаётся на месте захвата)
    const rect = block.getBoundingClientRect();
    game.dragOffsetX = e.clientX - rect.left;
    game.dragOffsetY = e.clientY - rect.top;

    block.classList.add('dragging');
    block.addEventListener('pointermove', onPointerMove);
    block.addEventListener('pointerup',   onPointerUp, { once: true });
    block.addEventListener('pointercancel', onPointerUp, { once: true });
    block.addEventListener('lostpointercapture', onPointerUp, { once: true });
  });
}

// Двигаем блок вслед за курсором / пальцем
function onPointerMove(e) {
  if (!game.isDragging || !game.blockElement) return;

  game.blockX = e.clientX - game.dragOffsetX;
  game.blockY = e.clientY - game.dragOffsetY;

  game.blockElement.style.left = game.blockX + 'px';
  game.blockElement.style.top  = game.blockY + 'px';

  // Подсвечиваем корзину под курсором
  game.blockElement.style.pointerEvents = 'none'; // чтобы найти элемент ПОД блоком
  const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
  game.blockElement.style.pointerEvents = '';

  document.querySelectorAll('.basket').forEach(b => b.classList.remove('over'));
  elementBelow?.closest('.basket')?.classList.add('over');
}

// Пользователь отпустил блок
function onPointerUp(e) {
  const activeBlock = game.blockElement;
  if (!activeBlock) return;

  activeBlock.removeEventListener('pointermove', onPointerMove);
  activeBlock.classList.remove('dragging');
  game.isDragging = false;
  document.querySelectorAll('.basket').forEach(b => b.classList.remove('over'));

  // Смотрим что находится под блоком в момент отпускания
  activeBlock.style.pointerEvents = 'none';
  const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
  activeBlock.style.pointerEvents = '';

  const basketBelow = elementBelow?.closest('.basket');

  if (basketBelow) {
    handleDrop(basketBelow.dataset.cat, basketBelow);
  } else {
    // Не попал в корзину — продолжаем падение
    game.lastTimestamp = null;
    game.animFrameId = requestAnimationFrame(animateFall);
  }
}


/* 12. ПОПАДАНИЕ В КОРЗИНУ */

function handleDrop(categoryId, basketElement) {
  if (!game.currentConcept) return;

  cancelAnimationFrame(game.animFrameId);
  game.isDragging = false;

  if (game.currentConcept.category === categoryId) {
    handleCorrect(game.currentConcept, categoryId, basketElement);
  } else {
    handleMistake(game.currentConcept, false);
  }
}

// Правильный ответ
function handleCorrect(concept, categoryId, basketElement) {
  game.correct++;
  game.score += 10 + concept.level * 5; // уровень сложности даёт бонус
  if (game.correctByLevel && typeof concept.level === 'number') {
    const lv = concept.level;
    if (lv === 1 || lv === 2 || lv === 3) game.correctByLevel[lv] = (game.correctByLevel[lv] || 0) + 1;
  }
  playSoundCorrect();

  // Обновляем счётчик в корзине
  const counter = document.getElementById('cnt-' + categoryId);
  if (counter) {
    counter.textContent = parseInt(counter.textContent || 0) + 1;
    counter.classList.add('do-score');
    setTimeout(() => counter.classList.remove('do-score'), 220);
  }

  // Анимация корзины
  const basket = basketElement || document.querySelector(`.basket[data-cat="${categoryId}"]`);
  if (basket) {
    basket.classList.add('do-basket-ok');
    setTimeout(() => basket.classList.remove('do-basket-ok'), 320);

    // Цветные частицы в центре корзины
    const rect = basket.getBoundingClientRect();
    const categoryColors = {
      functions:  '#00e8d5',
      operators:  '#ff3366',
      data_types: '#ffd930',
      loops:      '#2ecc71',
      conditions: '#9b72ff',
    };
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, categoryColors[categoryId], 10);
  }

  showToast('ok', `✓ ${concept.text}`, concept.hint);
  showScoreBurst('+' + (10 + concept.level * 5), true);
  removeCurrentBlock();
  refreshHUD();

  // Победа?
  if (game.correct >= game.level.target) {
    playSoundWin();
    setTimeout(() => finishGame('win'), 600);
    return;
  }

  game.spawnTimerId = setTimeout(spawnBlock, 600);
}

// Ошибка (неверная корзина или блок упал)
// missed = true означает, что блок упал вниз без попытки
function handleMistake(concept, missed) {
  game.errors++;
  game.score = Math.max(0, game.score - 5); // штраф, но не ниже нуля
  game.errorLog.push({ text: concept.text, hint: concept.hint });
  playSoundWrong();

  const message = missed
    ? `✗ "${concept.text}" пропущен!`
    : `✗ Неверно! "${concept.text}"`;
  showToast('err', message, concept.hint);
  showScoreBurst('-5', false);
  shakeElement(document.querySelector('.hud'));

  // Анимируем потерю жизни и уменьшаем счётчик
  animateHeartLoss(game.lives - 1, game.level.lives);
  game.lives--;

  removeCurrentBlock();
  refreshHUD();

  // Конец игры?
  if (game.lives <= 0 || game.errors > game.level.maxErrors) {
    playSoundGameOver();
    setTimeout(() => finishGame('lose'), 550);
    return;
  }

  game.spawnTimerId = setTimeout(spawnBlock, 820);
}

// Удаляет текущий блок с экрана и сбрасывает переменные
function removeCurrentBlock() {
  cancelAnimationFrame(game.animFrameId);
  if (game.blockElement) {
    game.blockElement.remove();
    game.blockElement = null;
  }
  game.currentConcept = null;
  game.isDragging     = false;
}


/* 13. HUD */

function refreshHUD() {
  document.getElementById('h-score').textContent = game.score;
  document.getElementById('h-prog').textContent  = `${game.correct}/${game.level.target}`;
  document.getElementById('h-lname').textContent = `LVL ${game.level.id} — ${game.level.name}`;

  // Прогресс-бар: сколько % от цели выполнено
  const progressPercent = Math.min(100, Math.round(game.correct / game.level.target * 100));
  document.getElementById('h-bar').style.width = progressPercent + '%';

  updateHearts(game.lives, game.level.lives);
}


/* 14. КОНЕЦ ИГРЫ */

function finishGame(result) {
  cancelAnimationFrame(game.animFrameId);
  removeCurrentBlock();

  // Отправляем результат и при победе, и при проигрыше:
  // набранные очки засчитываются, даже если жизни кончились раньше цели.
  {
    const elapsedMs = Math.max(0, Date.now() - (game.startedAtMs || Date.now()));
    submitScore('sorter', {
      level: game.level?.id || 1,
      result: result === 'win' ? 'win' : 'lose',
      correct_total: game.correct,
      errors_total: game.errors,
      correct_by_level: game.correctByLevel || { 1: 0, 2: 0, 3: 0 },
      elapsed_ms: elapsedMs,
    }).then(res => {
      if (!res) return;
      if (typeof res.total_game_score === 'number') {
        showToast('ok', `🏆 Очки добавлены! Всего в игре: ${res.total_game_score}`);
      } else if (res.is_record) {
        showToast('ok', '🏆 Новый рекорд сохранён!');
      }
    });
    // Обновляем виджет лидерборда в меню
    const lbEl = document.getElementById('lb-sorter');
    if (lbEl) renderLeaderboard(lbEl, 'sorter', 5);
  }

  const isWin    = result === 'win';
  const accuracy = game.correct + game.errors > 0
    ? Math.round(game.correct / (game.correct + game.errors) * 100)
    : 0;

  // Заголовок результата
  const titleEl = document.getElementById('r-title');
  titleEl.textContent = isWin ? '>> УРОВЕНЬ ПРОЙДЕН! <<' : '>> GAME OVER <<';
  titleEl.className   = 'res-title ' + (isWin ? 'win' : 'lose');

  // Статистика
  document.getElementById('r-score').textContent = game.score;
  document.getElementById('r-ok').textContent    = game.correct;
  document.getElementById('r-err').textContent   = game.errors;
  document.getElementById('r-acc').textContent   = accuracy + '%';

  // Список ошибок
  const errorSection = document.getElementById('r-errsec');
  if (game.errorLog.length > 0) {
    errorSection.style.display = '';
    document.getElementById('r-errlist').innerHTML = game.errorLog
      .map(e => `<div class="err-row"><span class="ec">${e.text}</span><span class="eh">${e.hint}</span></div>`)
      .join('');
  } else {
    errorSection.style.display = 'none';
  }

  showScreen('s-result');
}


/* 15. ПАУЗА */

function togglePause() {
  game.paused = !game.paused;
  game.paused ? playSoundPause() : playSoundUnpause();

  document.getElementById('btn-pause').textContent = game.paused ? '> RESUME' : '|| PAUSE';

  if (game.paused) {
    // Отменяем ожидающий спавн, чтобы не запустился пока на паузе
    clearTimeout(game.spawnTimerId);
  } else {
    if (game.blockElement) {
      // Блок на экране — возобновляем падение
      game.lastTimestamp = null;
      game.animFrameId = requestAnimationFrame(animateFall);
    } else {
      // Блока нет — запускаем новый
      game.spawnTimerId = setTimeout(spawnBlock, 400);
    }
  }
}


/* 16. КНОПКИ И КЛАВИШИ */

document.getElementById('btn-pause').onclick = () => togglePause();

document.getElementById('btn-esc').onclick = () => {
  cancelAnimationFrame(game.animFrameId);
  removeCurrentBlock();
  showScreen('s-menu');
};

document.getElementById('btn-retry').onclick = () => {
  if (game.level) {
    playSoundStart();
    setTimeout(() => startLevel(game.level.id), 150);
  }
};

document.getElementById('btn-menu').onclick = () => {
  cancelAnimationFrame(game.animFrameId);
  removeCurrentBlock();
  showScreen('s-menu');
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const menuScreen = document.getElementById('s-menu');
    if (!menuScreen.classList.contains('out')) {
      window.location.href = '../../index.html';
    } else {
      cancelAnimationFrame(game.animFrameId);
      removeCurrentBlock();
      showScreen('s-menu');
    }
  }
  // Клавиша P — пауза, только когда игровой экран активен
  if (e.key === 'p' || e.key === 'P') {
    const gameScreen = document.getElementById('s-game');
    if (!gameScreen.classList.contains('out')) togglePause();
  }
});


/* УТИЛИТЫ */

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}


/* 17. СТАРТ ПРИЛОЖЕНИЯ */

initStarfield();
initMenu();

// Загружаем таблицу лидеров в меню
const _lbSorter = document.getElementById('lb-sorter');
if (_lbSorter) renderLeaderboard(_lbSorter, 'sorter', 5);
