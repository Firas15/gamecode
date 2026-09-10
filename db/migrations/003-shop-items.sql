-- ============================================================
--  Каталог магазина переезжает из PHP в базу
--
--  До этой миграции список товаров был захардкожен в
--  includes/shop.php: цену правили в коде и выкатывали релизом.
--  Теперь он лежит в таблице и правится из админки, а код
--  остаётся запасным вариантом — если таблицы нет, магазин
--  молча берёт старый список и работает как раньше.
--
--  Миграция идемпотентна: повторный запуск ничего не сломает
--  и не перезапишет уже отредактированные цены (ON CONFLICT
--  DO NOTHING).
--
--  Применить локально (Windows, свой PostgreSQL) — из папки проекта:
--    scripts\migrate-local.cmd
--  Скрипт прогоняет все файлы из db/migrations по очереди.
--
--  На сервере руками ничего запускать не нужно: миграции
--  применяет docker/entrypoint.sh при каждом старте контейнера,
--  то есть сразу после ./scripts/deploy.sh
--
--  Откат:
--    DROP TABLE IF EXISTS shop_items;
--  Каталог снова берётся из includes/shop.php, покупки игроков
--  лежат в отдельной таблице shop_purchases и не страдают.
-- ============================================================

-- Файл в UTF-8, а psql в консоли Windows по умолчанию считает
-- ввод кодировкой WIN1251 и спотыкается на первом же символе,
-- которого в ней нет (например на «И» в «СЕТЕВОЙ ИНЖЕНЕР»).
-- Говорим серверу правду про кодировку до первого русского слова.
SET client_encoding = 'UTF8';

BEGIN;

-- payload — единственное поле, которое значит разное у разных
-- видов товара. Так сделано намеренно: заводить четыре почти
-- всегда пустые колонки ради одного заполненного значения хуже,
-- чем одна колонка с понятным правилом.
--
--   frame  → CSS-класс рамки      (gc-frame--gold)
--   title  → сам текст титула     (ХАКЕР)
--   avatar → имя файла без .png   (avatar4-gold → img/avatars/avatar4-gold.png)
--   skin   → папка спрайтов       (gold → games/pixelgame/assets/player/gold/)
--
-- hidden — снят с продажи. Товар исчезает с витрины, но у тех,
-- кто успел купить, продолжает работать: удалять купленное
-- нельзя, иначе люди теряют то, за что заплатили.
CREATE TABLE IF NOT EXISTS shop_items (
    id         character varying(40) PRIMARY KEY,
    kind       character varying(16) NOT NULL,
    name       character varying(80) NOT NULL,
    price      integer DEFAULT 0 NOT NULL,
    is_free    boolean DEFAULT false NOT NULL,
    hidden     boolean DEFAULT false NOT NULL,
    payload    character varying(120) DEFAULT ''::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_items_kind ON shop_items (kind, sort_order);

-- Стартовое наполнение — ровно тот каталог, что сейчас в коде.
-- ON CONFLICT DO NOTHING: если миграцию прогнать второй раз уже
-- после правок в админке, цены останутся отредактированными.
INSERT INTO shop_items (id, kind, name, price, is_free, payload, sort_order) VALUES
    -- РАМКИ
    ('frame_none',     'frame',  'Без рамки',          0,   true,  '',                  10),
    ('frame_cyan',     'frame',  'Неоновый контур',    50,  false, 'gc-frame--cyan',    20),
    ('frame_green',    'frame',  'Матрица',            90,  false, 'gc-frame--green',   30),
    ('frame_pink',     'frame',  'Розовый шум',        140, false, 'gc-frame--pink',    40),
    ('frame_gold',     'frame',  'Золото',             200, false, 'gc-frame--gold',    50),
    ('frame_dashed',   'frame',  'Бегущая строка',     300, false, 'gc-frame--dashed',  60),
    ('frame_glitch',   'frame',  'Глитч',              450, false, 'gc-frame--glitch',  70),
    ('frame_rgb',      'frame',  'RGB',                700, false, 'gc-frame--rgb',     80),

    -- ТИТУЛЫ
    ('title_none',     'title',  'Без титула',         0,   true,  '',                     10),
    ('title_novice',   'title',  'Новичок',            40,  false, 'НОВИЧОК',              20),
    ('title_debug',    'title',  'Отладчик',           70,  false, 'ОТЛАДЧИК',             30),
    ('title_net',      'title',  'Сетевой инженер',    100, false, 'СЕТЕВОЙ ИНЖЕНЕР',      40),
    ('title_sorter',   'title',  'Мастер сортировки',  100, false, 'МАСТЕР СОРТИРОВКИ',    50),
    ('title_quiz',     'title',  'Эрудит',             100, false, 'ЭРУДИТ',               60),
    ('title_hacker',   'title',  'Хакер',              180, false, 'ХАКЕР',                70),
    ('title_arch',     'title',  'Архитектор',         280, false, 'АРХИТЕКТОР',           80),
    ('title_legend',   'title',  'Легенда GameCode',   450, false, 'ЛЕГЕНДА GAMECODE',     90),

    -- АВАТАРЫ (пять исходных бесплатны — они были у всех до магазина)
    ('avatar1',        'avatar', 'Аватар 1',           0,   true,  'avatar1',           10),
    ('avatar2',        'avatar', 'Аватар 2',           0,   true,  'avatar2',           20),
    ('avatar3',        'avatar', 'Аватар 3',           0,   true,  'avatar3',           30),
    ('avatar4',        'avatar', 'Аватар 4',           0,   true,  'avatar4',           40),
    ('avatar5',        'avatar', 'Аватар 5',           0,   true,  'avatar5',           50),
    ('avatar1-toxic',  'avatar', 'Токсичный',          90,  false, 'avatar1-toxic',     60),
    ('avatar2-ice',    'avatar', 'Лёд',                120, false, 'avatar2-ice',       70),
    ('avatar3-blood',  'avatar', 'Багровый',           160, false, 'avatar3-blood',     80),
    ('avatar4-gold',   'avatar', 'Золотой',            200, false, 'avatar4-gold',      90),
    ('avatar5-plasma', 'avatar', 'Плазма',             260, false, 'avatar5-plasma',   100),
    ('avatar1-void',   'avatar', 'Пустота',            350, false, 'avatar1-void',     110),

    -- СКИНЫ CODEQUEST
    ('skin_default',   'skin',   'Базовый',            0,   true,  '',                  10),
    ('skin_green',     'skin',   'Зелёный протокол',   150, false, 'green',             20),
    ('skin_crimson',   'skin',   'Красный код',        250, false, 'crimson',           30),
    ('skin_gold',      'skin',   'Золотой байт',       400, false, 'gold',              40),
    ('skin_void',      'skin',   'Тьма',               600, false, 'void',              50)
ON CONFLICT (id) DO NOTHING;

COMMIT;
