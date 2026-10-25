<?php
/**
 * Score Submission API
 * POST /api/score.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/game_security.php';
require_once __DIR__ . '/../includes/glitch.php';
require_once __DIR__ . '/../includes/network.php';
require_once __DIR__ . '/../includes/millionaire.php';
require_once __DIR__ . '/../includes/sorter.php';
require_once __DIR__ . '/../includes/codequest.php';

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

$allowedGames = ['sorter', 'network', 'millionaire', 'pixelgame', 'glitch'];
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

function gc_compute_score(string $gameId, array $payload, int $startedAt = 0, array $run = []): array {
    // ВРЕМЯ ПАРТИИ СЧИТАЕМ ПО СЕРВЕРУ, А НЕ ПО КЛИЕНТУ.
    //
    // elapsed_ms присылает браузер, и раньше проверки «слишком быстро»
    // опирались именно на него — а значит бот мог прислать красивые
    // «30 секунд» сразу после ping-game и фармить очки и пиксель коины
    // каждые несколько секунд, вообще не играя.
    //
    // started_at лежит в ране и входит в HMAC-подпись run_token, так
    // что подделать его нельзя: партия не может закончиться раньше,
    // чем сервер её зарегистрировал. Клиентский elapsed_ms остаётся
    // только для справки в мете.
    $clientElapsed = gc_int($payload['elapsed_ms'] ?? 0, 0, 7200_000, 0);
    $serverElapsed = $startedAt > 0
        ? (int)((time() - $startedAt) * 1000)
        : $clientElapsed;

    if ($gameId === 'network') {
        // «Сетевой маршрут» ведёт сервер (api/network.php): задания, проверка
        // ответов и очки — там же, по серверным часам. Из payload браузера
        // здесь не берётся ничего — только итог из состояния рана.
        $g = $run['network'] ?? null;
        if (!is_array($g)) return ['ok' => false, 'error' => 'Run not started'];
        if (empty($g['finished'])) return ['ok' => false, 'error' => 'Run not finished'];
        $answered = (int)$g['right'] + (int)$g['wrong'];
        if ($answered <= 0) return ['ok' => false, 'error' => 'Nothing answered'];
        // Честный минимум: каждое задание — прочитать и ответить (≥ 0.5 с, это
        // проверяет api/network.php) плюс показ результата (~1.5 с). Берём 80 %:
        // так даже бот со всеми ответами сдаёт партии не чаще живого игрока.
        $minMs = (int)(0.8 * $answered * 2000);
        if ($serverElapsed < max(5000, $minMs)) return ['ok' => false, 'error' => 'Too fast'];
        $score = max(0, min(NET_SCORE_CAP, (int)$g['score']));
        return ['ok' => true, 'score' => $score, 'meta' => [
            'level_id'    => 'level' . (int)$g['level'],
            'result'      => !empty($g['won']) ? 'win' : 'lose',
            'correct'     => (int)$g['right'],
            'wrong'       => (int)$g['wrong'],
            'best_streak' => (int)$g['best'],
            'hints'       => (int)$g['hints'],
            'lives_left'  => (int)$g['lives'],
            'by_type'     => (array)$g['by_type'],
            'elapsed_ms'  => $serverElapsed,
        ]];
    }

    if ($gameId === 'sorter') {
        // «Сортировщик» ведёт сервер (api/sorter.php): каждый блок проверен
        // там же. Из payload браузера не берётся ничего.
        $st = $run['sorter'] ?? null;
        if (!is_array($st)) return ['ok' => false, 'error' => 'Run not started'];
        if (empty($st['finished'])) return ['ok' => false, 'error' => 'Run not finished'];
        $answered = (int)$st['correct'] + (int)$st['errors'];
        // Каждый блок — не меньше 0.35 с до ответа и 0.4 с до следующего
        if ($answered > 0 && $serverElapsed < (int)($answered * 750)) return ['ok' => false, 'error' => 'Too fast'];
        $bl = (array)$st['by_level'];
        return ['ok' => true, 'score' => max(0, (int)$st['score']), 'meta' => [
            'level'            => (int)$st['level'],
            'result'           => !empty($st['won']) ? 'win' : 'lose',
            'correct_total'    => (int)$st['correct'],
            'errors_total'     => (int)$st['errors'],
            'correct_by_level' => ['1' => (int)($bl['1'] ?? 0), '2' => (int)($bl['2'] ?? 0), '3' => (int)($bl['3'] ?? 0)],
            'elapsed_ms'       => $serverElapsed,
        ]];
    }

    if ($gameId === 'millionaire') {
        // «Миллионера» ведёт сервер (api/millionaire.php): вопросы, ответы
        // и подсказки — там. Из payload браузера не берётся ничего.
        $m = $run['millionaire'] ?? null;
        if (!is_array($m)) return ['ok' => false, 'error' => 'Run not started'];
        if (empty($m['finished'])) return ['ok' => false, 'error' => 'Run not finished'];
        $answered = (int)$m['right'] + (int)$m['wrong'];
        // Каждый ответ сервер принимает не раньше чем через 0.8 с после выдачи,
        // плюс анимация «думаем» и пояснение — честная партия длится дольше.
        if ($answered > 0 && $serverElapsed < (int)($answered * 1500)) return ['ok' => false, 'error' => 'Too fast'];
        $score = mil_score($m);
        return ['ok' => true, 'score' => $score, 'meta' => [
            'reached'    => min(MIL_TOTAL, (int)$m['right'] + (empty($m['won']) ? 1 : 0)),
            'won'        => !empty($m['won']),
            'correct'    => (int)$m['right'],
            'elapsed_ms' => $serverElapsed,
        ]];
    }

    if ($gameId === 'pixelgame') {
        // CodeQuest ведёт сервер (api/pixelgame.php): каждый ответ сундука и
        // боя проверен там же, там же начислены очки. Из payload не берётся ничего.
        $g = $run['pixelgame'] ?? null;
        if (!is_array($g)) return ['ok' => false, 'error' => 'Run not started'];
        if (empty($g['finished'])) return ['ok' => false, 'error' => 'Run not finished'];
        $battles = count((array)$g['battles']);
        if (!empty($g['won'])) {
            // Пройти лабиринт с сундуками и врагами быстрее нельзя
            $minMs = max(15000, (int)$g['total_chests'] * 4000 + $battles * 2000);
            if ($serverElapsed < $minMs) return ['ok' => false, 'error' => 'Too fast'];
        }
        return ['ok' => true, 'score' => cq_score($g), 'meta' => [
            'level'                 => (int)$g['level'],
            'result'                => !empty($g['won']) ? 'win' : 'lose',
            'chests_opened'         => (int)$g['opened'],
            'total_chests'          => (int)$g['total_chests'],
            'monster_battles_won'   => (int)$g['battles_won'],
            'monster_battles_total' => $battles,
            'hp_remaining'          => (int)$g['hp'],
            'elapsed_ms'            => $serverElapsed,
            'direct_pts'            => (int)$g['pts'],
        ]];
    }

    if ($gameId === 'glitch') {
        // «Глюк-атаку» ведёт сервер (api/glitch.php): каждый ответ проверен
        // там же, очки посчитаны по серверным часам. Из payload браузера
        // здесь не берётся НИЧЕГО — только итог из состояния рана.
        $g = $run['glitch'] ?? null;
        if (!is_array($g)) return ['ok' => false, 'error' => 'Run not started'];
        if (empty($g['finished'])) return ['ok' => false, 'error' => 'Run not finished'];
        $answered = (int)$g['right'] + (int)$g['wrong'];
        if ($answered <= 0) return ['ok' => false, 'error' => 'Nothing answered'];
        // Честный минимум длительности партии: каждый вопрос — выход призрака
        // и пауза после ответа (~1.3 с), каждая волна — заставка 1.5 с,
        // босс — заставка и финал (~3.8 с). Берём 80 % с запасом на быстрые
        // машины. Это ограничивает, как часто можно сдавать даже идеальные
        // партии, — бот со списком ответов фармит не быстрее живого игрока.
        $waves = []; $boss = false;
        foreach (array_slice((array)$g['plan'], 0, (int)$g['pos']) as $item) {
            if (!empty($item['boss'])) $boss = true; else $waves[(int)$item['wave']] = true;
        }
        $minMs = (int)(0.8 * ($answered * 1300 + count($waves) * 1500 + ($boss ? 3800 : 0)));
        if ($serverElapsed < max(5000, $minMs)) return ['ok' => false, 'error' => 'Too fast'];
        $score = max(0, min(GLITCH_SCORE_CAP, (int)$g['score']));
        return ['ok' => true, 'score' => $score, 'meta' => [
            'result'      => !empty($g['won']) ? 'win' : 'lose',
            'correct'     => (int)$g['right'],
            'wrong'       => (int)$g['wrong'],
            'best_streak' => (int)$g['best'],
            'boss_killed' => (int)$g['boss_hp'] === 0,
            'lives_left'  => (int)$g['lives'],
            'themes'      => array_values((array)$g['themes']),
            'by_theme'    => (array)$g['by_theme'],
            'elapsed_ms'  => $serverElapsed,
        ]];
    }

    return ['ok' => false, 'error' => 'Unsupported game'];
}

$computed = gc_compute_score($gameId, $payload, $startedAt, $run);
if (empty($computed['ok'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $computed['error'] ?? 'Invalid score payload']);
    exit;
}

$score = (int)$computed['score'];
$meta = $computed['meta'] ?? [];

// Ран гасим ДО начисления, а не после.
//
// Раньше отметка ставилась в самом конце: если бы запрос оборвался
// между записью очков и этой строкой, ран остался бы «свежим», и
// повтор того же запроса начислил бы очки и коины второй раз.
// Порядок «сначала погасить, потом начислять» превращает это
// в «не более одного раза» вместо «не менее одного раза».
$_SESSION['game_runs'][$runId]['used'] = true;
$_SESSION['last_score_submit'][$gameId] = $now;

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

    echo json_encode([
        'ok'      => true,
        'saved'   => false,
        'guest'   => true,
        'pending' => true,
        'score'   => $score,
    ]);
    exit;
}

// Сколько коинов даст этот результат — считаем ДО записи, чтобы
// число попало в мету попытки. Иначе в истории игр («последние
// игры» в профиле) показать заработок было бы неоткуда: в таблице
// scores лежат только очки, а пересчёт задним числом соврал бы про
// партии, сыгранные до появления валюты.
$meta['coins'] = gc_shop_coins_for_score($score);

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

// Монеты магазина: процент от очков. Считаются от уже проверенного
// сервером значения — клиент на сумму повлиять не может.
// Очки при этом не расходуются: таблица лидеров живёт своей шкалой.
$coinsEarned = gc_shop_award_coins($userId, $score);

// Сумма всех очков пользователя ПОСЛЕ сохранения — SQL вместо readScores()
$afterRows = gamecode_pg_query_all(
    'SELECT COALESCE(SUM(score), 0) AS total FROM scores WHERE user_id = $1',
    [$userId]
);
$totalAll = (int)($afterRows[0]['total'] ?? 0);
updateUser($userId, ['best_score' => $totalAll]);

cache_invalidate_user($userId, $_SESSION['user_nickname'] ?? '');

$totalAfterGame = $totalBeforeGame + $score;

echo json_encode([
    'ok' => true,
    'saved' => true,
    'score' => $score,
    'old_score' => $totalBeforeGame,
    'is_record' => $totalAfterGame > $totalBeforeGame,
    'total_game_score' => $totalAfterGame,
    'coins_earned' => $coinsEarned,
    'coins' => gc_shop_coins($userId),
]);
