<?php
/**
 * МАГАЗИН
 *
 * Всё, что можно купить, — косметика: рамка вокруг аватара,
 * подпись под ником, картинка аватара, цвет персонажа в CodeQuest.
 * На очки, сложность и результаты покупки не влияют.
 */
require_once dirname(__DIR__) . '/includes/auth.php';

if (!isLoggedIn()) {
    header('Location: login.php?redirect=shop.php');
    exit;
}

$user   = getCurrentUser();
$userId = (int)$user['id'];

$ready    = gc_shop_ready();
$wallet   = gc_shop_wallet($userId);
$owned    = gc_shop_purchased($userId);
$equipped = gc_shop_equipped($userId);

$sections = [
    ['kind' => 'frame',  'title' => '[ РАМКИ ]',   'accent' => 'cyan',   'hint' => 'Обводка вокруг аватара. Видна в профиле и в таблице лидеров.'],
    ['kind' => 'title',  'title' => '[ ТИТУЛЫ ]',  'accent' => 'yellow', 'hint' => 'Подпись под ником.'],
    ['kind' => 'avatar', 'title' => '[ АВАТАРЫ ]', 'accent' => 'green',  'hint' => 'Первые пять доступны всем и всегда.'],
    ['kind' => 'skin',   'title' => '[ СКИНЫ CODEQUEST ]', 'accent' => 'pink', 'hint' => 'Цвет персонажа в игре «Внутри компьютера».'],
];

/** Владеет ли игрок предметом (бесплатное — у всех). */
function shop_page_owns(array $item, array $owned): bool {
    return !empty($item['free']) || (int)$item['price'] === 0
        || in_array($item['id'], $owned, true);
}

/** Надет ли предмет прямо сейчас. */
function shop_page_on(array $item, array $equipped): bool {
    $kind = $item['kind'];
    if ($kind === 'avatar') {
        return ($equipped['avatar'] ?? '') === (string)($item['file'] ?? '');
    }
    return ($equipped[$kind] ?? '') === $item['id'];
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Магазин — Game Code</title>
  <link rel="icon" href="../img/ICON.PNG" type="image/png">
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('../css/style.css', 'css/style.css'), ENT_QUOTES, 'UTF-8') ?>"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('../css/pages.css', 'css/pages.css'), ENT_QUOTES, 'UTF-8') ?>"/>
  <!-- auth.css держит виджет пользователя в шапке (.aw-user) — без него
       ник и меню «Мой профиль / Выйти» вываливаются нестилизованным текстом -->
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('../css/auth.css', 'css/auth.css'), ENT_QUOTES, 'UTF-8') ?>"/>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('../css/shop.css', 'css/shop.css'), ENT_QUOTES, 'UTF-8') ?>"/>
  <link rel="stylesheet" href="../css/mobile.css"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
  <script>window.AUTH_ROOT = '../';</script>
