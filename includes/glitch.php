<?php
/**
 * ============================================================
 *  «ГЛЮК-АТАКА» — серверная часть игры
 *
 *  Вопросы и темы лежат в базе (миграция 004-glitch.sql),
 *  правятся в админке (admin/glitch.php).
 *
 *  ЗАЩИТА ОТ НАКРУТКИ. Партию ведёт сервер, а не браузер:
 *    1. При старте сервер сам выбирает вопросы и хранит план
 *       партии в сессии (рядом с подписанным раном из ping-game).
 *    2. Вопрос выдаётся по одному. Правильный вариант браузер
 *       узнаёт только ПОСЛЕ ответа — заранее его нет нигде.
 *    3. Верность ответа, очки за скорость, серию, жизни и босса
 *       считает сервер по своим часам. Браузер присылает только
 *       номер выбранного варианта.
 *    4. score.php берёт итог из этого же состояния — прислать
 *       «свои» очки нельзя, payload от клиента не используется.
 *  Итого максимум, который можно получить, — честно идеальная
 *  партия, и не чаще, чем она физически длится.
 * ============================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/game_security.php';

const GLITCH_GAME_ID     = 'glitch';
const GLITCH_LIVES       = 4;
const GLITCH_PER_WAVE    = 4;
const GLITCH_MAX_WAVES   = 5;
const GLITCH_BOSS_Q      = 3;
const GLITCH_MIN_Q       = 10;                      // меньше — партию не начать
const GLITCH_WAVE_TIMES  = [18, 16, 14, 12, 10];    // секунд на вопрос в волне N
const GLITCH_BOSS_TIME   = 12;
const GLITCH_APPROACH_MS = 550;   // анимация «призрак выходит на позицию»: таймер в это время ещё не идёт
const GLITCH_GRACE_SEC   = 3;     // ответ позже таймера + запас (пауза, сеть) засчитывается, но без очков

// Очки: максимум за идеальную партию ≈ 1000, как у «Миллионера»
const GLITCH_POINTS_BASE  = 20;   // за верный ответ
const GLITCH_POINTS_SPEED = 10;   // до +10 за скорость
const GLITCH_COMBO_STEP   = 5;    // +5 за каждую ступень серии
const GLITCH_COMBO_AT     = [3, 6, 9];
const GLITCH_BOSS_HIT     = 50;
const GLITCH_BOSS_KILL    = 100;
const GLITCH_SCORE_CAP    = 2000; // санитарный потолок на случай будущих правок баланса

const GLITCH_Q_MAX   = 200;       // длины полей в админке
const GLITCH_A_MAX   = 80;
const GLITCH_EXP_MAX = 300;

function glitch_tables_ready(): bool {
    static $ready = null;
    if ($ready === null) {
        $ready = gamecode_pg_table_exists('glitch_themes') && gamecode_pg_table_exists('glitch_questions');
    }
    return $ready;
}

/** Темы с числом видимых вопросов. $visibleOnly — без скрытых тем. */
function glitch_themes(bool $visibleOnly = true): array {
    if (!glitch_tables_ready()) return [];
    $rows = gamecode_pg_query_all(
        'SELECT t.id, t.name, t.color, t.sort_order, t.hidden,
                COUNT(q.id) FILTER (WHERE NOT q.hidden) AS visible,
                COUNT(q.id) AS total
         FROM glitch_themes t
         LEFT JOIN glitch_questions q ON q.theme_id = t.id
         ' . ($visibleOnly ? 'WHERE NOT t.hidden' : '') . '
         GROUP BY t.id
         ORDER BY t.sort_order ASC, t.id ASC'
    );
    if (!is_array($rows)) return [];
    return array_map(static function (array $r): array {
        return [
            'id'      => (string)$r['id'],
            'name'    => (string)$r['name'],
            'color'   => (string)$r['color'],
            'sort'    => (int)$r['sort_order'],
            'hidden'  => gamecode_db_bool($r['hidden']),
            'count'   => (int)$r['visible'],
            'total'   => (int)$r['total'],
        ];
    }, $rows);
}

