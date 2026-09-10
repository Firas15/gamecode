(function() {
  const ROOT    = (window.AUTH_ROOT || '').replace(/\/$/, '');
  const API_URL = ROOT + '/api/check-auth.php';

  const container = document.getElementById('auth-widget');
  if (!container) return;

  // Картинки берём относительным путём, когда AUTH_ROOT пуст (главная),
  // и от корня — со вложенных страниц. Так же сделано у аватара.
  const IMG = ROOT ? ROOT + '/img/' : 'img/';

  /**
   * Баланс пиксель коинов слева от виджета пользователя.
   *
   * Рисуется здесь, а не в разметке страниц: шапка одинаковая на
   * трёх десятках файлов, и держать её в них синхронно вручную —
   * гарантированный источник расхождений. Здесь же уже есть ответ
   * check-auth.php, в котором баланс и приходит.
   */
  function renderBalance(coins) {
    const host = container.parentNode;
    if (!host) return;

    let el = document.getElementById('gcBalance');
    if (!el) {
      el = document.createElement('a');
      el.id = 'gcBalance';
      el.className = 'gc-balance';
      el.href = ROOT + '/pages/shop.php';
      el.title = 'Пиксель коины — валюта магазина';
      host.insertBefore(el, container);
    }
    el.innerHTML =
      `<img class="gc-coin" src="${IMG}pixel_coin.png" alt="пиксель коин"/>` +
      `<span class="gc-balance-num">${Number(coins) || 0}</span>`;
  }

  function removeBalance() {
    const el = document.getElementById('gcBalance');
    if (el) el.remove();
  }

  // Рендер виджета
  function render(data) {
    if (data.loggedIn && data.banned) {
      // У заблокированного баланс убираем: показывать ему магазин незачем.
      removeBalance();
      renderBanned();
    } else if (data.loggedIn) {
      renderBalance(data.coins);
      renderUser(data);
    } else {
      removeBalance();
      renderGuest();
    }
  }

  function renderBanned() {
    // Блокируем весь сайт оверлеем
    const overlay = document.createElement('div');
    overlay.id = 'ban-overlay';
    overlay.innerHTML = `
      <div class="ban-box">
        <div class="ban-icon">
        <img src="img/zamok.png" alt="замок" style="width:100px; height:80px;">
        </div>
        <div class="ban-title pixel-text">АККАУНТ ЗАБЛОКИРОВАН</div>
        <p class="ban-msg pixel-text">Ваш аккаунт был заблокирован<br/>администрацией сайта.</p>
        <a href="${ROOT}/api/logout.php" class="ban-btn pixel-text">[ ВЫЙТИ ]</a>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Показываем заглушку в шапке
    const container = document.getElementById('auth-widget');
    if (container) {
      container.innerHTML = `<span class="aw-banned pixel-text" style="color:var(--pink,#ff4d6d);font-size:9px;">[ ЗАБЛОКИРОВАН ]</span>`;
    }
  }

  function renderGuest() {
    container.innerHTML = `
      <div class="aw-guest">
        <a href="${ROOT}/pages/login.php" class="aw-btn-login pixel-text">
          <span class="aw-btn-full">[ ВОЙТИ ]</span><span class="aw-btn-compact">ВХОД</span>
        </a>
        <a href="${ROOT}/pages/register.php" class="aw-btn-register pixel-text">
          <span class="aw-btn-full">[ РЕГИСТРАЦИЯ ]</span><span class="aw-btn-compact">РЕГ.</span>
        </a>
      </div>
    `;
  }

  function renderUser(data) {
    container.innerHTML = `
      <div class="aw-user" id="awUser">
        <button class="aw-username pixel-text" id="awToggle" type="button">
          <span class="aw-avatar"><img src="${ROOT ? ROOT + '/img/avatars/' : 'img/avatars/'}${data.avatarEmoji || 'avatar1'}.png" alt="аватар" class="avatar-img avatar-img--sm"/></span>
          <span class="aw-nick">${escHtml(data.nickname)}</span>
          <span class="aw-caret">▼</span>
        </button>
        <div class="aw-dropdown" id="awDropdown">
          <a href="${ROOT}/pages/profile.php" class="aw-dd-item pixel-text">
          МОЙ ПРОФИЛЬ
          </a>
          <div class="aw-dd-divider"></div>
          <a href="${ROOT}/api/logout.php" class="aw-dd-item aw-dd-logout pixel-text"
             onclick="return confirm('Выйти?')">
          ВЫЙТИ
          </a>
        </div>
      </div>
    `;

    const toggle   = document.getElementById('awToggle');
    const dropdown = document.getElementById('awDropdown');

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
      toggle.classList.toggle('active');
    });

    // Закрыть при клике снаружи
    document.addEventListener('click', function closeDD(e) {
      if (!container.contains(e.target)) {
        dropdown.classList.remove('open');
        toggle.classList.remove('active');
      }
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Скелетон пока грузится
  container.innerHTML = '<div class="aw-loading pixel-text">···</div>';

  fetch(API_URL, { credentials: 'same-origin', cache: 'no-store' })
    .then(r => r.json())
    .then(render)
    .catch(() => renderGuest());
})();
