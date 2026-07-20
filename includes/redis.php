<?php
/**
 * =============================================================================
 * GAME CODE — Redis Cache Layer
 * Файл: includes/redis.php
 * =============================================================================
 *
 * Подключить в includes/db.php одной строкой:
 *   require_once __DIR__ . '/redis.php';
 *
 * Паттерн Cache-Aside везде одинаковый:
 *   1. Смотрим в Redis
 *   2. Если есть — отдаём сразу (не идём в PG)
 *   3. Если нет — идём в PG, кладём в Redis, отдаём
 *   4. При изменении данных — чистим нужные ключи
 *
 * КЛЮЧИ REDIS (что хранится и сколько):
 *   gamecode:games          — список игр           TTL: 1 час
 *   gamecode:news           — список новостей      TTL: 30 мин
 *   gamecode:faq            — FAQ чат-бота         TTL: 1 час
 *   gamecode:lb:all         — лидерборд общий      TTL: 5 мин
 *   gamecode:lb:{game}      — лидерборд по игре    TTL: 5 мин
 *   gamecode:user:{id}      — профиль пользователя TTL: 10 мин
 *   gamecode:user:nick:{lc} — поиск по нику        TTL: 10 мин
 * =============================================================================
 */

declare(strict_types=1);

// =============================================================================
// ПОДКЛЮЧЕНИЕ К REDIS
// =============================================================================

/**
 * Возвращает соединение с Redis или null если Redis недоступен.
 * Используем static чтобы подключаться только один раз за запрос.
 * Если Redis упал — приложение продолжает работать через PostgreSQL.
 */
function gamecode_redis(): ?\Redis {
    static $redis = null;
    static $attempted = false;

    if ($attempted) {
        return $redis; // уже пробовали, возвращаем результат
    }
    $attempted = true;

    if (!class_exists('Redis')) {
        // Расширение phpredis не установлено — работаем без кэша
        return null;
    }

    $host = gamecode_env('REDIS_HOST', '127.0.0.1');
    $port = (int) gamecode_env('REDIS_PORT', '6379');
    $pass = gamecode_env('REDIS_PASSWORD', '');
    $db   = (int) gamecode_env('REDIS_DB', '0');

    try {
        $r = new \Redis();
        // connect с таймаутом 1 сек — чтобы не тормозить если Redis недоступен
        if (!$r->connect($host, $port, 1.0)) {
            error_log('[GameCode Redis] connect() returned false for ' . $host . ':' . $port);
            return null;
        }
        if ($pass !== '') {
            if (!$r->auth($pass)) {
                error_log('[GameCode Redis] auth() failed for ' . $host . ':' . $port);
                return null;
            }
        }
        if ($db !== 0) {
            if (!$r->select($db)) {
                error_log('[GameCode Redis] select(' . $db . ') failed for ' . $host . ':' . $port);
                return null;
            }
        }

        $pong = $r->ping();
        if ($pong !== true && strtoupper((string)$pong) !== 'PONG' && strtoupper((string)$pong) !== '+PONG') {
            error_log('[GameCode Redis] ping() returned unexpected value: ' . var_export($pong, true));
        }
        $redis = $r;
    } catch (\Throwable $e) {
        error_log('[GameCode Redis] Connection failed: ' . $e->getMessage());
        $redis = null;
    }

    return $redis;
}

// =============================================================================
// НИЗКОУРОВНЕВЫЕ ХЕЛПЕРЫ
// =============================================================================

/** Получить значение из Redis, декодировать JSON → array. Возвращает null если нет. */
function cache_get(string $key): ?array {
    $r = gamecode_redis();
    if (!$r) return null;

    try {
        $raw = $r->get($key);
        if ($raw === false) return null; // ключа нет
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    } catch (\Throwable $e) {
        return null;
    }
}

/** Сохранить массив в Redis как JSON с TTL в секундах. */
function cache_set(string $key, array $data, int $ttl): void {
    $r = gamecode_redis();
    if (!$r) return;

    try {
        $r->setex($key, $ttl, json_encode($data, JSON_UNESCAPED_UNICODE));
    } catch (\Throwable $e) {
        // Молча игнорируем — кэш необязателен
    }
}

