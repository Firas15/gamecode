<?php
/**
 * GAME CODE — Pixelgame Monster Questions API
 * GET /api/pixelgame-questions.php
 *
 * Отдаёт блок вопросов для боёв в том же формате, что и статический
 * games/pixelgame/data/monster-questions.json: { topic, questions: [...] }.
 *
 * Источник: Redis-кэш → PostgreSQL → JSON-фолбэк
 * (cached_read_pixelgame_monster_questions).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';

$data = cached_read_pixelgame_monster_questions();
if (!is_array($data) || empty($data['questions'])) {
    http_response_code(404);
    echo json_encode(['error' => 'Questions not found']);
    exit;
}

echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
