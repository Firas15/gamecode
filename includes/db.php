<?php
require_once __DIR__ . '/redis.php'; 

if (file_exists(dirname(__DIR__) . '/config.php')) {
    require_once dirname(__DIR__) . '/config.php';
}

define('USERS_FILE', dirname(__DIR__) . '/data/users.json');
define('GAMES_FILE', dirname(__DIR__) . '/data/games.json');
define('NEWS_FILE', dirname(__DIR__) . '/data/news.json');
define('SCORES_FILE', dirname(__DIR__) . '/data/scores.json');
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

function gamecode_user_to_row(array $user): array {
    $secretAnswerHash = (string)($user['secret_answer_hash'] ?? '');
    if ($secretAnswerHash === '' && !empty($user['secret_answer'])) {
        $secretAnswerHash = password_hash((string)$user['secret_answer'], PASSWORD_DEFAULT);
    }

    $nickname = (string)($user['nickname'] ?? '');

    return [
        'id' => (int)($user['id'] ?? 0),
        'nickname' => $nickname,
        'password_hash' => (string)($user['password_hash'] ?? ''),
        'bio' => (string)($user['bio'] ?? ''),
        'favorite_lang' => (string)($user['favorite_lang'] ?? ''),
        'favorite_game' => (string)($user['favorite_game'] ?? ''),
        'games_played' => (int)($user['games_played'] ?? 0),
        'best_score' => (int)($user['best_score'] ?? 0),
        'avatar_emoji' => (string)($user['avatar_emoji'] ?? 'avatar1'),
        'secret_question' => (string)($user['secret_question'] ?? ''),
        'secret_answer_hash' => $secretAnswerHash,
        'banned' => gamecode_db_bool($user['banned'] ?? false),
        'created_at' => (string)($user['created_at'] ?? date('Y-m-d H:i:s')),
        'updated_at' => (string)($user['updated_at'] ?? date('Y-m-d H:i:s')),
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

function readUsers(): array {
    $rows = gamecode_pg_query_all(
        'SELECT id, nickname, password_hash, bio, favorite_lang, favorite_game, games_played, best_score, avatar_emoji, secret_question, secret_answer_hash, banned, created_at, updated_at
         FROM users
         ORDER BY id ASC'
    );

    if ($rows !== false) {
        if (!empty($rows)) {
            $users = [];
            foreach ($rows as $row) {
                $users[] = gamecode_user_from_row($row);
            }
            return $users;
        }
    }

    $backup = gamecode_json_read(USERS_FILE);
    if (!is_array($backup)) {
        return [];
    }

    $users = [];
    foreach ($backup as $row) {
        if (!is_array($row)) {
            continue;
        }
        $users[] = gamecode_user_from_row($row);
    }
    return $users;
}

function writeUsers(array $users): void {
    $users = array_values($users);
    $backupRows = [];
    foreach ($users as $user) {
        if (is_array($user)) {
            $backupRows[] = gamecode_user_to_row($user);
        }
    }
    $conn = gamecode_pg_connection();
    if (!$conn) {
        return;
    }

    if (@pg_query($conn, 'BEGIN') === false) {
        return;
    }

    $existingRows = gamecode_pg_query_all('SELECT id FROM users ORDER BY id ASC');
    $existingIds = [];
    if (is_array($existingRows)) {
        foreach ($existingRows as $row) {
            $existingIds[] = (int)($row['id'] ?? 0);
        }
    }

    $keepIds = [];
    foreach ($users as $user) {
        if (is_array($user)) {
            $keepIds[] = (int)($user['id'] ?? 0);
        }
    }

    $removedIds = array_values(array_diff($existingIds, $keepIds));
    if (!empty($removedIds)) {
        $literal = '{' . implode(',', array_map('intval', $removedIds)) . '}';
        if (@pg_query_params($conn, 'DELETE FROM users WHERE id = ANY($1::int[])', [$literal]) === false) {
            @pg_query($conn, 'ROLLBACK');
            return;
        }
    }

    $ok = true;
    foreach ($users as $user) {
        if (!is_array($user)) {
            continue;
        }

        $row = gamecode_user_to_row($user);
        $sql = '
            INSERT INTO users (
                id, nickname, password_hash, bio, favorite_lang, favorite_game, games_played,
                best_score, avatar_emoji, secret_question, secret_answer_hash, banned, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            ON CONFLICT (id) DO UPDATE SET
                nickname = EXCLUDED.nickname,
                password_hash = EXCLUDED.password_hash,
                bio = EXCLUDED.bio,
                favorite_lang = EXCLUDED.favorite_lang,
                favorite_game = EXCLUDED.favorite_game,
                games_played = EXCLUDED.games_played,
                best_score = EXCLUDED.best_score,
                avatar_emoji = EXCLUDED.avatar_emoji,
                secret_question = EXCLUDED.secret_question,
                secret_answer_hash = EXCLUDED.secret_answer_hash,
                banned = EXCLUDED.banned,
                created_at = EXCLUDED.created_at,
                updated_at = NOW()
        ';

        $params = [
            $row['id'],
            $row['nickname'],
            $row['password_hash'],
            $row['bio'],
            $row['favorite_lang'],
            $row['favorite_game'],
            $row['games_played'],
            $row['best_score'],
            $row['avatar_emoji'],
            $row['secret_question'],
            $row['secret_answer_hash'],
            $row['banned'] ? 't' : 'f',
            $row['created_at'],
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

function findUserByNick(string $nickname): ?array {
    $rows = gamecode_pg_query_all(
        'SELECT id, nickname, password_hash, bio, favorite_lang, favorite_game, games_played, best_score, avatar_emoji, secret_question, secret_answer_hash, banned, created_at, updated_at
         FROM users
         WHERE LOWER(nickname) = LOWER($1)
         LIMIT 1',
        [$nickname]
    );

    if (is_array($rows) && !empty($rows)) {
        return gamecode_user_from_row($rows[0]);
    }

    foreach (readUsers() as $user) {
        if (strtolower((string)($user['nickname'] ?? '')) === strtolower($nickname)) {
            return $user;
        }
    }
    return null;
}

function findUserById(int $id): ?array {
    $rows = gamecode_pg_query_all(
        'SELECT id, nickname, password_hash, bio, favorite_lang, favorite_game, games_played, best_score, avatar_emoji, secret_question, secret_answer_hash, banned, created_at, updated_at
         FROM users
         WHERE id = $1
         LIMIT 1',
        [$id]
    );

    if (is_array($rows) && !empty($rows)) {
        return gamecode_user_from_row($rows[0]);
    }

    foreach (readUsers() as $user) {
        if ((int)($user['id'] ?? 0) === $id) {
            return $user;
        }
    }
    return null;
}

function createUser(string $nickname, string $passwordHash, string $secretQuestion = '', string $secretAnswer = ''): array {
    $secretAnswerHash = password_hash($secretAnswer, PASSWORD_DEFAULT);
    $user = [
        'nickname' => $nickname,
        'password_hash' => $passwordHash,
        'bio' => '',
        'favorite_lang' => '',
        'favorite_game' => '',
        'games_played' => 0,
        'best_score' => 0,
        'avatar_emoji' => 'avatar1',
        'secret_question' => $secretQuestion,
        'secret_answer_hash' => $secretAnswerHash,
        'banned' => false,
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s'),
    ];

    $conn = gamecode_pg_connection();
    if ($conn) {
        $sql = '
            INSERT INTO users (
                nickname, password_hash, bio, favorite_lang, favorite_game, games_played,
                best_score, avatar_emoji, secret_question, secret_answer_hash, banned, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            RETURNING id, nickname, password_hash, bio, favorite_lang, favorite_game, games_played,
                      best_score, avatar_emoji, secret_question, secret_answer_hash, banned, created_at, updated_at
        ';

        $params = [
            $user['nickname'],
            $user['password_hash'],
            $user['bio'],
            $user['favorite_lang'],
            $user['favorite_game'],
            $user['games_played'],
            $user['best_score'],
            $user['avatar_emoji'],
            $user['secret_question'],
            $user['secret_answer_hash'],
            'f',
        ];

        $rows = gamecode_pg_query_all($sql, $params);
        if (is_array($rows) && !empty($rows)) {
            $created = gamecode_user_from_row($rows[0]);
            return $created;
        }
    }

    $users = readUsers();
    $maxId = 0;
    foreach ($users as $existing) {
        $maxId = max($maxId, (int)($existing['id'] ?? 0));
    }
    $user['id'] = $maxId + 1;
    $users[] = $user;
    writeUsers($users);
    return $user;
}

function updateUser(int $id, array $fields): void {
    $users = readUsers();
    foreach ($users as &$user) {
        if ((int)($user['id'] ?? 0) !== $id) {
            continue;
        }

        foreach ($fields as $key => $value) {
            if ($key === 'secret_answer') {
                $user['secret_answer_hash'] = password_hash((string)$value, PASSWORD_DEFAULT);
                $user['secret_answer'] = (string)$value;
                continue;
            }
            $user[$key] = $value;
        }
        $user['updated_at'] = date('Y-m-d H:i:s');
        break;
    }
    unset($user);

    writeUsers($users);
}

function gamecode_secret_answer_matches(array $user, string $answer): bool {
    $answer = trim($answer);
    $hash = (string)($user['secret_answer_hash'] ?? '');
    if ($hash !== '') {
        return password_verify($answer, $hash);
    }

    $legacy = strtolower(trim((string)($user['secret_answer'] ?? '')));
    return $legacy !== '' && $legacy === strtolower($answer);
}

function gamecode_games_read_db(): array {
    $rows = gamecode_pg_query_all(
        'SELECT id, title, emoji, description, level, stars, wip, link, created_at
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

        $row = gamecode_game_to_row($game, (int)$index);
        $sql = '
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

function readScores(): array {
    $rows = gamecode_pg_query_all(
        'SELECT id, user_id, game_id, score, meta, created_at, updated_at
         FROM scores
         ORDER BY id ASC'
    );

    if (is_array($rows) && !empty($rows)) {
        $scores = [];
        foreach ($rows as $row) {
            $scores[] = gamecode_score_from_row($row);
        }
        return $scores;
    }

    $backup = gamecode_json_read(SCORES_FILE);
    if (!is_array($backup)) {
        return [];
    }

    $scores = [];
    foreach ($backup as $item) {
        if (!is_array($item)) {
            continue;
        }
        $scores[] = gamecode_score_from_row($item);
    }
    return $scores;
}

function writeScores(array $scores): bool {
    $scores = array_values($scores);
    $conn = gamecode_pg_connection();
    if (!$conn) {
        return true;
    }

    if (@pg_query($conn, 'BEGIN') === false) {
        return false;
    }

    if (@pg_query($conn, 'DELETE FROM scores') === false) {
        @pg_query($conn, 'ROLLBACK');
        return false;
    }

    $ok = true;
    foreach ($scores as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $meta = $entry['meta'] ?? [];
        if (!is_string($meta)) {
            $meta = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        if ($meta === false || $meta === null) {
            $meta = '{}';
        }

        $sql = '
            INSERT INTO scores (user_id, game_id, score, meta, created_at, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        ';
        $params = [
            isset($entry['user_id']) ? (int)$entry['user_id'] : null,
            (string)($entry['game_id'] ?? ''),
            (int)($entry['score'] ?? 0),
            is_string($meta) ? $meta : '{}',
            (string)($entry['created_at'] ?? date('Y-m-d H:i:s')),
            (string)($entry['updated_at'] ?? date('Y-m-d H:i:s')),
        ];

        if (gamecode_pg_exec($sql, $params) === false) {
            $ok = false;
            break;
        }
    }

    if ($ok) {
        @pg_query($conn, 'COMMIT');
        return true;
    }

    @pg_query($conn, 'ROLLBACK');
    return false;
}

function addScore(int $userId, string $gameId, int $score, array $meta = []): array {
    $now = date('Y-m-d H:i:s');
    $conn = gamecode_pg_connection();
    if ($conn) {
        $sql = '
            INSERT INTO scores (user_id, game_id, score, meta, created_at, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
            RETURNING id, user_id, game_id, score, meta, created_at, updated_at
        ';
        $metaJson = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($metaJson === false) {
            $metaJson = '{}';
        }
        $rows = gamecode_pg_query_all($sql, [$userId, $gameId, $score, $metaJson, $now, $now]);
        if (is_array($rows) && !empty($rows)) {
            $entry = gamecode_score_from_row($rows[0]);
            return $entry;
        }
    }

    $entry = [
        'user_id' => $userId,
        'game_id' => $gameId,
        'score' => $score,
        'meta' => $meta,
        'created_at' => $now,
        'updated_at' => $now,
    ];
    $scores = readScores();
    $scores[] = $entry;
    writeScores($scores);
    return $entry;
}

function adminAvatarFileKey(array $u): string {
    $av = $u['avatar_emoji'] ?? 'avatar1';
    return is_string($av) && preg_match('/^avatar\d+$/', $av) ? $av : 'avatar1';
}

function readUsersAdmin(): array {
    return readUsers();
}

function writeUsersAdmin(array $users): void {
    writeUsers($users);
}
