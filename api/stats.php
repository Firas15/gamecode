<?php
/**
 * GAME CODE — Stats API
 * GET /api/stats.php — возвращает кол-во зарегистрированных пользователей
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';

$users = readUsers();

echo json_encode([
    'ok'         => true,
    'user_count' => count($users),
]);
