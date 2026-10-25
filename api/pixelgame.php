<?php
/**
 * ============================================================
 *  API CodeQuest (pixelgame). Партию ведёт сервер — см. includes/codequest.php
 *
 *  POST {action:'start',  run_id, run_token, level}
 *  POST {action:'chest',  run_id, run_token, chest}           — вопрос сундука (индекс)
 *  POST {action:'chest_answer',  ..., chest, choice}          — choice: позиция на экране
 *  POST {action:'battle', run_id, run_token, enemy}           — вопрос боя (номер врага)
 *  POST {action:'battle_answer', ..., enemy, choice}
 *  POST {action:'finish', run_id, run_token, completed}       — дошёл до выхода / погиб
 *
 *  run_id/run_token — те же, что выдаёт api/ping-game.php.
 *  Итог записывает обычный api/score.php из этого же состояния.
 * ============================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/codequest.php';

[$body, $action, $runId, $run] = gc_game_request(CQ_GAME_ID);
$g = $run[CQ_GAME_ID] ?? null;

// ---------- старт уровня ----------
if ($action === 'start') {
    if (is_array($g)) gc_game_fail('Партия уже начата', 409);
    $levelNo = (int)($body['level'] ?? 0);
    $level = cq_level($levelNo);
    if (!$level) gc_game_fail('Нет такого уровня');
    $g = [
        'level'        => $levelNo,
        'total_chests' => count($level['chests']),
        'enemies'      => cq_enemy_count($level),
        'hp'           => CQ_HP,
        'pts'          => 0,
        'opened'       => 0,
        'chests'       => [],    // индекс сундука => выдача
        'battles'      => [],    // номер врага => выдача + id вопроса
        'used_q'       => [],    // вопросы боёв, уже выпавшие в партии
        'battles_won'  => 0,
        'finished'     => false,
        'won'          => false,
    ];
    gc_game_save($runId, CQ_GAME_ID, $g);
    gc_game_out(['ok' => true, 'total_chests' => $g['total_chests'], 'enemies' => $g['enemies']] + cq_public_state($g));
}

if (!is_array($g)) gc_game_fail('Партия не начата', 409);
if (!empty($g['finished'])) gc_game_fail('Партия уже окончена', 409);

$level = cq_level((int)$g['level']);
if (!$level) gc_game_fail('Уровень не найден', 500);

// ---------- вопрос сундука ----------
if ($action === 'chest' || $action === 'chest_answer') {
    $idx = (int)($body['chest'] ?? -1);
    $ch = $level['chests'][$idx] ?? null;
    if ($idx < 0 || !is_array($ch)) gc_game_fail('Нет такого сундука');
    $text    = (string)($ch['question'] ?? $ch['text'] ?? ($ch['q']['text'] ?? ''));
    $code    = (string)($ch['code'] ?? ($ch['q']['code'] ?? ''));
    $options = array_values((array)($ch['options'] ?? ($ch['q']['options'] ?? [])));
    $correct = (int)($ch['correct'] ?? ($ch['q']['correct'] ?? -1));
    if (count($options) < 2 || $correct < 0 || $correct >= count($options)) gc_game_fail('Сундук без вопроса', 500);

    $item = $g['chests'][$idx] ?? null;
    if (is_array($item) && $item['done']) gc_game_fail('Сундук уже открыт', 409);

    if ($action === 'chest') {
        if (!is_array($item)) {
            $item = cq_new_item(count($options));
            $g['chests'][$idx] = $item;
            gc_game_save($runId, CQ_GAME_ID, $g);
        }
        gc_game_out(['ok' => true, 'chest' => $idx] + cq_public_question($item, $text, $code, $options));
    }

    // ответ
    if (!is_array($item)) gc_game_fail('Вопрос не выдан', 409);
    $choice = (int)($body['choice'] ?? -1);
    if ($choice < 0 || $choice >= count($options) || in_array($choice, $item['removed'], true)) gc_game_fail('Нет такого варианта', 409);
    if (microtime(true) - (float)$item['at'] < CQ_MIN_ANSWER_SEC) gc_game_fail('Слишком рано', 409);

    $ok = $item['order'][$choice] === $correct;
    $points = 0;
    if ($ok) {
        $points = CQ_CHEST_PTS[min((int)$item['attempts'], 3)];
        $item['done'] = true;
        $g['pts'] += $points;
        $g['opened']++;
    } else {
        $item['attempts']++;
        $item['removed'][] = $choice;
        $item['at'] = microtime(true);
        $g['hp'] = max(0, $g['hp'] - 1);
        if ($g['hp'] <= 0) { $g['finished'] = true; $g['won'] = false; }
    }
    $g['chests'][$idx] = $item;
    gc_game_save($runId, CQ_GAME_ID, $g);
    gc_game_out(['ok' => true, 'correct' => $ok, 'points' => $points] + cq_public_state($g));
}

// ---------- бой с врагом ----------
if ($action === 'battle' || $action === 'battle_answer') {
    $enemy = (int)($body['enemy'] ?? -1);
    if ($enemy < 0 || $enemy >= (int)$g['enemies']) gc_game_fail('Нет такого врага');
    $item = $g['battles'][$enemy] ?? null;
    if (is_array($item) && $item['done']) gc_game_fail('Враг уже побеждён', 409);
    $pool = cq_monster_questions();
    if (!$pool) gc_game_fail('Нет вопросов для боёв', 500);

    if ($action === 'battle') {
        if (!is_array($item)) {
            // Вопрос, который в этой партии ещё не выпадал (если такие остались)
            $ids = array_values(array_diff(array_keys($pool), $g['used_q']));
            if (!$ids) $ids = array_keys($pool);
            $qid = (string)$ids[array_rand($ids)];
            $item = cq_new_item(count($pool[$qid]['options'])) + ['qid' => $qid];
            $g['used_q'][] = $qid;
            $g['battles'][$enemy] = $item;
            gc_game_save($runId, CQ_GAME_ID, $g);
        }
        $q = $pool[$item['qid']] ?? null;
        if (!$q) gc_game_fail('Вопрос не найден', 500);
        gc_game_out(['ok' => true, 'enemy' => $enemy] + cq_public_question($item, (string)($q['text'] ?? ''), (string)($q['code'] ?? ''), array_values($q['options'])));
    }

    if (!is_array($item)) gc_game_fail('Вопрос не выдан', 409);
    $q = $pool[$item['qid']] ?? null;
    if (!$q) gc_game_fail('Вопрос не найден', 500);
    $n = count($q['options']);
    $choice = (int)($body['choice'] ?? -1);
    if ($choice < 0 || $choice >= $n || in_array($choice, $item['removed'], true)) gc_game_fail('Нет такого варианта', 409);
    if (microtime(true) - (float)$item['at'] < CQ_MIN_ANSWER_SEC) gc_game_fail('Слишком рано', 409);

    $ok = $item['order'][$choice] === (int)$q['correct'];
    $points = 0;
    if ($ok) {
        $points = CQ_BATTLE_PTS[min((int)$item['attempts'], 3)];
        $item['done'] = true;
        $g['pts'] += $points;
        $g['battles_won']++;
    } else {
        $item['attempts']++;
        $item['removed'][] = $choice;
        $item['at'] = microtime(true);
        $g['hp'] = max(0, $g['hp'] - 1);
        if ($g['hp'] <= 0) { $g['finished'] = true; $g['won'] = false; }
    }
    $g['battles'][$enemy] = $item;
    gc_game_save($runId, CQ_GAME_ID, $g);
    gc_game_out(['ok' => true, 'correct' => $ok, 'points' => $points, 'hint' => (string)($q['hint'] ?? '')] + cq_public_state($g));
}

// ---------- конец уровня ----------
if ($action === 'finish') {
    $completed = ($body['completed'] ?? false) === true;
    if ($completed) {
        // Победа — только если сервер сам видел все сундуки открытыми
        if ((int)$g['opened'] < (int)$g['total_chests']) gc_game_fail('Открыты не все сундуки', 409);
        $g['won'] = true;
    } else {
        $g['won'] = false;
    }
    $g['finished'] = true;
    gc_game_save($runId, CQ_GAME_ID, $g);
    gc_game_out(['ok' => true, 'score' => cq_score($g)] + cq_public_state($g));
}

gc_game_fail('Unknown action');
