<?php
/**
 * ============================================================
 *  API «Сортировщика». Партию ведёт сервер — см. includes/sorter.php
 *
 *  POST {action:'start',  run_id, run_token, level}       — 1..3
 *  POST {action:'next',   run_id, run_token}              — следующий блок (только текст)
 *  POST {action:'answer', run_id, run_token, index, category}
 *        category — id корзины или null, если блок упал
 *
 *  run_id/run_token — те же, что выдаёт api/ping-game.php.
 *  Итог записывает обычный api/score.php из этого же состояния.
 * ============================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/sorter.php';

[$body, $action, $runId, $run] = gc_game_request(SORTER_GAME_ID);
$s = $run[SORTER_GAME_ID] ?? null;

// ---------- старт ----------
if ($action === 'start') {
    if (is_array($s)) gc_game_fail('Партия уже начата', 409);
    $level = (int)($body['level'] ?? 0);
    if (!isset(SORTER_LEVELS[$level])) gc_game_fail('Нет такого уровня');
    $s = [
        'level'    => $level,
        'target'   => SORTER_LEVELS[$level]['target'],
        'pool'     => sorter_build_pool($level),
        'n'        => 0,          // сколько блоков уже выдано
        'issued'   => null,       // выданный и ещё не разобранный блок
        'last_at'  => 0.0,        // когда разобран предыдущий
        'lives'    => SORTER_LIVES,
        'score'    => 0,
        'correct'  => 0,
        'errors'   => 0,
        'by_level' => ['1' => 0, '2' => 0, '3' => 0],
        'finished' => false,
        'won'      => false,
    ];
    gc_game_save($runId, SORTER_GAME_ID, $s);
    gc_game_out(['ok' => true] + sorter_public_state($s));
}

if (!is_array($s)) gc_game_fail('Партия не начата', 409);
if (!empty($s['finished'])) gc_game_fail('Партия уже окончена', 409);

// ---------- следующий блок ----------
if ($action === 'next') {
    // Повторный запрос (обрыв сети) отдаёт тот же блок
    if (!is_array($s['issued'])) {
        if (microtime(true) - (float)$s['last_at'] < SORTER_MIN_GAP_SEC) gc_game_fail('Слишком рано', 409);
        if (!$s['pool']) {
            // Понятия кончились раньше цели — партия окончена
            $s['finished'] = true;
            $s['won'] = false;
            gc_game_save($runId, SORTER_GAME_ID, $s);
            gc_game_out(['ok' => true, 'empty' => true] + sorter_public_state($s));
        }
        $s['issued'] = ['n' => (int)$s['n'], 'idx' => (int)array_pop($s['pool']), 'at' => microtime(true)];
        $s['n']++;
        gc_game_save($runId, SORTER_GAME_ID, $s);
    }
    $c = sorter_concepts()[$s['issued']['idx']];
    gc_game_out(['ok' => true, 'index' => (int)$s['issued']['n'], 'text' => (string)$c['text']]);
}

// ---------- блок брошен в корзину или упал ----------
if ($action === 'answer') {
    $issued = $s['issued'];
    if (!is_array($issued)) gc_game_fail('Блок не выдан', 409);
    if ((int)($body['index'] ?? -1) !== (int)$issued['n']) gc_game_fail('Не тот блок', 409);
    if (microtime(true) - (float)$issued['at'] < SORTER_MIN_ANSWER_SEC) gc_game_fail('Слишком рано', 409);

    $category = $body['category'] ?? null;
    $missed = !is_string($category) || !in_array($category, SORTER_CATEGORIES, true);
    $c = sorter_concepts()[$issued['idx']];
    $ok = !$missed && $category === $c['cat'];

    $points = 0;
    if ($ok) {
        $points = sorter_points((int)$c['level']);
        $s['correct']++;
        $s['score'] += $points;
        $s['by_level'][(string)$c['level']]++;
    } else {
        $s['errors']++;
        $s['lives'] = max(0, $s['lives'] - 1);
        $s['score'] = max(0, $s['score'] - SORTER_PENALTY);   // штраф, но не ниже нуля
        $points = -SORTER_PENALTY;
    }
    if ($s['correct'] >= $s['target']) { $s['finished'] = true; $s['won'] = true; }
    elseif ($s['lives'] <= 0)          { $s['finished'] = true; $s['won'] = false; }

    $s['issued'] = null;
    $s['last_at'] = microtime(true);
    gc_game_save($runId, SORTER_GAME_ID, $s);

    gc_game_out([
        'ok'       => true,
        'correct'  => $ok,
        'missed'   => $missed,
        'text'     => (string)$c['text'],
        'hint'     => (string)$c['hint'],
        'category' => $ok ? (string)$c['cat'] : null,
        'points'   => $points,
        'level'    => (int)$c['level'],
    ] + sorter_public_state($s) + ['correct_count' => (int)$s['correct']]);
}

gc_game_fail('Unknown action');
