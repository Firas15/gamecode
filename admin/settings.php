<?php
require_once __DIR__ . '/config.php';
requireAdmin();

$msg = ''; $msgType = '';
$configFile = __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'change_password') {
        $current = $_POST['current_pass'] ?? '';
        $new1    = $_POST['new_pass'] ?? '';
        $new2    = $_POST['new_pass2'] ?? '';
        if ($current !== ADMIN_PASSWORD) {
            $msg = 'Текущий пароль неверный'; $msgType = 'error';
        } elseif (strlen($new1) < 6) {
            $msg = 'Новый пароль: минимум 6 символов'; $msgType = 'error';
        } elseif ($new1 !== $new2) {
            $msg = 'Пароли не совпадают'; $msgType = 'error';
        } else {
            $content = file_get_contents($configFile);
            $content = preg_replace(
                "/define\('ADMIN_PASSWORD',\s*'.*?'\)/",
                "define('ADMIN_PASSWORD', '" . addslashes($new1) . "')",
                $content
            );
            file_put_contents($configFile, $content);
            writeLog('Изменён пароль администратора');
            $msg = 'Пароль успешно изменён!'; $msgType = 'success';
        }
    }

    if ($action === 'change_login') {
        $newLogin = trim($_POST['new_login'] ?? '');
        if (strlen($newLogin) < 3) {
            $msg = 'Логин: минимум 3 символа'; $msgType = 'error';
        } else {
            $content = file_get_contents($configFile);
            $content = preg_replace(
                "/define\('ADMIN_LOGIN',\s*'.*?'\)/",
                "define('ADMIN_LOGIN', '" . addslashes($newLogin) . "')",
                $content
            );
            file_put_contents($configFile, $content);
            writeLog('Изменён логин администратора', $newLogin);
            $msg = 'Логин успешно изменён!'; $msgType = 'success';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Настройки — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin.css', 'admin/admin.css'), ENT_QUOTES, 'UTF-8') ?>"/>
</head>
<body>
<?php include __DIR__ . '/sidebar.php'; ?>
<div class="adm-main">
  <div class="adm-topbar">
    <h1 class="adm-page-title pixel">// НАСТРОЙКИ</h1>
    <a href="logout.php" class="adm-btn-danger pixel">[ ВЫЙТИ ]</a>
  </div>

  <?php if ($msg): ?>
  <div class="adm-alert adm-alert-<?= $msgType ?> pixel"><?= htmlspecialchars($msg) ?></div>
  <?php endif; ?>

  <div class="adm-two-col">
    <!-- Смена логина -->
    <div class="adm-panel">
      <div class="adm-panel-header"><span class="pixel">🔑 ИЗМЕНИТЬ ЛОГИН АДМИНА</span></div>
      <form method="POST" style="padding:20px 24px;">
        <input type="hidden" name="action" value="change_login"/>
        <div class="adm-field">
          <label class="adm-label pixel">// ТЕКУЩИЙ ЛОГИН</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="text" value="<?= htmlspecialchars(ADMIN_LOGIN) ?>" disabled/>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// НОВЫЙ ЛОГИН</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="text" name="new_login" placeholder="новый логин" required minlength="3"/>
          </div>
        </div>
        <button type="submit" class="adm-btn-primary pixel" style="margin-top:8px">[ СОХРАНИТЬ ЛОГИН ]</button>
      </form>
    </div>

    <!-- Смена пароля -->
    <div class="adm-panel">
      <div class="adm-panel-header"><span class="pixel">🔐 ИЗМЕНИТЬ ПАРОЛЬ АДМИНА</span></div>
      <form method="POST" style="padding:20px 24px;">
        <input type="hidden" name="action" value="change_password"/>
        <div class="adm-field">
          <label class="adm-label pixel">// ТЕКУЩИЙ ПАРОЛЬ</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="password" name="current_pass" required/>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// НОВЫЙ ПАРОЛЬ</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="password" name="new_pass" required minlength="6"/>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// ПОВТОР ПАРОЛЯ</label>
          <div class="adm-input-wrap">
            <input class="adm-input" type="password" name="new_pass2" required minlength="6"/>
          </div>
        </div>
        <button type="submit" class="adm-btn-primary pixel" style="margin-top:8px">[ СОХРАНИТЬ ПАРОЛЬ ]</button>
      </form>
    </div>
  </div>

  <!-- Инфо о системе -->
  <div class="adm-panel" style="margin-top:20px">
    <div class="adm-panel-header"><span class="pixel">📊 ИНФОРМАЦИЯ О СИСТЕМЕ</span></div>
    <div style="padding:20px 24px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
      <?php
      $info = [
        'PHP версия'       => phpversion(),
        'Сервер'           => $_SERVER['SERVER_SOFTWARE'] ?? 'PHP Dev Server',
        'Пользователей'    => count(readUsersAdmin()),
        'Игр'              => count(readGames()),
        'Записей в логе'   => count(readAdminLog()),
        'Дата на сервере'  => date('d.m.Y H:i:s'),
        'Postgres users'   => 'OK',
        'Postgres games'   => 'OK',
      ];
      foreach ($info as $k => $v): ?>
      <div class="adm-info-row">
        <span class="pixel dim"><?= $k ?>:</span>
        <span class="pixel cyan"><?= htmlspecialchars($v) ?></span>
      </div>
      <?php endforeach; ?>
    </div>
  </div>

</div>
</body>
</html>
