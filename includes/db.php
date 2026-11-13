<?php
require_once __DIR__ . '/redis.php'; 

if (file_exists(dirname(__DIR__) . '/config.php')) {
    require_once dirname(__DIR__) . '/config.php';
}

define('GAMES_FILE', dirname(__DIR__) . '/data/games.json');
define('NEWS_FILE', dirname(__DIR__) . '/data/news.json');
define('LOG_FILE', dirname(__DIR__) . '/data/admin_log.json');
define('CHAT_FAQ_FILE', dirname(__DIR__) . '/data/chat_faq.json');

function gamecode_env(string $name, string $default = ''): string {
    if (defined($name)) {
        $value = constant($name);
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
    }

    $value = getenv($name);
    if ($value !== false && trim($value) !== '') {
        return trim((string)$value);
    }

    return $default;
}

function gamecode_db_bool($value): bool {
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value)) {
        return $value === 1;
    }
    if (is_string($value)) {
        $value = strtolower(trim($value));
        return in_array($value, ['1', 't', 'true', 'yes', 'on'], true);
    }
    return false;
}

function gamecode_pg_connection() {
    static $conn = null;
    static $attempted = false;

    if ($conn !== null || $attempted) {
        return $conn;
    }
    $attempted = true;

    if (!function_exists('pg_connect')) {
        return null;
    }

    $dsn = gamecode_env('DATABASE_URL');
    if ($dsn === '') {
        $host = gamecode_env('DB_HOST', gamecode_env('PGHOST'));
        $port = gamecode_env('DB_PORT', gamecode_env('PGPORT', '5432'));
        $name = gamecode_env('DB_NAME', gamecode_env('PGDATABASE'));
        $user = gamecode_env('DB_USER', gamecode_env('PGUSER'));
        $pass = gamecode_env('DB_PASSWORD', gamecode_env('DB_PASS', gamecode_env('PGPASSWORD')));

        if ($host === '' || $name === '' || $user === '') {
            return null;
        }

        $dsn = sprintf(
            'host=%s port=%s dbname=%s user=%s password=%s',
            $host,
            $port,
            $name,
            $user,
            $pass
        );
    }

    $conn = @pg_connect($dsn);
    return $conn ?: null;
}

function gamecode_pg_query_all(string $sql, array $params = []) {
    $conn = gamecode_pg_connection();
    if (!$conn) {
        return false;
    }

    $result = $params ? @pg_query_params($conn, $sql, $params) : @pg_query($conn, $sql);
    if ($result === false) {
        return false;
    }

    $rows = pg_fetch_all($result);
    return is_array($rows) ? $rows : [];
}

function gamecode_pg_exec(string $sql, array $params = []) {
    $conn = gamecode_pg_connection();
    if (!$conn) {
        return false;
    }

    return $params ? @pg_query_params($conn, $sql, $params) : @pg_query($conn, $sql);
}

function gamecode_pg_table_exists(string $table, string $schema = 'public'): bool {
    $rows = gamecode_pg_query_all(
        'SELECT 1
         FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2
         LIMIT 1',
        [$schema, $table]
    );
    return is_array($rows) && !empty($rows);
}

function gamecode_pg_table_columns(string $table, string $schema = 'public'): array {
    static $cache = [];
    $key = $schema . '.' . $table;
    if (isset($cache[$key])) {
        return $cache[$key];
    }

    $rows = gamecode_pg_query_all(
        'SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position',
        [$schema, $table]
    );

    $columns = [];
    if (is_array($rows)) {
        foreach ($rows as $row) {
            $columns[] = strtolower((string)($row['column_name'] ?? ''));
        }
    }

    $cache[$key] = $columns;
    return $columns;
}

function gamecode_pg_pick_column(array $columns, array $candidates): ?string {
    foreach ($candidates as $candidate) {
        if (in_array(strtolower($candidate), $columns, true)) {
            return strtolower($candidate);
        }
    }
    return null;
}

