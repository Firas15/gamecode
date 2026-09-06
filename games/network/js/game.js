/* 
   1.  ЗВУКИ          — Web Audio API
   2.  ЗВЁЗДНЫЙ ФОН   — canvas анимация
   3.  ДАННЫЕ         — уровни и задания
   4.  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ — IP-арифметика
   5.  ЭКРАНЫ         — переключение между меню/игрой/результатом
   6.  HUD            — очки, жизни, прогресс-бар
   7.  ТОСТЫ          — всплывающие уведомления
   8.  МЕНЮ           — карточки уровней
   9.  ВСТУПЛЕНИЕ     — экран с условиями задания
  10.  ИГРОВОЕ ПОЛЕ   — устройства, линии, отправитель
  11.  МЕХАНИКА ИГРЫ  — проверка ответа, анимация пакета
  12.  РАУНДЫ         — цикл раундов внутри уровня
  13.  РЕЗУЛЬТАТ      — итоговый экран
  14.  КЛАВИШИ        — ESC
  15.  ЗАПУСК         — init
*/


/*  1. ЗВУКИ */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(freq, dur, shape = 'square', vol = 0.15) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type            = shape;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function soundCorrect() {
  playBeep(523, 0.06);
  setTimeout(() => playBeep(659, 0.06), 70);
  setTimeout(() => playBeep(784, 0.14), 140);
}
function soundWrong() {
  playBeep(220, 0.08);
  setTimeout(() => playBeep(160, 0.15), 80);
}
function soundPacketFly() {
  playBeep(880, 0.04, 'sine', 0.1);
}
function soundWin() {
  [523,659,784,1047].forEach((n,i) => setTimeout(() => playBeep(n, 0.1), i * 90));
}
function soundLose() {
  [300,250,200,150].forEach((n,i) => setTimeout(() => playBeep(n, 0.12, 'sawtooth'), i * 100));
}
function soundStart() {
  playBeep(330, 0.06);
  setTimeout(() => playBeep(523, 0.10), 80);
}
function soundClick() {
  playBeep(440, 0.04, 'square', 0.08);
}


