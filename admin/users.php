<?php
require_once __DIR__ . '/config.php';
requireAdmin();

$msg = ''; $msgType = '';

// Удаление пользователя
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    if ($_POST['action'] === 'delete' && !empty($_POST['user_id'])) {
        $uid   = (int)$_POST['user_id'];
        $users = readUsersAdmin();
        $nick  = '';
        $users = array_filter($users, function($u) use ($uid, &$nick) {
            if ((int)$u['id'] === $uid) { $nick = $u['nickname']; return false; }
            return true;
        });
        writeUsersAdmin(array_values($users));
        writeLog('Удалён пользователь', $nick);
        $msg = "Пользователь «{$nick}» удалён."; $msgType = 'success';
    }
    if ($_POST['action'] === 'ban' && !empty($_POST['user_id'])) {
        $uid   = (int)$_POST['user_id'];
        $users = readUsersAdmin();
        $nick  = '';
        foreach ($users as &$u) {
            if ((int)$u['id'] === $uid) {
                $u['banned'] = !empty($u['banned']) ? 0 : 1;
                $nick = $u['nickname'];
                $status = $u['banned'] ? 'заблокирован' : 'разблокирован';
                break;
            }
        } unset($u);
        writeUsersAdmin($users);
        writeLog("Пользователь {$status}", $nick);
        $msg = "Пользователь «{$nick}» {$status}."; $msgType = 'success';
    }
}

$users  = readUsersAdmin();
$search = trim($_GET['q'] ?? '');
if ($search) {
    $users = array_filter($users, fn($u) => stripos($u['nickname'], $search) !== false);
}
$users = array_reverse($users);
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Пользователи — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin.css', 'admin/admin.css'), ENT_QUOTES, 'UTF-8') ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// ПОЛЬЗОВАТЕЛИ</h1>
    <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
  </div>

  <?php if ($msg): ?>
  <div class="adm-alert adm-alert-<?= $msgType ?> pixel"><?= htmlspecialchars($msg) ?></div>
  <?php endif; ?>

  <!-- Поиск -->
  <form method="GET" class="adm-search-form">
    <div class="adm-input-wrap" style="max-width:360px">
      <span class="adm-ico">🔍</span>
      <input class="adm-input" type="text" name="q" placeholder="Поиск по нику..." value="<?= htmlspecialchars($search) ?>"/>
    </div>
    <button type="submit" class="adm-btn pixel">[ НАЙТИ ]</button>
    <?php if ($search): ?>
    <a href="users.php" class="adm-btn pixel">[ СБРОС ]</a>
    <?php endif; ?>
  </form>

  <div class="adm-panel">
    <div class="adm-panel-header">
      <span class="pixel">👥 ВСЕГО: <?= count($users) ?></span>
    </div>
    <table class="adm-table adm-table-full">
      <thead>
        <tr>
          <th>ID</th>
          <th>Аватар</th>
          <th>Никнейм</th>
          <th>Биография</th>
          <th>Язык</th>
          <th>Регистрация</th>
          <th>Статус</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($users as $u): ?>
        <tr class="<?= !empty($u['banned']) ? 'row-banned' : '' ?>">
          <td class="pixel dim"><?= (int)$u['id'] ?></td>
          <td>
            <img src="../img/avatars/<?= htmlspecialchars(adminAvatarFileKey($u)) ?>.png" alt="" class="adm-user-avatar" width="36" height="36" loading="lazy"/>
          </td>
          <td class="pixel"><?= htmlspecialchars($u['nickname']) ?></td>
          <td class="dim"><?= htmlspecialchars(substr($u['bio'] ?? '', 0, 40)) ?><?= strlen($u['bio'] ?? '') > 40 ? '...' : '' ?></td>
          <td class="pixel dim"><?= htmlspecialchars($u['favorite_lang'] ?? '—') ?></td>
          <td class="pixel dim"><?= htmlspecialchars(substr($u['created_at'], 0, 10)) ?></td>
          <td>
            <?php if (!empty($u['banned'])): ?>
            <span class="adm-badge banned pixel">БАН</span>
            <?php else: ?>
            <span class="adm-badge active pixel">OK</span>
            <?php endif; ?>
          </td>
          <td class="adm-actions">
            <form method="POST" style="display:inline">
              <input type="hidden" name="action" value="ban"/>
              <input type="hidden" name="user_id" value="<?= (int)$u['id'] ?>"/>
              <button type="submit" class="adm-btn-sm adm-btn-warn pixel"
                title="<?= !empty($u['banned']) ? 'Разблокировать' : 'Заблокировать' ?>">
                <?= !empty($u['banned']) ? '🔓' : '🔒' ?>
              </button>
            </form>
            <form method="POST" style="display:inline"
                  onsubmit="return confirm('Удалить «<?= htmlspecialchars($u['nickname'], ENT_QUOTES) ?>»? Это действие нельзя отменить.')">
              <input type="hidden" name="action" value="delete"/>
              <input type="hidden" name="user_id" value="<?= (int)$u['id'] ?>"/>
              <button type="submit" class="adm-btn-sm adm-btn-danger pixel">🗑</button>
            </form>
          </td>
        </tr>
        <?php endforeach; ?>
        <?php if (empty($users)): ?>
        <tr><td colspan="8" class="pixel dim" style="text-align:center;padding:24px">Нет пользователей</td></tr>
        <?php endif; ?>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>