function glitch_question(int $id): ?array {
    $rows = gamecode_pg_query_all('SELECT * FROM glitch_questions WHERE id = $1', [$id]);
    return (is_array($rows) && $rows) ? $rows[0] : null;
}

/** Бонус за серию: 0 / +5 / +10 / +15. */
function glitch_combo_bonus(int $streak): int {
    $level = 0;
    foreach (GLITCH_COMBO_AT as $at) {
        if ($streak >= $at) $level++;
    }
    return $level * GLITCH_COMBO_STEP;
}

// ------------------------------------------------------------
// Состояние партии в сессии: $_SESSION['game_runs'][$runId]['glitch']
// ------------------------------------------------------------

/**
 * Проверка рана: тот же подписанный run_id/run_token, что выдаёт
 * api/ping-game.php для всех игр сайта. Возвращает ран или текст ошибки.
 */
function glitch_load_run(string $runId, string $runToken) {
    if ($runId === '' || $runToken === '') return 'Нет run_id/run_token';
    $run = $_SESSION['game_runs'][$runId] ?? null;
    if (!is_array($run) || ($run['game_id'] ?? '') !== GLITCH_GAME_ID) return 'Неизвестная партия';
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $startedAt = (int)($run['started_at'] ?? 0);
    if ($startedAt <= 0 || !gc_verify_run_token($userId, $runId, GLITCH_GAME_ID, $startedAt, $runToken)) {
        return 'Неверная подпись партии';
    }
    if (!empty($run['used'])) return 'Партия уже завершена';
    return $run;
}

/**
 * План: 3 вопроса — боссу, остальное — волнами по 4 (не больше 5 волн).
 * Если вопросов мало, волн меньше, а остаток (<4) уходит в последнюю.
 * Ровно та же раскладка, что в прототипе игры.
 */
function glitch_build_plan(array $themeIds): ?array {
    if (!$themeIds) return null;
    $rows = gamecode_pg_query_all(
        'SELECT q.id, q.theme_id
         FROM glitch_questions q
         JOIN glitch_themes t ON t.id = q.theme_id
         WHERE NOT q.hidden AND NOT t.hidden AND q.theme_id = ANY($1)',
        ['{' . implode(',', $themeIds) . '}']
    );
    if (!is_array($rows) || count($rows) < GLITCH_MIN_Q) return null;
    shuffle($rows);

    $boss = array_slice($rows, 0, GLITCH_BOSS_Q);
    $rest = array_slice($rows, GLITCH_BOSS_Q);
    $nW = max(1, min(GLITCH_MAX_WAVES, intdiv(count($rest), GLITCH_PER_WAVE)));
    $waves = [];
    for ($w = 0; $w < $nW; $w++) $waves[] = array_slice($rest, $w * GLITCH_PER_WAVE, GLITCH_PER_WAVE);
    if ($nW < GLITCH_MAX_WAVES) {
        $left = array_slice($rest, $nW * GLITCH_PER_WAVE);
        $waves[$nW - 1] = array_merge($waves[$nW - 1], $left);
    }

    $plan = [];
    foreach ($waves as $w => $list) {
        foreach ($list as $r) $plan[] = ['id' => (int)$r['id'], 'theme' => (string)$r['theme_id'], 'wave' => $w, 'boss' => false];
    }
    foreach ($boss as $r) $plan[] = ['id' => (int)$r['id'], 'theme' => (string)$r['theme_id'], 'wave' => $nW, 'boss' => true];
    return ['plan' => $plan, 'waves' => $nW];
}

function glitch_time_limit(array $item): int {
    if (!empty($item['boss'])) return GLITCH_BOSS_TIME;
    $w = (int)$item['wave'];
    return GLITCH_WAVE_TIMES[min($w, count(GLITCH_WAVE_TIMES) - 1)];
}

/** Публичная часть состояния — то, что можно показать браузеру. */
function glitch_public_state(array $g): array {
    return [
        'score'    => (int)$g['score'],
        'lives'    => (int)$g['lives'],
        'streak'   => (int)$g['streak'],
        'combo'    => glitch_combo_bonus((int)$g['streak']),
        'boss_hp'  => (int)$g['boss_hp'],
        'finished' => !empty($g['finished']),
        'won'      => !empty($g['won']),
    ];
}
