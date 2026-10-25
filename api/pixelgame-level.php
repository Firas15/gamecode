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
 *
 * Игроку уровень отдаётся БЕЗ правильных ответов: вопросы сундуков
 * проверяет сервер (api/pixelgame.php). Полные данные — только
 * вошедшему в админку: они нужны редактору уровней.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/codequest.php';

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

$isAdmin = !empty($_SESSION['gc_admin_auth']);
echo json_encode($isAdmin ? $data : cq_public_level($data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
