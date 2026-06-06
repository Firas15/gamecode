<?php
$current = basename($_SERVER['PHP_SELF']);
$links = [
  'dashboard.php' => ['icon' => '📊', 'label' => 'DASHBOARD'],
  'users.php'     => ['icon' => '👥', 'label' => 'ПОЛЬЗОВАТЕЛИ'],
  'games.php'     => ['icon' => '🎮', 'label' => 'ИГРЫ'],
  'news.php'      => ['icon' => '📰', 'label' => 'НОВОСТИ'],
  'log.php'       => ['icon' => '📋', 'label' => 'ЛОГ'],
  'settings.php'  => ['icon' => '⚙',  'label' => 'НАСТРОЙКИ'],
];
?>
<nav class="adm-sidebar">
  <div class="adm-sidebar-logo">
    <span class="pixel">GAME</span><span class="pixel accent">CODE</span>
    <div class="adm-sidebar-badge pixel">ADMIN</div>
  </div>
  <ul class="adm-nav">
    <?php foreach ($links as $href => $item): ?>
    <li>
      <a href="<?= $href ?>" class="adm-nav-link pixel <?= $current === $href ? 'active' : '' ?>">
        <span class="nav-icon"><?= $item['icon'] ?></span>
        <?= $item['label'] ?>
      </a>
    </li>
    <?php endforeach; ?>
  </ul>
  <div class="adm-sidebar-footer">
    <a href="../index.html" class="pixel">◀ НА САЙТ</a>
  </div>
</nav>
