<?php
require_once __DIR__ . '/config.php';
requireAdmin();

$users = readUsersAdmin();
$games = readGames();
$log   = array_reverse(readAdminLog());

$totalUsers  = count($users);
$totalGames  = count($games);
$activeGames = count(array_filter($games, fn($g) => !$g['wip']));
$wipGames    = $totalGames - $activeGames;
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Dashboard — Admin — Game Code</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin.css', 'admin/admin.css'), ENT_QUOTES, 'UTF-8') ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// DASHBOARD</h1>
    <div class="adm-topbar-right">
      <span class="adm-time pixel" id="admTime"></span>
      <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
    </div>
  </div>

  <!-- Статы -->
  <div class="adm-stats-grid">
    <div class="adm-stat-card cyan">
      <div class="stat-icon">👥</div>
      <div class="stat-val pixel"><?= $totalUsers ?></div>
      <div class="stat-label pixel">ПОЛЬЗОВАТЕЛЕЙ</div>
    </div>
    <div class="adm-stat-card green">
      <div class="stat-icon">🎮</div>
      <div class="stat-val pixel"><?= $activeGames ?></div>
      <div class="stat-label pixel">АКТИВНЫХ ИГР</div>
    </div>
    <div class="adm-stat-card yellow">
      <div class="stat-icon">🚧</div>
      <div class="stat-val pixel"><?= $wipGames ?></div>
      <div class="stat-label pixel">В РАЗРАБОТКЕ</div>
    </div>
    <div class="adm-stat-card purple">
      <div class="stat-icon">📋</div>
      <div class="stat-val pixel"><?= count($log) ?></div>
      <div class="stat-label pixel">СОБЫТИЙ В ЛОГЕ</div>
    </div>
  </div>

  <div class="adm-two-col">

    <!-- Последние пользователи -->
    <div class="adm-panel">
      <div class="adm-panel-header">
        <span class="pixel">👥 ПОСЛЕДНИЕ ПОЛЬЗОВАТЕЛИ</span>
        <a href="users.php" class="adm-link pixel">ВСЕ →</a>
      </div>
      <table class="adm-table">
        <thead><tr><th>Аватар</th><th>Никнейм</th><th>Регистрация</th></tr></thead>
        <tbody>
          <?php foreach (array_slice(array_reverse($users), 0, 6) as $u): ?>
          <tr>
            <td>
              <img src="../img/avatars/<?= htmlspecialchars(adminAvatarFileKey($u)) ?>.png" alt="" class="adm-user-avatar" width="36" height="36" loading="lazy"/>
            </td>
            <td class="pixel"><?= htmlspecialchars($u['nickname']) ?></td>
            <td class="pixel dim"><?= htmlspecialchars(substr($u['created_at'], 0, 10)) ?></td>
          </tr>
          <?php endforeach; ?>
          <?php if (empty($users)): ?>
          <tr><td colspan="3" class="pixel dim" style="text-align:center">Нет пользователей</td></tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>

    <!-- Лог событий -->
    <div class="adm-panel">
      <div class="adm-panel-header">
        <span class="pixel">📋 ЛОГ СОБЫТИЙ</span>
        <a href="log.php" class="adm-link pixel">ВСЕ →</a>
      </div>
      <div class="adm-log-list">
        <?php foreach (array_slice($log, 0, 8) as $entry): ?>
        <div class="adm-log-item">
          <span class="log-time pixel"><?= htmlspecialchars($entry['time']) ?></span>
          <span class="log-action pixel"><?= htmlspecialchars($entry['action']) ?></span>
          <?php if ($entry['detail']): ?>
          <span class="log-detail pixel dim"><?= htmlspecialchars($entry['detail']) ?></span>
          <?php endif; ?>
        </div>
        <?php endforeach; ?>
        <?php if (empty($log)): ?>
        <div class="pixel dim" style="padding:16px;text-align:center">Лог пуст</div>
        <?php endif; ?>
      </div>
    </div>

  </div>

  <!-- Игры -->
  <div class="adm-panel" style="margin-top:24px">
    <div class="adm-panel-header">
      <span class="pixel">🎮 ИГРЫ</span>
      <a href="games.php" class="adm-link pixel">УПРАВЛЕНИЕ →</a>
    </div>
    <div class="adm-games-mini">
      <?php foreach ($games as $g): ?>
      <div class="adm-game-mini <?= $g['wip'] ? 'wip' : 'active' ?>">
        <span class="game-emoji"><?= htmlspecialchars($g['emoji']) ?></span>
        <span class="game-title pixel"><?= htmlspecialchars($g['title']) ?></span>
        <span class="game-status pixel"><?= $g['wip'] ? 'WIP' : 'LIVE' ?></span>
      </div>
      <?php endforeach; ?>
    </div>
  </div>

</div>
<script>
  function tick() {
    document.getElementById('admTime').textContent = new Date().toLocaleTimeString('ru-RU');
  }
  tick(); setInterval(tick, 1000);
</script>
</body>
</html>
