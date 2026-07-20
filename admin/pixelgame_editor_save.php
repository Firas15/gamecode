<?php
/**
 * GAME CODE — Pixelgame Editor Save API (админка)
 * POST /admin/pixelgame_editor_save.php
 *
 * Actions (JSON body):
 *   { action: 'save_level',     level_number: N, level: {...} }
 *   { action: 'delete_level',   level_number: N }
 *   { action: 'save_questions', data: { topic, questions: [...] } }
 *
 * Пишет в PostgreSQL (pixelgame_levels / pixelgame_monster_questions),
 * сбрасывает Redis-кэш контента, логирует в admin_log.
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!adminIsLoggedIn()) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Not authorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
    exit;
}

$action = (string)($body['action'] ?? '');

if ($action === 'save_level') {
    $levelNumber = (int)($body['level_number'] ?? 0);
    $level = $body['level'] ?? null;

    if ($levelNumber < 1 || $levelNumber > 100) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid level_number']);
        exit;
    }
    if (!is_array($level) || !isset($level['chests']) || !is_array($level['chests'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid level data (chests required)']);
        exit;
    }

    if (!writePixelgameLevel($levelNumber, $level)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Cannot write to PostgreSQL']);
        exit;
    }

    cache_invalidate_pixelgame($levelNumber);
    writeLog('Pixelgame: сохранён уровень', 'level ' . $levelNumber . ' — ' . (string)($level['title'] ?? ''));
    echo json_encode(['ok' => true, 'level_number' => $levelNumber]);
    exit;
}

if ($action === 'delete_level') {
    $levelNumber = (int)($body['level_number'] ?? 0);
    if ($levelNumber < 1 || $levelNumber > 100) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid level_number']);
        exit;
    }

    if (!deletePixelgameLevel($levelNumber)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Cannot delete from PostgreSQL']);
        exit;
    }

    cache_invalidate_pixelgame($levelNumber);
    writeLog('Pixelgame: удалён уровень', 'level ' . $levelNumber);
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'save_questions') {
    $data = $body['data'] ?? null;
    if (!is_array($data) || !isset($data['questions']) || !is_array($data['questions'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid questions data']);
        exit;
    }

    if (!writePixelgameMonsterQuestions($data)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Cannot write to PostgreSQL']);
        exit;
    }

    cache_invalidate_pixelgame();
    writeLog('Pixelgame: сохранены вопросы монстров', 'вопросов: ' . count($data['questions']));
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action']);
