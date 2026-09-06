/* ============================================================
   ОГРАНИЧЕНИЕ ТЕОРИИ ДЛЯ ГОСТЯ

   Гостю открыта первая карточка каждой темы, остальные
   приглушены и не кликаются. Внутри самой статьи блокируется
   переход к следующей теме.

   Это мотивация зарегистрироваться, а не защита контента:
   страницы теории статические, прямая ссылка по-прежнему
   откроется. Так и задумано — иначе пришлось бы переводить
   двадцать страниц на PHP и ломать внешние ссылки.
   ============================================================ */
(() => {
  const ROOT = (window.AUTH_ROOT || '.').replace(/\/$/, '');
  const LOCK_TEXT = 'Войдите в аккаунт или зарегистрируйтесь для доступа к разделу';
  const LOCK_ICON = ROOT + '/img/zamok.png';

  function injectStyles() {
    if (document.getElementById('gcTheoryLockStyles')) return;
    const css = document.createElement('style');
    css.id = 'gcTheoryLockStyles';
    css.textContent = `
    .gc-locked{position:relative;cursor:not-allowed}
    .gc-locked > *:not(.gc-lock-veil):not(.gc-lock-badge){opacity:.18;transition:opacity .2s}
    .gc-locked:hover > *:not(.gc-lock-veil):not(.gc-lock-badge){opacity:.08}
    .gc-lock-veil{position:absolute;inset:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:18px;padding:22px;text-align:center;
        /* фон обязателен: без него подсказка ложится поверх текста карточки */
        background:rgba(8,12,20,.94);
        opacity:0;transition:opacity .2s;pointer-events:none}
    .gc-locked:hover .gc-lock-veil,
    .gc-locked:focus-visible .gc-lock-veil{opacity:1}
    .gc-lock-icon{width:52px;height:52px;display:block;
        image-rendering:pixelated;image-rendering:crisp-edges}
    .gc-lock-msg{font-family:'Press Start 2P',monospace;font-size:10px;line-height:2;
        letter-spacing:.5px;color:#f5d800}
    .gc-lock-badge{position:absolute;top:10px;right:10px;width:26px;height:26px;opacity:.55;
        image-rendering:pixelated;image-rendering:crisp-edges;
        pointer-events:none;transition:opacity .2s;z-index:2}
    .gc-locked:hover .gc-lock-badge{opacity:0}
    /* Приглушаем цветом, а не opacity: прозрачность родителя
       унаследовала бы и подсказка, и её было бы не прочитать. */
    .gc-locked-btn{position:relative;cursor:not-allowed;
        color:#3d5069!important;border-color:#1e2e46!important;
        background:transparent!important;box-shadow:none!important}
    .gc-locked-btn:hover{color:#3d5069!important;border-color:#1e2e46!important}
    /* Прижимаем к правому краю кнопки, а не центрируем: кнопка «дальше»
       стоит у правого края страницы, и центрированная подсказка уезжала за экран. */
    .gc-lock-tip{position:absolute;right:0;bottom:calc(100% + 14px);
        width:max-content;max-width:min(420px,86vw);padding:16px 20px;text-align:center;
        background:#0d1626;border:2px solid #f5d800;z-index:60;
        font-family:'Press Start 2P',monospace;font-size:10px;line-height:2;color:#f5d800;
        opacity:0;pointer-events:none;transition:opacity .2s}
    .gc-lock-tip .gc-lock-tip-icon{width:34px;height:34px;display:block;margin:0 auto 12px;
        image-rendering:pixelated;image-rendering:crisp-edges}
    .gc-locked-btn:hover .gc-lock-tip{opacity:1}
    @media (max-width:480px){
      .gc-lock-icon{width:40px;height:40px}
      .gc-lock-msg{font-size:8px;line-height:1.9}
      .gc-lock-veil{gap:12px;padding:14px}
      .gc-lock-tip{font-size:8px;padding:12px 14px}
      .gc-lock-tip .gc-lock-tip-icon{width:26px;height:26px;margin-bottom:9px}
    }`;
    document.head.appendChild(css);
  }

  function lockCard(card) {
    if (card.classList.contains('gc-locked')) return;
    card.classList.add('gc-locked');
    card.setAttribute('aria-disabled', 'true');
    card.removeAttribute('href');

    const badge = document.createElement('img');
    badge.className = 'gc-lock-badge';
    badge.src = LOCK_ICON;
    badge.alt = '';
    badge.setAttribute('aria-hidden', 'true');
    card.appendChild(badge);

    const veil = document.createElement('span');
    veil.className = 'gc-lock-veil';
    veil.innerHTML =
      `<img class="gc-lock-icon" src="${LOCK_ICON}" alt="" aria-hidden="true">` +
      `<span class="gc-lock-msg">${LOCK_TEXT}</span>`;
    card.appendChild(veil);

    card.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = ROOT + '/pages/register.php';
    });
  }

  function lockNextButton(btn) {
    if (btn.classList.contains('gc-locked-btn')) return;
    btn.classList.add('gc-locked-btn');
    btn.setAttribute('aria-disabled', 'true');
    btn.removeAttribute('href');

    const tip = document.createElement('span');
    tip.className = 'gc-lock-tip';
    tip.innerHTML =
      `<img class="gc-lock-tip-icon" src="${LOCK_ICON}" alt="" aria-hidden="true">` + LOCK_TEXT;
    btn.appendChild(tip);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = ROOT + '/pages/register.php';
    });
  }

  function applyLocks() {
    injectStyles();

    // Список тем: в каждой сетке открыта только первая карточка
    document.querySelectorAll('.topics-grid').forEach((grid) => {
      const cards = grid.querySelectorAll('.topic-card');
      cards.forEach((card, i) => { if (i > 0) lockCard(card); });
    });

    // Внутри статьи — переход к следующей теме
    document.querySelectorAll('.btn-theory-next').forEach(lockNextButton);
  }

  async function init() {
    // Ничего не блокируем, пока не убедились, что человек не вошёл:
    // при ошибке сети лучше оставить контент открытым, чем закрыть его своим.
    try {
      const res = await fetch(ROOT + '/api/check-auth.php', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.loggedIn === true) return;
    } catch {
      return;
    }
    applyLocks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