/** Удалить один или несколько ключей из Redis. */
function cache_delete(string ...$keys): void {
    $r = gamecode_redis();
    if (!$r || empty($keys)) return;

    try {
        $r->del($keys);
    } catch (\Throwable $e) {
        // Молча игнорируем
    }
}

/** Удалить все ключи с заданным префиксом (например gamecode:lb:*). */
function cache_delete_pattern(string $pattern): void {
    $r = gamecode_redis();
    if (!$r) return;

    try {
        $keys = $r->keys($pattern);
        if (!empty($keys)) {
            $r->del($keys);
        }
    } catch (\Throwable $e) {
        // Молча игнорируем
    }
}

// =============================================================================
// TTL КОНСТАНТЫ
// =============================================================================

const CACHE_TTL_GAMES       = 3600;  // 1 час  — игры меняются редко
const CACHE_TTL_NEWS        = 1800;  // 30 мин — новости обновляются редко
const CACHE_TTL_FAQ         = 3600;  // 1 час  — FAQ почти статичен
const CACHE_TTL_LEADERBOARD = 300;   // 5 мин  — лидерборд обновляется часто
const CACHE_TTL_USER        = 600;   // 10 мин — профиль может меняться
const CACHE_TTL_PIXELGAME_CONTENT = 3600; // 1 час — контент уровней меняется редко (как games/faq)

// =============================================================================
// КЛЮЧИ REDIS
// =============================================================================

const CACHE_KEY_GAMES    = 'gamecode:games';
const CACHE_KEY_NEWS     = 'gamecode:news';
const CACHE_KEY_FAQ      = 'gamecode:faq';
const CACHE_KEY_LB_ALL   = 'gamecode:lb:all';
const CACHE_KEY_PIXELGAME_QUESTIONS = 'gamecode:pixelgame:questions';

function cache_key_lb(string $game): string {
    return 'gamecode:lb:' . $game;
}
function cache_key_pixelgame_level(int $levelNumber): string {
    return 'gamecode:pixelgame:level:' . $levelNumber;
}
function cache_key_user(int $id): string {
    return 'gamecode:user:' . $id;
}
function cache_key_user_nick(string $nickname): string {
    return 'gamecode:user:nick:' . strtolower($nickname);
}

// =============================================================================
// КЭШИРОВАННЫЕ ФУНКЦИИ — ИГРЫ
// =============================================================================

/**
 * Читает список игр.
 * Cache-Aside: Redis → PostgreSQL → Redis.
 */
function cached_read_games(): array {
    // 1. Смотрим кэш
    $cached = cache_get(CACHE_KEY_GAMES);
    if ($cached !== null) {
        return $cached;
    }

    // 2. Идём в PostgreSQL
    $games = readGames();

    // 3. Кладём в кэш
    cache_set(CACHE_KEY_GAMES, $games, CACHE_TTL_GAMES);

    return $games;
}

/**
 * Сохраняет игры и сбрасывает кэш.
 * Вызывается из admin/games.php при изменении.
 */
function cached_write_games(array $games): void {
    writeGames($games);
    cache_delete(CACHE_KEY_GAMES);
}

// =============================================================================
// КЭШИРОВАННЫЕ ФУНКЦИИ — PIXELGAME (контент уровней и вопросов)
// Cache-Aside по образцу cached_read_games().
// =============================================================================

/**
 * Читает уровень Pixelgame: Redis → PostgreSQL (фолбэк JSON) → Redis.
 */
function cached_read_pixelgame_level(int $levelNumber): ?array {
    $key = cache_key_pixelgame_level($levelNumber);

    $cached = cache_get($key);
    if ($cached !== null) {
        return $cached;
    }

    $level = readPixelgameLevel($levelNumber);
    if (!is_array($level)) {
        return null;
    }

    cache_set($key, $level, CACHE_TTL_PIXELGAME_CONTENT);
    return $level;
}

/**
 * Читает вопросы монстров Pixelgame: Redis → PostgreSQL (фолбэк JSON) → Redis.
 */