</head>
<body>

  <div class="overlay" id="overlay"></div>

  <nav class="sidebar" id="sidebar">
    <button class="sidebar-close" id="sidebarClose">х</button>
    <div class="sidebar-logo">
      <span class="pixel-text">GAME</span><span class="pixel-text accent">CODE</span>
    </div>
    <ul class="sidebar-nav">
      <li><a href="../index.html" class="sidebar-link sidebar-link--games">Все игры</a></li>
      <li><a href="leaderboard.html" class="sidebar-link sidebar-link--leaders">Лидеры</a></li>
      <li><a href="theory.html" class="sidebar-link sidebar-link--theory">Теория</a></li>
      <li><a href="shop.php" class="sidebar-link sidebar-link--shop active">Магазин</a></li>
      <li><a href="how-to-play.html" class="sidebar-link sidebar-link--howto">Как играть</a></li>
      <li><a href="about.html" class="sidebar-link sidebar-link--about">О нас</a></li>
    </ul>
    <a class="sidebar-partner" href="https://itgorky.ru/" target="_blank" rel="noopener">
      <img class="sidebar-partner-img" src="../img/itgorky-mascot.png" alt="ITGorky" />
      <span class="partner-name">IT<em>GORKY</em></span>
    </a>
    <div class="sidebar-footer">
      <span>GameCode © 2026</span>
    </div>
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
        <span class="partner-name">IT<em>GORKY</em></span>
      </a>
    </div>
    <div class="header-right">
      <div id="auth-widget"></div>
    </div>
  </header>

  <section class="page-hero">
    <div class="page-hero-inner">
      <p class="breadcrumb"><a href="../index.html">ГЛАВНАЯ</a> / <span class="accent">МАГАЗИН</span></p>
      <h1 class="page-title accent">МАГАЗИН</h1>
      <p class="page-subtitle pixel-text">Трать пиксель коины на внешний вид</p>
    </div>
  </section>

  <main class="page-content" style="max-width:900px;">

    <?php if (!$ready): ?>
      <div class="auth-error pixel-text" style="margin-bottom:24px;">
        ⚠ Магазин ещё не подключён к базе. Нужно применить миграцию db/migrations/002-shop.sql.
      </div>
    <?php else: ?>

    <div class="gc-wallet">
      <div>
        <div class="gc-wallet-coins">
          <img class="gc-coin gc-coin--lg" src="../img/pixel_coin.png" alt=""/>
          <span id="walletCoins"><?= (int)$wallet['coins'] ?></span>
        </div>
        <div class="gc-wallet-label"><?= GC_COIN_NAME ?></div>
      </div>
      <div class="gc-wallet-sub">
        заработано за всё время: <?= (int)$wallet['earned'] ?><br>
        потрачено: <?= (int)$wallet['spent'] ?>
      </div>
    </div>

    <p class="gc-shop-note">
      Пиксель коины капают сами: <?= GC_COIN_RATE ?>% от очков за каждую сыгранную партию.
      Очки при покупке НЕ тратятся — место в таблице лидеров остаётся на месте.
      Купленное остаётся навсегда, переключать между своими вещами можно сколько угодно.
    </p>

    <?php foreach ($sections as $section):
        // true — снятое с продажи на витрину не попадает.
        // У тех, кто успел купить, оно продолжает работать.
        $items = gc_shop_by_kind($section['kind'], true);
        if (empty($items)) continue; ?>
      <div class="content-block <?= $section['accent'] ?>-accent" style="animation-delay:0s">
        <h2 class="block-title <?= $section['accent'] ?>"><?= $section['title'] ?></h2>
        <p class="gc-shop-note"><?= htmlspecialchars($section['hint']) ?></p>

        <div class="gc-shop-grid">
        <?php foreach ($items as $item):
            $has = shop_page_owns($item, $owned);
            $on  = shop_page_on($item, $equipped);
            $cls = 'gc-shop-card' . ($on ? ' gc-shop-card--on' : ($has ? ' gc-shop-card--owned' : ''));
        ?>
          <div class="<?= $cls ?>" data-item="<?= htmlspecialchars($item['id']) ?>" data-kind="<?= $item['kind'] ?>">

            <div class="gc-shop-preview">
              <?php if ($item['kind'] === 'frame'): ?>
                <span class="gc-frame <?= htmlspecialchars((string)($item['css'] ?? '')) ?>">
                  <img src="../img/avatars/<?= htmlspecialchars($equipped['avatar']) ?>.png" alt=""/>
                </span>
              <?php elseif ($item['kind'] === 'title'): ?>
                <?php if (($item['text'] ?? '') === ''): ?>
                  <span class="gc-shop-name" style="color:#5f7590">— пусто —</span>
                <?php else: ?>
                  <span class="gc-title-tag"><?= htmlspecialchars($item['text']) ?></span>
                <?php endif; ?>
              <?php elseif ($item['kind'] === 'avatar'): ?>
                <img src="../img/avatars/<?= htmlspecialchars((string)$item['file']) ?>.png" alt=""/>
              <?php else: ?>
                <?php $dir = (string)($item['dir'] ?? ''); ?>
                <img src="../games/pixelgame/assets/player/<?= $dir !== '' ? htmlspecialchars($dir) . '/' : '' ?>preview.png"
                     alt="" onerror="this.style.visibility='hidden'"/>
              <?php endif; ?>
            </div>

            <div class="gc-shop-name"><?= htmlspecialchars($item['name']) ?></div>

            <?php
              $free = !empty($item['free']) || (int)$item['price'] === 0;
            ?>
            <div class="gc-shop-price <?= $has ? 'gc-shop-price--owned' : '' ?>">
              <?php if ($on): ?>НАДЕТО
              <?php elseif ($has): ?><?= $free ? 'БЕСПЛАТНО' : 'КУПЛЕНО' ?>
              <?php else: ?>
                <img class="gc-coin gc-coin--sm" src="../img/pixel_coin.png" alt=""/><?= (int)$item['price'] ?>
              <?php endif; ?>
            </div>

            <?php if ($on): ?>
              <button class="gc-shop-btn" disabled>[ УЖЕ НА ВАС ]</button>
            <?php elseif ($has): ?>
              <button class="gc-shop-btn gc-shop-btn--equip" data-action="equip">[ НАДЕТЬ ]</button>
            <?php else: ?>
              <button class="gc-shop-btn" data-action="buy"
                      <?= (int)$item['price'] > (int)$wallet['coins'] ? 'data-poor="1"' : '' ?>>[ КУПИТЬ ]</button>
            <?php endif; ?>

          </div>
        <?php endforeach; ?>
        </div>
      </div>
    <?php endforeach; ?>

    <?php endif; ?>

  </main>

  <div class="gc-shop-toast" id="shopToast"></div>

  <script src="<?= htmlspecialchars(asset_url('../js/app.js', 'js/app.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
  <script src="<?= htmlspecialchars(asset_url('../js/auth.js', 'js/auth.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
  <script>
  (() => {
    const toastEl = document.getElementById('shopToast');
    let toastTimer = null;
    function toast(text, isError) {
      toastEl.textContent = text;
      toastEl.classList.toggle('gc-shop-toast--err', !!isError);
      toastEl.classList.add('gc-shop-toast--on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('gc-shop-toast--on'), 2600);
    }

    document.querySelectorAll('.gc-shop-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card   = btn.closest('.gc-shop-card');
        const action = btn.dataset.action;
        const itemId = card.dataset.item;

        // Покупка необратима, поэтому спрашиваем. Надеть — нет, там нечего терять.
        if (action === 'buy') {
          if (btn.dataset.poor) { toast('Не хватает пиксель коинов — сыграй ещё', true); return; }
          const name  = card.querySelector('.gc-shop-name').textContent.trim();
          const price = card.querySelector('.gc-shop-price').textContent.trim();
          if (!confirm(`Купить «${name}» за ${price} пиксель коинов?\n\nСпишутся сразу, вернуть их обратно нельзя.`)) return;
        }

        btn.disabled = true;
        try {
          const res = await fetch('../api/shop.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action, item_id: itemId }),
          });
          const data = await res.json();
          if (!data.ok) { toast(data.error || 'Не получилось', true); btn.disabled = false; return; }

          toast(action === 'buy' ? 'Куплено!' : 'Надето!');
          // Перерисовываем страницу целиком: надетый предмет меняет вид
          // сразу нескольких карточек, и собирать это руками дороже,
          // чем один запрос к серверу.
          setTimeout(() => window.location.reload(), 700);
        } catch (e) {
          toast('Нет связи с сервером', true);
          btn.disabled = false;
        }
      });
    });
  })();
  </script>
</body>
</html>
