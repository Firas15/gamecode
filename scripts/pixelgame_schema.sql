-- =============================================================================
-- GAME CODE — Pixelgame content tables
-- Контент игры Pixelgame: уровни и вопросы для боёв.
-- Postgres — источник истины; JSON-файлы в games/pixelgame/data/ остаются
-- как read-only аварийный фолбэк (НЕ удалять!).
--
-- Перед запуском сверь текущую схему прода:
--   pg_dump --schema-only -h $DB_HOST -U $DB_USER -d $DB_NAME > schema_current.sql
--
-- Запуск:
--   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f scripts/pixelgame_schema.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS pixelgame_levels (
    id            SERIAL PRIMARY KEY,
    level_number  INT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    data          JSONB NOT NULL,   -- весь объект уровня как в level*.json (title, chests, final, опц. map)
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pixelgame_monster_questions (
    id            SERIAL PRIMARY KEY,
    topic         TEXT NOT NULL DEFAULT 'go',
    data          JSONB NOT NULL,   -- весь объект {topic, questions:[...]} как в monster-questions.json
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
