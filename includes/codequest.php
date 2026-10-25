<?php
/**
 * ============================================================
 *  CODEQUEST (pixelgame) — серверная часть игры
 *
 *  Раньше очки считал браузер и присылал в конце «direct_pts: 190»,
 *  а сервер проверял только верхнюю границу. Вопросы сундуков и боёв
 *  вместе с правильными ответами браузер получал заранее
 *  (api/pixelgame-level.php, api/pixelgame-questions.php).
 *
 *  Теперь (как в «Глюк-атаке»):
 *    1. Ходьба по лабиринту остаётся в браузере, а каждый вопрос —
 *       сундука или боя — выдаёт сервер, без правильного варианта.
 *    2. Ответ проверяет сервер; он же начисляет очки за попытку
 *       (20/10/5/0 за сундук, 15/10/5/0 за бой) и снимает HP.
 *    3. Победа засчитывается, только если сервер видел все сундуки
 *       открытыми. score.php берёт очки отсюда, payload не нужен.
 *    4. Публичная выдача уровня и вопросов — без ответов
 *       (полная — только для админки, редактору она нужна).
 * ============================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/game_security.php';

const CQ_GAME_ID       = 'pixelgame';
const CQ_HP            = 5;
const CQ_CHEST_PTS     = [20, 10, 5, 0];   // по номеру попытки
const CQ_BATTLE_PTS    = [15, 10, 5, 0];
const CQ_MIN_ANSWER_SEC = 0.5;             // прочитать вопрос быстрее нельзя
const CQ_DEFAULT_ENEMIES = 6;              // врагов на карте по умолчанию (MAP_DEFAULT в game.js)

/** Уровень из базы (Redis → Postgres → JSON), как его видит админка. */
function cq_level(int $level): ?array {
    if ($level < 1 || $level > 100) return null;
    $data = cached_read_pixelgame_level($level);
    return (is_array($data) && !empty($data['chests']) && is_array($data['chests'])) ? $data : null;
}

/** Вопросы для боёв: [id => вопрос]. */
function cq_monster_questions(): array {
    $data = cached_read_pixelgame_monster_questions();
    $out = [];
    foreach ((array)($data['questions'] ?? []) as $q) {
        if (is_array($q) && isset($q['id'], $q['options'], $q['correct']) && count((array)$q['options']) >= 2) {
            $out[(string)$q['id']] = $q;
        }
    }
    return $out;
}

/** Сколько врагов на карте уровня — столько боёв может быть в партии. */
function cq_enemy_count(array $level): int {
    $map = $level['map'] ?? null;
    if (!is_array($map) || !$map) return CQ_DEFAULT_ENEMIES;
    $n = 0;
    foreach ($map as $row) {
        $cells = is_array($row) ? $row : str_split((string)$row);
        foreach ($cells as $c) {
            if ($c === 4 || $c === '4' || $c === 'E') $n++;
        }
    }
    return $n;
}

/**
 * Уровень для браузера: без правильных ответов и подсказок к ним.
 * Награда (кусок кода) остаётся — она нужна для финальной сборки
 * и на очки не влияет.
 */
function cq_public_level(array $level): array {
    $level['chests'] = array_map(static function ($ch) {
        if (!is_array($ch)) return $ch;
        unset($ch['correct'], $ch['hint']);
        if (isset($ch['q']) && is_array($ch['q'])) unset($ch['q']['correct'], $ch['q']['hint']);
        return $ch;
    }, $level['chests']);
    return $level;
}

/** Выдача вопроса: варианты в порядке сервера, без убранных. */
function cq_public_question(array $item, string $text, string $code, array $options): array {
    return [
        'text'    => $text,
        'code'    => $code,
        'options' => array_map(static fn($i) => (string)$options[$i], $item['order']),
        'removed' => array_values($item['removed']),
    ];
}

function cq_new_item(int $nOptions): array {
    return ['order' => gc_shuffled_order($nOptions), 'attempts' => 0, 'removed' => [], 'at' => microtime(true), 'done' => false];
}

/** Итоговые очки партии: только за победу, с потолком по уровню. */
function cq_score(array $g): int {
    if (empty($g['won'])) return 0;
    $cap = (int)$g['total_chests'] * CQ_CHEST_PTS[0] + (int)$g['enemies'] * CQ_BATTLE_PTS[0];
    return max(0, min((int)$g['pts'], $cap));
}

function cq_public_state(array $g): array {
    return [
        'hp'       => (int)$g['hp'],
        'pts'      => (int)$g['pts'],
        'opened'   => (int)$g['opened'],
        'finished' => !empty($g['finished']),
        'won'      => !empty($g['won']),
    ];
}
