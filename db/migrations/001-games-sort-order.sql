-- ============================================================
--  Миграция 001: порядок игр в карусели
--
--  Добавляет games.sort_order. До неё порядок задавался датой
--  создания и вручную не менялся.
--
--  Применение на сервере:
--    cd /opt/gamecode
--    docker compose cp db/migrations/001-games-sort-order.sql db:/tmp/m1.sql
--    docker compose exec db psql -U gamecode_user -d gamecode -f /tmp/m1.sql
--
--  Выполнять повторно безопасно.
-- ============================================================

ALTER TABLE public.games
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Начальный порядок = тот, что был виден раньше (по дате добавления),
-- иначе после миграции все игры получили бы 0 и порядок стал случайным.
WITH ordered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) - 1) AS pos
    FROM public.games
)
UPDATE public.games g
SET sort_order = o.pos
FROM ordered o
WHERE g.id = o.id
  AND g.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_games_sort ON public.games (sort_order ASC);