function cached_read_pixelgame_monster_questions(): ?array {
    $cached = cache_get(CACHE_KEY_PIXELGAME_QUESTIONS);
    if ($cached !== null) {
        return $cached;
    }

    $questions = readPixelgameMonsterQuestions();
    if (!is_array($questions)) {
        return null;
    }

    cache_set(CACHE_KEY_PIXELGAME_QUESTIONS, $questions, CACHE_TTL_PIXELGAME_CONTENT);
    return $questions;
}

/**
 * Сбрасывает кэш контента Pixelgame.
 * Вызывается из админки после сохранения уровня/вопросов.
 * @param int $levelNumber 0 — сбросить все уровни
 */
function cache_invalidate_pixelgame(int $levelNumber = 0): void {
    if ($levelNumber > 0) {
        cache_delete(cache_key_pixelgame_level($levelNumber), CACHE_KEY_PIXELGAME_QUESTIONS);
        return;
    }
    cache_delete_pattern('gamecode:pixelgame:level:*');
    cache_delete(CACHE_KEY_PIXELGAME_QUESTIONS);
}

// =============================================================================
// КЭШИРОВАННЫЕ ФУНКЦИИ — НОВОСТИ
// =============================================================================

function cached_read_news(): array {
    $cached = cache_get(CACHE_KEY_NEWS);
    if ($cached !== null) {
        return $cached;
    }

    $news = readNews();
    cache_set(CACHE_KEY_NEWS, $news, CACHE_TTL_NEWS);

    return $news;
}

/**
 * Сохраняет новости и сбрасывает кэш.
 */
function cached_write_news(array $news): void {
    writeNews($news);
    cache_delete(CACHE_KEY_NEWS);
}

// =============================================================================
// КЭШИРОВАННЫЕ ФУНКЦИИ — FAQ
// =============================================================================

function cached_load_faq(): array {
    $cached = cache_get(CACHE_KEY_FAQ);
    if ($cached !== null) {
        return $cached;
    }

    $items = gamecode_chat_faq_load_items();
    cache_set(CACHE_KEY_FAQ, $items, CACHE_TTL_FAQ);

    return $items;
}

/**
 * Сохраняет FAQ и сбрасывает кэш.
 */
function cached_save_faq(array $items): bool {
    $ok = gamecode_chat_faq_save_items($items);
    if ($ok) {
        cache_delete(CACHE_KEY_FAQ);
    }
    return $ok;
}

// =============================================================================
// КЭШИРОВАННЫЕ ФУНКЦИИ — ПОЛЬЗОВАТЕЛИ
// =============================================================================

/**
 * Поиск пользователя по id.
 * Кэшируем профиль на 10 мин — часто нужен при каждом запросе (check-auth, profile).
 */
function cached_find_user_by_id(int $id): ?array {
    $key = cache_key_user($id);

    $cached = cache_get($key);
    if ($cached !== null) {
        // Специальный маркер "пользователь не найден" — чтобы не долбить PG
        if (isset($cached['__not_found'])) return null;
        return $cached;
    }

    $user = findUserById($id);

    if ($user !== null) {
        cache_set($key, $user, CACHE_TTL_USER);
    } else {
        // Кэшируем "не найден" на 1 мин чтобы не долбить PG несуществующими id
        cache_set($key, ['__not_found' => true], 60);
    }

    return $user;
}

/**
 * Поиск пользователя по нику.
 * Кэшируем id → потом берём профиль по id из кэша.
 */
function cached_find_user_by_nick(string $nickname): ?array {
    $nickKey = cache_key_user_nick($nickname);

    // Кэш хранит только id пользователя
    $cached = cache_get($nickKey);
    if ($cached !== null) {
        if (isset($cached['__not_found'])) return null;
        $id = (int)($cached['id'] ?? 0);
        if ($id > 0) {
            return cached_find_user_by_id($id);
        }
    }

    $user = findUserByNick($nickname);

    if ($user !== null) {
        // Кэшируем маппинг nick → id
        cache_set($nickKey, ['id' => $user['id']], CACHE_TTL_USER);
        // И сам профиль
        cache_set(cache_key_user($user['id']), $user, CACHE_TTL_USER);
    } else {
        cache_set($nickKey, ['__not_found' => true], 60);
    }

    return $user;
}

