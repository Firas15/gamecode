<?php
require_once dirname(__DIR__) . '/includes/auth.php';

if (isLoggedIn()) {
    header('Location: profile.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nick   = $_POST['nickname'] ?? '';
    $pass   = $_POST['password'] ?? '';
    $result = loginUser($nick, $pass);
    if (isset($result['ok'])) {
        $redirect = $_GET['redirect'] ?? '../index.html';
        header('Location: ' . $redirect);
        exit;
    }
    $error = $result['error'];
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Вход — Game Code</title>
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
    <button class="sidebar-close" id="sidebarClose">✕</button>
    <div class="sidebar-logo">
      <span class="pixel-text">GAME</span>
      <span class="pixel-text accent">CODE</span>
      <a class="sidebar-partner" href="https://itgorky.ru/" target="_blank" rel="noopener">
        <span class="partner-x">×</span>
        <span class="partner-name">IT<em>GORKY</em></span>
      </a>
    </div>
    <ul class="sidebar-nav">
      <li><a href="../index.html"    class="sidebar-link" >Все игры</a></li>
      <li><a href="leaderboard.html"      class="sidebar-link" >Лидеры</a></li>
      <li><a href="how-to-play.html" class="sidebar-link" >Как играть</a></li>
      <li><a href="theory.html"      class="sidebar-link" >Теория</a></li>
      <li><a href="about.html"       class="sidebar-link" >О нас</a></li>
    </ul>
    <div class="sidebar-footer"><span>V2.0 — GameCode</span></div>
  </nav>

  <header class="header">
    <div class="header-left">
      <button class="menu-btn" id="menuBtn" aria-label="Открыть меню">
        <span></span><span></span><span></span>
      </button>
      <div class="site-title">
        <a href="../index.html" class="logo pixel-text" style="text-decoration:none;">GAME<span class="accent">CODE</span></a>
        <p class="tagline pixel-text">Изучай программирование в играх</p>
      
        <a class="partner-mark" href="https://itgorky.ru/" target="_blank" rel="noopener">
          <span class="partner-x">×</span>
          <span class="partner-name">IT<em>GORKY</em></span>
        </a>
      </div>
      <a class="partner-mark" href="https://itgorky.ru/" target="_blank" rel="noopener"
         title="ITGorky — ИТ-карта Нижнего Новгорода. Партнёр проекта">
        <span class="partner-x">×</span>
        <!-- Когда получите логотип от партнёров, положите файл в img/itgorky-logo.svg
             и раскомментируйте строку ниже, а <span class="partner-name"> удалите.
        <img class="partner-logo" src="../img/itgorky-logo.svg" alt="ITGorky" />
        -->
        <span class="partner-name">IT<em>GORKY</em></span>
      </a>
    </div>
    <div class="header-right">
      <div id="auth-widget"></div>
    </div>
  </header>

  <section class="page-hero">
    <div class="page-hero-inner">
      <p class="breadcrumb"><a href="../index.html">ГЛАВНАЯ</a> / <span class="cyan">ВХОД</span></p>
      <h1 class="page-title cyan">ВХОД</h1>
      <p class="page-subtitle pixel-text">Войди в свой аккаунт</p>
    </div>
  </section>

  <main class="page-content" style="max-width:520px;">

    <div class="auth-card">
      <div class="auth-card-header">
        <span class="pixel-text">[ ДОБРО ПОЖАЛОВАТЬ ]</span>
      </div>

      <div class="auth-error pixel-text" id="auth-error"<?= $error ? '' : ' style="display:none;"' ?>><?php if ($error): ?>⚠ <?= htmlspecialchars($error) ?><?php endif; ?></div>

      <form method="POST" class="auth-form" id="loginForm" autocomplete="off">
        <input type="hidden" name="redirect" value="<?= htmlspecialchars($_GET['redirect'] ?? '../index.html', ENT_QUOTES, 'UTF-8') ?>"/>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="nickname">// НИКНЕЙМ (ЛОГИН)</label>
          <div class="auth-input-wrap">
            <input
              class="auth-input"
              type="text"
              id="nickname"
              name="nickname"
              placeholder="  твой никнейм"
              value="<?= htmlspecialchars($_POST['nickname'] ?? '') ?>"
              required
              autocomplete="off"
            />
          </div>
          <p class="auth-inline-error pixel-text" id="nickname-error" style="display:none;"></p>
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="password">// ПАРОЛЬ</label>
          <div class="auth-input-wrap">
            <input
              class="auth-input"
              type="password"
              id="password"
              name="password"
              placeholder="  введи пароль"
              required
              autocomplete="current-password"
            />
            <button type="button" class="auth-eye" id="togglePass" title="Показать пароль"></button>
          </div>
        </div>

        <div class="auth-show-pass">
          <label class="auth-toggle-label pixel-text">
            <input type="checkbox" id="showPassword"/>
            <span class="auth-checkbox-custom"></span>
            Показывать пароль
          </label>
        </div>

        <button type="submit" class="auth-submit pixel-text">[ ВОЙТИ ]</button>

        <div class="auth-alt pixel-text">
          <a href="reset-password.php" class="auth-link" style="color:var(--text-dim); font-size:7px;">Забыли пароль?</a>
        </div>

        <div class="auth-alt pixel-text">
          Нет аккаунта? <a href="register.php" class="auth-link">[ РЕГИСТРАЦИЯ ]</a>
        </div>

      </form>
    </div>

  </main>

  <footer class="footer">
    <p class="pixel-text">GAME<span class="accent">CODE</span> &copy; 2026</p>
    <p class="footer-sub">Изучай программирование в играх</p>
  </footer>

  <script src="<?= htmlspecialchars(asset_url('../js/app.js', 'js/app.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
  <script src="<?= htmlspecialchars(asset_url('../js/auth.js', 'js/auth.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
  <script src="<?= htmlspecialchars(asset_url('../js/auth-forms.js', 'js/auth-forms.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
  <script>
    const passEl = document.getElementById('password');
    document.getElementById('togglePass').addEventListener('click', function() {
      const shown = passEl.type === 'text';
      passEl.type = shown ? 'password' : 'text';
      this.style.opacity = shown ? '0.5' : '1';
    });
    document.getElementById('showPassword').addEventListener('change', function() {
      passEl.type = this.checked ? 'text' : 'password';
    });
  </script>
</body>
</html>
