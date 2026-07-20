<?php
require_once dirname(__DIR__) . '/includes/auth.php';

if (!isLoggedIn()) {
    header('Location: login.php?redirect=profile.php');
    exit;
}

$user    = getCurrentUser();
$isNew   = isset($_GET['new']);
$saved   = false;
$saveErr = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update') {
    $result = updateProfile((int)$user['id'], [
        'bio'           => $_POST['bio']           ?? '',
        'favorite_lang' => $_POST['favorite_lang'] ?? '',
        'favorite_game' => $_POST['favorite_game'] ?? '',
        'avatar_emoji'  => $_POST['avatar_emoji']  ?? 'avatar1',
    ]);
    if (isset($result['ok'])) {
        $saved = true;
        $user  = getCurrentUser(); // обновляем
    } else {
        $saveErr = $result['error'];
    }
}

// Считаем статистику из Postgres
$allScores  = readScores();
$userId     = (int)$user['id'];

$gamesPlayed = (int)($user['games_played'] ?? 0); // счётчик запусков из ping-game

$bestPerGame = [];
foreach ($allScores as $entry) {
    if ((int)$entry['user_id'] === $userId) {
        $gid = $entry['game_id'];
        if (!isset($bestPerGame[$gid]) || (int)$entry['score'] > $bestPerGame[$gid]) {
            $bestPerGame[$gid] = (int)$entry['score'];
        }
    }
}
$bestScore = array_sum($bestPerGame);

$gameLabels = [
    'sorter'      => 'Сортировщик',
    'network'     => 'Сетевой маршрут',
    'millionaire' => 'Кто хочет стать программистом',
];
$gameColors = [
    'total'       => '#00e5ff',
    'sorter'      => '#39ff14',
    'network'     => '#f5d800',
    'millionaire' => '#ff4d6d',
];

$userScoreEntries = [];
foreach ($allScores as $entry) {
    $gameId = (string)($entry['game_id'] ?? '');
    if ((int)($entry['user_id'] ?? 0) !== $userId || !isset($gameLabels[$gameId])) {
        continue;
    }
    $userScoreEntries[] = $entry;
}

usort($userScoreEntries, static function (array $a, array $b): int {
    $cmp = strcmp((string)($a['created_at'] ?? ''), (string)($b['created_at'] ?? ''));
    if ($cmp !== 0) return $cmp;
    return strcmp((string)($a['updated_at'] ?? ''), (string)($b['updated_at'] ?? ''));
});

function gc_sample_progress_series(array $series, int $maxPoints = 28): array {
    $count = count($series);
    if ($count <= $maxPoints) return $series;
    $sampled = [];
    for ($i = 0; $i < $maxPoints; $i++) {
        $index = (int) round(($i * ($count - 1)) / ($maxPoints - 1));
        $sampled[] = $series[$index];
    }
    return $sampled;
}

$progressAttempts = 0;
$progressSeriesFull = ['total' => []];
$progressBestByGame = array_fill_keys(array_keys($gameLabels), 0);
$progressAttemptsByGame = array_fill_keys(array_keys($gameLabels), 0);
$progressAttemptedGames = array_fill_keys(array_keys($gameLabels), false);
foreach (array_keys($gameLabels) as $gid) {
    $progressSeriesFull[$gid] = [];
}

foreach ($userScoreEntries as $entry) {
    $gameId = (string)$entry['game_id'];
    $score  = max(0, (int)($entry['score'] ?? 0));

    $progressAttempts++;
    $progressAttemptsByGame[$gameId]++;
    $progressAttemptedGames[$gameId] = true;

    if ($score > $progressBestByGame[$gameId]) {
        $progressBestByGame[$gameId] = $score;
    }

    $totalBest = array_sum($progressBestByGame);
    $progressSeriesFull['total'][] = ['x' => $progressAttempts, 'y' => $totalBest];

    foreach ($progressBestByGame as $gid => $bestValue) {
        $progressSeriesFull[$gid][] = ['x' => $progressAttempts, 'y' => $bestValue];
    }
}

