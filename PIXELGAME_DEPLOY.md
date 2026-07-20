# Развёртывание Pixelgame в GameCode — пошаговая инструкция

Игра уже интегрирована в код (папка `games/pixelgame/`, API, очки, админка).
Осталось выполнить шаги на сервере с PostgreSQL и Redis.

## Шаг 1. Сверить текущую схему БД

В репозитории `schema.sql` нет, поэтому перед созданием новых таблиц снимаем схему с прода/дева:

```bash
pg_dump --schema-only -h $DB_HOST -U $DB_USER -d $DB_NAME > schema_current.sql
```

Убедись, что таблиц `pixelgame_levels` и `pixelgame_monster_questions` ещё нет
и имена не конфликтуют с существующими (`users`, `games`, `news`, `admin_log`, `scores`, `chat_faq`).

## Шаг 2. Прогнать миграцию контента

Из корня проекта (миграция сама создаст таблицы, если их нет, и сделает upsert —
повторный запуск безопасен):

```bash
php scripts/migrate_pixelgame_json_to_pg.php
```

Ожидаемый вывод: «Уровней перенесено: 4», вопросы монстров — upsert OK.
DDL отдельно лежит в `scripts/pixelgame_schema.sql`, если хочешь создать таблицы вручную через psql.

Проверка:

```sql
SELECT level_number, title, jsonb_array_length(data->'chests') AS chests FROM pixelgame_levels ORDER BY 1;
SELECT topic, jsonb_array_length(data->'questions') AS questions FROM pixelgame_monster_questions;
```

Должно быть 4 уровня по 5 сундуков и 100 вопросов.

**Важно:** JSON-файлы в `games/pixelgame/data/` не удалять — это аварийный
read-only фолбэк на случай недоступности Postgres (тот же паттерн, что `data/games.json`).

## Шаг 3. Зарегистрировать игру в каталоге

Через админку `admin/games.php` («Добавить игру») или прямым SQL:

```sql
INSERT INTO games (id, title, emoji, description, level, stars, wip, link, created_at)
VALUES (
  'pixelgame',
  'CodeQuest — Внутри компьютера',
  '👾',
  'Пиксельная RPG: исследуй лабиринт, открывай сундуки с кодом и собери программу на Go',
  'medium',
  2,
  true,          -- WIP на время обкатки
  'games/pixelgame/index.html',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

После вставки прямым SQL сбрось кэш каталога: `redis-cli DEL gamecode:games`
(при добавлении через админку кэш сбросится сам).

## Шаг 4. Redis

Ничего нового настраивать не нужно — используется общий Redis
(`REDIS_HOST/REDIS_PORT/REDIS_PASSWORD/REDIS_DB`, см. `includes/redis.php`).
Новые ключи появятся автоматически:

- `gamecode:pixelgame:level:{1..4}` (TTL 1 час)
- `gamecode:pixelgame:questions` (TTL 1 час)
- `gamecode:lb:pixelgame` (TTL 5 мин, после первого сабмита очков)

## Шаг 5. Проверка end-to-end

1. Открой главную — в карусели и каталоге есть карточка «CodeQuest» (с бейджем WIP).
2. Пока `wip=true`, страница игры редиректит на главную (`js/wip-guard.js`) — для теста временно переключи WIP в `admin/games.php` (кнопка ⏸/▶).
3. Залогинься на сайте, пройди уровень 1 до конца (собери программу и запусти).
4. Проверь очки:
   ```sql
   SELECT * FROM scores WHERE game_id = 'pixelgame' ORDER BY id DESC LIMIT 5;
   ```
5. Проверь кэш лидерборда до/после сабмита:
   ```bash
   redis-cli KEYS 'gamecode:lb:*'
   redis-cli KEYS 'gamecode:pixelgame:*'
   ```
6. Виджет «ТОП ИГРОКОВ» в меню игры показывает результат.
7. Отказоустойчивость: останови Redis — сайт и все 4 игры продолжают работать
   (напрямую через Postgres); останови Postgres — контент игры отдаётся из JSON-фолбэка.

## Шаг 6. Админка уровней

`admin` → пункт «👾 PIXELGAME» в сайдбаре (`admin/pixelgame_editor.php`).
Редактор карт/вопросов сохраняет теперь в PostgreSQL (кнопка SAVE LEVEL)
и сам сбрасывает Redis-кэш. Старый `admin.html` с localStorage удалён.

Ограничение: в игре отображаются уровни 1–4 (сетка уровней фиксированная).
Кнопка «+ NEW LEVEL» в редакторе сохранит уровень 5+ в БД, но в игре он не появится
без доработки экрана выбора уровней.

## Шаг 7. Запуск для всех

1. `admin/games.php` → переключить WIP → LIVE.
2. В `js/data.js` у записи `pixelgame` поменять `wip: true` → `false` (карточка в каталоге на главной).

## Как считаются очки (справка)

Формула в `api/score.php` (`gc_compute_score`, ветка `pixelgame`), очки только за победу
(все сундуки собраны, HP ≥ 1, `completed=true`):

```
base  = сундуки×20 + HP×10 + победы_в_боях×15 − ошибки_в_сундуках×5   (не ниже 0)
score = base × множитель уровня (ур.1 ×1.0, ур.2 ×1.2, ур.3 ×1.4, ур.4 ×1.6)
```

Анти-спидран: минимум `max(15 сек, сундуки×4 сек + бои×2 сек)` на прохождение.
Античит: HMAC run-токены (`api/ping-game.php`), rate-limit 3 сек — как у остальных игр.
