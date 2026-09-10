-- ============================================================
--  Магазин за очки: монеты, покупки, экипировка
--  Миграция идемпотентна — повторный запуск безопасен.
--
--  Применить:
--    docker compose exec -T db psql -U gamecode_user -d gamecode \
--      < db/migrations/002-shop.sql
--
--  Откат (если магазин решили убрать):
--    ALTER TABLE users DROP COLUMN IF EXISTS coins,
--                      DROP COLUMN IF EXISTS coins_earned,
--                      DROP COLUMN IF EXISTS equipped_frame,
--                      DROP COLUMN IF EXISTS equipped_title,
--                      DROP COLUMN IF EXISTS equipped_skin;
--    DROP TABLE IF EXISTS shop_purchases;
--  Но проще ничего не удалять: без кода магазина эти поля
--  просто лежат и никому не мешают.
-- ============================================================

BEGIN;

-- Приветственный бонус выдаётся через DEFAULT 50 в момент создания
-- колонки: все, кто уже зарегистрирован, получают 50 монет разом.
-- Сразу после этого дефолт сбрасывается в 0, чтобы будущие вставки
-- не раздавали бонус повторно — новым пользователям его начисляет
-- registerUser() явным запросом.
ALTER TABLE users ADD COLUMN IF NOT EXISTS coins integer DEFAULT 50 NOT NULL;
ALTER TABLE users ALTER COLUMN coins SET DEFAULT 0;

-- Сколько монет заработано за всё время. Нужно только для витрины
-- профиля («заработано / потрачено»), в расчётах не участвует.
ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_earned integer DEFAULT 0 NOT NULL;

-- Надетые предметы. Пустая строка = ничего не надето.
-- Идентификатор товара, а не внешний ключ: каталог живёт в PHP
-- (includes/shop.php), в гите, и правится без миграций.
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_frame character varying(40) DEFAULT ''::character varying NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_title character varying(40) DEFAULT ''::character varying NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_skin  character varying(40) DEFAULT ''::character varying NOT NULL;

-- Купленное. UNIQUE(user_id, item_id) — главная защита от двойной
-- покупки: даже если два запроса прилетят одновременно, второй
-- упрётся в индекс, а не спишет монеты дважды.
CREATE TABLE IF NOT EXISTS shop_purchases (
    id         bigserial PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id    character varying(40) NOT NULL,
    price      integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_purchases_uniq ON shop_purchases (user_id, item_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_user ON shop_purchases (user_id);

COMMIT;