$progressChartSeries = [];
if ($progressAttempts > 0) {
    $progressChartSeries[] = [
        'id'       => 'total',
        'name'     => 'Общий счёт',
        'color'    => $gameColors['total'],
        'current'  => $bestScore,
        'attempts' => $progressAttempts,
        'points'   => gc_sample_progress_series($progressSeriesFull['total']),
    ];

    foreach ($gameLabels as $gid => $label) {
        if (!$progressAttemptedGames[$gid]) continue;
        $progressChartSeries[] = [
            'id'       => $gid,
            'name'     => $label,
            'color'    => $gameColors[$gid],
            'current'  => $progressBestByGame[$gid],
            'attempts' => $progressAttemptsByGame[$gid],
            'points'   => gc_sample_progress_series($progressSeriesFull[$gid]),
        ];
    }
}

$progressChartData = [
    'attempts' => $progressAttempts,
    'series'   => $progressChartSeries,
];

$avatars  = ['avatar1','avatar2','avatar3','avatar4','avatar5'];
$langs    = ['','Python','C++','JavaScript','Java','Go','Rust','TypeScript','C#','PHP','Kotlin'];
$games    = ['','Кто хочет стать программистом','Сетевой маршрут','Сортировщик'];
$regDate  = date('d.m.Y', strtotime($user['created_at']));
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title><?= htmlspecialchars($user['nickname']) ?> — Профиль — Game Code</title>
  <link rel="icon" href="../../img/ICON.PNG" type="image/png">
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('../css/style.css', 'css/style.css'), ENT_QUOTES, 'UTF-8') ?>"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('../css/pages.css', 'css/pages.css'), ENT_QUOTES, 'UTF-8') ?>"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('../css/auth.css', 'css/auth.css'), ENT_QUOTES, 'UTF-8') ?>"/>
  <link rel="stylesheet" href="../css/mobile.css"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <script>window.AUTH_ROOT = '../';</script>
