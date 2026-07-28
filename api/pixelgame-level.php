<?php
/**
 * Pixelgame Level API
 * GET /api/pixelgame-level.php?level=N
 *
 * Отдаёт данные уровня в том же формате, что и статический
 * games/pixelgame/data/levels/levelN.json (клиент игры одинаково
 * обрабатывает оба источника).
 *
 * Источник: Redis-кэш → PostgreSQL → JSON-фолбэк (cached_read_pixelgame_level).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';

$level = (int)($_GET['level'] ?? 0);
if ($level < 1 || $level > 100) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid level number']);
    exit;
}

$data = cached_read_pixelgame_level($level);
if (!is_array($data) || empty($data)) {
    http_response_code(404);
    echo json_encode(['error' => 'Level not found']);
    exit;
}

echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