function gamecode_json_read(string $path): ?array {
    if (!file_exists($path)) {
        return null;
    }

    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function gamecode_json_write(string $path, array $data): void {
    // JSON storage is disabled now that Postgres is the source of truth.
}

function gamecode_user_from_row(array $row): array {
    return [
        'id' => (int)($row['id'] ?? 0),
        'nickname' => (string)($row['nickname'] ?? ''),
        'password_hash' => (string)($row['password_hash'] ?? ''),
        'bio' => (string)($row['bio'] ?? ''),
        'favorite_lang' => (string)($row['favorite_lang'] ?? ''),
        'favorite_game' => (string)($row['favorite_game'] ?? ''),
        'games_played' => (int)($row['games_played'] ?? 0),
        'best_score' => (int)($row['best_score'] ?? 0),
        'avatar_emoji' => (string)($row['avatar_emoji'] ?? 'avatar1'),
        'secret_question' => (string)($row['secret_question'] ?? ''),
        'secret_answer_hash' => (string)($row['secret_answer_hash'] ?? ''),
        'secret_answer' => (string)($row['secret_answer'] ?? ''),
        'banned' => gamecode_db_bool($row['banned'] ?? false),
        'created_at' => (string)($row['created_at'] ?? date('Y-m-d H:i:s')),
        'updated_at' => (string)($row['updated_at'] ?? date('Y-m-d H:i:s')),
    ];
}

function gamecode_game_from_row(array $row): array {
    return [
        'id' => (string)($row['id'] ?? ''),
        'title' => (string)($row['title'] ?? ''),
        'emoji' => (string)($row['emoji'] ?? '🎮'),
        'desc' => (string)($row['description'] ?? ($row['desc'] ?? '')),
        'description' => (string)($row['description'] ?? ($row['desc'] ?? '')),
        'level' => (string)($row['level'] ?? 'beginner'),
        'stars' => max(0, min(5, (int)($row['stars'] ?? 0))),
        'wip' => gamecode_db_bool($row['wip'] ?? false),
        'link' => (string)($row['link'] ?? '#'),
        'created_at' => (string)($row['created_at'] ?? date('Y-m-d H:i:s')),
        'sort_order' => (int)($row['sort_order'] ?? 0),
    ];
}

function gamecode_game_to_row(array $game, int $sortOrder = 0): array {
    return [
        'id' => (string)($game['id'] ?? ''),
        'title' => (string)($game['title'] ?? ''),
        'emoji' => (string)($game['emoji'] ?? '🎮'),
        'description' => (string)($game['description'] ?? ($game['desc'] ?? '')),
        'level' => (string)($game['level'] ?? 'beginner'),
        'stars' => max(0, min(5, (int)($game['stars'] ?? 0))),
        'wip' => gamecode_db_bool($game['wip'] ?? false),
        'link' => (string)($game['link'] ?? '#'),
        'created_at' => (string)($game['created_at'] ?? date('Y-m-d H:i:s')),
        'sort_order' => $sortOrder,
    ];
}

function gamecode_news_from_row(array $row): array {
    return [
        'id' => (string)($row['id'] ?? ''),
        'title' => (string)($row['title'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'image' => (string)($row['image'] ?? ''),
        'layout' => (string)($row['layout'] ?? 'left') === 'right' ? 'right' : 'left',
        'sort_order' => (int)($row['sort_order'] ?? 0),
        'created_at' => (string)($row['created_at'] ?? date('Y-m-d H:i:s')),
        'updated_at' => (string)($row['updated_at'] ?? date('Y-m-d H:i:s')),
    ];
}

function gamecode_news_to_row(array $news, int $sortOrder = 0): array {
    return [
        'id' => (string)($news['id'] ?? ''),
        'title' => (string)($news['title'] ?? ''),
        'description' => (string)($news['description'] ?? ''),
        'image' => (string)($news['image'] ?? ''),
        'layout' => (string)($news['layout'] ?? 'left') === 'right' ? 'right' : 'left',
        'sort_order' => $sortOrder,
        'created_at' => (string)($news['created_at'] ?? date('Y-m-d H:i:s')),
        'updated_at' => (string)($news['updated_at'] ?? date('Y-m-d H:i:s')),
    ];
}

function gamecode_log_from_row(array $row): array {
    $actedAt = (string)($row['acted_at'] ?? $row['time'] ?? date('Y-m-d H:i:s'));
    return [
        'id' => (int)($row['id'] ?? 0),
        'acted_at' => $actedAt,
        'time' => $actedAt,
        'action' => (string)($row['action'] ?? ''),
        'detail' => (string)($row['detail'] ?? ''),
        'created_at' => (string)($row['created_at'] ?? $actedAt),
    ];
}

function gamecode_score_from_row(array $row): array {
    $meta = $row['meta'] ?? [];
    if (is_string($meta)) {
        $decoded = json_decode($meta, true);
        $meta = is_array($decoded) ? $decoded : [];
    } elseif (!is_array($meta)) {
        $meta = [];
    }

    return [
        'id' => (int)($row['id'] ?? 0),
        'user_id' => isset($row['user_id']) ? (int)$row['user_id'] : null,
        'game_id' => (string)($row['game_id'] ?? ''),
        'score' => (int)($row['score'] ?? 0),
        'meta' => $meta,
        'created_at' => (string)($row['created_at'] ?? date('Y-m-d H:i:s')),
        'updated_at' => (string)($row['updated_at'] ?? date('Y-m-d H:i:s')),
    ];
}

function gamecode_chat_faq_file_path(): string {
    return CHAT_FAQ_FILE;
}

function gamecode_chat_faq_row_to_item(array $faqRow, array $keywordRows = []): array {
    $keywords = [];
    foreach ($keywordRows as $keywordRow) {
        if (!is_array($keywordRow)) {
            continue;
        }

        $keyword = trim((string)($keywordRow['keyword'] ?? $keywordRow['word'] ?? $keywordRow['value'] ?? ''));
        if ($keyword !== '') {
            $keywords[] = $keyword;
        }
    }

    return [
        'question' => trim((string)($faqRow['question'] ?? $faqRow['title'] ?? '')),
        'keywords' => array_values(array_unique($keywords)),
        'answer' => trim((string)($faqRow['answer'] ?? $faqRow['response'] ?? '')),
    ];
}

function gamecode_chat_faq_load_items(): array {
    $faqTable = 'chat_faq';
    $kwTable = 'chat_faq_keywords';

    if (gamecode_pg_table_exists($faqTable)) {
        $faqColumns = gamecode_pg_table_columns($faqTable);
        $faqIdCol = gamecode_pg_pick_column($faqColumns, ['id', 'faq_id']);
        $questionCol = gamecode_pg_pick_column($faqColumns, ['question', 'title', 'prompt']);
        $answerCol = gamecode_pg_pick_column($faqColumns, ['answer', 'response', 'reply']);
        $sortCol = gamecode_pg_pick_column($faqColumns, ['sort_order', 'sort', 'position', 'ord']);

        if ($questionCol && $answerCol) {
            $orderSql = $sortCol ? "{$sortCol} ASC, " : '';
            $orderSql .= $faqIdCol ? "{$faqIdCol} ASC" : '1 ASC';
            $faqRows = gamecode_pg_query_all(
                "SELECT * FROM {$faqTable} ORDER BY {$orderSql}"
            );

            $keywordMap = [];
            if (gamecode_pg_table_exists($kwTable)) {
                $kwColumns = gamecode_pg_table_columns($kwTable);
                $linkCol = gamecode_pg_pick_column($kwColumns, ['faq_id', 'chat_faq_id', 'question_id', 'parent_id']);
                $keywordCol = gamecode_pg_pick_column($kwColumns, ['keyword', 'word', 'value', 'term']);
                $kwSortCol = gamecode_pg_pick_column($kwColumns, ['sort_order', 'sort', 'position', 'ord']);

                if ($linkCol && $keywordCol) {
                    $kwOrderSql = $kwSortCol ? "{$kwSortCol} ASC, " : '';
                    $kwOrderSql .= gamecode_pg_pick_column($kwColumns, ['id']) ?: '1';
                    $kwRows = gamecode_pg_query_all(
                        "SELECT * FROM {$kwTable} ORDER BY {$kwOrderSql}"
                    );
                    if (is_array($kwRows)) {
                        foreach ($kwRows as $kwRow) {
                            $linkId = (string)($kwRow[$linkCol] ?? '');
                            if ($linkId === '') {
                                continue;
                            }
                            $keywordMap[$linkId][] = $kwRow;
                        }
                    }
                }
            }

            $items = [];
            if (is_array($faqRows)) {
                foreach ($faqRows as $faqRow) {
                    if (!is_array($faqRow)) {
                        continue;
                    }

                    $faqId = $faqIdCol ? (string)($faqRow[$faqIdCol] ?? '') : '';
                    $items[] = gamecode_chat_faq_row_to_item($faqRow, $faqId !== '' ? ($keywordMap[$faqId] ?? []) : []);
                }
            }

            if (!empty($items)) {
                return $items;
            }
        }
    }

    $backup = gamecode_json_read(CHAT_FAQ_FILE);
    if (!is_array($backup)) {
        return [];
    }

    $items = [];
    foreach ($backup as $item) {
        if (!is_array($item)) {
            continue;
        }
        $items[] = [
            'question' => trim((string)($item['question'] ?? '')),
            'keywords' => array_values(array_filter(array_map('strval', (array)($item['keywords'] ?? [])), static fn($v) => trim($v) !== '')),
            'answer' => trim((string)($item['answer'] ?? '')),
        ];
    }
    return $items;
}

function gamecode_chat_faq_save_items(array $items): bool {
    $faqTable = 'chat_faq';
    $kwTable = 'chat_faq_keywords';
    $conn = gamecode_pg_connection();
    if (!$conn || !gamecode_pg_table_exists($faqTable)) {
        return false;
    }

    $faqColumns = gamecode_pg_table_columns($faqTable);
    $faqIdCol = gamecode_pg_pick_column($faqColumns, ['id', 'faq_id']);
    $questionCol = gamecode_pg_pick_column($faqColumns, ['question', 'title', 'prompt']);
    $answerCol = gamecode_pg_pick_column($faqColumns, ['answer', 'response', 'reply']);
    $sortCol = gamecode_pg_pick_column($faqColumns, ['sort_order', 'sort', 'position', 'ord']);
    $createdCol = gamecode_pg_pick_column($faqColumns, ['created_at', 'created']);
    $updatedCol = gamecode_pg_pick_column($faqColumns, ['updated_at', 'updated']);

    if (!$questionCol || !$answerCol) {
        return false;
    }

    $kwColumns = gamecode_pg_table_exists($kwTable) ? gamecode_pg_table_columns($kwTable) : [];
    $kwLinkCol = $kwColumns ? gamecode_pg_pick_column($kwColumns, ['faq_id', 'chat_faq_id', 'question_id', 'parent_id']) : null;
    $kwKeywordCol = $kwColumns ? gamecode_pg_pick_column($kwColumns, ['keyword', 'word', 'value', 'term']) : null;
    $kwSortCol = $kwColumns ? gamecode_pg_pick_column($kwColumns, ['sort_order', 'sort', 'position', 'ord']) : null;
    $kwCreatedCol = $kwColumns ? gamecode_pg_pick_column($kwColumns, ['created_at', 'created']) : null;
    $kwUpdatedCol = $kwColumns ? gamecode_pg_pick_column($kwColumns, ['updated_at', 'updated']) : null;

    if (@pg_query($conn, 'BEGIN') === false) {
        return false;
    }

    $ok = true;
    if (gamecode_pg_table_exists($kwTable) && $kwLinkCol && $kwKeywordCol) {
        if (@pg_query($conn, "DELETE FROM {$kwTable}") === false) {
            $ok = false;
        }
    }
    if ($ok) {
        if (@pg_query($conn, "DELETE FROM {$faqTable}") === false) {
            $ok = false;
        }
    }

    if ($ok) {
        foreach (array_values($items) as $faqIndex => $item) {
            if (!is_array($item)) {
                continue;
            }

            $question = trim((string)($item['question'] ?? ''));
            $answer = trim((string)($item['answer'] ?? ''));
            $keywords = $item['keywords'] ?? [];
            if ($question === '' || $answer === '') {
                continue;
            }
            if (!is_array($keywords)) {
                $keywords = [];
            }

            $faqData = [];
            if ($questionCol) $faqData[$questionCol] = $question;
            if ($answerCol) $faqData[$answerCol] = $answer;
            if ($sortCol) $faqData[$sortCol] = (int)$faqIndex;
            if ($createdCol) $faqData[$createdCol] = date('Y-m-d H:i:s');
            if ($updatedCol) $faqData[$updatedCol] = date('Y-m-d H:i:s');

            $faqColsSql = implode(', ', array_map(static fn($c) => '"' . $c . '"', array_keys($faqData)));
            $faqPlaceholders = [];
            $faqParams = [];
            $p = 1;
            foreach ($faqData as $value) {
                $faqPlaceholders[] = '$' . $p++;
                $faqParams[] = $value;
            }

            $returning = $faqIdCol ? ' RETURNING "' . $faqIdCol . '"' : '';
            $faqSql = "INSERT INTO {$faqTable} ({$faqColsSql}) VALUES (" . implode(', ', $faqPlaceholders) . "){$returning}";
            $faqRows = gamecode_pg_query_all($faqSql, $faqParams);
            $faqId = null;
            if (is_array($faqRows) && !empty($faqRows) && $faqIdCol) {
                $faqId = $faqRows[0][strtolower($faqIdCol)] ?? $faqRows[0][$faqIdCol] ?? null;
            }
            if ($faqId === null && $faqIdCol) {
                $lookup = gamecode_pg_query_all(
                    "SELECT {$faqIdCol} AS id FROM {$faqTable} ORDER BY {$faqIdCol} DESC LIMIT 1"
                );
                if (is_array($lookup) && !empty($lookup)) {
                    $faqId = $lookup[0]['id'] ?? null;
                }
            }

            if ($faqId !== null && gamecode_pg_table_exists($kwTable) && $kwLinkCol && $kwKeywordCol) {
                $kwIndex = 0;
                foreach ($keywords as $keyword) {
                    $kw = trim((string)$keyword);
                    if ($kw === '') {
                        continue;
                    }

                    $kwData = [
                        $kwLinkCol => $faqId,
                        $kwKeywordCol => $kw,
                    ];
                    if ($kwSortCol) $kwData[$kwSortCol] = $kwIndex++;
                    if ($kwCreatedCol) $kwData[$kwCreatedCol] = date('Y-m-d H:i:s');
                    if ($kwUpdatedCol) $kwData[$kwUpdatedCol] = date('Y-m-d H:i:s');

                    $kwColsSql = implode(', ', array_map(static fn($c) => '"' . $c . '"', array_keys($kwData)));
                    $kwPlaceholders = [];
                    $kwParams = [];
                    $k = 1;
                    foreach ($kwData as $value) {
                        $kwPlaceholders[] = '$' . $k++;
                        $kwParams[] = $value;
                    }

                    $kwSql = "INSERT INTO {$kwTable} ({$kwColsSql}) VALUES (" . implode(', ', $kwPlaceholders) . ")";
                    if (gamecode_pg_exec($kwSql, $kwParams) === false) {
                        $ok = false;
                        break 2;
                    }
                }
            }
        }
    }

    if ($ok) {
        @pg_query($conn, 'COMMIT');
        return true;
    }

    @pg_query($conn, 'ROLLBACK');
    return false;
}

/* ============================================================
   ПОЛЬЗОВАТЕЛИ

   Каждая функция трогает ровно те строки, о которых её просят.

   Раньше updateUser() читал ВСЮ таблицу, менял одного человека и
   отдавал список writeUsers(), а тот удалял из базы всех, кого в
   списке не оказалось, и перезаписывал остальных. Звалось это на
   каждый старт игры и каждое сохранение очков, отсюда:
     - два запроса одновременно затирали друг другу значения:
       из 10 одновременных стартов игры засчитывались 2;
     - аккаунт, созданный между чтением и записью, удалялся;
     - если чтение на миг возвращало пустой список, запись
       удаляла всех пользователей.
   Теперь это точечные UPDATE/DELETE по id, а счётчики меняет сама
   база. Запасного чтения из data/users.json больше нет: при сбое
   базы честная ошибка лучше, чем работа с пустым или старым списком.
   ============================================================ */

/** Все пользователи — только для списков в админке. */
function readUsers(): array {
    $rows = gamecode_pg_query_all('SELECT * FROM users ORDER BY id ASC');
    return is_array($rows) ? array_map('gamecode_user_from_row', $rows) : [];
}

function findUserByNick(string $nickname): ?array {
    $rows = gamecode_pg_query_all(
        'SELECT * FROM users WHERE LOWER(nickname) = LOWER($1) LIMIT 1',
        [$nickname]
    );
    return (is_array($rows) && !empty($rows)) ? gamecode_user_from_row($rows[0]) : null;
}

function findUserById(int $id): ?array {
    $rows = gamecode_pg_query_all('SELECT * FROM users WHERE id = $1 LIMIT 1', [$id]);
    return (is_array($rows) && !empty($rows)) ? gamecode_user_from_row($rows[0]) : null;
}

/**
 * Создаёт пользователя. Возвращает его строку или пустой массив,
 * если запись не удалась (например, ник заняли в ту же секунду).
 */
function createUser(string $nickname, string $passwordHash, string $secretQuestion = '', string $secretAnswer = ''): array {
    $rows = gamecode_pg_query_all(
        'INSERT INTO users (nickname, password_hash, secret_question, secret_answer_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *',
        [$nickname, $passwordHash, $secretQuestion, password_hash($secretAnswer, PASSWORD_DEFAULT)]
    );
    return (is_array($rows) && !empty($rows)) ? gamecode_user_from_row($rows[0]) : [];
}

/**
 * Меняет перечисленные поля одного пользователя одним UPDATE.
 * Поля вне списка пропускаются: имя колонки никогда не приходит
 * из запроса, но белый список дешевле, чем разбираться потом.
 * 'secret_answer' сохраняется только хешем.
 */
function updateUser(int $id, array $fields): bool {
    static $allowed = [
        'password_hash', 'bio', 'favorite_lang', 'favorite_game', 'avatar_emoji',
        'games_played', 'best_score', 'banned', 'secret_question', 'secret_answer_hash',
    ];

    if (array_key_exists('secret_answer', $fields)) {
        $fields['secret_answer_hash'] = password_hash((string)$fields['secret_answer'], PASSWORD_DEFAULT);
        unset($fields['secret_answer']);
    }

    $set = [];
    $params = [$id];
    foreach ($fields as $key => $value) {
        if (!in_array($key, $allowed, true)) {
            continue;
        }
        if ($key === 'banned') {
            $value = gamecode_db_bool($value) ? 't' : 'f';
        } elseif ($key === 'games_played' || $key === 'best_score') {
            $value = (int)$value;
        } else {
            $value = (string)$value;
        }
        $params[] = $value;
        $set[] = $key . ' = $' . count($params);
    }
    if (empty($set) || $id <= 0) {
        return false;
    }

    $sql = 'UPDATE users SET ' . implode(', ', $set) . ', updated_at = NOW() WHERE id = $1';
    return gamecode_pg_exec($sql, $params) !== false;
}

/**
 * +1 к «сыграно игр». Прибавляет сама база, поэтому десять запросов
 * одновременно дают +10, а не затирают друг друга.
 * Возвращает новое значение или 0, если пользователя нет.
 */
function gamecode_user_bump_games_played(int $id): int {
    $rows = gamecode_pg_query_all(
        'UPDATE users SET games_played = games_played + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING games_played',
        [$id]
    );
    return (is_array($rows) && !empty($rows)) ? (int)$rows[0]['games_played'] : 0;
}

/**
 * users.best_score — сумма всех очков игрока. Считает и записывает
 * база одним запросом: значение не устареет по дороге через PHP.
 */
function gamecode_user_sync_best_score(int $id): int {
    $rows = gamecode_pg_query_all(
        'UPDATE users
         SET best_score = (SELECT COALESCE(SUM(score), 0) FROM scores WHERE user_id = $1),
             updated_at = NOW()
         WHERE id = $1
         RETURNING best_score',
        [$id]
    );
    return (is_array($rows) && !empty($rows)) ? (int)$rows[0]['best_score'] : 0;
}

/** Удаляет одного пользователя. Его очки остаются с user_id = NULL. */
function deleteUser(int $id): bool {
    if ($id <= 0) {
        return false;
    }
    return gamecode_pg_exec('DELETE FROM users WHERE id = $1', [$id]) !== false;
}

function gamecode_secret_answer_matches(array $user, string $answer): bool {
    $answer = trim($answer);
    $hash = (string)($user['secret_answer_hash'] ?? '');
    return $hash !== '' && password_verify($answer, $hash);
}

/**
 * Колонка games.sort_order появилась позже самой таблицы.
 * Проверяем её наличие, чтобы код работал и до применения миграции
 * db/migrations/001-games-sort-order.sql — иначе запрос упал бы,
 * readGames вернул бы пустой список и карусель на главной опустела.
 */
function gamecode_games_has_sort_order(): bool {
    static $has = null;
    if ($has === null) {
        $has = in_array('sort_order', gamecode_pg_table_columns('games'), true);
    }
    return $has;
}

function gamecode_games_read_db(): array {
    $hasSort = gamecode_games_has_sort_order();
    $rows = gamecode_pg_query_all(
        $hasSort
            ? 'SELECT id, title, emoji, description, level, stars, wip, link, created_at, sort_order
               FROM games
               ORDER BY sort_order ASC, created_at ASC, id ASC'
            : 'SELECT id, title, emoji, description, level, stars, wip, link, created_at
               FROM games
               ORDER BY created_at ASC, id ASC'
    );

    if (is_array($rows) && !empty($rows)) {
        $games = [];
        foreach ($rows as $row) {
            $games[] = gamecode_game_from_row($row);
        }
        return $games;
    }

    $backup = gamecode_json_read(GAMES_FILE);
    if (!is_array($backup)) {
        return [];
    }

    $games = [];
    foreach ($backup as $item) {
        if (!is_array($item)) {
            continue;
        }
        $games[] = gamecode_game_from_row($item);
    }
    return $games;
}

function readGames(): array {
    return gamecode_games_read_db();
}

function writeGames(array $games): void {
    $games = array_values($games);
    $conn = gamecode_pg_connection();
    if (!$conn) {
        return;
    }

    if (@pg_query($conn, 'BEGIN') === false) {
        return;
    }

    $existingRows = gamecode_pg_query_all('SELECT id FROM games ORDER BY id ASC');
    $existingIds = [];
    if (is_array($existingRows)) {
        foreach ($existingRows as $row) {
            $existingIds[] = (string)($row['id'] ?? '');
        }
    }

    $keepIds = [];
    foreach ($games as $game) {
        if (is_array($game)) {
            $keepIds[] = (string)($game['id'] ?? '');
        }
    }

    $removedIds = array_values(array_diff($existingIds, $keepIds));
    if (!empty($removedIds)) {
        $literal = '{' . implode(',', array_map(static fn($v) => '"' . str_replace('"', '\"', $v) . '"', $removedIds)) . '}';
        if (@pg_query_params($conn, 'DELETE FROM games WHERE id = ANY($1::varchar[])', [$literal]) === false) {
            @pg_query($conn, 'ROLLBACK');
            return;
        }
    }

    $ok = true;
    foreach ($games as $index => $game) {
        if (!is_array($game)) {
            continue;
        }

        // порядок игр = порядок в массиве: админка меняет местами элементы
        $row = gamecode_game_to_row($game, (int)$index);
        $sql = gamecode_games_has_sort_order()
            ? '
            INSERT INTO games (
                id, title, emoji, description, level, stars, wip, link, created_at, sort_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                emoji = EXCLUDED.emoji,
                description = EXCLUDED.description,
                level = EXCLUDED.level,
                stars = EXCLUDED.stars,
                wip = EXCLUDED.wip,
                link = EXCLUDED.link,
                created_at = EXCLUDED.created_at,
                sort_order = EXCLUDED.sort_order
        '
            : '
            INSERT INTO games (
                id, title, emoji, description, level, stars, wip, link, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                emoji = EXCLUDED.emoji,
                description = EXCLUDED.description,
                level = EXCLUDED.level,
                stars = EXCLUDED.stars,
                wip = EXCLUDED.wip,
                link = EXCLUDED.link,
                created_at = EXCLUDED.created_at
        ';

        $params = [
            $row['id'],
            $row['title'],
            $row['emoji'],
            $row['description'],
            $row['level'],
            $row['stars'],
            $row['wip'] ? 't' : 'f',
            $row['link'],
            $row['created_at'],
        ];
        if (gamecode_games_has_sort_order()) {
            $params[] = $row['sort_order'];
        }

        if (gamecode_pg_exec($sql, $params) === false) {
            $ok = false;
            break;
        }
    }

    if ($ok) {
        @pg_query($conn, 'COMMIT');
        return;
    }

    @pg_query($conn, 'ROLLBACK');
}

function readNews(): array {
    $rows = gamecode_pg_query_all(
        'SELECT id, title, description, image, layout, sort_order, created_at, updated_at
         FROM news
         ORDER BY sort_order ASC, created_at ASC, id ASC'
    );

    if (is_array($rows) && !empty($rows)) {
        $news = [];
        foreach ($rows as $row) {
            $news[] = gamecode_news_from_row($row);
        }
        return $news;
    }

    $backup = gamecode_json_read(NEWS_FILE);
    if (!is_array($backup)) {
        return [];
    }

    $news = [];
    foreach ($backup as $item) {
        if (!is_array($item)) {
            continue;
        }
        $news[] = gamecode_news_from_row($item);
    }
    return $news;
}

function writeNews(array $news): void {
    $news = array_values($news);
    $conn = gamecode_pg_connection();
    if (!$conn) {
        return;
    }

    if (@pg_query($conn, 'BEGIN') === false) {
        return;
    }

    $existingRows = gamecode_pg_query_all('SELECT id FROM news ORDER BY id ASC');
    $existingIds = [];
    if (is_array($existingRows)) {
        foreach ($existingRows as $row) {
            $existingIds[] = (string)($row['id'] ?? '');
        }
    }

    $keepIds = [];
    foreach ($news as $item) {
        if (is_array($item)) {
            $keepIds[] = (string)($item['id'] ?? '');
        }
    }

    $removedIds = array_values(array_diff($existingIds, $keepIds));
    if (!empty($removedIds)) {
        $literal = '{' . implode(',', array_map(static fn($v) => '"' . str_replace('"', '\"', $v) . '"', $removedIds)) . '}';
        if (@pg_query_params($conn, 'DELETE FROM news WHERE id = ANY($1::varchar[])', [$literal]) === false) {
            @pg_query($conn, 'ROLLBACK');
            return;
        }
    }

    $ok = true;
    foreach ($news as $index => $item) {
        if (!is_array($item)) {
            continue;
        }

        $row = gamecode_news_to_row($item, (int)$index);
        $sql = '
            INSERT INTO news (
                id, title, description, image, layout, sort_order, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                image = EXCLUDED.image,
                layout = EXCLUDED.layout,
                sort_order = EXCLUDED.sort_order,
                created_at = EXCLUDED.created_at,
                updated_at = NOW()
        ';

        $params = [
            $row['id'],
            $row['title'],
            $row['description'],
            $row['image'],
            $row['layout'],
            $row['sort_order'],
            $row['created_at'],
            $row['updated_at'],
        ];

        if (gamecode_pg_exec($sql, $params) === false) {
            $ok = false;
            break;
        }
    }

    if ($ok) {
        @pg_query($conn, 'COMMIT');
        return;
    }

    @pg_query($conn, 'ROLLBACK');
}

function readAdminLog(): array {
    $rows = gamecode_pg_query_all(
        'SELECT id, acted_at, action, detail, created_at
         FROM admin_log
         ORDER BY acted_at ASC, id ASC'
    );

    if (is_array($rows) && !empty($rows)) {
        $log = [];
        foreach ($rows as $row) {
            $log[] = gamecode_log_from_row($row);
        }
        return $log;
    }

    $backup = gamecode_json_read(LOG_FILE);
    if (!is_array($backup)) {
        return [];
    }

    $log = [];
    foreach ($backup as $item) {
        if (!is_array($item)) {
            continue;
        }
        $log[] = gamecode_log_from_row($item);
    }
    return $log;
}

function writeAdminLog(array $log): void {
    $log = array_values($log);
    $conn = gamecode_pg_connection();
    if (!$conn) {
        return;
    }

    if (@pg_query($conn, 'BEGIN') === false) {
        return;
    }

    if (@pg_query($conn, 'DELETE FROM admin_log') === false) {
        @pg_query($conn, 'ROLLBACK');
        return;
    }

    $ok = true;
    foreach ($log as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $actedAt = (string)($entry['acted_at'] ?? $entry['time'] ?? date('Y-m-d H:i:s'));
        $sql = '
            INSERT INTO admin_log (acted_at, action, detail, created_at)
            VALUES ($1, $2, $3, NOW())
        ';
        $params = [
            $actedAt,
            (string)($entry['action'] ?? ''),
            (string)($entry['detail'] ?? ''),
        ];

        if (gamecode_pg_exec($sql, $params) === false) {
            $ok = false;
            break;
        }
    }

    if ($ok) {
        @pg_query($conn, 'COMMIT');
        return;
    }

    @pg_query($conn, 'ROLLBACK');
}

function writeLog(string $action, string $detail = ''): void {
    $log = readAdminLog();
    $log[] = [
        'acted_at' => date('Y-m-d H:i:s'),
        'action' => $action,
        'detail' => $detail,
    ];

    if (count($log) > 100) {
        $log = array_slice($log, -100);
    }

    writeAdminLog($log);
}

/**
 * Записывает один результат. Возвращает сохранённую строку или
 * пустой массив, если запись не удалась.
 *
 * Раньше при неудачной вставке функция читала ВСЕ очки и звала
 * writeScores(), которая делала DELETE FROM scores и вставляла всё
 * заново: сбой чтения в этот момент стирал таблицу очков целиком.
 * Теперь неудача — это просто неудача, и вызывающий код её видит.
 */
function addScore(int $userId, string $gameId, int $score, array $meta = []): array {
    $metaJson = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($metaJson === false) {
        $metaJson = '{}';
    }

    $rows = gamecode_pg_query_all(
        'INSERT INTO scores (user_id, game_id, score, meta, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
         RETURNING id, user_id, game_id, score, meta, created_at, updated_at',
        [$userId, $gameId, $score, $metaJson]
    );
    return (is_array($rows) && !empty($rows)) ? gamecode_score_from_row($rows[0]) : [];
}

// PIXELGAME — контент игры (уровни, вопросы монстров)
// Postgres — источник истины, JSON-файлы в games/pixelgame/data/ — read-only
// аварийный фолбэк (тот же паттерн, что games/news/chat_faq).

function gamecode_pixelgame_level_file(int $levelNumber): string {
    return __DIR__ . "/../games/pixelgame/data/levels/level{$levelNumber}.json";
}

function gamecode_pixelgame_questions_file(): string {
    return __DIR__ . '/../games/pixelgame/data/monster-questions.json';
}

/**
 * Читает данные одного уровня (jsonb-блок как в level*.json).
 * Postgres → фолбэк на статический JSON-файл.
 */
function readPixelgameLevel(int $levelNumber): ?array {
    $rows = gamecode_pg_query_all(
        'SELECT level_number, title, data FROM pixelgame_levels WHERE level_number = $1',
        [$levelNumber]
    );
    if (is_array($rows) && !empty($rows)) {
        $data = json_decode((string)$rows[0]['data'], true);
        if (is_array($data)) {
            return $data;
        }
    }
    // Фолбэк на статический JSON, если Postgres недоступен или строки нет
    return gamecode_json_read(gamecode_pixelgame_level_file($levelNumber));
}

/**
 * Список всех уровней (для редактора в админке).
 * @return array<int, array>  ключ — level_number
 */
function readPixelgameLevels(): array {
    $levels = [];
    $rows = gamecode_pg_query_all(
        'SELECT level_number, title, data FROM pixelgame_levels ORDER BY level_number ASC'
    );
    if (is_array($rows) && !empty($rows)) {
        foreach ($rows as $row) {
            $data = json_decode((string)$row['data'], true);
            if (is_array($data)) {
                $levels[(int)$row['level_number']] = $data;
            }
        }
        if (!empty($levels)) {
            return $levels;
        }
    }

    // Фолбэк: статические JSON-файлы level1..4
    for ($n = 1; $n <= 4; $n++) {
        $data = gamecode_json_read(gamecode_pixelgame_level_file($n));
        if (is_array($data)) {
            $levels[$n] = $data;
        }
    }
    return $levels;
}

/**
 * Сохраняет (upsert) уровень. Вызывается из админки.
 */
function writePixelgameLevel(int $levelNumber, array $data): bool {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }
    $title = (string)($data['title'] ?? ($data['name'] ?? "Level {$levelNumber}"));
    $now = date('Y-m-d H:i:s');
    $result = gamecode_pg_exec(
        'INSERT INTO pixelgame_levels (level_number, title, data, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (level_number) DO UPDATE SET
             title = EXCLUDED.title,
             data = EXCLUDED.data,
             updated_at = EXCLUDED.updated_at',
        [$levelNumber, $title, $json, $now, $now]
    );
    return $result !== false;
}

/**
 * Удаляет уровень из БД (админка).
 */
function deletePixelgameLevel(int $levelNumber): bool {
    return gamecode_pg_exec(
        'DELETE FROM pixelgame_levels WHERE level_number = $1',
        [$levelNumber]
    ) !== false;
}

/**
 * Читает блок вопросов для боёв ({topic, questions:[...]}).
 * Postgres → фолбэк на статический JSON-файл.
 */
function readPixelgameMonsterQuestions(): ?array {
    $rows = gamecode_pg_query_all(
        'SELECT data FROM pixelgame_monster_questions ORDER BY id ASC LIMIT 1'
    );
    if (is_array($rows) && !empty($rows)) {
        $data = json_decode((string)$rows[0]['data'], true);
        if (is_array($data)) {
            return $data;
        }
    }
    return gamecode_json_read(gamecode_pixelgame_questions_file());
}

/**
 * Сохраняет (upsert) блок вопросов монстров.
 */
function writePixelgameMonsterQuestions(array $data): bool {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }
    $topic = (string)($data['topic'] ?? 'go');
    $now = date('Y-m-d H:i:s');

    $rows = gamecode_pg_query_all('SELECT id FROM pixelgame_monster_questions ORDER BY id ASC LIMIT 1');
    if (is_array($rows) && !empty($rows)) {
        $result = gamecode_pg_exec(
            'UPDATE pixelgame_monster_questions
             SET topic = $1, data = $2::jsonb, updated_at = $3
             WHERE id = $4',
            [$topic, $json, $now, (int)$rows[0]['id']]
        );
        return $result !== false;
    }

    $result = gamecode_pg_exec(
        'INSERT INTO pixelgame_monster_questions (topic, data, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3, $4)',
        [$topic, $json, $now, $now]
    );
    return $result !== false;
}

function adminAvatarFileKey(array $u): string {
    $av = $u['avatar_emoji'] ?? 'avatar1';
    return is_string($av) && preg_match('/^avatar\d+$/', $av) ? $av : 'avatar1';
}

function readUsersAdmin(): array {
    return readUsers();
}
