<?php
/**
 * ============================================================
 *  «СОРТИРОВЩИК» — серверная часть игры
 *
 *  Раньше браузер сам решал, в ту ли корзину брошен блок, и в конце
 *  присылал «20 верных, 0 ошибок» — сервер проверял только, что такие
 *  числа в принципе возможны. Скрипт отправлял их без игры.
 *
 *  Теперь партию ведёт сервер (как в «Глюк-атаке»):
 *    1. Сервер выдаёт блоки по одному — только текст, без корзины.
 *    2. Браузер сообщает, в какую корзину блок брошен (или что упал).
 *    3. Верность, очки, жизни и победу считает сервер.
 *    4. score.php берёт итог отсюда, payload браузера не используется.
 * ============================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/game_security.php';

const SORTER_GAME_ID = 'sorter';
const SORTER_LIVES   = 3;
const SORTER_PENALTY = 5;
const SORTER_CATEGORIES = ['functions', 'operators', 'data_types', 'loops', 'conditions'];

// Уровни — как в игре: цель и какие понятия в пуле
const SORTER_LEVELS = [
    1 => ['target' => 10, 'allowed' => [1]],
    2 => ['target' => 15, 'allowed' => [1, 2]],
    3 => ['target' => 20, 'allowed' => [1, 2, 3]],
];

// Темп живого игрока: блок надо увидеть, схватить и донести до корзины,
// а следующий появляется после паузы 0.6–0.8 с. Скрипт быстрее не сможет.
const SORTER_MIN_ANSWER_SEC = 0.35;
const SORTER_MIN_GAP_SEC    = 0.4;

function sorter_concepts(): array {
    static $c = null;
    if ($c === null) $c = require __DIR__ . '/sorter_concepts.php';
    return $c;
}

/** Очки за верный блок: 15 / 20 / 25 по сложности понятия. */
function sorter_points(int $conceptLevel): int {
    return 10 + $conceptLevel * 5;
}

/** Перемешанный пул понятий для уровня (индексы в sorter_concepts). */
function sorter_build_pool(int $level): array {
    $allowed = SORTER_LEVELS[$level]['allowed'];
    $pool = [];
    foreach (sorter_concepts() as $i => $c) {
        if (in_array((int)$c['level'], $allowed, true)) $pool[] = $i;
    }
    shuffle($pool);
    return $pool;
}

function sorter_public_state(array $s): array {
    return [
        'score'    => (int)$s['score'],
        'lives'    => (int)$s['lives'],
        'correct'  => (int)$s['correct'],
        'errors'   => (int)$s['errors'],
        'target'   => (int)$s['target'],
        'finished' => !empty($s['finished']),
        'won'      => !empty($s['won']),
    ];
}