</head>
<body>

  <div class="overlay" id="overlay"></div>

  <nav class="sidebar" id="sidebar">
    <button class="sidebar-close" id="sidebarClose">х</button>
    <div class="sidebar-logo">
      <span class="pixel-text">GAME</span><span class="pixel-text accent">CODE</span>
    </div>
    <ul class="sidebar-nav">
      <li><a href="../index.html"    class="sidebar-link" >Все игры</a></li>
      <li><a href="leaderboard.html"      class="sidebar-link" >Лидеры</a></li>
      <li><a href="how-to-play.html" class="sidebar-link" >Как играть</a></li>
      <li><a href="theory.html"      class="sidebar-link" >Теория</a></li>
      <li><a href="about.html"       class="sidebar-link" >О нас</a></li>
    </ul>
    <div class="sidebar-footer">
      <span>V2.0 — GameCode</span>
    </div>
  </nav>

  <header class="header">
    <div class="header-left">
      <button class="menu-btn" id="menuBtn" aria-label="Открыть меню">
        <span></span><span></span><span></span>
      </button>
      <div class="site-title">
        <a href="../index.html" class="logo pixel-text" style="text-decoration:none;">GAME<span class="accent">CODE</span></a>
        <p class="tagline pixel-text">Изучай программирование в играх</p>
      </div>
    </div>
    <div class="header-right">
      <div id="auth-widget"></div>
    </div>
  </header>

  <section class="page-hero">
    <div class="page-hero-inner">
      <p class="breadcrumb"><a href="../index.html">ГЛАВНАЯ</a> / <span class="accent">ПРОФИЛЬ</span></p>
      <div class="profile-hero-avatar"><img src="../img/avatars/<?= htmlspecialchars($user['avatar_emoji']) ?>.png" alt="аватар" class="avatar-img avatar-img--hero"/></div>
      <h1 class="page-title accent"><?= htmlspecialchars($user['nickname']) ?></h1>
      <p class="page-subtitle pixel-text">ИГРОК С <?= $regDate ?></p>
    </div>
  </section>

  <main class="page-content" style="max-width:780px;">

    <?php if ($isNew): ?>
    <div class="auth-success pixel-text" style="margin-bottom:24px;">
       Добро пожаловать! Твой аккаунт создан. Заполни профиль!
    </div>
    <?php endif; ?>

    <?php if ($saved): ?>
    <div class="auth-success pixel-text" style="margin-bottom:24px;">
       Профиль сохранён!
    </div>
    <?php endif; ?>

    <?php if ($saveErr): ?>
    <div class="auth-error pixel-text" style="margin-bottom:24px;">
      ⚠ <?= htmlspecialchars($saveErr) ?>
    </div>
    <?php endif; ?>

    <!-- Статистика -->
    <div class="content-block cyan-accent" style="animation-delay:0s">
      <h2 class="block-title cyan">[ СТАТИСТИКА ]</h2>
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="pstat-val pixel-text yellow"><?= $gamesPlayed ?></div>
          <div class="pstat-label pixel-text">Игр сыграно</div>
        </div>
        <div class="profile-stat">
          <div class="pstat-val pixel-text green"><?= $bestScore ?></div>
          <div class="pstat-label pixel-text">Лучший счёт</div>
        </div>
        <div class="profile-stat">
          <div class="pstat-val pixel-text cyan"><?= $regDate ?></div>
          <div class="pstat-label pixel-text">Дата регистрации</div>
        </div>
      </div>
    </div>

    <div class="content-block green-accent" style="animation-delay:0.05s">
      <h2 class="block-title green">[ ПРОГРЕСС ПО ОЧКАМ ]</h2>

      <?php if ($progressAttempts > 0): ?>
      <div
        class="profile-progress"
        data-profile-chart='<?= htmlspecialchars(json_encode($progressChartData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8') ?>'
      >
        <div class="profile-progress-head">
          <p class="profile-progress-text pixel-text">Лучший результат растёт по мере прохождения игр</p>
          <div class="profile-progress-controls">
            <div class="profile-progress-chip pixel-text">ПОПЫТОК: <?= $progressAttempts ?></div>
            <div class="profile-progress-toggle" role="tablist" aria-label="Режим графика">
              <button type="button" class="profile-progress-toggle-btn pixel-text is-active" data-chart-mode="total">ОБЩИЙ</button>
              <button type="button" class="profile-progress-toggle-btn pixel-text" data-chart-mode="games">ПО ИГРАМ</button>
            </div>
          </div>
        </div>

        <div class="profile-progress-legend">
          <?php foreach ($progressChartSeries as $series): ?>
          <div class="profile-progress-legend-item pixel-text" data-series-id="<?= htmlspecialchars($series['id'], ENT_QUOTES, 'UTF-8') ?>">
            <span class="profile-progress-swatch" style="--swatch: <?= htmlspecialchars($series['color'], ENT_QUOTES, 'UTF-8') ?>"></span>
            <span><?= htmlspecialchars($series['name']) ?></span>
          </div>
          <?php endforeach; ?>
        </div>

        <div class="profile-progress-stage">
          <svg class="profile-progress-svg" viewBox="0 0 760 320" aria-label="График прогресса по очкам"></svg>
          <div class="profile-progress-tooltip pixel-text" hidden></div>
        </div>

        <div class="profile-progress-axis pixel-text">
          <span>СТАРТ</span>
          <span>ЛУЧШИЙ РЕЗУЛЬТАТ СЕЙЧАС</span>
        </div>

        <div class="profile-progress-cards">
          <?php foreach ($progressChartSeries as $series): ?>
          <div class="profile-progress-card" data-series-id="<?= htmlspecialchars($series['id'], ENT_QUOTES, 'UTF-8') ?>">
            <div class="profile-progress-card-top">
              <span class="profile-progress-swatch" style="--swatch: <?= htmlspecialchars($series['color'], ENT_QUOTES, 'UTF-8') ?>"></span>
              <span class="profile-progress-card-name pixel-text"><?= htmlspecialchars($series['name']) ?></span>
            </div>
            <div class="profile-progress-card-value pixel-text"><?= (int)$series['current'] ?></div>
            <div class="profile-progress-card-meta pixel-text">попыток: <?= (int)$series['attempts'] ?></div>
          </div>
          <?php endforeach; ?>
        </div>
      </div>
      <?php else: ?>
      <div class="profile-progress-empty pixel-text">
        Пока нет очков для графика. Сыграй в любую игру и здесь появится пиксельный прогресс.
      </div>
      <?php endif; ?>
    </div>

    <!-- О себе (только чтение если пусто, иначе показываем) -->
    <?php if (!empty($user['bio']) || !empty($user['favorite_lang'])): ?>
    <div class="content-block" style="animation-delay:0.1s">
      <h2 class="block-title">[ О СЕБЕ ]</h2>
      <?php if (!empty($user['bio'])): ?>
        <p class="block-text pixel-text"><?= nl2br(htmlspecialchars($user['bio'])) ?></p>
      <?php endif; ?>
      <?php if (!empty($user['favorite_lang'])): ?>
        <div class="profile-tags" style="margin-top:12px;">
          <span class="profile-tag cyan"> <?= htmlspecialchars($user['favorite_lang']) ?></span>
          <?php if (!empty($user['favorite_game'])): ?>
          <span class="profile-tag yellow"> <?= htmlspecialchars($user['favorite_game']) ?></span>
          <?php endif; ?>
        </div>
      <?php endif; ?>
    </div>
    <?php endif; ?>

    <!-- Редактирование профиля -->
    <div class="content-block accent-border" style="animation-delay:0.2s">
      <h2 class="block-title accent">[ РЕДАКТИРОВАТЬ ПРОФИЛЬ ]</h2>

      <form method="POST" class="auth-form profile-form">
        <input type="hidden" name="action" value="update"/>

        <div class="auth-field">
          <label class="auth-label pixel-text">// АВАТАР (выбери картинку)</label>
          <div class="avatar-picker" id="avatarPicker">
            <?php foreach ($avatars as $av): ?>
            <button
              type="button"
              class="avatar-opt <?= $user['avatar_emoji'] === $av ? 'selected' : '' ?>"
              data-emoji="<?= $av ?>"
            ><img src="../img/avatars/<?= $av ?>.png" alt="<?= $av ?>" class="avatar-img avatar-img--opt"/></button>
            <?php endforeach; ?>
          </div>
          <input type="hidden" name="avatar_emoji" id="avatarInput" value="<?= htmlspecialchars($user['avatar_emoji']) ?>"/>
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="bio">// О СЕБЕ</label>
          <textarea
            class="auth-input auth-textarea"
            id="bio"
            name="bio"
            placeholder="Расскажи пару слов о себе..."
            maxlength="300"
            rows="4"
          ><?= htmlspecialchars($user['bio']) ?></textarea>
          <p class="auth-hint pixel-text"><span id="bioCount"><?= strlen($user['bio']) ?></span>/300</p>
        </div>

        <div class="profile-form-row">
          <div class="auth-field">
            <label class="auth-label pixel-text" for="fav_lang">// ЛЮБИМЫЙ ЯЗЫК</label>
            <div class="auth-input-wrap">
              <select class="auth-input auth-select" id="fav_lang" name="favorite_lang">
                <?php foreach ($langs as $l): ?>
                <option value="<?= $l ?>" <?= $user['favorite_lang'] === $l ? 'selected' : '' ?>>
                  <?= $l ?: '— не выбрано —' ?>
                </option>
                <?php endforeach; ?>
              </select>
            </div>
          </div>

          <div class="auth-field">
            <label class="auth-label pixel-text" for="fav_game">// ЛЮБИМАЯ ИГРА</label>
            <div class="auth-input-wrap">
              <select class="auth-input auth-select" id="fav_game" name="favorite_game">
                <?php foreach ($games as $g): ?>
                <option value="<?= $g ?>" <?= $user['favorite_game'] === $g ? 'selected' : '' ?>>
                  <?= $g ?: '— не выбрано —' ?>
                </option>
                <?php endforeach; ?>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" class="auth-submit pixel-text">[ СОХРАНИТЬ ИЗМЕНЕНИЯ ]</button>
      </form>
    </div>

    <!-- Опасная зона: выход -->
    <div class="content-block" style="animation-delay:0.3s; border-color: rgba(255,77,109,0.3);">
      <h2 class="block-title pink">[ АККАУНТ ]</h2>
      <div class="profile-actions">
        <a href="../api/logout.php" class="auth-danger-btn pixel-text"
           onclick="return confirm('Выйти из аккаунта?')">
          [ ВЫЙТИ ]
        </a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <p class="pixel-text">GAME<span class="accent">CODE</span> &copy; 2026</p>
    <p class="footer-sub">Изучай программирование в играх</p>
  </footer>

  <script src="<?= htmlspecialchars(asset_url('../js/app.js', 'js/app.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
  <script src="<?= htmlspecialchars(asset_url('../js/auth.js', 'js/auth.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
  <script>
    // Пикер аватара
    document.querySelectorAll('.avatar-opt').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        const av = this.dataset.emoji;
        document.getElementById('avatarInput').value = av;
        // Обновляем hero аватар
        document.querySelector('.profile-hero-avatar .avatar-img--hero').src = '../img/avatars/' + av + '.png';
      });
    });

    // Счётчик символов bio
    const bioEl = document.getElementById('bio');
    const cntEl = document.getElementById('bioCount');
    bioEl.addEventListener('input', () => { cntEl.textContent = bioEl.value.length; });

    const progressRoot = document.querySelector('[data-profile-chart]');
    if (progressRoot) {
      const chartData = JSON.parse(progressRoot.dataset.profileChart);
      const svg = progressRoot.querySelector('.profile-progress-svg');
      const tooltip = progressRoot.querySelector('.profile-progress-tooltip');
      const toggleButtons = Array.from(progressRoot.querySelectorAll('[data-chart-mode]'));

      const NS = 'http://www.w3.org/2000/svg';
      const width = 760;
      const height = 320;
      const pad = { top: 18, right: 18, bottom: 34, left: 58 };
      const innerWidth = width - pad.left - pad.right;
      const innerHeight = height - pad.top - pad.bottom;

      const niceMax = (value) => {
        if (value <= 10) return 10;
        const power = 10 ** Math.floor(Math.log10(value));
        return Math.ceil((value / power) * 4) * power / 4;
      };

      const make = (name, attrs = {}) => {
        const el = document.createElementNS(NS, name);
        Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
        return el;
      };

      const seriesByMode = {
        total: chartData.series.filter(series => series.id === 'total'),
        games: chartData.series.filter(series => series.id !== 'total')
      };
      let currentMode = 'total';

      const setActiveModeUi = (mode) => {
        progressRoot.dataset.chartMode = mode;
        toggleButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.chartMode === mode));
        const visibleIds = new Set(seriesByMode[mode].map(series => series.id));
        progressRoot.querySelectorAll('.profile-progress-legend-item, .profile-progress-card').forEach(el => {
          el.classList.toggle('is-dimmed', !visibleIds.has(el.dataset.seriesId));
        });
      };

      const hideTooltip = () => {
        tooltip.hidden = true;
      };

      const showTooltip = (event, series, point) => {
        tooltip.hidden = false;
        tooltip.innerHTML = `<strong>${series.name}</strong><span>Попытка ${point.x}</span><span>${point.y.toLocaleString('ru-RU')} очков</span>`;
        const stageRect = progressRoot.querySelector('.profile-progress-stage').getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = event.clientX - stageRect.left + 14;
        let top = event.clientY - stageRect.top - tooltipRect.height - 14;
        if (left + tooltipRect.width > stageRect.width - 8) left = stageRect.width - tooltipRect.width - 8;
        if (top < 8) top = event.clientY - stageRect.top + 18;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      };

      const renderChart = (mode) => {
        currentMode = mode;
        setActiveModeUi(mode);
        hideTooltip();
        svg.innerHTML = '';

        const visibleSeries = seriesByMode[mode];
        if (!visibleSeries.length) return;

        const allPoints = visibleSeries.flatMap(series => series.points);
        const maxX = Math.max(...allPoints.map(point => point.x), 1);
        const maxYRaw = Math.max(...allPoints.map(point => point.y), 10);
        const maxY = niceMax(maxYRaw);

        const xFor = (x) => pad.left + ((x - 1) / Math.max(1, maxX - 1)) * innerWidth;
        const yFor = (y) => pad.top + innerHeight - (y / maxY) * innerHeight;

        svg.appendChild(make('rect', {
          x: pad.left,
          y: pad.top,
          width: innerWidth,
          height: innerHeight,
          class: 'profile-progress-frame'
        }));

        for (let i = 0; i <= 4; i++) {
          const value = (maxY / 4) * i;
          const y = yFor(value);
          svg.appendChild(make('line', {
            x1: pad.left,
            y1: y,
            x2: pad.left + innerWidth,
            y2: y,
            class: 'profile-progress-grid'
          }));

          const label = make('text', {
            x: pad.left - 10,
            y: y + 4,
            'text-anchor': 'end',
            class: 'profile-progress-label'
          });
          label.textContent = Math.round(value).toLocaleString('ru-RU');
          svg.appendChild(label);
        }

        const verticalSteps = Math.min(6, Math.max(1, maxX - 1));
        for (let i = 0; i <= verticalSteps; i++) {
          const x = pad.left + (innerWidth / Math.max(1, verticalSteps)) * i;
          svg.appendChild(make('line', {
            x1: x,
            y1: pad.top,
            x2: x,
            y2: pad.top + innerHeight,
            class: 'profile-progress-grid profile-progress-grid--v'
          }));
        }

        visibleSeries.forEach(series => {
          const points = series.points.map(point => `${xFor(point.x)},${yFor(point.y)}`).join(' ');
          svg.appendChild(make('polyline', {
            points,
            fill: 'none',
            stroke: series.color,
            'stroke-width': series.id === 'total' ? 5 : 3,
            'stroke-linecap': 'square',
            'stroke-linejoin': 'miter',
            class: 'profile-progress-line'
          }));

          series.points.forEach((point, pointIndex) => {
            const size = pointIndex === series.points.length - 1 ? 8 : 5;
            svg.appendChild(make('rect', {
              x: xFor(point.x) - size / 2,
              y: yFor(point.y) - size / 2,
              width: size,
              height: size,
              fill: series.color,
              class: 'profile-progress-point'
            }));

            const hoverTarget = make('circle', {
              cx: xFor(point.x),
              cy: yFor(point.y),
              r: 10,
              class: 'profile-progress-hit'
            });
            hoverTarget.addEventListener('mouseenter', (event) => showTooltip(event, series, point));
            hoverTarget.addEventListener('mousemove', (event) => showTooltip(event, series, point));
            hoverTarget.addEventListener('mouseleave', hideTooltip);
            svg.appendChild(hoverTarget);
          });
        });
      };

      toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => renderChart(btn.dataset.chartMode));
      });

      progressRoot.querySelector('.profile-progress-stage').addEventListener('mouseleave', hideTooltip);
      renderChart(currentMode);
    }
  </script>
</body>
</html>
