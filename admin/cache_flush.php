<?php
require_once __DIR__ . '/config.php';
requireAdmin();
require_once dirname(__DIR__) . '/includes/redis.php';

$r = gamecode_redis();
if (!$r) { echo 'Redis недоступен'; exit; }

$keys = ['gamecode:games', 'gamecode:news', 'gamecode:faq'];
foreach ($keys as $k) {
    $r->del($k);
}
// leaderboard keys
$lb = $r->keys('gamecode:lb:*');
if ($lb) { foreach ($lb as $k) $r->del($k); }

echo 'Кэш сброшен. <a href="javascript:history.back()">Назад</a>';
