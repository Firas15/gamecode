<?php
require_once dirname(__DIR__) . '/includes/auth.php';

// Уже залогинен — в профиль
if (isLoggedIn()) {
    header('Location: profile.php');
    exit;
}

$error   = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nick     = $_POST['nickname']        ?? '';
    $pass     = $_POST['password']        ?? '';
    $confirm  = $_POST['confirm']         ?? '';
    $question = $_POST['secret_question'] ?? '';
    $answer   = $_POST['secret_answer']   ?? '';
    $result   = registerUser($nick, $pass, $confirm, $question, $answer);
    if (isset($result['ok'])) {
        header('Location: profile.php?new=1');
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
  <title>Регистрация — Game Code</title>
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
    </div>
    <ul class="sidebar-nav">
      <li><a href="../index.html"    class="sidebar-link" >Все игры</a></li>
      <li><a href="leaderboard.html"      class="sidebar-link" >Лидеры</a></li>
      <li><a href="how-to-play.html" class="sidebar-link" >Как играть</a></li>
      <li><a href="theory.html"      class="sidebar-link" >Теория</a></li>
      <li><a href="about.html"       class="sidebar-link" >О нас</a></li>
    </ul>
      <a class="sidebar-partner" href="https://itgorky.ru/" target="_blank" rel="noopener">
        <span class="partner-x">×</span>
        <span class="partner-name">IT<em>GORKY</em></span>
      </a>
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
      <p class="breadcrumb"><a href="../index.html">ГЛАВНАЯ</a> / <span class="cyan">РЕГИСТРАЦИЯ</span></p>
      <h1 class="page-title cyan">РЕГИСТРАЦИЯ</h1>
      <p class="page-subtitle pixel-text">Создай аккаунт и начни играть</p>
    </div>
  </section>

  <main class="page-content" style="max-width:520px;">

    <div class="auth-card">
      <div class="auth-card-header">
        <span class="pixel-text">[ НОВЫЙ ИГРОК ]</span>
      </div>

      <div class="auth-error pixel-text" id="auth-error"<?= $error ? '' : ' style="display:none;"' ?>><?php if ($error): ?>⚠ <?= htmlspecialchars($error) ?><?php endif; ?></div>

      <form method="POST" class="auth-form" id="regForm" autocomplete="off">

        <div class="auth-field">
          <label class="auth-label pixel-text" for="nickname">// НИКНЕЙМ (ЛОГИН)</label>
          <div class="auth-input-wrap">
            <input
              class="auth-input"
              type="text"
              id="nickname"
              name="nickname"
              placeholder="  от 3 до 24 символов"
              value="<?= htmlspecialchars($_POST['nickname'] ?? '') ?>"
              maxlength="24"
              required
              autocomplete="off"
            />
          </div>
          <p class="auth-inline-error pixel-text" id="nickname-error" style="display:none;"></p>
          <p class="auth-hint pixel-text">Латиница, кириллица, цифры, _ и -</p>
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="password">// ПАРОЛЬ</label>
          <div class="auth-input-wrap">
            <input
              class="auth-input"
              type="password"
              id="password"
              name="password"
              placeholder="  минимум 6 символов"
              required
              autocomplete="new-password"
            />
            <button type="button" class="auth-eye" id="togglePass" title="Показать/скрыть пароль"></button>
          </div>
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="confirm">// ПОДТВЕРЖДЕНИЕ ПАРОЛЯ</label>
          <div class="auth-input-wrap">
            <input
              class="auth-input"
              type="password"
              id="confirm"
              name="confirm"
              placeholder="  повтори пароль"
              required
              autocomplete="new-password"
            />
            <button type="button" class="auth-eye" id="toggleConfirm" title="Показать/скрыть пароль"></button>
          </div>
          <div class="auth-match-indicator" id="matchIndicator"></div>
        </div>

        <div class="auth-show-pass">
          <label class="auth-toggle-label pixel-text">
            <input type="checkbox" id="showAllPasswords"/>
            <span class="auth-checkbox-custom"></span>
            Показывать пароли
          </label>
        </div>

        <!-- Секретный вопрос -->
        <div style="height:1px; background:var(--border-blue); margin: 4px 0;"></div>
        <div style="font-size:7px; color:var(--text-dim); letter-spacing:1px; font-family:var(--font-pixel); line-height:1.9;">
          // ЗАЩИТА АККАУНТА<br/>
          Секретный вопрос поможет восстановить<br/>пароль, если ты его забудешь.
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="secret_question">// СЕКРЕТНЫЙ ВОПРОС</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">❓</span>
            <select class="auth-input auth-select" id="secret_question" name="secret_question" required>
              <option value="" disabled <?= empty($_POST['secret_question']) ? 'selected' : '' ?>>Выбери вопрос...</option>
              <?php
              $questions = [
                'Кличка твоего первого питомца?',
                'Любимая игра из детства?',
                'Город, где ты родился?',
                'Любимый герой из книги или фильма?',
                'Имя лучшего друга из детства?',
                'Любимое блюдо?',
                'Первый язык программирования, который ты изучал?',
              ];
              foreach ($questions as $q) {
                $sel = (($_POST['secret_question'] ?? '') === $q) ? 'selected' : '';
                echo "<option value=\"" . htmlspecialchars($q) . "\" $sel>" . htmlspecialchars($q) . "</option>";
              }
              ?>
            </select>
          </div>
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="secret_answer">// ОТВЕТ НА ВОПРОС</label>
          <div class="auth-input-wrap">
            <input
              class="auth-input"
              type="text"
              id="secret_answer"
              name="secret_answer"
              placeholder="  твой ответ"
              value="<?= htmlspecialchars($_POST['secret_answer'] ?? '') ?>"
              maxlength="100"
              required
              autocomplete="off"
            />
          </div>
          <p class="auth-hint pixel-text">Запомни ответ — он понадобится для сброса пароля. Регистр не важен.</p>
        </div>

        <button type="submit" class="auth-submit pixel-text">[ СОЗДАТЬ АККАУНТ ]</button>

        <div class="auth-alt pixel-text">
          Уже есть аккаунт? <a href="login.php" class="auth-link">[ ВОЙТИ ]</a>
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
    // Переключалки видимости пароля
    function toggleInput(inputId, btnId) {
      const inp = document.getElementById(inputId);
      const btn = document.getElementById(btnId);
      btn.addEventListener('click', () => {
        const shown = inp.type === 'text';
        inp.type = shown ? 'password' : 'text';
        btn.style.opacity = shown ? '0.5' : '1';
      });
    }
    toggleInput('password', 'togglePass');
    toggleInput('confirm',  'toggleConfirm');

    // Глобальный чекбокс "показывать пароли"
    document.getElementById('showAllPasswords').addEventListener('change', function() {
      ['password','confirm'].forEach(id => {
        document.getElementById(id).type = this.checked ? 'text' : 'password';
      });
      document.getElementById('togglePass').style.opacity    = this.checked ? '1' : '0.5';
      document.getElementById('toggleConfirm').style.opacity = this.checked ? '1' : '0.5';
    });

    // Индикатор совпадения паролей
    const passEl    = document.getElementById('password');
    const confEl    = document.getElementById('confirm');
    const indicator = document.getElementById('matchIndicator');
    function checkMatch() {
      if (!confEl.value) { indicator.textContent = ''; indicator.className = 'auth-match-indicator'; return; }
      if (passEl.value === confEl.value) {
        indicator.textContent = 'Пароли совпадают';
        indicator.className = 'auth-match-indicator match-ok';
      } else {
        indicator.textContent = 'Пароли не совпадают';
        indicator.className = 'auth-match-indicator match-fail';
      }
    }
    passEl.addEventListener('input', checkMatch);
    confEl.addEventListener('input', checkMatch);
  </script>
</body>
</html>
