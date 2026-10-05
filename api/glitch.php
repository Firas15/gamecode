<?php
/**
 * ============================================================
 *  API «Глюк-атаки»
 *
 *  GET  ?action=themes                  — темы и число вопросов (меню игры)
 *  POST {action:'start',  run_id, run_token, themes:[...]}
 *        — сервер выбирает вопросы и раскладывает их по волнам;
 *          в ответ уходят только темы (для цвета и табличек призраков)
 *  POST {action:'next',   run_id, run_token}
 *        — текст следующего вопроса и варианты, без правильного
 *  POST {action:'answer', run_id, run_token, index, choice}
 *        — choice 0..3 или -1 (не успел); сервер проверяет ответ,
 *          считает очки и только теперь говорит, какой был верный
 *
 *  run_id/run_token — те же, что выдаёт api/ping-game.php.
 *  Итог партии записывает обычный api/score.php: он берёт очки
 *  из состояния, которое ведёт этот файл. Подробности — в includes/glitch.php.
 * ============================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/glitch.php';

function glitch_out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function glitch_fail(string $error, int $code = 400): void {
    glitch_out(['ok' => false, 'error' => $error], $code);
}

if (!glitch_tables_ready()) {
    glitch_fail('Игра ещё не настроена: нет таблиц вопросов (миграция 004-glitch.sql)', 503);
}

// ---------- темы для меню ----------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (($_GET['action'] ?? '') !== 'themes') glitch_fail('Unknown action');
    $themes = array_values(array_filter(glitch_themes(true), static fn($t) => $t['count'] > 0));
    glitch_out([
        'ok'     => true,
        'themes' => array_map(static fn($t) => ['id' => $t['id'], 'name' => $t['name'], 'color' => $t['color'], 'count' => $t['count']], $themes),
        'min'    => GLITCH_MIN_Q,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') glitch_fail('Method not allowed', 405);

$body     = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) glitch_fail('Invalid JSON');
$action   = (string)($body['action'] ?? '');
$runId    = trim((string)($body['run_id'] ?? ''));
$runToken = trim((string)($body['run_token'] ?? ''));

$run = glitch_load_run($runId, $runToken);
if (!is_array($run)) glitch_fail($run, 403);
$g = $run['glitch'] ?? null;

// ---------- старт: сервер раскладывает вопросы ----------
if ($action === 'start') {
    if (is_array($g)) glitch_fail('Партия уже начата', 409);

    $known = [];
    foreach (glitch_themes(true) as $t) $known[$t['id']] = $t;
    $themes = [];
    foreach ((array)($body['themes'] ?? []) as $id) {
        $id = (string)$id;
        if (isset($known[$id]) && !in_array($id, $themes, true)) $themes[] = $id;
    }
    if (!$themes) glitch_fail('Не выбраны темы');

    $built = glitch_build_plan($themes);
    if (!$built) glitch_fail('В выбранных темах меньше ' . GLITCH_MIN_Q . ' вопросов');

    $g = [
        'plan'     => $built['plan'],
        'waves'    => $built['waves'],
        'themes'   => $themes,
        'pos'      => 0,          // какой вопрос выдать следующим
        'issued'   => null,       // выданный и ещё не отвеченный вопрос
        'lives'    => GLITCH_LIVES,
        'score'    => 0,
        'streak'   => 0,
        'best'     => 0,
        'right'    => 0,
        'wrong'    => 0,
        'boss_hp'  => GLITCH_BOSS_Q,
        'finished' => false,
        'won'      => false,
        'by_theme' => [],
    ];
    $_SESSION['game_runs'][$runId]['glitch'] = $g;

    // Браузеру — только раскладка тем: по ним красятся призраки и подписываются таблички.
    $waves = array_fill(0, $built['waves'], []);
    $boss = [];
    foreach ($built['plan'] as $item) {
        if ($item['boss']) $boss[] = $item['theme'];
        else $waves[$item['wave']][] = $item['theme'];
    }
    glitch_out([
        'ok'     => true,
        'waves'  => $waves,
        'boss'   => $boss,
        'lives'  => GLITCH_LIVES,
        'times'  => ['waves' => GLITCH_WAVE_TIMES, 'boss' => GLITCH_BOSS_TIME, 'approach_ms' => GLITCH_APPROACH_MS],
        'themes' => array_map(static fn($id) => ['id' => $id, 'name' => $known[$id]['name'], 'color' => $known[$id]['color']], $themes),
    ]);
}

if (!is_array($g)) glitch_fail('Партия не начата', 409);
if (!empty($g['finished'])) glitch_fail('Партия уже окончена', 409);

// ---------- следующий вопрос ----------
if ($action === 'next') {
    $pos = (int)$g['pos'];
    $item = $g['plan'][$pos] ?? null;
    if (!$item) glitch_fail('Вопросы закончились', 409);

    // Повторный запрос того же вопроса (например, оборвалась сеть) отдаёт его
    // же с тем же порядком вариантов и НЕ сбрасывает время выдачи.
    $issued = $g['issued'];
    if (!is_array($issued) || (int)$issued['pos'] !== $pos) {
        $issued = ['pos' => $pos, 'at' => microtime(true), 'order' => [0, 1, 2, 3]];
        shuffle($issued['order']);
        $g['issued'] = $issued;
        $_SESSION['game_runs'][$runId]['glitch'] = $g;
    }

    $q = glitch_question((int)$item['id']);
    if (!$q) glitch_fail('Вопрос не найден', 500);
    $answers = [$q['answer1'], $q['answer2'], $q['answer3'], $q['answer4']];
    glitch_out([
        'ok'      => true,
        'index'   => $pos,
        'theme'   => $item['theme'],
        'boss'    => (bool)$item['boss'],
        'time'    => glitch_time_limit($item),
        'q'       => (string)$q['question'],
        'options' => array_map(static fn($i) => (string)$answers[$i], $issued['order']),
    ]);
}

// ---------- ответ ----------
if ($action === 'answer') {
    $issued = $g['issued'];
    if (!is_array($issued)) glitch_fail('Вопрос не выдан', 409);
    $index = (int)($body['index'] ?? -2);
    if ($index !== (int)$issued['pos']) glitch_fail('Не тот вопрос', 409);
    $choice = (int)($body['choice'] ?? -1);
    if ($choice < -1 || $choice > 3) $choice = -1;

    // Игра включает кнопки только после выхода призрака на позицию (~0.55 с).
    // Ответ раньше этого живой клиент прислать не может — это скрипт.
    if (microtime(true) - (float)$issued['at'] < GLITCH_APPROACH_MS / 1000 - 0.15) glitch_fail('Слишком рано', 409);

    $item = $g['plan'][$index];
    $q = glitch_question((int)$item['id']);
    if (!$q) glitch_fail('Вопрос не найден', 500);
    $answers = [$q['answer1'], $q['answer2'], $q['answer3'], $q['answer4']];
    $correctPos = array_search((int)$q['correct'], $issued['order'], true);

    // Время ответа — по часам сервера. Первые GLITCH_APPROACH_MS призрак
    // выходит на позицию, таймер у игрока в это время ещё не идёт.
    $limit = glitch_time_limit($item);
    $rt = microtime(true) - (float)$issued['at'] - GLITCH_APPROACH_MS / 1000;
    $late = $rt > $limit + GLITCH_GRACE_SEC;
    $ok = $choice >= 0 && $choice === $correctPos;

    $points = 0;
    $bossKilled = false;
    if ($ok) {
        $g['streak']++;
        $g['best'] = max($g['best'], $g['streak']);
        $g['right']++;
        if ($item['boss']) {
            $g['boss_hp'] = max(0, $g['boss_hp'] - 1);
            if (!$late) $points = GLITCH_BOSS_HIT;
            if ($g['boss_hp'] === 0) { $bossKilled = true; $points += GLITCH_BOSS_KILL; }
        } elseif (!$late) {
            $speed = max(0.0, min(1.0, 1 - max(0.0, $rt) / $limit));
            $points = GLITCH_POINTS_BASE + (int)round(GLITCH_POINTS_SPEED * $speed) + glitch_combo_bonus($g['streak']);
        }
    } else {
        $g['streak'] = 0;
        $g['wrong']++;
        $g['lives'] = max(0, $g['lives'] - 1);
    }
    $g['score'] = min(GLITCH_SCORE_CAP, $g['score'] + $points);

    $t = $item['theme'];
    if (!isset($g['by_theme'][$t])) $g['by_theme'][$t] = ['n' => 0, 'ok' => 0];
    $g['by_theme'][$t]['n']++;
    if ($ok) $g['by_theme'][$t]['ok']++;

    $g['issued'] = null;
    $g['pos'] = $index + 1;
    if ($g['lives'] <= 0) {
        $g['finished'] = true; $g['won'] = false;
    } elseif ($g['pos'] >= count($g['plan'])) {
        $g['finished'] = true; $g['won'] = true;
    }
    $_SESSION['game_runs'][$runId]['glitch'] = $g;

    glitch_out(array_merge([
        'ok'          => true,
        'correct'     => $ok,
        'right'       => $correctPos,
        'right_text'  => (string)$answers[(int)$q['correct']],
        'explain'     => (string)$q['explanation'],
        'points'      => $points,
        'late'        => $ok && $late,
        'boss_killed' => $bossKilled,
    ], glitch_public_state($g)));
}

glitch_fail('Unknown action');
