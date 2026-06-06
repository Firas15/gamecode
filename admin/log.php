<?php
require_once __DIR__ . '/config.php';
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'clear') {
    writeAdminLog([]);
    writeLog('Лог очищен администратором');
    header('Location: log.php'); exit;
}

$log = array_reverse(readAdminLog());
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Лог — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin.css', 'admin/admin.css'), ENT_QUOTES, 'UTF-8') ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// ЛОГ СОБЫТИЙ</h1>
    <div style="display:flex;gap:10px;align-items:center;">
      <form method="POST" onsubmit="return confirm('Очистить весь лог?')">
        <input type="hidden" name="action" value="clear"/>
        <button type="submit" class="adm-btn-danger pixel">[ ОЧИСТИТЬ ЛОГ ]</button>
      </form>
      <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
    </div>
  </div>

  <div class="adm-panel">
    <div class="adm-panel-header">
      <span class="pixel">📋 ВСЕГО ЗАПИСЕЙ: <?= count($log) ?></span>
    </div>
    <table class="adm-table adm-table-full">
      <thead><tr><th>#</th><th>Время</th><th>Событие</th><th>Подробности</th></tr></thead>
      <tbody>
        <?php foreach ($log as $i => $entry): ?>
        <tr>
          <td class="pixel dim"><?= count($log) - $i ?></td>
          <td class="pixel dim"><?= htmlspecialchars($entry['time']) ?></td>
          <td class="pixel"><?= htmlspecialchars($entry['action']) ?></td>
          <td class="dim"><?= htmlspecialchars($entry['detail'] ?? '') ?></td>
        </tr>
        <?php endforeach; ?>
        <?php if (empty($log)): ?>
        <tr><td colspan="4" class="pixel dim" style="text-align:center;padding:24px">Лог пуст</td></tr>
        <?php endif; ?>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>
