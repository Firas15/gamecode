<?php
require_once dirname(__DIR__) . '/includes/assets.php';
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Сброс пароля — Game Code</title>
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
      <li><a href="../index.html"    class="sidebar-link">Все игры</a></li>
      <li><a href="leaderboard.html" class="sidebar-link">Лидеры</a></li>
      <li><a href="how-to-play.html" class="sidebar-link">Как играть</a></li>
      <li><a href="theory.html"      class="sidebar-link">Теория</a></li>
      <li><a href="about.html"       class="sidebar-link">О нас</a></li>
    </ul>
    <a class="sidebar-partner" href="https://itgorky.ru/" target="_blank" rel="noopener">
      <img class="sidebar-partner-img" src="../img/itgorky-mascot.png" alt="ITGorky" />
      <span class="partner-name">IT<em>GORKY</em></span>
    </a>
    <div class="sidebar-footer"><span>GameCode © 2026</span></div>
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
    <div class="header-right"><div id="auth-widget"></div></div>
  </header>

  <section class="page-hero">
    <div class="page-hero-inner">
      <p class="breadcrumb"><a href="../index.html">ГЛАВНАЯ</a> / <a href="login.php">ВХОД</a> / <span class="cyan">СБРОС ПАРОЛЯ</span></p>
      <h1 class="page-title cyan">СБРОС ПАРОЛЯ</h1>
      <p class="page-subtitle pixel-text">Ответь на секретный вопрос</p>
    </div>
  </section>

  <main class="page-content" style="max-width:520px;">

    <div class="auth-card">
      <div class="auth-card-header">
      <span class="pixel-text">[ ВОССТАНОВЛЕНИЕ ДОСТУПА ]</span>
      </div>

      <!-- Сообщения -->
      <div id="rp-error"   class="auth-error pixel-text"   style="display:none; margin:0 28px;"></div>
      <div id="rp-success" class="auth-success pixel-text" style="display:none; margin:0 28px;"></div>

      <!-- Ввод никнейма -->
      <div id="step1" class="auth-form" style="padding:28px; display:flex; flex-direction:column; gap:22px;">

        <div style="font-size:8px; color:var(--text-dim); letter-spacing:1px; line-height:1.8; font-family:var(--font-pixel);">
          Введи свой никнейм — мы покажем твой<br/>секретный вопрос.
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="rp-nickname">// НИКНЕЙМ</label>
          <div class="auth-input-wrap">
            <input class="auth-input" type="text" id="rp-nickname" placeholder="твой никнейм" autocomplete="off"/>
          </div>
          <p class="auth-inline-error pixel-text" id="rp-nick-error" style="display:none;"></p>
        </div>

        <button class="auth-submit pixel-text" id="btn-check-nick">[ НАЙТИ АККАУНТ ]</button>

        <div class="auth-alt pixel-text">
          Вспомнил пароль? <a href="login.php" class="auth-link">[ ВОЙТИ ]</a>
        </div>
      </div>

      <!-- Секретный вопрос + новый пароль -->
      <div id="step2" style="display:none; padding:28px; flex-direction:column; gap:22px;">

        <div class="auth-field">
          <label class="auth-label pixel-text">// СЕКРЕТНЫЙ ВОПРОС</label>
          <div style="
            background:var(--bg-dark);
            border:1px solid var(--border-blue);
            padding:14px 16px;
            font-family:var(--font-pixel);
            font-size:8px;
            color:var(--cyan);
            letter-spacing:1px;
            line-height:1.8;
          " id="rp-question-text"></div>
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="rp-answer">// ОТВЕТ</label>
          <div class="auth-input-wrap">
            <input class="auth-input" type="text" id="rp-answer" placeholder="твой ответ" autocomplete="off"/>
          </div>
          <p class="auth-hint pixel-text">Регистр букв не важен</p>
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="rp-newpass">// НОВЫЙ ПАРОЛЬ</label>
          <div class="auth-input-wrap">
            <input class="auth-input" type="password" id="rp-newpass" placeholder="минимум 6 символов" autocomplete="new-password"/>
            <button type="button" class="auth-eye" id="rp-eye1">👁</button>
          </div>
        </div>

        <div class="auth-field">
          <label class="auth-label pixel-text" for="rp-confirm">// ПОДТВЕРЖДЕНИЕ</label>
          <div class="auth-input-wrap">
            <input class="auth-input" type="password" id="rp-confirm" placeholder="повтори пароль" autocomplete="new-password"/>
            <button type="button" class="auth-eye" id="rp-eye2">👁</button>
          </div>
          <div class="auth-match-indicator" id="rp-match"></div>
        </div>

        <button class="auth-submit pixel-text" id="btn-reset" style="background:rgba(178,75,255,0.08); color:var(--accent); border-color:var(--accent);">
          [ СБРОСИТЬ ПАРОЛЬ ]
        </button>

        <button class="auth-submit pixel-text" id="btn-back"
          style="background:transparent; color:var(--text-dim); border:1px solid var(--border-blue); font-size:8px; padding:10px;">
          ← НАЗАД
        </button>
      </div>

      <!-- ШАГ 3: Успех -->
      <div id="step3" style="display:none; padding:28px; text-align:center; flex-direction:column; gap:22px; align-items:center;">
        <div style="font-size:48px;">✅</div>
        <div class="pixel-text" style="font-size:9px; color:var(--green); letter-spacing:1px; line-height:2;">
          Пароль успешно изменён!
        </div>
        <a href="login.php" class="auth-submit pixel-text" style="text-decoration:none; display:block; text-align:center;">
          [ ВОЙТИ ]
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
  (function () {
    const step1   = document.getElementById('step1');
    const step2   = document.getElementById('step2');
    const step3   = document.getElementById('step3');
    const errEl   = document.getElementById('rp-error');
    const nickEl  = document.getElementById('rp-nickname');
    const qText   = document.getElementById('rp-question-text');
    const ansEl   = document.getElementById('rp-answer');
    const newPass = document.getElementById('rp-newpass');
    const conf    = document.getElementById('rp-confirm');
    const match   = document.getElementById('rp-match');
    const nickInline = document.getElementById('rp-nick-error');

    let currentNick = '';

    function setNickInline(msg) {
      if (!nickInline) return;
      nickInline.textContent = msg || '';
      nickInline.style.display = msg ? 'block' : 'none';
      const inp = document.getElementById('rp-nickname');
      if (inp) inp.classList.toggle('auth-invalid', !!msg);
    }

    nickEl.addEventListener('input', () => {
      const v = nickEl.value.trim();
      if (!v) { setNickInline(''); return; }
      setNickInline(validateNick(nickEl.value));
    });

    const NICK_RE = /^[a-zA-Z0-9_\-а-яёА-ЯЁ]+$/u;
    function validateNick(nick) {
      nick = String(nick).trim();
      if (nick.length < 3 || nick.length > 24) return 'Никнейм: от 3 до 24 символов';
      if (!NICK_RE.test(nick)) return 'Никнейм: только буквы, цифры, _ и -';
      return '';
    }

    function showError(msg) {
      errEl.textContent = '⚠ ' + msg;
      errEl.style.display = 'block';
      errEl.style.marginBottom = '16px';
      errEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function hideError() {
      errEl.style.display = 'none';
    }

    function showStep(n) {
      step1.style.display = n === 1 ? 'flex' : 'none';
      step2.style.display = n === 2 ? 'flex' : 'none';
      step3.style.display = n === 3 ? 'flex' : 'none';
      hideError();
    }

    // Найти аккаунт
    document.getElementById('btn-check-nick').addEventListener('click', async () => {
      hideError();
      const nick = nickEl.value.trim();
      const nv = validateNick(nickEl.value);
      if (!nick) { setNickInline('Введи никнейм'); nickEl.focus(); return; }
      if (nv) { setNickInline(nv); nickEl.focus(); return; }
      setNickInline('');

      const btn = document.getElementById('btn-check-nick');
      btn.textContent = '[ ПОИСК... ]';
      btn.disabled = true;

      try {
        const res  = await fetch('../api/get-question.php?nickname=' + encodeURIComponent(nick));
        const data = await res.json();

        if (data.error) { showError(data.error); }
        else {
          currentNick = nick;
          qText.textContent = data.question;
          showStep(2);
        }
      } catch(e) {
        showError('Ошибка соединения. Попробуй ещё раз.');
      } finally {
        btn.textContent = '[ НАЙТИ АККАУНТ ]';
        btn.disabled = false;
      }
    });

    // Нажатие Enter в поле никнейма
    nickEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-check-nick').click();
    });

    // НАЗАД
    document.getElementById('btn-back').addEventListener('click', () => {
      ansEl.value = '';
      newPass.value = '';
      conf.value = '';
      match.textContent = '';
      showStep(1);
    });

    // Совпадение паролей
    function checkMatch() {
      if (!conf.value) { match.textContent = ''; match.className = 'auth-match-indicator'; return; }
      if (newPass.value === conf.value) {
        match.textContent = 'Пароли совпадают';
        match.className = 'auth-match-indicator match-ok';
      } else {
        match.textContent = 'Пароли не совпадают';
        match.className = 'auth-match-indicator match-fail';
      }
    }
    newPass.addEventListener('input', checkMatch);
    conf.addEventListener('input', checkMatch);

    // Глазики
    function eyeToggle(inputId, btnId) {
      document.getElementById(btnId).addEventListener('click', function() {
        const inp = document.getElementById(inputId);
        const shown = inp.type === 'text';
        inp.type = shown ? 'password' : 'text';
        this.style.opacity = shown ? '0.5' : '1';
      });
    }
    eyeToggle('rp-newpass', 'rp-eye1');
    eyeToggle('rp-confirm',  'rp-eye2');

    // Сбросить пароль
    document.getElementById('btn-reset').addEventListener('click', async () => {
      const answer  = ansEl.value.trim();
      const np      = newPass.value;
      const cp      = conf.value;

      if (!answer)       { showError('Введи ответ на секретный вопрос'); return; }
      if (np.length < 6) { showError('Новый пароль: минимум 6 символов'); return; }
      if (np !== cp)     { showError('Пароли не совпадают'); return; }

      const btn = document.getElementById('btn-reset');
      btn.textContent = '[ ПРОВЕРКА... ]';
      btn.disabled = true;

      try {
        const form = new FormData();
        form.append('nickname',         currentNick);
        form.append('secret_answer',    answer);
        form.append('new_password',     np);
        form.append('confirm_password', cp);

        const res  = await fetch('../api/reset-password.php', { method: 'POST', body: form });
        const data = await res.json();

        if (data.error) { showError(data.error); }
        else            { showStep(3); }
      } catch(e) {
        showError('Ошибка соединения. Попробуй ещё раз.');
      } finally {
        btn.textContent = '[ СБРОСИТЬ ПАРОЛЬ ]';
        btn.disabled = false;
      }
    });

    showStep(1);
  })();
  </script>
</body>
</html>
