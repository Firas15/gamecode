<?php
/**
 * GAME CODE — одноразовая миграция контента Pixelgame из JSON в PostgreSQL.
 *
 * Запуск (CLI, из корня проекта):
 *   php scripts/migrate_pixelgame_json_to_pg.php
 *
 * Что делает:
 *   1. Создаёт таблицы pixelgame_levels / pixelgame_monster_questions,
 *      если их ещё нет (тот же DDL, что в scripts/pixelgame_schema.sql).
 *   2. Читает games/pixelgame/data/levels/level{1..4}.json и делает upsert
 *      в pixelgame_levels (ON CONFLICT (level_number) DO UPDATE).
 *   3. Читает games/pixelgame/data/monster-questions.json и upsert-ит
 *      в pixelgame_monster_questions.
 *   4. Сбрасывает Redis-кэш контента Pixelgame.
 *   5. Логирует, сколько строк вставлено/обновлено.
 *
 * JSON-файлы НЕ удаляются — остаются аварийным read-only фолбэком.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Этот скрипт запускается только из CLI.\n");
    exit(1);
}

require_once __DIR__ . '/../includes/db.php';

function migrate_log(string $msg): void {
    echo '[' . date('H:i:s') . "] {$msg}\n";
}

$conn = gamecode_pg_connection();
if (!$conn) {
    fwrite(STDERR, "ОШИБКА: нет подключения к PostgreSQL (проверь config.php / переменные окружения).\n");
    exit(1);
}
migrate_log('Подключение к PostgreSQL — OK');

// ── 1. Таблицы ───────────────────────────────────────────────────────────────
$ddl = [
    'pixelgame_levels' => '
        CREATE TABLE IF NOT EXISTS pixelgame_levels (
            id            SERIAL PRIMARY KEY,
            level_number  INT NOT NULL UNIQUE,
            title         TEXT NOT NULL,
            data          JSONB NOT NULL,
            created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
        )',
    'pixelgame_monster_questions' => '
        CREATE TABLE IF NOT EXISTS pixelgame_monster_questions (
            id            SERIAL PRIMARY KEY,
            topic         TEXT NOT NULL DEFAULT \'go\',
            data          JSONB NOT NULL,
            created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
        )',
];

foreach ($ddl as $table => $sql) {
    if (gamecode_pg_exec($sql) === false) {
        fwrite(STDERR, "ОШИБКА: не удалось создать таблицу {$table}.\n");
        exit(1);
    }
    migrate_log("Таблица {$table} — OK");
}

// ── 2. Уровни ────────────────────────────────────────────────────────────────
$inserted = 0;
$failed = 0;
for ($n = 1; $n <= 4; $n++) {
    $path = gamecode_pixelgame_level_file($n);
    $data = gamecode_json_read($path);
    if (!is_array($data) || empty($data['chests'])) {
        migrate_log("ПРОПУСК: level{$n}.json не найден или некорректен ({$path})");
        $failed++;
        continue;
    }
    if (writePixelgameLevel($n, $data)) {
        $chestCount = count($data['chests']);
        migrate_log("Уровень {$n} («" . ($data['title'] ?? "Level {$n}") . "», сундуков: {$chestCount}) — upsert OK");
        $inserted++;
    } else {
        migrate_log("ОШИБКА: не удалось записать уровень {$n}");
        $failed++;
    }
}

// ── 3. Вопросы монстров ──────────────────────────────────────────────────────
$qData = gamecode_json_read(gamecode_pixelgame_questions_file());
if (is_array($qData) && !empty($qData['questions'])) {
    if (writePixelgameMonsterQuestions($qData)) {
        migrate_log('Вопросы монстров (topic: ' . ($qData['topic'] ?? 'go') . ', вопросов: ' . count($qData['questions']) . ') — upsert OK');
    } else {
        migrate_log('ОШИБКА: не удалось записать вопросы монстров');
        $failed++;
    }
} else {
    migrate_log('ПРОПУСК: monster-questions.json не найден или некорректен');
    $failed++;
}

// ── 4. Сброс кэша ────────────────────────────────────────────────────────────
cache_invalidate_pixelgame();
migrate_log('Redis-кэш контента Pixelgame сброшен (или Redis недоступен — не критично)');

// ── 5. Проверка ──────────────────────────────────────────────────────────────
$rows = gamecode_pg_query_all('SELECT level_number, title FROM pixelgame_levels ORDER BY level_number');
if (is_array($rows)) {
    migrate_log('В БД сейчас уровней: ' . count($rows));
    foreach ($rows as $row) {
        migrate_log("  - level {$row['level_number']}: {$row['title']}");
    }
}

migrate_log("Готово. Уровней перенесено: {$inserted}, ошибок/пропусков: {$failed}");
exit($failed > 0 ? 1 : 0);
