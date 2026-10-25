<?php
declare(strict_types=1);

function gc_get_app_secret(): string {
    $path = dirname(__DIR__) . '/data/app_secret.key';
    $dir  = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    if (is_file($path)) {
        $raw = (string)@file_get_contents($path);
        $raw = trim($raw);
        if ($raw !== '') return $raw;
    }

    $secret = bin2hex(random_bytes(32)); // 64 hex chars
    @file_put_contents($path, $secret, LOCK_EX);
    return $secret;
}

function gc_hmac(string $data): string {
    $secret = gc_get_app_secret();
    return hash_hmac('sha256', $data, $secret);
}

function gc_sign_run_token(int $userId, string $runId, string $gameId, int $startedAtUnix): string {
    return gc_hmac($userId . '|' . $runId . '|' . $gameId . '|' . $startedAtUnix);
}

function gc_verify_run_token(int $userId, string $runId, string $gameId, int $startedAtUnix, string $token): bool {
    $expected = gc_sign_run_token($userId, $runId, $gameId, $startedAtUnix);
    return hash_equals($expected, $token);
}


/* ============================================================
   ОБЩЕЕ ДЛЯ ИГР, КОТОРЫЕ ВЕДЁТ СЕРВЕР
   («Миллионер», «Сортировщик», CodeQuest — по образцу «Глюк-атаки»)

   Ран выдаёт api/ping-game.php: run_id + подписанный run_token.
   Состояние партии лежит в сессии рядом с раном:
     $_SESSION['game_runs'][$runId][$gameId] = [...]
   Браузер присылает только действия игрока (какой вариант выбрал,
   в какую корзину бросил), а верность, очки и жизни считает сервер.
   api/score.php потом берёт итог из этого же состояния.
   ============================================================ */

/** Ран этой игры по run_id/run_token или текст ошибки. */
function gc_game_load_run(string $gameId, string $runId, string $runToken) {
    if ($runId === '' || $runToken === '') return 'Нет run_id/run_token';
    $run = $_SESSION['game_runs'][$runId] ?? null;
    if (!is_array($run) || ($run['game_id'] ?? '') !== $gameId) return 'Неизвестная партия';
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $startedAt = (int)($run['started_at'] ?? 0);
    if ($startedAt <= 0 || !gc_verify_run_token($userId, $runId, $gameId, $startedAt, $runToken)) {
        return 'Неверная подпись партии';
    }
    if (!empty($run['used'])) return 'Партия уже завершена';
    return $run;
}

function gc_game_save(string $runId, string $gameId, array $state): void {
    $_SESSION['game_runs'][$runId][$gameId] = $state;
}

function gc_game_out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function gc_game_fail(string $error, int $code = 400): void {
    gc_game_out(['ok' => false, 'error' => $error], $code);
}

/**
 * Разбор POST-запроса игрового API: JSON-тело, действие, ран.
 * Возвращает [$body, $action, $runId, $run]; при ошибке отвечает сам.
 */
function gc_game_request(string $gameId): array {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') gc_game_fail('Method not allowed', 405);
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) gc_game_fail('Invalid JSON');
    $runId    = trim((string)($body['run_id'] ?? ''));
    $runToken = trim((string)($body['run_token'] ?? ''));
    $run = gc_game_load_run($gameId, $runId, $runToken);
    if (!is_array($run)) gc_game_fail($run, 403);
    return [$body, (string)($body['action'] ?? ''), $runId, $run];
}

/** Порядок вариантов, перемешанный сервером: позиция на экране => индекс в базе. */
function gc_shuffled_order(int $n = 4): array {
    $order = range(0, $n - 1);
    shuffle($order);
    return $order;
}
