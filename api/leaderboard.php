<?php
/**
 * GAME CODE — Leaderboard API
 * GET /api/leaderboard.php?game=all
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

// Подключаем базу данных 
require_once __DIR__ . '/../includes/db.php';

$game = isset($_GET['game']) ? trim($_GET['game']) : 'all';
$allowedGames = ['all', 'sorter', 'network', 'millionaire'];
$limit = min((int)($_GET['limit'] ?? 10), 50);

if (!in_array($game, $allowedGames, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown game']);
    exit;
}


$result = cached_leaderboard($game, $limit);

// Отдаем мгновенный JSON-ответ клиенту
echo json_encode(['ok' => true, 'game' => $game, 'rows' => $result], JSON_UNESCAPED_UNICODE);