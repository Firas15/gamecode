<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/csrf.php';
require_once dirname(__DIR__) . '/includes/rate_limit.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login = trim((string)($_POST['login'] ?? ''));
    $pass  = (string)($_POST['password'] ?? '');
    // Подбор пароля админки: 5 неверных попыток за 15 минут с одного IP
    $ip = gc_client_ip();
    $rlBlocked = gc_rl_blocked('admin_ip', $ip, 5);
    $ok = !$rlBlocked
        && ADMIN_PASSWORD !== ''
        && hash_equals((string)ADMIN_LOGIN, $login)
        && hash_equals((string)ADMIN_PASSWORD, $pass);
    if ($ok) {
        gc_rl_clear('admin_ip', $ip);
        // Новый идентификатор сессии на вход: закрывает подмену
        // сессии и заодно выдаёт куку с новыми параметрами
        // (HttpOnly, SameSite) тем, кто уже был залогинен.
        session_regenerate_id(true);
        $_SESSION[ADMIN_SESSION] = true;
        writeLog('Вход в админку');
        header('Location: dashboard.php');
        exit;
    }
    if ($rlBlocked) {
        $error = gc_rl_message(gc_rl_wait('admin_ip', $ip));
    } else {
        gc_rl_hit('admin_ip', $ip, 900);
        $error = 'Неверный логин или пароль';
    }
}
if (adminIsLoggedIn()) { header('Location: dashboard.php'); exit; }
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admin — Game Code</title>
  <link rel="stylesheet" href="../css/fonts.css"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin.css', 'admin/admin.css'), ENT_QUOTES, 'UTF-8') ?>"/>
</head>
<body class="login-page">
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">
        <span class="pixel">GAME</span><span class="pixel accent">CODE</span>
        <div class="login-badge pixel">[ ADMIN PANEL ]</div>
      </div>
      <?php if ($error): ?>
        <div class="adm-alert adm-alert-error pixel"><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>
      <form method="POST" class="login-form">
        <div class="adm-field">
          <label class="adm-label pixel">// ЛОГИН</label>
          <div class="adm-input-wrap">
            <span class="adm-ico">🔑</span>
            <input class="adm-input" type="text" name="login" placeholder="admin" required autocomplete="off"/>
          </div>
        </div>
        <div class="adm-field">
          <label class="adm-label pixel">// ПАРОЛЬ</label>
          <div class="adm-input-wrap">
            <span class="adm-ico">🔐</span>
            <input class="adm-input" type="password" name="password" placeholder="••••••••" required/>
            <button type="button" class="adm-eye" onclick="togglePass(this)">👁</button>
          </div>
        </div>
        <button type="submit" class="adm-btn-primary pixel">[ ВОЙТИ В ПАНЕЛЬ ]</button>
      </form>
      <div class="login-back pixel"><a href="../index.html">◄ НА САЙТ</a></div>
    </div>
  </div>
  <script>
    function togglePass(btn) {
      const inp = btn.parentElement.querySelector('input');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    }
  </script>
</body>
</html>
