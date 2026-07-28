<?php
/**
 * Stats API
 * GET /api/stats.php — возвращает кол-во зарегистрированных пользователей
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';

$rows = gamecode_pg_query_all('SELECT COUNT(*) AS cnt FROM users', []);
$userCount = (int)($rows[0]['cnt'] ?? 0);

echo json_encode([
    'ok'         => true,
    'user_count' => $userCount,
]);
