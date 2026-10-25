<?php
/**
 * ============================================================
 *  API «Миллионера». Партию ведёт сервер — см. includes/millionaire.php
 *
 *  POST {action:'start',   run_id, run_token}
 *  POST {action:'next',    run_id, run_token}          — текущий вопрос без ответа
 *  POST {action:'answer',  run_id, run_token, index, choice}
 *        choice 0..3 — позиция на экране, -1 — время вышло
 *  POST {action:'hint',    run_id, run_token, index, type}
 *        type: immunity | fifty | audience | swap
 *  POST {action:'forfeit', run_id, run_token}           — ушёл со вкладки
 *
 *  run_id/run_token — те же, что выдаёт api/ping-game.php.
 *  Итог записывает обычный api/score.php из этого же состояния.
 * ============================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/millionaire.php';

[$body, $action, $runId, $run] = gc_game_request(MIL_GAME_ID);
$m = $run[MIL_GAME_ID] ?? null;

// ---------- старт ----------
if ($action === 'start') {
    if (is_array($m)) gc_game_fail('Партия уже начата', 409);
    $m = [
        'plan'     => mil_build_plan(),
        'pos'      => 0,
        'issued'   => null,
        'hints'    => ['immunity' => false, 'immunity_active' => false, 'fifty' => false, 'audience' => false, 'swap' => false],
        'right'    => 0,
        'wrong'    => 0,
        'finished' => false,
        'won'      => false,
    ];
    if (count($m['plan']) < MIL_TOTAL) gc_game_fail('Мало вопросов в базе', 500);
    gc_game_save($runId, MIL_GAME_ID, $m);
    gc_game_out(['ok' => true, 'total' => MIL_TOTAL]);
}

if (!is_array($m)) gc_game_fail('Партия не начата', 409);
if (!empty($m['finished'])) gc_game_fail('Партия уже окончена', 409);

// ---------- текущий вопрос ----------
if ($action === 'next') {
    $pos = (int)$m['pos'];
    if ($pos >= MIL_TOTAL) gc_game_fail('Вопросы закончились', 409);
    // Повторный запрос (обрыв сети) отдаёт тот же вопрос с тем же порядком
    if (!is_array($m['issued']) || (int)$m['issued']['pos'] !== $pos) {
        mil_issue($m, $pos);
        gc_game_save($runId, MIL_GAME_ID, $m);
    }
    gc_game_out(['ok' => true] + mil_public_question($m));
}

// ---------- ушёл со вкладки — партия проиграна на текущем вопросе ----------
if ($action === 'forfeit') {
    $m['finished'] = true;
    $m['won'] = false;
    $m['issued'] = null;
    gc_game_save($runId, MIL_GAME_ID, $m);
    gc_game_out(['ok' => true, 'finished' => true, 'won' => false, 'score' => mil_score($m)]);
}

$issued = $m['issued'];
if (!is_array($issued)) gc_game_fail('Вопрос не выдан', 409);
if ((int)($body['index'] ?? -2) !== (int)$issued['pos']) gc_game_fail('Не тот вопрос', 409);

// ---------- подсказки ----------
if ($action === 'hint') {
    $type = (string)($body['type'] ?? '');
    if (!array_key_exists($type, $m['hints']) || $type === 'immunity_active') gc_game_fail('Нет такой подсказки');
    if (!empty($m['hints'][$type])) gc_game_fail('Подсказка уже использована', 409);
    $m['hints'][$type] = true;
    $correct = mil_correct_pos($issued);
    $out = ['ok' => true, 'type' => $type];

    if ($type === 'immunity') {
        $m['hints']['immunity_active'] = true;
    } elseif ($type === 'fifty') {
        // Убираем два неверных из тех, что ещё на экране
        $wrong = array_values(array_filter([0, 1, 2, 3], static fn($i) => $i !== $correct && !in_array($i, $issued['removed'], true)));
        shuffle($wrong);
        $remove = array_slice($wrong, 0, 2);
        $m['issued']['removed'] = array_values(array_unique(array_merge($issued['removed'], $remove)));
        $out['remove'] = $remove;
    } elseif ($type === 'audience') {
        // Как раньше в браузере: за верный — большинство, но не всегда подавляющее
        $q = mil_questions()[$issued['id']];
        $pct = $q['d'] === 'easy' ? random_int(60, 89) : ($q['d'] === 'medium' ? random_int(45, 69) : random_int(30, 59));
        $p = [0, 0, 0, 0];
        $p[$correct] = $pct;
        $left = 100 - $pct;
        $others = array_values(array_filter([0, 1, 2, 3], static fn($i) => $i !== $correct));
        foreach ($others as $k => $i) {
            if ($k === count($others) - 1) { $p[$i] = $left; break; }
            $share = random_int(0, (int)floor($left * 0.6));
            $p[$i] = $share;
            $left -= $share;
        }
        $out['pcts'] = $p;
    } elseif ($type === 'swap') {
        // Замена на вопрос той же сложности, которого нет в партии
        $cur = mil_questions()[$issued['id']];
        $pool = [];
        foreach (mil_questions() as $id => $q) {
            if ($q['d'] === $cur['d'] && !in_array((int)$id, $m['plan'], true)) $pool[] = (int)$id;
        }
        if (!$pool) { $m['hints']['swap'] = false; gc_game_fail('Нет вопросов для замены', 409); }
        $m['plan'][(int)$issued['pos']] = $pool[array_rand($pool)];
        mil_issue($m, (int)$issued['pos']);
        $out['question'] = mil_public_question($m);
    }
    gc_game_save($runId, MIL_GAME_ID, $m);
    gc_game_out($out);
}

// ---------- ответ ----------
if ($action === 'answer') {
    $choice = (int)($body['choice'] ?? -1);
    if ($choice < -1 || $choice > 3) $choice = -1;
    if ($choice >= 0 && in_array($choice, $issued['removed'], true)) gc_game_fail('Этот вариант убран', 409);
    if (microtime(true) - (float)$issued['at'] < MIL_MIN_ANSWER_SEC) gc_game_fail('Слишком рано', 409);

    $q = mil_questions()[$issued['id']];
    $correct = mil_correct_pos($issued);
    $ok = $choice === $correct;

    if ($ok) {
        $m['right']++;
        $m['pos']++;
        $m['issued'] = null;
        if ($m['pos'] >= MIL_TOTAL) { $m['finished'] = true; $m['won'] = true; }
        gc_game_save($runId, MIL_GAME_ID, $m);
        gc_game_out([
            'ok' => true, 'correct' => true, 'right' => $correct, 'explain' => $q['exp'],
            'finished' => $m['finished'], 'won' => $m['won'], 'score' => mil_score($m),
        ]);
    }

    // Право на ошибку спасает от неверного варианта, но не от таймера.
    // Правильный ответ при этом не раскрываем — игрок выбирает снова.
    if ($choice >= 0 && !empty($m['hints']['immunity_active'])) {
        $m['hints']['immunity_active'] = false;
        $m['issued']['removed'][] = $choice;
        gc_game_save($runId, MIL_GAME_ID, $m);
        gc_game_out(['ok' => true, 'correct' => false, 'saved' => true, 'finished' => false]);
    }

    $m['wrong']++;
    $m['finished'] = true;
    $m['won'] = false;
    $m['issued'] = null;
    gc_game_save($runId, MIL_GAME_ID, $m);
    gc_game_out([
        'ok' => true, 'correct' => false, 'saved' => false, 'right' => $correct, 'explain' => $q['exp'],
        'finished' => true, 'won' => false, 'score' => mil_score($m),
    ]);
}

gc_game_fail('Unknown action');
