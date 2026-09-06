<?php
/**
 * Score Submission API
 * POST /api/score.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/game_security.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Гость проходит ровно те же проверки, что и авторизованный.
// Разница только в финале: его результат не пишется в таблицу очков,
// а откладывается в серверной сессии до регистрации или входа.
$isGuest = !isLoggedIn();

$body = json_decode(file_get_contents('php://input'), true);
$gameId = isset($body['game_id']) ? trim($body['game_id']) : '';
$runId = isset($body['run_id']) ? trim((string)$body['run_id']) : '';
$runToken = isset($body['run_token']) ? trim((string)$body['run_token']) : '';
$payload = isset($body['payload']) && is_array($body['payload']) ? $body['payload'] : [];

$allowedGames = ['sorter', 'network', 'millionaire', 'pixelgame'];
if (!in_array($gameId, $allowedGames, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown game_id']);
    exit;
}

$userId = $isGuest ? 0 : (int)$_SESSION['user_id'];

if ($runId === '' || $runToken === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing run_id/run_token']);
    exit;
}
if (!isset($_SESSION['game_runs']) || !is_array($_SESSION['game_runs']) || !isset($_SESSION['game_runs'][$runId])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unknown run_id']);
    exit;
}
$run = $_SESSION['game_runs'][$runId];
if (!is_array($run) || ($run['game_id'] ?? '') !== $gameId) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Run does not match game']);
    exit;
}
$startedAt = (int)($run['started_at'] ?? 0);
if ($startedAt <= 0 || !gc_verify_run_token($userId, $runId, $gameId, $startedAt, $runToken)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Invalid run token']);
    exit;
}
if (!empty($run['used'])) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'error' => 'Run already used']);
    exit;
}

if (!isset($_SESSION['last_score_submit'])) $_SESSION['last_score_submit'] = [];
if (!is_array($_SESSION['last_score_submit'])) $_SESSION['last_score_submit'] = [];
$now = time();
$lastTs = (int)($_SESSION['last_score_submit'][$gameId] ?? 0);
if ($lastTs > 0 && ($now - $lastTs) < 3) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'Too many submissions']);
    exit;
}

function gc_int($v, int $min, int $max, int $default = 0): int {
    if (!is_numeric($v)) return $default;
    $n = (int)$v;
    if ($n < $min) return $default;
    if ($n > $max) return $default;
    return $n;
}

function gc_require_keys(array $arr, array $keys): bool {
    foreach ($keys as $k) {
        if (!array_key_exists($k, $arr)) return false;
    }
    return true;
}

function gc_compute_score(string $gameId, array $payload, int $startedAt = 0): array {
    if ($gameId === 'network') {
        if (!gc_require_keys($payload, ['level_id', 'correct', 'wrong', 'elapsed_ms'])) {
            return ['ok' => false, 'error' => 'Invalid payload'];
        }
        $levelId = (string)$payload['level_id'];
        if (!in_array($levelId, ['level1', 'level2', 'level3'], true)) {
            return ['ok' => false, 'error' => 'Invalid level_id'];
        }
        // 'lose' — все три жизни потрачены. Пишем такую попытку в историю
        // с нулём очков, чтобы поражение было видно наравне с победой.
        // Старые клиенты поля result не шлют — считаем такой запрос победой.
        $result = (string)($payload['result'] ?? 'win');
        if (!in_array($result, ['win', 'lose'], true)) {
            return ['ok' => false, 'error' => 'Invalid result'];
        }
        $correct = gc_int($payload['correct'], 0, 3, -1);
        $wrong = gc_int($payload['wrong'], 0, 3, -1);
        $elapsed = gc_int($payload['elapsed_ms'], 0, 3600_000, -1);
        if ($correct < 0 || $wrong < 0 || $elapsed < 0) return ['ok' => false, 'error' => 'Invalid stats'];
        if (($correct + $wrong) !== 3) return ['ok' => false, 'error' => 'Rounds mismatch'];
        $lives = 3;
        if ($result === 'win') {
            if ($wrong >= $lives) return ['ok' => false, 'error' => 'Not a win'];
        } else {
            // Проигрыш наступает ровно на третьей ошибке, а раундов всего три,
            // поэтому у проигравшего не может быть ни одного верного ответа.
            if ($wrong !== $lives) return ['ok' => false, 'error' => 'Invalid loss state'];
        }
        if ($elapsed < 1800) return ['ok' => false, 'error' => 'Too fast'];
        return ['ok' => true, 'score' => $correct * 100, 'meta' => ['level_id' => $levelId, 'result' => $result, 'correct' => $correct, 'wrong' => $wrong, 'elapsed_ms' => $elapsed]];
    }

    if ($gameId === 'sorter') {
        if (!gc_require_keys($payload, ['level', 'correct_total', 'errors_total', 'correct_by_level', 'elapsed_ms'])) {
            return ['ok' => false, 'error' => 'Invalid payload'];
        }

        // 'lose' — проигрыш: жизни кончились раньше, чем набрана цель.
        // Очки за уже разобранные блоки всё равно засчитываются.
        // Старые клиенты поля result не шлют — считаем такой запрос победой.
        $result = (string)($payload['result'] ?? 'win');
        if (!in_array($result, ['win', 'lose'], true)) {
            return ['ok' => false, 'error' => 'Invalid result'];
        }
        $level = gc_int($payload['level'], 1, 3, -1);
        $correctTotal = gc_int($payload['correct_total'], 0, 20, -1);
        $errorsTotal = gc_int($payload['errors_total'], 0, 3, -1); // 3 = все жизни потрачены (проигрыш)
        $elapsed = gc_int($payload['elapsed_ms'], 0, 3600_000, -1);
        if ($level < 0 || $correctTotal < 0 || $errorsTotal < 0 || $elapsed < 0) return ['ok' => false, 'error' => 'Invalid stats'];

        $targets = [1 => 10, 2 => 15, 3 => 20];
        $lives = 3; // одинаково на всех уровнях; каждая ошибка стоит жизни
        $target = $targets[$level];

        if ($result === 'win') {
            // Победа возможна только при полностью набранной цели
            // и при том, что жизни ещё оставались.
            if ($correctTotal !== $target) return ['ok' => false, 'error' => 'Invalid correct_total'];
            if ($errorsTotal >= $lives) return ['ok' => false, 'error' => 'Too many errors'];
        } else {
            // Проигрыш наступает ровно тогда, когда потрачены все жизни.
            // Это условие не даёт «сдаться пораньше» и забрать очки:
            // без трёх ошибок игра не заканчивается.
            if ($errorsTotal !== $lives) return ['ok' => false, 'error' => 'Invalid loss state'];
            if ($correctTotal >= $target) return ['ok' => false, 'error' => 'Loss with target reached'];
        }
        if (!is_array($payload['correct_by_level'])) return ['ok' => false, 'error' => 'Invalid correct_by_level'];

        $c1 = gc_int($payload['correct_by_level'][1] ?? $payload['correct_by_level']['1'] ?? 0, 0, $target, -1);
        $c2 = gc_int($payload['correct_by_level'][2] ?? $payload['correct_by_level']['2'] ?? 0, 0, $target, -1);
        $c3 = gc_int($payload['correct_by_level'][3] ?? $payload['correct_by_level']['3'] ?? 0, 0, $target, -1);
        if ($c1 < 0 || $c2 < 0 || $c3 < 0) return ['ok' => false, 'error' => 'Invalid breakdown'];
        if (($c1 + $c2 + $c3) !== $correctTotal) return ['ok' => false, 'error' => 'Breakdown mismatch'];
        if ($level === 1 && ($c2 > 0 || $c3 > 0)) return ['ok' => false, 'error' => 'Invalid levels for LVL1'];
        if ($level === 2 && ($c3 > 0)) return ['ok' => false, 'error' => 'Invalid levels for LVL2'];

        $score = ($c1 * 15) + ($c2 * 20) + ($c3 * 25) - ($errorsTotal * 5);
        if ($score < 0) $score = 0;
        $minMs = (int)(($correctTotal + $errorsTotal) * 350);
        if ($elapsed < max(2000, $minMs)) return ['ok' => false, 'error' => 'Too fast'];

        return ['ok' => true, 'score' => $score, 'meta' => [
            'level' => $level,
            'result' => $result,
            'correct_total' => $correctTotal,
            'errors_total' => $errorsTotal,
            'correct_by_level' => ['1' => $c1, '2' => $c2, '3' => $c3],
            'elapsed_ms' => $elapsed,
        ]];
    }

    if ($gameId === 'millionaire') {
        if (!gc_require_keys($payload, ['reached', 'won', 'elapsed_ms'])) {
            return ['ok' => false, 'error' => 'Invalid payload'];
        }
        $reached = gc_int($payload['reached'], 1, 15, -1);
        $won = (bool)$payload['won'];
        $elapsed = gc_int($payload['elapsed_ms'], 0, 7200_000, -1);
        if ($reached < 0 || $elapsed < 0) return ['ok' => false, 'error' => 'Invalid stats'];

        if ($won) {
            if ($reached !== 15) return ['ok' => false, 'error' => 'Win mismatch'];
            $score = 1000;
        } else {
            $score = ($reached >= 10) ? 320 : (($reached >= 5) ? 10 : 0);
        }

        if ($elapsed < $reached * 1200) return ['ok' => false, 'error' => 'Too fast'];
        return ['ok' => true, 'score' => $score, 'meta' => ['reached' => $reached, 'won' => $won, 'elapsed_ms' => $elapsed]];
    }

    if ($gameId === 'pixelgame') {
        if (!gc_require_keys($payload, [
            'level', 'chests_opened', 'total_chests',
            'monster_battles_won', 'monster_battles_total', 'hp_remaining',
            'elapsed_ms', 'direct_pts', 'completed',
        ])) {
            return ['ok' => false, 'error' => 'Invalid payload'];
        }

        $level      = gc_int($payload['level'], 1, 4, -1);
        $chests     = gc_int($payload['chests_opened'], 0, 5, -1);
        $total      = gc_int($payload['total_chests'], 1, 5, -1);
        $battlesWon = gc_int($payload['monster_battles_won'], 0, 6, -1);  // max 6 врагов на карте
        $battlesAll = gc_int($payload['monster_battles_total'], 0, 100, -1);
        $hp         = gc_int($payload['hp_remaining'], 0, 5, -1); // 0 = игрок погиб (проигрыш)
        $elapsed    = gc_int($payload['elapsed_ms'], 0, 7200_000, -1);
        $directPts  = gc_int($payload['direct_pts'], 0, 99999, -1);
        $completed  = $payload['completed'] === true;

        if ($level < 0 || $chests < 0 || $total < 0
            || $battlesWon < 0 || $battlesAll < 0 || $hp < 0 || $elapsed < 0 || $directPts < 0) {
            return ['ok' => false, 'error' => 'Invalid stats'];
        }
        if ($battlesWon > $battlesAll) return ['ok' => false, 'error' => 'Battles mismatch'];

        // Анти-спидран: используем серверное время, а не клиентское elapsed_ms
        // Клиент может подделать elapsed_ms — сервер знает реальное время старта
        $serverElapsed = $startedAt > 0 ? (int)((time() - $startedAt) * 1000) : $elapsed;

        if (!$completed) {
            // Проигрыш: HP кончились, уровень не пройден. Пишем попытку в историю
            // с нулём очков. Проверку времени здесь не делаем — умереть можно быстро,
            // а накрутить нечего: за проигрыш начисляется ровно 0.
            if ($hp !== 0) return ['ok' => false, 'error' => 'Invalid loss state'];
            $score = 0;
        } else {
            // Очки только за победу: уровень пройден, все сундуки собраны, игрок жив
            if ($hp < 1) return ['ok' => false, 'error' => 'Invalid win state'];
            if ($chests !== $total) return ['ok' => false, 'error' => 'Chests mismatch'];
            $minMs = max(15000, $total * 4000 + $battlesAll * 2000);
            if ($serverElapsed < $minMs) return ['ok' => false, 'error' => 'Too fast'];

            // Cap очков: только победные битвы дают очки (battlesWon, не battlesAll)
            // Это закрывает вектор: накрутить battlesAll чтобы раздуть разрешённый максимум
            $maxPossible = ($total * 20) + ($battlesWon * 15);
            $score = max(0, min($directPts, $maxPossible));
        }

        return ['ok' => true, 'score' => $score, 'meta' => [
            'level' => $level,
            'result' => $completed ? 'win' : 'lose',
            'chests_opened' => $chests,
            'total_chests' => $total,
            'monster_battles_won' => $battlesWon,
            'monster_battles_total' => $battlesAll,
            'hp_remaining' => $hp,
            'elapsed_ms' => $serverElapsed,
            'direct_pts' => $directPts,
        ]];
    }

    return ['ok' => false, 'error' => 'Unsupported game'];
}

$computed = gc_compute_score($gameId, $payload, $startedAt);
if (empty($computed['ok'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $computed['error'] ?? 'Invalid score payload']);
    exit;
}

$score = (int)$computed['score'];
$meta = $computed['meta'] ?? [];

if ($isGuest) {
    // Храним ТОЛЬКО последний результат — так решено по продукту.
    // Число живёт на сервере: браузер получает его лишь для показа в окне
    // и подделать сохраняемое значение не может.
    $_SESSION['pending_score'] = [
        'game_id'    => $gameId,
        'score'      => $score,
        'meta'       => $meta,
        'created_at' => $now,
    ];

    $_SESSION['game_runs'][$runId]['used'] = true;
    $_SESSION['last_score_submit'][$gameId] = $now;

    echo json_encode([
        'ok'      => true,
        'saved'   => false,
        'guest'   => true,
        'pending' => true,
        'score'   => $score,
    ]);
    exit;
}

// Сумма очков этого пользователя в этой игре ДО новой записи — SQL вместо readScores()
$beforeRows = gamecode_pg_query_all(
    'SELECT COALESCE(SUM(score), 0) AS total FROM scores WHERE user_id = $1 AND game_id = $2',
    [$userId, $gameId]
);
$totalBeforeGame = (int)($beforeRows[0]['total'] ?? 0);

$savedEntry = addScore($userId, $gameId, $score, $meta);
if (!$savedEntry) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Cannot write score']);
    exit;
}

cache_invalidate_leaderboard($gameId);

// Сумма всех очков пользователя ПОСЛЕ сохранения — SQL вместо readScores()
$afterRows = gamecode_pg_query_all(
    'SELECT COALESCE(SUM(score), 0) AS total FROM scores WHERE user_id = $1',
    [$userId]
);
$totalAll = (int)($afterRows[0]['total'] ?? 0);
updateUser($userId, ['best_score' => $totalAll]);

cache_invalidate_user($userId, $_SESSION['user_nickname'] ?? '');

$totalAfterGame = $totalBeforeGame + $score;
$_SESSION['game_runs'][$runId]['used'] = true;
$_SESSION['last_score_submit'][$gameId] = $now;

echo json_encode([
    'ok' => true,
    'saved' => true,
    'score' => $score,
    'old_score' => $totalBeforeGame,
    'is_record' => $totalAfterGame > $totalBeforeGame,
    'total_game_score' => $totalAfterGame,
]);