/* 2. ЗВЁЗДНЫЙ ФОН */
(function initStars() {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  let stars    = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 120 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 1.5 + 0.3,
      alpha: Math.random(),
      speed: Math.random() * 0.008 + 0.003,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.alpha += s.speed;
      if (s.alpha > 1 || s.alpha < 0) s.speed *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,216,240,${s.alpha * 0.5})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();


/* 3. ДАННЫЕ — УРОВНИ И ЗАДАНИЯ */

/*
  Задание содержит:
  - senderIP     : IP отправителя (строка)
  - mask         : маска подсети (строка)
  - task         : текст задания
  - hint         : подсказка для игрока
  - devices[]    : устройства на схеме
      - name      : имя устройства
      - ip        : его IP
      - type      : 'laptop' | 'server' | 'phone'
      - correct   : true — правильный ответ
  - explanation  : объяснение правильного ответа
*/

const LEVELS = [
  /*
     УРОВЕНЬ 1 — НОВИЧОК
     Маска /24 (255.255.255.0)
 */
  {
    id:     'level1',
    name:   'НОВИЧОК',
    color:  '#39ff14',
    desc:   'Маска /24 — простые подсети',
    rounds: [
      {
        senderIP: '192.168.1.10',
        mask:     '255.255.255.0',
        task:     'Выбери устройство в той же подсети (192.168.1.X)',
        hint:     'ПОДСКАЗКА: При маске 255.255.255.0 — первые 3 октета должны совпадать',
        devices: [
          { name: 'Устройство A', ip: '192.168.1.25',  type: 'laptop', correct: true },
          { name: 'Устройство B', ip: '192.168.2.15',  type: 'server', correct: false },
          { name: 'Устройство C', ip: '10.0.0.5',      type: 'phone',  correct: false },
        ],
        explanation: '192.168.1.25 входит в подсеть 192.168.1.0/24 — первые 3 октета совпадают с отправителем.',
      },
      {
        senderIP: '10.0.0.5',
        mask:     '255.255.255.0',
        task:     'Найди устройство в подсети 10.0.0.X',
        hint:     'ПОДСКАЗКА: Маска /24 означает подсеть по первым 24 битам (3 октета)',
        devices: [
          { name: 'Сервер Alpha', ip: '10.0.0.100', type: 'server', correct: true },
          { name: 'ПК Beta',      ip: '10.1.0.5',   type: 'laptop', correct: false },
          { name: 'Планшет G',    ip: '172.16.0.1', type: 'phone',  correct: false },
        ],
        explanation: '10.0.0.100 — в той же подсети 10.0.0.0/24. У него совпадают первые три октета: 10.0.0.',
      },
      {
        senderIP: '172.16.5.50',
        mask:     '255.255.255.0',
        task:     'Выбери устройство из подсети 172.16.5.X',
        hint:     'ПОДСКАЗКА: Сравни первые 3 октета с IP отправителя',
        devices: [
          { name: 'PC-1',    ip: '172.16.4.50', type: 'laptop', correct: false },
          { name: 'PC-2',    ip: '172.16.5.99', type: 'laptop', correct: true },
          { name: 'Router',  ip: '192.168.0.1', type: 'server', correct: false },
        ],
        explanation: '172.16.5.99 — в той же подсети. Первые три октета 172.16.5 совпадают с отправителем.',
      },
    ],
  },

  /* 
     УРОВЕНЬ 2 — ПРАКТИК
     Маски /16 и /8
  */
  {
    id:     'level2',
    name:   'ПРАКТИК',
    color:  '#f5d800',
    desc:   'Маски /16 и /8 — шире подсети',
    rounds: [
      {
        senderIP: '192.168.5.20',
        mask:     '255.255.0.0',
        task:     'Маска /16 — подсеть 192.168.X.X. Найди устройство в ней',
        hint:     'ПОДСКАЗКА: При маске 255.255.0.0 — должны совпадать только первые 2 октета',
        devices: [
          { name: 'Хост A', ip: '192.168.99.1',  type: 'laptop', correct: true },
          { name: 'Хост B', ip: '192.169.1.5',   type: 'server', correct: false },
          { name: 'Хост C', ip: '10.168.5.20',   type: 'phone',  correct: false },
        ],
        explanation: '192.168.99.1 входит в 192.168.0.0/16. Первые два октета 192.168 совпадают.',
      },
      {
        senderIP: '10.20.0.1',
        mask:     '255.255.0.0',
        task:     'Подсеть 10.20.X.X — выбери правильное устройство',
        hint:     'ПОДСКАЗКА: Маска /16 = 255.255.0.0 — первые два октета фиксированы',
        devices: [
          { name: 'NAS-1',    ip: '10.20.50.100', type: 'server', correct: true },
          { name: 'Камера-1', ip: '10.21.0.5',    type: 'phone',  correct: false },
          { name: 'Switch-1', ip: '192.168.1.1',  type: 'laptop', correct: false },
        ],
        explanation: '10.20.50.100 — в подсети 10.20.0.0/16. Первые два октета 10.20 совпадают.',
      },
      {
        senderIP: '10.55.3.7',
        mask:     '255.0.0.0',
        task:     'Маска /8 — подсеть 10.X.X.X. Кто в ней?',
        hint:     'ПОДСКАЗКА: При маске 255.0.0.0 — достаточно совпадения только первого октета!',
        devices: [
          { name: 'Сервер A', ip: '10.200.100.5', type: 'server', correct: true },
          { name: 'Клиент B', ip: '172.16.0.1',   type: 'laptop', correct: false },
          { name: 'Принтер', ip: '192.168.1.50',  type: 'phone',  correct: false },
        ],
        explanation: '10.200.100.5 — в подсети 10.0.0.0/8. Первый октет 10 совпадает с отправителем.',
      },
    ],
  },

  /* 
     УРОВЕНЬ 3 — ЭКСПЕРТ
     Маски /25, /26, /28 — нестандартные
  */
  {
    id:     'level3',
    name:   'ЭКСПЕРТ',
    color:  '#ff4d6d',
    desc:   'Нестандартные маски /25, /26, /28',
    rounds: [
      {
        senderIP: '192.168.1.10',
        mask:     '255.255.255.128',
        task:     'Маска /25 делит /24 пополам: 0–127 и 128–255. Отправитель в 0-127. Найди его соседа',
        hint:     'ПОДСКАЗКА: 192.168.1.10 → первая половина (0-127). Выбери тот, чей 4-й октет ≤ 127',
        devices: [
          { name: 'Хост-X',  ip: '192.168.1.63',  type: 'laptop', correct: true },
          { name: 'Хост-Y',  ip: '192.168.1.130', type: 'server', correct: false },
          { name: 'Хост-Z',  ip: '192.168.2.10',  type: 'phone',  correct: false },
        ],
        explanation: '192.168.1.63 входит в подсеть 192.168.1.0/25 (диапазон .0–.127). 4-й октет 63 < 128.',
      },
      {
        senderIP: '10.0.0.200',
        mask:     '255.255.255.192',
        task:     'Маска /26 делит на 4 части по 64 адреса. 200 входит в диапазон 192–255. Найди соседа',
        hint:     'ПОДСКАЗКА: /26 = 64 адреса в блоке. 200 ÷ 64 = блок 192–255. Ищи адрес от 192 до 255',
        devices: [
          { name: 'Хост-A', ip: '10.0.0.210', type: 'server', correct: true },
          { name: 'Хост-B', ip: '10.0.0.130', type: 'laptop', correct: false },
          { name: 'Хост-C', ip: '10.0.1.200', type: 'phone',  correct: false },
        ],
        explanation: '10.0.0.210 — в том же блоке /26 (192–255). Оба адреса попадают в 10.0.0.192/26.',
      },
      {
        senderIP: '172.16.0.5',
        mask:     '255.255.255.240',
        task:     'Маска /28 — блоки по 16 адресов. Адрес .5 в блоке 0–15. Найди соседа',
        hint:     'ПОДСКАЗКА: /28 = 16 адресов в блоке. 5 ÷ 16 = блок 0–15. Выбери адрес в диапазоне 0–15',
        devices: [
          { name: 'SRV-1',   ip: '172.16.0.14', type: 'server', correct: true },
          { name: 'SRV-2',   ip: '172.16.0.17', type: 'server', correct: false },
          { name: 'Client',  ip: '172.16.0.32', type: 'laptop', correct: false },
        ],
        explanation: '172.16.0.14 — в блоке 172.16.0.0/28 (адреса 0–15). Оба устройства в одном блоке /28.',
      },
    ],
  },
];


/* 4. ВСПОМОГАТЕЛЬНЫЕ IP-ФУНКЦИИ */

// Разбить IP на массив чисел: '192.168.1.10' → [192, 168, 1, 10]
function parseIP(ip) {
  return ip.split('.').map(Number);
}

// Применить маску AND к IP: вычислить адрес подсети
function getNetworkAddress(ip, mask) {
  const ipArr   = parseIP(ip);
  const maskArr = parseIP(mask);
  return ipArr.map((oct, i) => oct & maskArr[i]).join('.');
}

// Проверить, находится ли device.ip в той же подсети что и senderIP при данной маске
function inSameSubnet(senderIP, deviceIP, mask) {
  return getNetworkAddress(senderIP, mask) === getNetworkAddress(deviceIP, mask);
}

// Красивое отображение адреса подсети
function subnetDisplay(senderIP, mask) {
  const net = getNetworkAddress(senderIP, mask);
  const bits = parseIP(mask).reduce((acc, oct) => acc + oct.toString(2).replace(/0/g, '').length, 0);
  return `${net}/${bits}`;
}

// Случайный порядок вариантов (устройств) на поле
function shuffleDevicesCopy(devices) {
  const arr = devices.map(d => ({ ...d }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


/* 5. ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ */
const screens = {
  menu:   document.getElementById('s-menu'),
  intro:  document.getElementById('s-intro'),
  game:   document.getElementById('s-game'),
  result: document.getElementById('s-result'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}


/* 6. СОСТОЯНИЕ ИГРЫ */
const state = {
  currentLevel:    null,   // объект уровня из LEVELS
  currentRoundIdx: 0,      // индекс текущего раунда
  displayDevices:  null,   // копия round.devices в случайном порядке для текущего раунда
  score:           0,
  lives:           3,
  correctCount:    0,
  errorCount:      0,
  errors:          [],     // [{question, yourAnswer, correctAnswer, explanation}]
  busy:            false,  // блокировка кликов во время анимации
  startedAtMs:     0,
};
const IS_FIREFOX = /firefox/i.test(navigator.userAgent);


/* ПИКСЕЛЬНЫЕ СЕРДЕЧКИ (как в сортировщике) */
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
  const PIXEL_SIZE = 3;
  const COLS = HEART_GRID[0].length;
  const ROWS = HEART_GRID.length;
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

function updateHearts(currentLives, maxLives) {
  const container = document.getElementById('h-hearts');
  if (!container) return;
  while (container.children.length < maxLives) {
    const heartCanvas = document.createElement('canvas');
    heartCanvas.className = 'px-heart-canvas';
    container.appendChild(heartCanvas);
  }
  while (container.children.length > maxLives) {
    container.removeChild(container.lastChild);
  }
  Array.from(container.children).forEach((heartCanvas, index) => {
    const isLost = index >= currentLives;
    drawHeart(heartCanvas, isLost);
    heartCanvas.style.opacity = isLost ? '0.3' : '1';
  });
}

function animateHeartLoss(newLives, maxLives) {
  const container = document.getElementById('h-hearts');
  if (!container) return;
  const dyingHeart = container.children[newLives];
  if (dyingHeart) {
    dyingHeart.classList.add('do-heart-pop');
    setTimeout(() => dyingHeart.classList.remove('do-heart-pop'), 380);
  }
  updateHearts(newLives, maxLives);
}

/* 7. HUD */
function updateHUD() {
  const total = state.currentLevel.rounds.length;

  document.getElementById('h-score').textContent = state.score;
  document.getElementById('h-round').textContent = `${state.currentRoundIdx + 1}/${total}`;
  document.getElementById('h-lname').textContent = state.currentLevel.name;

  const pct = (state.currentRoundIdx / total) * 100;
  document.getElementById('h-bar').style.width = pct + '%';

  updateHearts(state.lives, 3);
}


/* 8. ТОСТЫ */
function showToast(msg, type = 'info', duration = 2200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s';
    setTimeout(() => el.remove(), 400);
  }, duration);
}


/* 9. МЕНЮ */
function buildMenu() {
  const container = document.getElementById('level-cards');
  container.innerHTML = '';

  LEVELS.forEach(lvl => {
    const card = document.createElement('div');
    card.className = 'level-card';
    card.style.setProperty('--lv-color', lvl.color);
    card.innerHTML = `
      <div class="level-card-num">${lvl.id.replace('level', '')}</div>
      <div class="level-card-name">${lvl.name}</div>
      <div class="level-card-desc">${lvl.desc}</div>
      <div class="level-card-rounds pixel-text">${lvl.rounds.length} РАУНДА</div>
    `;
    card.addEventListener('click', () => {
      soundClick();
      startLevel(lvl);
    });
    container.appendChild(card);
  });
}


/* 10. ВСТУПЛЕНИЕ К УРОВНЮ */
function showIntro(round, levelName) {
  const subnet = subnetDisplay(round.senderIP, round.mask);

  document.getElementById('intro-lvl-name').textContent = levelName;
  document.getElementById('intro-sender').textContent   = round.senderIP;
  document.getElementById('intro-mask').textContent     = round.mask;
  document.getElementById('intro-subnet').textContent   = subnet;
  document.getElementById('intro-task').textContent     = round.task;
  document.getElementById('intro-hint').textContent     = round.hint;

  showScreen('intro');
}


/* 11. ИГРОВОЕ ПОЛЕ */

// Позиции для устройств на поле (правая часть экрана)
// Возвращает [x%, y%] от размеров game-field
function getDevicePositions(count) {
  if (count === 3) return [
    [72, 22],
    [82, 52],
    [68, 78],
  ];
  if (count === 4) return [
    [70, 15],
    [85, 38],
    [82, 62],
    [68, 82],
  ];
  // default
  return [[70, 30], [80, 60], [65, 80]];
}

function buildGameField(round) {
  const field   = document.getElementById('game-field');
  const devArea = document.getElementById('devices-area');
  const svg     = document.getElementById('network-svg');
  const packet  = document.getElementById('packet');
  const devices = state.displayDevices;

  devArea.innerHTML = '';
  svg.innerHTML     = '';
  svg.style.pointerEvents = 'none';
  packet.style.opacity = '0';
  packet.className  = 'packet';
  packet.style.pointerEvents = 'none';

  // Отправитель
  const senderLabel = document.getElementById('sender-ip-label');
  senderLabel.textContent = round.senderIP;

  // Позиции устройств
  const positions = getDevicePositions(devices.length);

  // Создание устройства
  devices.forEach((dev, i) => {
    const [xPct, yPct] = positions[i];

    const node = document.createElement('div');
    node.className = 'device-node';
    node.style.left = xPct + '%';
    node.style.top  = yPct + '%';
    node.dataset.idx = i;

    // Иконка
    const typeClass = dev.type === 'server' ? 'server-icon'
                    : dev.type === 'phone'  ? 'phone-icon'
                    : 'laptop-icon';
    node.innerHTML = `
      <div class="device-icon ${typeClass}">
        <div class="device-body">
          <div class="device-screen"></div>
          <div class="device-base"></div>
        </div>
      </div>
      <div class="device-label">
        <div class="device-name pixel-text">${dev.name}</div>
        <div class="device-ip pixel-text">${dev.ip}</div>
      </div>
    `;

    // Клик
    node.addEventListener('click', () => handleDeviceClick(i, round));
    devArea.appendChild(node);

    // Линия от отправителя к устройству
    drawLine(svg, i, positions[i], devices.length);
  });

  // Обновляем task panel
  document.getElementById('t-sender').textContent = round.senderIP;
  document.getElementById('t-mask').textContent   = round.mask;
  document.getElementById('t-subnet').textContent = subnetDisplay(round.senderIP, round.mask);
  document.getElementById('t-question').textContent = round.task;
}

// SVG-линия от отправителя к i-му устройству
function drawLine(svg, devIdx, [xPct, yPct], count) {
  const field  = document.getElementById('game-field');
  const sender = document.getElementById('sender-node');

  // Центр отправителя
  const sRect = sender.getBoundingClientRect();
  const fRect = field.getBoundingClientRect();

  const sx = sRect.right  - fRect.left;
  const sy = sRect.top + sRect.height / 2 - fRect.top;

  // Позиция устройства (в %)
  const dx = fRect.width  * xPct / 100;
  const dy = fRect.height * yPct / 100;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', sx);
  line.setAttribute('y1', sy);
  line.setAttribute('x2', dx);
  line.setAttribute('y2', dy);
  line.setAttribute('pointer-events', 'none');
  line.classList.add('network-line');
  line.id = `line-${devIdx}`;
  svg.appendChild(line);
}


/* 12. МЕХАНИКА — КЛИК ПО УСТРОЙСТВУ */
function handleDeviceClick(devIdx, round) {
  if (state.busy) return;
  state.busy = true;
  soundClick();

  const dev      = state.displayDevices[devIdx];
  const nodes    = document.querySelectorAll('.device-node');
  const node     = nodes[devIdx];
  const line     = document.getElementById(`line-${devIdx}`);

  if (dev.correct) {
    // ПРАВИЛЬНО
    soundPacketFly();
    animatePacket(devIdx, () => {
      soundCorrect();
      state.score += 100;
      state.correctCount++;
      line.classList.add('correct-final');
      node.classList.add('correct');
      showToast(`✓ ВЕРНО! +100 очков — ${round.explanation.slice(0, 60)}...`, 'ok', 3000);
      updateHUD();
      setTimeout(() => nextRound(), 2000);
    });

  } else {
    // НЕВЕРНО
    soundWrong();
    state.lives--;
    state.errorCount++;
    animateHeartLoss(state.lives, 3);
    line.classList.add('wrong');
    node.classList.add('wrong-choice');

    // Показываем правильный ответ
    const correctIdx  = state.displayDevices.findIndex(d => d.correct);
    const correctNode = nodes[correctIdx];
    const correctLine = document.getElementById(`line-${correctIdx}`);

    if (IS_FIREFOX) {
      setTimeout(() => {
        correctNode.classList.add('correct');
        correctLine.classList.add('correct-final');
      }, 650);
    } else {

      animatePacketWrong(devIdx, correctIdx, () => {
        correctNode.classList.add('correct');
        correctLine.classList.add('correct-final');
      });
    }

    state.errors.push({
      question:    `Раунд: ${round.senderIP} / ${round.mask}`,
      yourAnswer:  dev.ip,
      correctAnswer: state.displayDevices[correctIdx].ip,
      explanation: round.explanation,
    });

    const subnet = subnetDisplay(round.senderIP, round.mask);
    showToast(`✗ Неверно! ${dev.ip} не в подсети ${subnet}`, 'err', 3500);

    if (state.lives <= 0) {
      setTimeout(() => endGame(false), 2200);
    } else {
      setTimeout(() => nextRound(), 2500);
    }
  }
}


/* 13. АНИМАЦИЯ ПАКЕТА */
function getSenderCenter() {
  const field  = document.getElementById('game-field');
  const sender = document.getElementById('sender-node');
  const sRect  = sender.getBoundingClientRect();
  const fRect  = field.getBoundingClientRect();
  return {
    x: sRect.right - fRect.left - 20,
    y: sRect.top + sRect.height / 2 - fRect.top,
  };
}

function getDeviceCenter(devIdx) {
  const nodes = document.querySelectorAll('.device-node');
  const node  = nodes[devIdx];
  const field = document.getElementById('game-field');
  const nRect = node.getBoundingClientRect();
  const fRect = field.getBoundingClientRect();
  return {
    x: nRect.left + nRect.width / 2  - fRect.left,
    y: nRect.top  + nRect.height / 2 - fRect.top,
  };
}

function animatePacket(devIdx, onDone) {
  const packet = document.getElementById('packet');
  const from   = getSenderCenter();
  const to     = getDeviceCenter(devIdx);

  packet.className = 'packet';
  packet.style.left = from.x + 'px';
  packet.style.top  = from.y + 'px';
  packet.style.opacity = '1';

  requestAnimationFrame(() => {
    packet.classList.add('flying', 'correct-packet');
    packet.style.left = to.x + 'px';
    packet.style.top  = to.y + 'px';
  });

  setTimeout(() => {
    packet.style.opacity = '0';
    onDone();
  }, 650);
}

function animatePacketWrong(wrongIdx, correctIdx, onShowCorrect) {
  const packet = document.getElementById('packet');
  const from   = getSenderCenter();
  const to     = getDeviceCenter(wrongIdx);

  packet.className = 'packet';
  packet.style.left = from.x + 'px';
  packet.style.top  = from.y + 'px';
  packet.style.opacity = '1';

  requestAnimationFrame(() => {
    packet.classList.add('flying', 'wrong-packet');
    packet.style.left = to.x + 'px';
    packet.style.top  = to.y + 'px';
  });

  setTimeout(() => {
    packet.style.opacity = '0';
    onShowCorrect();
  }, 650);
}


/* 14. УПРАВЛЕНИЕ РАУНДАМИ */
function startLevel(level) {
  state.currentLevel    = level;
  state.currentRoundIdx = 0;
  state.score           = 0;
  state.lives           = 3;
  state.correctCount    = 0;
  state.errorCount      = 0;
  state.errors          = [];
  state.startedAtMs     = Date.now();

  pingGame('network');
  soundStart();
  startRound();
}

function startRound() {
  const round = state.currentLevel.rounds[state.currentRoundIdx];
  state.busy  = false;

  // Показываем вступление, затем через секунду игру
  showIntro(round, state.currentLevel.name);
}

function beginRound() {
  const round = state.currentLevel.rounds[state.currentRoundIdx];
  state.displayDevices = shuffleDevicesCopy(round.devices);
  showScreen('game');

  // Строим поле с небольшой задержкой
  setTimeout(() => {
    buildGameField(round);
    updateHUD();
  }, 50);
}

function nextRound() {
  state.currentRoundIdx++;
  const total = state.currentLevel.rounds.length;

  if (state.currentRoundIdx >= total) {
    endGame(true);
  } else {
    state.busy = false;
    // Показываем вступление следующего раунда
    const round = state.currentLevel.rounds[state.currentRoundIdx];
    showIntro(round, state.currentLevel.name);
  }
}


/* 15. КОНЕЦ ИГРЫ */
function endGame(won) {
  if (won) soundWin(); else soundLose();

  // Отправляем результат и при победе, и при проигрыше: попытка должна
  // попасть в историю в любом случае. За полный проигрыш начисляется 0 очков —
  // очки считает сервер, клиент лишь сообщает статистику раундов.
  {
    const elapsedMs = Math.max(0, Date.now() - (state.startedAtMs || Date.now()));
    submitScore('network', {
      level_id: state.currentLevel?.id || 'level1',
      result: won ? 'win' : 'lose',
      correct: state.correctCount,
      wrong: state.errorCount,
      elapsed_ms: elapsedMs,
    }).then(res => {
      if (!res) return;
      if (typeof res.total_game_score === 'number' && res.score > 0) {
        showToast(`🏆 Очки добавлены! Всего в игре: ${res.total_game_score}`, 'ok', 3000);
      } else if (res.is_record) {
        showToast('🏆 Новый рекорд сохранён!', 'ok', 3000);
      }
    });
    const lbEl = document.getElementById('lb-network');
    if (lbEl) renderLeaderboard(lbEl, 'network', 5);
  }

  const total = state.currentLevel.rounds.length;
  const acc   = total > 0 ? Math.round(state.correctCount / total * 100) : 0;

  const titleEl = document.getElementById('r-title');
  if (won) {
    titleEl.textContent = state.errorCount === 0
      ? '[ PERFECT SCORE! ]'
      : '[ УРОВЕНЬ ПРОЙДЕН ]';
    titleEl.style.color = state.errorCount === 0 ? 'var(--green)' : 'var(--cyan)';
  } else {
    titleEl.textContent = '[ GAME OVER ]';
    titleEl.style.color = 'var(--pink)';
  }

  document.getElementById('r-score').textContent   = state.score;
  document.getElementById('r-correct').textContent = state.correctCount;
  document.getElementById('r-errors').textContent  = state.errorCount;
  document.getElementById('r-acc').textContent     = acc + '%';

  // Разбор ошибок
  const reviewEl = document.getElementById('r-review');
  const listEl   = document.getElementById('r-error-list');
  listEl.innerHTML = '';
  if (state.errors.length > 0) {
    reviewEl.style.display = 'block';
    state.errors.forEach(e => {
      const item = document.createElement('div');
      item.className = 'error-item';
      item.innerHTML = `
        <strong>${e.question}</strong><br/>
        Твой ответ: <span style="color:var(--pink)">${e.yourAnswer}</span> →
        Правильно: <span style="color:var(--green)">${e.correctAnswer}</span>
        <span class="error-explain">${e.explanation}</span>
      `;
      listEl.appendChild(item);
    });
  } else {
    reviewEl.style.display = 'none';
  }

  showScreen('result');
}


/* 16. КНОПКИ */
// Кнопка старта раунда (на экране intro)
document.getElementById('btn-start-level').addEventListener('click', () => {
  soundClick();
  beginRound();
});

// ESC — назад в меню
document.getElementById('btn-esc').addEventListener('click', () => {
  soundClick();
  showScreen('menu');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    soundClick();
    if (screens.menu.classList.contains('active')) {
      window.location.href = '../../index.html';
    } else {
      showScreen('menu');
    }
  }
});

// Результат — повтор
document.getElementById('btn-retry').addEventListener('click', () => {
  soundClick();
  startLevel(state.currentLevel);
});

// Результат — меню
document.getElementById('btn-menu-res').addEventListener('click', () => {
  soundClick();
  showScreen('menu');
});


/* 17. ЗАПУСК */
function init() {
  buildMenu();
  showScreen('menu');

  const lbEl = document.getElementById('lb-network');
  if (lbEl) renderLeaderboard(lbEl, 'network', 5);
}

init();
