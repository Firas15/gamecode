<?php
/**
 * ============================================================
 *  «МИЛЛИОНЕР» — серверная часть игры
 *
 *  Раньше все 100 вопросов вместе с правильными ответами лежали
 *  в games/millionaire/js/game.js, а сервер верил браузеру на
 *  слово: «дошёл до 15-го, выиграл» — и записывал 1000 очков.
 *
 *  Теперь партию ведёт сервер (как в «Глюк-атаке»):
 *    1. При старте сервер сам выбирает 15 вопросов (5/5/5).
 *    2. Вопрос выдаётся по одному, без правильного варианта.
 *    3. Ответ проверяет сервер. Верный вариант браузер узнаёт
 *       только после ответа.
 *    4. Подсказки (50:50, зал, замена, право на ошибку) тоже
 *       считает сервер — иначе 50:50 выдавал бы ответ заранее.
 *    5. score.php берёт итог из этого состояния, payload браузера
 *       не используется.
 * ============================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/game_security.php';

const MIL_GAME_ID   = 'millionaire';
const MIL_TOTAL     = 15;
const MIL_PER_LEVEL = 5;               // 5 лёгких, 5 средних, 5 сложных
const MIL_MIN_ANSWER_SEC = 0.8;        // быстрее живой человек не прочитает и не подтвердит
const MIL_WIN_SCORE  = 1000;
const MIL_SAFE_1     = [5, 10];        // 5 верных — гарантия 10 очков
const MIL_SAFE_2     = [10, 320];      // 10 верных — гарантия 320 очков

function mil_questions(): array {
    static $q = null;
    if ($q === null) $q = require __DIR__ . '/millionaire_questions.php';
    return $q;
}

/** 15 вопросов: лёгкие, средние, сложные — без повторов. */
function mil_build_plan(): array {
    $by = ['easy' => [], 'medium' => [], 'hard' => []];
    foreach (mil_questions() as $id => $q) {
        if (isset($by[$q['d']])) $by[$q['d']][] = (int)$id;
    }
    $plan = [];
    foreach (['easy', 'medium', 'hard'] as $d) {
        $ids = $by[$d];
        shuffle($ids);
        $plan = array_merge($plan, array_slice($ids, 0, MIL_PER_LEVEL));
    }
    return $plan;
}

/** Очки за партию — те же правила, что показывает лестница в игре. */
function mil_score(array $m): int {
    if (!empty($m['won'])) return MIL_WIN_SCORE;
    $right = (int)$m['right'];
    if ($right >= MIL_SAFE_2[0]) return MIL_SAFE_2[1];
    if ($right >= MIL_SAFE_1[0]) return MIL_SAFE_1[1];
    return 0;
}

/** Новая выдача вопроса на позиции $pos (порядок вариантов — свой). */
function mil_issue(array &$m, int $pos): void {
    $m['issued'] = [
        'pos'     => $pos,
        'id'      => (int)$m['plan'][$pos],
        'at'      => microtime(true),
        'order'   => gc_shuffled_order(4),
        'removed' => [],             // позиции, убранные 50:50 или правом на ошибку
    ];
    // Право на ошибку действует только на тот вопрос, где его включили
    $m['hints']['immunity_active'] = false;
}

/** То, что браузеру можно показать о выданном вопросе. */
function mil_public_question(array $m): array {
    $is = $m['issued'];
    $q = mil_questions()[$is['id']];
    return [
        'index'      => (int)$is['pos'],
        'num'        => (int)$is['pos'] + 1,
        'difficulty' => $q['d'],
        'lang'       => $q['lang'],
        'q'          => $q['q'],
        'options'    => array_map(static fn($i) => (string)$q['a'][$i], $is['order']),
        'removed'    => array_values($is['removed']),
    ];
}

/** Позиция верного варианта на экране. */
function mil_correct_pos(array $issued): int {
    $q = mil_questions()[$issued['id']];
    return (int)array_search((int)$q['ok'], $issued['order'], true);
}
