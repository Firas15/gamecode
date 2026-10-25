<?php
/**
 * Pixelgame Monster Questions API
 * GET /api/pixelgame-questions.php
 *
 * Отдаёт блок вопросов для боёв в том же формате, что и статический
 * games/pixelgame/data/monster-questions.json: { topic, questions: [...] }.
 *
 * Источник: Redis-кэш → PostgreSQL → JSON-фолбэк
 * (cached_read_pixelgame_monster_questions).
 *
 * Игре этот список больше не нужен: вопрос боя выдаёт и проверяет
 * сервер (api/pixelgame.php). Игроку — без правильных ответов и
 * подсказок, полные данные — только вошедшему в админку.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';

$data = cached_read_pixelgame_monster_questions();
if (!is_array($data) || empty($data['questions'])) {
    http_response_code(404);
    echo json_encode(['error' => 'Questions not found']);
    exit;
}

if (empty($_SESSION['gc_admin_auth'])) {
    $data['questions'] = array_map(static function ($q) {
        if (is_array($q)) unset($q['correct'], $q['hint']);
        return $q;
    }, $data['questions']);
}
echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
