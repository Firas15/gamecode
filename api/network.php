<?php
/**
 * ============================================================
 *  API «Сетевого маршрута»
 *
 *  GET  ?action=levels                         — уровни для меню
 *  POST {action:'start',  run_id, run_token, level:1..3}
 *        — сервер собирает партию; в ответ — только её длина и время
 *  POST {action:'next',   run_id, run_token}
 *        — следующее задание без ответа
 *  POST {action:'hint',   run_id, run_token, index}
 *        — игрок открыл калькулятор: очки за задание делятся пополам
 *  POST {action:'answer', run_id, run_token, index, choice}
 *        — choice 0..3 или -1 (не успел); сервер проверяет, считает
 *          очки и только теперь говорит верный ответ и пояснение
 *
 *  run_id/run_token — из api/ping-game.php, как у всех игр сайта.
 *  Итог записывает api/score.php по состоянию из этого файла.
 *  Подробности — в includes/network.php.
 * ============================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/network.php';

function net_out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function net_fail(string $error, int $code = 400): void {
    net_out(['ok' => false, 'error' => $error], $code);
}

// ---------- уровни для меню ----------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (($_GET['action'] ?? '') !== 'levels') net_fail('Unknown action');
    $levels = [];
    foreach (NET_LEVELS as $id => $cfg) {
        $levels[] = [
            'id'    => $id,
            'name'  => $cfg['name'],
            'tasks' => array_sum($cfg['plan']),
            'time'  => $cfg['time'],
            'types' => array_values(array_map(static fn($t) => NET_TYPE_LABELS[$t], array_keys($cfg['plan']))),
        ];
    }
    net_out(['ok' => true, 'levels' => $levels, 'lives' => NET_LIVES]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') net_fail('Method not allowed', 405);

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) net_fail('Invalid JSON');
$action   = (string)($body['action'] ?? '');
$runId    = trim((string)($body['run_id'] ?? ''));
$runToken = trim((string)($body['run_token'] ?? ''));

$run = network_load_run($runId, $runToken);
if (!is_array($run)) net_fail($run, 403);
$g = $run['network'] ?? null;

function net_save(string $runId, array $g): void {
    $_SESSION['game_runs'][$runId]['network'] = $g;
}

// ---------- старт ----------
if ($action === 'start') {
    if (is_array($g)) net_fail('Партия уже начата', 409);
    $level = (int)($body['level'] ?? 0);
    if (!isset(NET_LEVELS[$level])) net_fail('Неизвестный уровень');

    $tasks = network_build_tasks($level);
    $g = [
        'level'    => $level,
        'tasks'    => $tasks,
        'pos'      => 0,
        'issued'   => null,
        'lives'    => NET_LIVES,
        'score'    => 0,
        'bonus'    => 0,
        'streak'   => 0,
        'best'     => 0,
        'right'    => 0,
        'wrong'    => 0,
        'hints'    => 0,
        'by_type'  => [],
        'finished' => false,
        'won'      => false,
    ];
    net_save($runId, $g);
    net_out([
        'ok'    => true,
        'level' => $level,
        'name'  => NET_LEVELS[$level]['name'],
        'total' => count($tasks),
        'lives' => NET_LIVES,
    ]);
}

if (!is_array($g)) net_fail('Партия не начата', 409);
if (!empty($g['finished'])) net_fail('Партия уже окончена', 409);

// ---------- следующее задание ----------
if ($action === 'next') {
    $pos = (int)$g['pos'];
    $task = $g['tasks'][$pos] ?? null;
    if (!$task) net_fail('Задания закончились', 409);
    // Повторный запрос (оборвалась сеть) отдаёт то же задание и не сбрасывает время
    if (!is_array($g['issued']) || (int)$g['issued']['pos'] !== $pos) {
        $g['issued'] = ['pos' => $pos, 'at' => microtime(true), 'hint' => false];
        net_save($runId, $g);
    }
    net_out(['ok' => true] + network_public_task($task, $pos, count($g['tasks']), (int)$g['level'])
        + ['hint' => !empty($g['issued']['hint'])]);
}

// ---------- подсказка-калькулятор ----------
if ($action === 'hint') {
    $issued = $g['issued'];
    if (!is_array($issued) || (int)($body['index'] ?? -1) !== (int)$issued['pos']) net_fail('Не то задание', 409);
    $task = $g['tasks'][(int)$issued['pos']];
    if (empty($task['calc'])) net_fail('Для этого задания калькулятора нет');
    if (empty($issued['hint'])) {
        $g['issued']['hint'] = true;
        $g['hints']++;
        net_save($runId, $g);
    }
    net_out(['ok' => true, 'hint' => true]);
}

// ---------- ответ ----------
if ($action === 'answer') {
    $issued = $g['issued'];
    if (!is_array($issued)) net_fail('Задание не выдано', 409);
    $index = (int)($body['index'] ?? -2);
    if ($index !== (int)$issued['pos']) net_fail('Не то задание', 409);
    $choice = (int)($body['choice'] ?? -1);
    if ($choice < -1 || $choice > 3) $choice = -1;

    $elapsed = microtime(true) - (float)$issued['at'];
    // Прочитать задание и кликнуть быстрее полсекунды человек не может
    if ($choice >= 0 && $elapsed < NET_MIN_ANSWER) net_fail('Слишком рано', 409);

    $level = (int)$g['level'];
    $cfg = NET_LEVELS[$level];
    $task = $g['tasks'][$index];
    $limit = network_time_limit($task, $level);
    $late = $elapsed > $limit + NET_GRACE_SEC;
    $ok = $choice >= 0 && $choice === (int)$task['answer'];

    $points = 0;
    if ($ok) {
        $g['streak']++;
        $g['best'] = max($g['best'], $g['streak']);
        $g['right']++;
        if (!$late) {
            $speed = max(0.0, min(1.0, 1 - $elapsed / $limit));
            $points = $cfg['base'] + (int)round($cfg['speed'] * $speed) + network_combo_bonus($g['streak']);
            if (!empty($issued['hint'])) $points = intdiv($points, 2);
        }
    } else {
        $g['streak'] = 0;
        $g['wrong']++;
        $g['lives'] = max(0, $g['lives'] - 1);
    }
    $g['score'] = min(NET_SCORE_CAP, $g['score'] + $points);

    $type = $task['type'];
    if (!isset($g['by_type'][$type])) $g['by_type'][$type] = ['n' => 0, 'ok' => 0];
    $g['by_type'][$type]['n']++;
    if ($ok) $g['by_type'][$type]['ok']++;

    $g['issued'] = null;
    $g['pos'] = $index + 1;
    if ($g['lives'] <= 0) {
        $g['finished'] = true;
        $g['won'] = false;
    } elseif ($g['pos'] >= count($g['tasks'])) {
        $g['finished'] = true;
        $g['won'] = true;
        $g['bonus'] = $cfg['bonus'];
        $g['score'] = min(NET_SCORE_CAP, $g['score'] + $cfg['bonus']);
    }
    net_save($runId, $g);

    net_out(array_merge([
        'ok'         => true,
        'correct'    => $ok,
        'right'      => (int)$task['answer'],
        'right_text' => (string)$task['options'][(int)$task['answer']],
        'explain'    => (string)$task['explain'],
        'points'     => $points,
        'late'       => $ok && $late,
        'hinted'     => !empty($issued['hint']),
    ], network_public_state($g)));
}

net_fail('Unknown action');
