<?php
/**
 * Game Session Ping
 * POST /api/ping-game.php
 * Body: { game_id: "sorter"|"network"|"millionaire" }
 *
 * Вызывается при каждом запуске игры (startLevel).
 * Увеличивает счётчик games_played у пользователя.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/game_security.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isLoggedIn()) {
    echo json_encode(['ok' => true, 'skipped' => true]);
    exit;
}

$body   = json_decode(file_get_contents('php://input'), true);
$gameId = isset($body['game_id']) ? trim($body['game_id']) : '';

$allowedGames = ['sorter', 'network', 'millionaire', 'pixelgame'];
if (!in_array($gameId, $allowedGames, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown game_id']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$user   = findUserById($userId);

if (!$user) {
    echo json_encode(['error' => 'User not found']);
    exit;
}

$newCount = (int)($user['games_played'] ?? 0) + 1;
updateUser($userId, ['games_played' => $newCount]);

$runId = bin2hex(random_bytes(16));
$startedAt = time();

if (!isset($_SESSION['game_runs']) || !is_array($_SESSION['game_runs'])) {
    $_SESSION['game_runs'] = [];
}
$_SESSION['game_runs'][$runId] = [
    'game_id'     => $gameId,
    'started_at'  => $startedAt,
    'used'        => false,
];

if (count($_SESSION['game_runs']) > 20) {
    $_SESSION['game_runs'] = array_slice($_SESSION['game_runs'], -20, null, true);
}

$token = gc_sign_run_token($userId, $runId, $gameId, $startedAt);

echo json_encode([
    'ok' => true,
    'games_played' => $newCount,
    'run_id' => $runId,
    'run_token' => $token,
    'started_at' => $startedAt,
]);