/**
 * Сбросить кэш пользователя (при изменении профиля, бане и т.д.)
 */
function cache_invalidate_user(int $id, string $nickname = ''): void {
    $keys = [cache_key_user($id)];
    if ($nickname !== '') {
        $keys[] = cache_key_user_nick($nickname);
    }
    cache_delete(...$keys);
}

// =============================================================================
// КЭШИРОВАННЫЕ ФУНКЦИИ — ЛИДЕРБОРД
// =============================================================================

/**
 * Самая важная функция — лидерборд.
 *
 * БЕЗ Redis: loadScores() загружает 9077 строк в PHP, потом readUsers()
 *            загружает 52 пользователей, потом PHP считает суммы.
 *            Это ~1.6 МБ данных на каждый запрос лидерборда.
 *
 * С Redis:   первый запрос считает и кладёт результат в кэш.
 *            Следующие 5 минут — мгновенный ответ из памяти.
 *
 * С Redis + SQL агрегацией: вместо loadScores() делаем один SQL запрос
 *                           с SUM + GROUP BY прямо в PostgreSQL.
 */
function cached_leaderboard(string $game, int $limit = 10): array {
    $key = ($game === 'all') ? CACHE_KEY_LB_ALL : cache_key_lb($game);

    // 1. Проверяем кэш
    $cached = cache_get($key);
    if ($cached !== null) {
        // Применяем limit уже на закэшированный результат
        // (кэшируем топ-50, отдаём нужное кол-во)
        return array_slice($cached, 0, $limit);
    }

    // 2. Считаем в PostgreSQL через агрегацию — не загружаем 9077 строк в PHP!
    $rows = build_leaderboard_from_db($game, 50); // кэшируем топ-50

    // 3. Кладём в кэш
    cache_set($key, $rows, CACHE_TTL_LEADERBOARD);

    return array_slice($rows, 0, $limit);
}

/**
 * Считает лидерборд одним SQL-запросом с JOIN и SUM.
 * Намного эффективнее чем читать всё в PHP.
 */
function build_leaderboard_from_db(string $game, int $limit): array {
    if ($game === 'all') {
        $sql = '
            SELECT
                u.id,
                u.nickname,
                u.avatar_emoji,
                SUM(s.score) AS total_score
            FROM scores s
            JOIN users u ON u.id = s.user_id
            WHERE s.user_id IS NOT NULL
            GROUP BY u.id, u.nickname, u.avatar_emoji
            ORDER BY total_score DESC
            LIMIT $1
        ';
        $params = [$limit];
    } else {
        $sql = '
            SELECT
                u.id,
                u.nickname,
                u.avatar_emoji,
                SUM(s.score) AS total_score
            FROM scores s
            JOIN users u ON u.id = s.user_id
            WHERE s.game_id = $1
              AND s.user_id IS NOT NULL
            GROUP BY u.id, u.nickname, u.avatar_emoji
            ORDER BY total_score DESC
            LIMIT $2
        ';
        $params = [$game, $limit];
    }

    $rows = gamecode_pg_query_all($sql, $params);
    if (!is_array($rows)) {
        return [];
    }

    $result = [];
    $rank = 1;
    foreach ($rows as $row) {
        $entry = [
            'rank'         => $rank++,
            'nickname'     => (string)($row['nickname'] ?? ''),
            'avatar_emoji' => (string)($row['avatar_emoji'] ?? 'avatar1'),
            'score'        => (int)($row['total_score'] ?? 0),
        ];
        if ($game !== 'all') {
            $entry['game_id'] = $game;
        }
        $result[] = $entry;
    }

    return $result;
}

/**
 * Сбросить кэш лидерборда — вызывать после каждого нового score.
 */
function cache_invalidate_leaderboard(string $gameId = ''): void {
    // Всегда сбрасываем общий лидерборд
    cache_delete(CACHE_KEY_LB_ALL);

    // Если знаем конкретную игру — сбрасываем и её
    if ($gameId !== '') {
        cache_delete(cache_key_lb($gameId));
    }
}
