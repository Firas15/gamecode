<?php
/**
 * ============================================================
 *  МАГАЗИН ЗА ОЧКИ
 * ============================================================
 *
 *  Две шкалы, специально разведённые:
 *
 *    ОЧКИ   — сумма всего заработанного за всё время. Только
 *             растут, по ним строится таблица лидеров. Покупки
 *             их не трогают, поэтому топовый игрок может
 *             тратить, не боясь потерять место.
 *
 *    ПИКСЕЛЬ КОИНЫ — валюта магазина. Капают как процент от очков
 *             (GC_COIN_RATE), тратятся на предметы.
 *
 *  Каталог лежит в таблице shop_items и правится из админки
 *  (admin/shop.php). Массив ниже — тот же каталог в коде: он
 *  остаётся запасным вариантом на случай, когда миграция
 *  003-shop-items.sql ещё не прогнана. Так магазин работает
 *  и на свежей базе, и на старой, без единого «белого экрана».
 *  Кто чем владеет и что надел — по-прежнему в отдельных
 *  таблицах, каталог этого не касается.
 *
 *  Все предметы косметические. Ни один не влияет на очки,
 *  сложность или геймплей — иначе магазин превратился бы
 *  в «плати очками за преимущество».
 * ============================================================
 */

require_once __DIR__ . '/db.php';

/** Сколько процентов от заработанных очков превращается в пиксель коины. */
const GC_COIN_RATE = 10;

/** Приветственный бонус новому игроку — ровно на самый дешёвый предмет и сдачу. */
const GC_WELCOME_COINS = 50;

/** Название валюты — одно на весь сайт, чтобы не разъезжалось по файлам. */
const GC_COIN_NAME = 'ПИКСЕЛЬ КОИН';

/**
 * Список видов товара в том порядке, в каком они идут на витрине.
 * Он же задаёт порядок разделов в админке.
 */
const GC_SHOP_KINDS = ['frame', 'title', 'avatar', 'skin'];

/**
 * У каждого вида своё «полезное» поле, и в базе они все лежат
 * в одной колонке payload. Эта карта — единственное место, где
 * записано соответствие; и чтение из базы, и запись из админки
 * ходят через неё.
 */
const GC_SHOP_PAYLOAD_KEY = [
    'frame'  => 'css',   // CSS-класс рамки
    'title'  => 'text',  // текст титула
    'avatar' => 'file',  // имя файла в img/avatars без .png
    'skin'   => 'dir',   // папка спрайтов в games/pixelgame/assets/player
];

/**
 * Каталог по умолчанию — тот, что был в коде до переезда в базу.
 *
 * kind определяет, куда предмет надевается:
 *   frame  — рамка вокруг аватара (чистый CSS, класс gc-frame--*)
 *   title  — подпись под ником
 *   avatar — картинка img/avatars/<file>.png, кладётся в users.avatar_emoji
 *   skin   — персонаж в CodeQuest, папка games/pixelgame/assets/player/<dir>/
 *
 * free = true — предмет доступен всем и не требует покупки.
 * Пять исходных аватаров и базовый скин остались бесплатными:
 * отнимать у людей то, что у них уже было, нельзя.
 */
function gc_shop_default_catalog(): array {
    static $catalog = null;
    if ($catalog !== null) return $catalog;

    $catalog = [
        // ── РАМКИ ────────────────────────────────────────────
        ['id' => 'frame_none',    'kind' => 'frame', 'name' => 'Без рамки',        'price' => 0,   'free' => true, 'css' => ''],
        ['id' => 'frame_cyan',    'kind' => 'frame', 'name' => 'Неоновый контур',  'price' => 50,  'css' => 'gc-frame--cyan'],
        ['id' => 'frame_green',   'kind' => 'frame', 'name' => 'Матрица',          'price' => 90,  'css' => 'gc-frame--green'],
        ['id' => 'frame_pink',    'kind' => 'frame', 'name' => 'Розовый шум',      'price' => 140, 'css' => 'gc-frame--pink'],
        ['id' => 'frame_gold',    'kind' => 'frame', 'name' => 'Золото',           'price' => 200, 'css' => 'gc-frame--gold'],
        ['id' => 'frame_dashed',  'kind' => 'frame', 'name' => 'Бегущая строка',   'price' => 300, 'css' => 'gc-frame--dashed'],
        ['id' => 'frame_glitch',  'kind' => 'frame', 'name' => 'Глитч',            'price' => 450, 'css' => 'gc-frame--glitch'],
        ['id' => 'frame_rgb',     'kind' => 'frame', 'name' => 'RGB',              'price' => 700, 'css' => 'gc-frame--rgb'],

        // ── ТИТУЛЫ ───────────────────────────────────────────
        ['id' => 'title_none',    'kind' => 'title', 'name' => 'Без титула',       'price' => 0,   'free' => true, 'text' => ''],
        ['id' => 'title_novice',  'kind' => 'title', 'name' => 'Новичок',          'price' => 40,  'text' => 'НОВИЧОК'],
        ['id' => 'title_debug',   'kind' => 'title', 'name' => 'Отладчик',         'price' => 70,  'text' => 'ОТЛАДЧИК'],
        ['id' => 'title_net',     'kind' => 'title', 'name' => 'Сетевой инженер',  'price' => 100, 'text' => 'СЕТЕВОЙ ИНЖЕНЕР'],
        ['id' => 'title_sorter',  'kind' => 'title', 'name' => 'Мастер сортировки','price' => 100, 'text' => 'МАСТЕР СОРТИРОВКИ'],
        ['id' => 'title_quiz',    'kind' => 'title', 'name' => 'Эрудит',           'price' => 100, 'text' => 'ЭРУДИТ'],
        ['id' => 'title_hacker',  'kind' => 'title', 'name' => 'Хакер',            'price' => 180, 'text' => 'ХАКЕР'],
        ['id' => 'title_arch',    'kind' => 'title', 'name' => 'Архитектор',       'price' => 280, 'text' => 'АРХИТЕКТОР'],
        ['id' => 'title_legend',  'kind' => 'title', 'name' => 'Легенда GameCode', 'price' => 450, 'text' => 'ЛЕГЕНДА GAMECODE'],

        // ── АВАТАРЫ ──────────────────────────────────────────
        // Пять исходных — бесплатные, как и были.
        ['id' => 'avatar1', 'kind' => 'avatar', 'name' => 'Аватар 1', 'price' => 0, 'free' => true, 'file' => 'avatar1'],
        ['id' => 'avatar2', 'kind' => 'avatar', 'name' => 'Аватар 2', 'price' => 0, 'free' => true, 'file' => 'avatar2'],
        ['id' => 'avatar3', 'kind' => 'avatar', 'name' => 'Аватар 3', 'price' => 0, 'free' => true, 'file' => 'avatar3'],
        ['id' => 'avatar4', 'kind' => 'avatar', 'name' => 'Аватар 4', 'price' => 0, 'free' => true, 'file' => 'avatar4'],
        ['id' => 'avatar5', 'kind' => 'avatar', 'name' => 'Аватар 5', 'price' => 0, 'free' => true, 'file' => 'avatar5'],
        // Платные — цветовые версии тех же картинок.
        ['id' => 'avatar1-toxic', 'kind' => 'avatar', 'name' => 'Токсичный',  'price' => 90,  'file' => 'avatar1-toxic'],
        ['id' => 'avatar2-ice',   'kind' => 'avatar', 'name' => 'Лёд',        'price' => 120, 'file' => 'avatar2-ice'],
        ['id' => 'avatar3-blood', 'kind' => 'avatar', 'name' => 'Багровый',   'price' => 160, 'file' => 'avatar3-blood'],
        ['id' => 'avatar4-gold',  'kind' => 'avatar', 'name' => 'Золотой',    'price' => 200, 'file' => 'avatar4-gold'],
        ['id' => 'avatar5-plasma','kind' => 'avatar', 'name' => 'Плазма',     'price' => 260, 'file' => 'avatar5-plasma'],
        ['id' => 'avatar1-void',  'kind' => 'avatar', 'name' => 'Пустота',    'price' => 350, 'file' => 'avatar1-void'],

        // ── СКИНЫ CODEQUEST ──────────────────────────────────
        ['id' => 'skin_default', 'kind' => 'skin', 'name' => 'Базовый',           'price' => 0,   'free' => true, 'dir' => ''],
        ['id' => 'skin_green',   'kind' => 'skin', 'name' => 'Зелёный протокол',  'price' => 150, 'dir' => 'green'],
        ['id' => 'skin_crimson', 'kind' => 'skin', 'name' => 'Красный код',       'price' => 250, 'dir' => 'crimson'],
        ['id' => 'skin_gold',    'kind' => 'skin', 'name' => 'Золотой байт',      'price' => 400, 'dir' => 'gold'],
        ['id' => 'skin_void',    'kind' => 'skin', 'name' => 'Тьма',              'price' => 600, 'dir' => 'void'],
    ];

    return $catalog;
}

/**
 * Есть ли таблица каталога. Пока миграция 003 не прогнана,
 * магазин работает на списке из кода — так же, как работал
 * до появления админки.
 */
function gc_shop_items_table_ready(): bool {
    static $ready = null;
    if ($ready === null) {
        $ready = gamecode_pg_table_exists('shop_items');
    }
    return $ready;
}

/** PostgreSQL отдаёт boolean строкой 't'/'f'. */
function gc_shop_bool($value): bool {
    return $value === true || $value === 't' || $value === 'true' || $value === '1' || $value === 1;
}

/**
 * Каталог из базы. null — таблицы нет или она пуста, значит
 * зовущий берёт список из кода.
 *
 * Порядок: сначала вид (в порядке витрины), внутри вида —
 * sort_order, дальше цена. Так новый товар, добавленный без
 * указания порядка, встаёт по цене, а не в случайное место.
 */
function gc_shop_catalog_from_db(): ?array {
    if (!gc_shop_items_table_ready()) return null;

    $rows = gamecode_pg_query_all(
        "SELECT id, kind, name, price, is_free, hidden, payload, sort_order
           FROM shop_items
          ORDER BY CASE kind
                     WHEN 'frame'  THEN 1
                     WHEN 'title'  THEN 2
                     WHEN 'avatar' THEN 3
                     WHEN 'skin'   THEN 4
                     ELSE 5
                   END,
                   sort_order, price, id"
    );
    if (!is_array($rows) || empty($rows)) return null;

    $out = [];
    foreach ($rows as $row) {
        $kind = (string)($row['kind'] ?? '');
        $item = [
            'id'         => (string)($row['id'] ?? ''),
            'kind'       => $kind,
            'name'       => (string)($row['name'] ?? ''),
            'price'      => (int)($row['price'] ?? 0),
            'hidden'     => gc_shop_bool($row['hidden'] ?? false),
            'sort_order' => (int)($row['sort_order'] ?? 0),
        ];
        // 'free' ставим только когда он true: остальной код
        // проверяет предмет через !empty($item['free']).
        if (gc_shop_bool($row['is_free'] ?? false)) {
            $item['free'] = true;
        }
        $item[GC_SHOP_PAYLOAD_KEY[$kind] ?? 'payload'] = (string)($row['payload'] ?? '');
        $out[] = $item;
    }
    return $out;
}

/**
 * Действующий каталог: из базы, а если её ещё нет — из кода.
 * Читается один раз за запрос.
 */
function gc_shop_catalog(): array {
    static $catalog = null;
    if ($catalog !== null) return $catalog;

    $catalog = gc_shop_catalog_from_db() ?? gc_shop_default_catalog();
    return $catalog;
}

/** id => предмет */
function gc_shop_items(): array {
    static $byId = null;
    if ($byId === null) {
        $byId = [];
        foreach (gc_shop_catalog() as $item) {
            $byId[$item['id']] = $item;
        }
    }
    return $byId;
}

function gc_shop_item(string $id): ?array {
    $items = gc_shop_items();
    return $items[$id] ?? null;
}

/**
 * Предметы одного вида, в порядке каталога.
 *
 * $visibleOnly = true — только то, что сейчас в продаже. Так
 * зовёт витрина магазина. Везде, где речь про уже купленное
 * (проверка владения, выбор аватара в профиле), зовут без
 * этого флага: снятый с продажи предмет обязан продолжать
 * работать у того, кто его купил.
 */
function gc_shop_by_kind(string $kind, bool $visibleOnly = false): array {
    $out = [];
    foreach (gc_shop_catalog() as $item) {
        if ($item['kind'] !== $kind) continue;
        if ($visibleOnly && !empty($item['hidden'])) continue;
        $out[] = $item;
    }
    return $out;
}

function gc_shop_is_free(array $item): bool {
    return !empty($item['free']) || (int)$item['price'] === 0;
}

/**
 * Миграция 002-shop.sql могла ещё не прогреться на сервере.
 * До неё магазин молча выключается, а не роняет каждую страницу
 * запросом к несуществующей колонке.
 */
function gc_shop_ready(): bool {
    static $ready = null;
    if ($ready === null) {
        $cols = gamecode_pg_table_columns('users');
        $ready = in_array('coins', $cols, true)
            && in_array('equipped_frame', $cols, true)
            && gamecode_pg_table_exists('shop_purchases');
    }
    return $ready;
}

/** Кошелёк: баланс, всего заработано, всего потрачено. */
function gc_shop_wallet(int $userId): array {
    $empty = ['coins' => 0, 'earned' => 0, 'spent' => 0];
    if ($userId <= 0 || !gc_shop_ready()) return $empty;

    $rows = gamecode_pg_query_all(
        'SELECT u.coins,
                u.coins_earned,
                COALESCE((SELECT SUM(price) FROM shop_purchases WHERE user_id = u.id), 0) AS spent
         FROM users u WHERE u.id = $1',
        [$userId]
    );
    if (!is_array($rows) || empty($rows)) return $empty;

    return [
        'coins'  => (int)($rows[0]['coins'] ?? 0),
        'earned' => (int)($rows[0]['coins_earned'] ?? 0),
        'spent'  => (int)($rows[0]['spent'] ?? 0),
    ];
}

function gc_shop_coins(int $userId): int {
    return gc_shop_wallet($userId)['coins'];
}

/** Что игрок купил. Бесплатные предметы сюда не попадают — они у всех. */
function gc_shop_purchased(int $userId): array {
    if ($userId <= 0 || !gc_shop_ready()) return [];
    $rows = gamecode_pg_query_all(
        'SELECT item_id FROM shop_purchases WHERE user_id = $1',
        [$userId]
    );
    if (!is_array($rows)) return [];

    $ids = [];
    foreach ($rows as $row) {
        $ids[] = (string)($row['item_id'] ?? '');
    }
    return $ids;
}

/** Владеет ли: куплено или бесплатно. */
function gc_shop_owns(int $userId, string $itemId): bool {
    $item = gc_shop_item($itemId);
    if (!$item) return false;
    if (gc_shop_is_free($item)) return true;
    return in_array($itemId, gc_shop_purchased($userId), true);
}

/** Что сейчас надето. Возвращает id предметов. */
function gc_shop_equipped(int $userId): array {
    $none = ['frame' => 'frame_none', 'title' => 'title_none', 'avatar' => 'avatar1', 'skin' => 'skin_default'];
    if ($userId <= 0 || !gc_shop_ready()) return $none;

    $rows = gamecode_pg_query_all(
        'SELECT equipped_frame, equipped_title, equipped_skin, avatar_emoji FROM users WHERE id = $1',
        [$userId]
    );
    if (!is_array($rows) || empty($rows)) return $none;

    $r = $rows[0];
    return [
        'frame'  => ((string)($r['equipped_frame'] ?? '')) ?: 'frame_none',
        'title'  => ((string)($r['equipped_title'] ?? '')) ?: 'title_none',
        'skin'   => ((string)($r['equipped_skin']  ?? '')) ?: 'skin_default',
        'avatar' => ((string)($r['avatar_emoji']   ?? '')) ?: 'avatar1',
    ];
}

/**
 * Покупка. Порядок операций важен:
 *
 *   1. Вставляем строку покупки с ON CONFLICT DO NOTHING.
 *      Уникальный индекс (user_id, item_id) — единственная надёжная
 *      защита от двойного списания: если два запроса прилетят
 *      одновременно, вторая вставка вернёт ноль строк.
 *   2. Списываем коины запросом с условием coins >= price.
 *      Ноль изменённых строк = денег не хватило, откатываемся.
 *
 * Цену берём из каталога на сервере, из запроса — только id.
 */
function gc_shop_buy(int $userId, string $itemId): array {
    if ($userId <= 0)      return ['ok' => false, 'error' => 'Не авторизован'];
    if (!gc_shop_ready())  return ['ok' => false, 'error' => 'Магазин ещё не подключён'];

    $item = gc_shop_item($itemId);
    if (!$item)                 return ['ok' => false, 'error' => 'Такого товара нет'];
    if (gc_shop_is_free($item)) return ['ok' => false, 'error' => 'Этот предмет и так доступен'];

    // Снятое с продажи не продаём даже по прямому запросу к API:
    // с витрины оно пропало, а id остался известен всем, кто
    // видел страницу раньше.
    if (!empty($item['hidden'])) return ['ok' => false, 'error' => 'Товар снят с продажи'];

    $price = (int)$item['price'];
    $conn = gamecode_pg_connection();
    if (!$conn) return ['ok' => false, 'error' => 'Нет связи с базой'];

    if (@pg_query($conn, 'BEGIN') === false) {
        return ['ok' => false, 'error' => 'Не удалось начать транзакцию'];
    }

    $ins = @pg_query_params(
        $conn,
        'INSERT INTO shop_purchases (user_id, item_id, price)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO NOTHING
         RETURNING id',
        [$userId, $itemId, $price]
    );
    if ($ins === false) {
        @pg_query($conn, 'ROLLBACK');
        return ['ok' => false, 'error' => 'Не удалось записать покупку'];
    }
    if (pg_num_rows($ins) === 0) {
        @pg_query($conn, 'ROLLBACK');
        return ['ok' => false, 'error' => 'Уже куплено'];
    }

    $upd = @pg_query_params(
        $conn,
        'UPDATE users SET coins = coins - $2, updated_at = NOW()
         WHERE id = $1 AND coins >= $2
         RETURNING coins',
        [$userId, $price]
    );
    if ($upd === false || pg_num_rows($upd) === 0) {
        @pg_query($conn, 'ROLLBACK');
        return ['ok' => false, 'error' => 'Не хватает пиксель коинов'];
    }

    $left = (int)(pg_fetch_result($upd, 0, 0));

    if (@pg_query($conn, 'COMMIT') === false) {
        @pg_query($conn, 'ROLLBACK');
        return ['ok' => false, 'error' => 'Не удалось завершить покупку'];
    }

    return ['ok' => true, 'item' => $item, 'coins' => $left];
}

/**
 * Надеть купленное. Переключаться между своими предметами можно
 * сколько угодно и бесплатно — платят один раз, за владение.
 */
function gc_shop_equip(int $userId, string $itemId): array {
    if ($userId <= 0)     return ['ok' => false, 'error' => 'Не авторизован'];
    if (!gc_shop_ready()) return ['ok' => false, 'error' => 'Магазин ещё не подключён'];

    $item = gc_shop_item($itemId);
    if (!$item) return ['ok' => false, 'error' => 'Такого товара нет'];
    if (!gc_shop_owns($userId, $itemId)) return ['ok' => false, 'error' => 'Предмет не куплен'];

    // Аватар живёт в своей давней колонке — её читают профиль,
    // таблица лидеров и виджет авторизации.
    $column = [
        'frame'  => 'equipped_frame',
        'title'  => 'equipped_title',
        'skin'   => 'equipped_skin',
        'avatar' => 'avatar_emoji',
    ][$item['kind']] ?? null;
    if ($column === null) return ['ok' => false, 'error' => 'Этот предмет нельзя надеть'];

    $value = $item['kind'] === 'avatar' ? (string)$item['file'] : $itemId;

    $res = gamecode_pg_exec(
        'UPDATE users SET ' . $column . ' = $2, updated_at = NOW() WHERE id = $1',
        [$userId, $value]
    );
    if ($res === false) return ['ok' => false, 'error' => 'Не удалось сохранить'];

    // Аватар, рамка и титул лежат в каждой строке кэша лидерборда.
    // Без сброса новая внешность появлялась бы там только через
    // пять минут — ровно то, что выглядит как «не сохранилось».
    // Скин в лидерборде не показывается, но сбросить лишний ключ
    // дешевле, чем поддерживать здесь список исключений.
    cache_invalidate_leaderboards_all();

    return ['ok' => true, 'kind' => $item['kind'], 'item' => $item];
}

/**
 * Начисление пиксель коинов за партию: GC_COIN_RATE процентов
 * от очков, округляя вверх, чтобы за любой ненулевой результат
 * упал хотя бы один коин. За полный проигрыш (0 очков) — ноль:
 * в истории такая попытка видна, но платить за неё не за что.
 *
 * Возвращает, сколько коинов начислено. Саму формулу считает
 * gc_shop_coins_for_score() — она же нужна, чтобы положить число
 * в мету результата и потом показать его в истории игр.
 */
function gc_shop_coins_for_score(int $score): int {
    if ($score <= 0) return 0;
    return (int)ceil($score * GC_COIN_RATE / 100);
}

function gc_shop_award_coins(int $userId, int $score): int {
    if ($userId <= 0 || $score <= 0 || !gc_shop_ready()) return 0;

    $coins = gc_shop_coins_for_score($score);
    if ($coins <= 0) return 0;

    $res = gamecode_pg_exec(
        'UPDATE users
         SET coins = coins + $2, coins_earned = coins_earned + $2, updated_at = NOW()
         WHERE id = $1',
        [$userId, $coins]
    );
    return $res === false ? 0 : $coins;
}

/**
 * Ручная правка баланса из админки: $delta может быть любого знака.
 *
 * Баланс не уходит в минус — GREATEST(0, …) на стороне SQL. Иначе
 * администратор одним «минус тысяча» загонял бы игрока в долг,
 * из которого тот не выберется и который сломал бы покупки.
 *
 * Выданное НЕ идёт в coins_earned: там счётчик заработанного игрой,
 * и подарки администрации его портить не должны.
 *
 * Возвращает новый баланс или null, если пользователя нет.
 */
function gc_shop_admin_adjust(int $userId, int $delta): ?int {
    if ($userId <= 0 || $delta === 0 || !gc_shop_ready()) return null;

    $rows = gamecode_pg_query_all(
        'UPDATE users
         SET coins = GREATEST(0, coins + $2), updated_at = NOW()
         WHERE id = $1
         RETURNING coins',
        [$userId, $delta]
    );
    if (!is_array($rows) || empty($rows)) return null;

    return (int)$rows[0]['coins'];
}

/** Приветственный бонус при регистрации. */
function gc_shop_grant_welcome(int $userId): void {
    if ($userId <= 0 || !gc_shop_ready()) return;
    gamecode_pg_exec(
        'UPDATE users SET coins = coins + $2, updated_at = NOW() WHERE id = $1',
        [$userId, GC_WELCOME_COINS]
    );
}

/** CSS-класс надетой рамки — для профиля и таблицы лидеров. */
function gc_shop_frame_css(string $frameId): string {
    $item = gc_shop_item($frameId);
    return ($item && $item['kind'] === 'frame') ? (string)($item['css'] ?? '') : '';
}

/** Текст надетого титула. */
function gc_shop_title_text(string $titleId): string {
    $item = gc_shop_item($titleId);
    return ($item && $item['kind'] === 'title') ? (string)($item['text'] ?? '') : '';
}

/** Папка спрайтов надетого скина ('' = базовый персонаж). */
function gc_shop_skin_dir(string $skinId): string {
    $item = gc_shop_item($skinId);
    return ($item && $item['kind'] === 'skin') ? (string)($item['dir'] ?? '') : '';
}


/* ============================================================
   РЕДАКТИРОВАНИЕ КАТАЛОГА ИЗ АДМИНКИ

   Всё, что ниже, работает только когда прогнана миграция 003.
   Без таблицы каталог берётся из кода и править его нечем —
   функции честно возвращают ошибку, а не делают вид, что
   сохранили.

   После любой правки сбрасываем кэш таблицы лидеров: в её
   строках лежат рамка и титул игрока, и переименованный титул
   без сброса менялся бы там только через пять минут.
   ============================================================ */

/**
 * Товары, которые нельзя ни удалить, ни спрятать, ни сделать
 * платными. Это «пустые» варианты и аватар по умолчанию: на них
 * откатывается любой игрок, который ничего не покупал, и без них
 * профиль оказался бы без картинки, а рамка — без варианта «снять».
 */
const GC_SHOP_PROTECTED = ['frame_none', 'title_none', 'skin_default', 'avatar1'];

function gc_shop_is_protected(string $itemId): bool {
    return in_array($itemId, GC_SHOP_PROTECTED, true);
}

/** Сколько раз товар куплен. Решает, можно ли его удалять. */
function gc_shop_purchase_count(string $itemId): int {
    if (!gc_shop_ready()) return 0;
    $rows = gamecode_pg_query_all(
        'SELECT COUNT(*) AS n FROM shop_purchases WHERE item_id = $1',
        [$itemId]
    );
    return is_array($rows) && isset($rows[0]['n']) ? (int)$rows[0]['n'] : 0;
}

/** Покупки сразу по всему каталогу: id => сколько раз куплен. */
function gc_shop_purchase_counts(): array {
    if (!gc_shop_ready()) return [];
    $rows = gamecode_pg_query_all(
        'SELECT item_id, COUNT(*) AS n FROM shop_purchases GROUP BY item_id'
    );
    if (!is_array($rows)) return [];

    $out = [];
    foreach ($rows as $row) {
        $out[(string)($row['item_id'] ?? '')] = (int)($row['n'] ?? 0);
    }
    return $out;
}

/**
 * Создать или обновить товар.
 *
 * $data: id, kind, name, price, payload, sort_order, is_free, hidden.
 * При обновлении вид и id не меняются — их менять нельзя, на
 * них завязаны строки в shop_purchases и колонки equipped_*.
 */
function gc_shop_admin_save(array $data, bool $isNew): array {
    if (!gc_shop_items_table_ready()) {
        return ['ok' => false, 'error' => 'Каталог ещё не в базе: прогоните db/migrations/003-shop-items.sql'];
    }

    $id   = trim((string)($data['id'] ?? ''));
    $kind = (string)($data['kind'] ?? '');
    $name = trim((string)($data['name'] ?? ''));

    if ($id === '' || strlen($id) > 40)          return ['ok' => false, 'error' => 'Некорректный идентификатор товара'];
    if (!in_array($kind, GC_SHOP_KINDS, true))   return ['ok' => false, 'error' => 'Неизвестный раздел магазина'];
    if ($name === '')                            return ['ok' => false, 'error' => 'Название не может быть пустым'];
    if (mb_strlen($name) > 80)                   return ['ok' => false, 'error' => 'Название длиннее 80 символов'];

    // Цену ограничиваем сверху не из вредности: четырёхзначные
    // суммы и так за гранью того, что игрок накопит, а опечатка
    // в лишний ноль тихо убирает товар из досягаемости.
    $price = (int)($data['price'] ?? 0);
    if ($price < 0 || $price > 100000) return ['ok' => false, 'error' => 'Цена должна быть от 0 до 100000'];

    $payload = trim((string)($data['payload'] ?? ''));
    if (mb_strlen($payload) > 120) return ['ok' => false, 'error' => 'Значение товара длиннее 120 символов'];

    $sortOrder = (int)($data['sort_order'] ?? 0);
    if ($sortOrder < 0 || $sortOrder > 100000) $sortOrder = 0;

    $isFree = !empty($data['is_free']) || $price === 0;
    $hidden = !empty($data['hidden']);

    // Бесплатное остаётся бесплатным. Если повесить цену на то,
    // что у людей уже есть даром, вещь мгновенно исчезнет у всех,
    // кто её не «покупал» — покупок-то нет. Нужен платный вариант —
    // заводится отдельным товаром.
    if (!$isNew) {
        $existing = gc_shop_item($id);
        if ($existing && gc_shop_is_free($existing)) {
            $price  = 0;
            $isFree = true;
        }
        if (gc_shop_is_protected($id)) {
            $hidden = false;
        }
    }

    if ($isNew) {
        $rows = gamecode_pg_query_all(
            'INSERT INTO shop_items (id, kind, name, price, is_free, hidden, payload, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING
             RETURNING id',
            [$id, $kind, $name, $price, $isFree ? 't' : 'f', $hidden ? 't' : 'f', $payload, $sortOrder]
        );
        if (!is_array($rows) || empty($rows)) {
            return ['ok' => false, 'error' => 'Товар с таким идентификатором уже есть'];
        }
    } else {
        // kind и id намеренно не в списке обновляемых полей.
        $res = gamecode_pg_exec(
            'UPDATE shop_items
                SET name = $2, price = $3, is_free = $4, hidden = $5, payload = $6, sort_order = $7
              WHERE id = $1',
            [$id, $name, $price, $isFree ? 't' : 'f', $hidden ? 't' : 'f', $payload, $sortOrder]
        );
        if ($res === false) return ['ok' => false, 'error' => 'Не удалось сохранить товар'];
    }

    cache_invalidate_leaderboards_all();
    return ['ok' => true, 'id' => $id];
}

/** Снять с продажи или вернуть на витрину. */
function gc_shop_admin_set_hidden(string $itemId, bool $hidden): array {
    if (!gc_shop_items_table_ready()) {
        return ['ok' => false, 'error' => 'Каталог ещё не в базе'];
    }
    if ($hidden && gc_shop_is_protected($itemId)) {
        return ['ok' => false, 'error' => 'Этот вариант нужен как «пусто» по умолчанию — его нельзя убрать'];
    }

    $res = gamecode_pg_exec(
        'UPDATE shop_items SET hidden = $2 WHERE id = $1',
        [$itemId, $hidden ? 't' : 'f']
    );
    if ($res === false) return ['ok' => false, 'error' => 'Не удалось изменить статус'];

    cache_invalidate_leaderboards_all();
    return ['ok' => true];
}

/**
 * Удаление. Купленное не удаляем ни при каких условиях —
 * вместо этого предлагаем снять с продажи. Иначе у игрока
 * пропадает вещь, за которую он заплатил, а надетая слетает
 * на пустое место.
 */
function gc_shop_admin_delete(string $itemId): array {
    if (!gc_shop_items_table_ready()) {
        return ['ok' => false, 'error' => 'Каталог ещё не в базе'];
    }

    if (gc_shop_is_protected($itemId)) {
        return ['ok' => false, 'error' => 'Этот вариант нужен как «пусто» по умолчанию — удалить нельзя'];
    }

    $bought = gc_shop_purchase_count($itemId);
    if ($bought > 0) {
        return ['ok' => false, 'error' => "Товар куплен ($bought шт.) — его можно только снять с продажи"];
    }

    $res = gamecode_pg_exec('DELETE FROM shop_items WHERE id = $1', [$itemId]);
    if ($res === false) return ['ok' => false, 'error' => 'Не удалось удалить товар'];

    cache_invalidate_leaderboards_all();
    return ['ok' => true];
}

/**
 * Сдвинуть товар в своём разделе на позицию вверх или вниз.
 * Меняем местами sort_order с соседом — так порядок остаётся
 * осмысленным даже если значения изначально шли не подряд.
 */
function gc_shop_admin_move(string $itemId, string $direction): array {
    if (!gc_shop_items_table_ready()) {
        return ['ok' => false, 'error' => 'Каталог ещё не в базе'];
    }

    $item = gc_shop_item($itemId);
    if (!$item) return ['ok' => false, 'error' => 'Товар не найден'];

    $list = gc_shop_by_kind($item['kind']);
    $index = -1;
    foreach ($list as $i => $row) {
        if ($row['id'] === $itemId) { $index = $i; break; }
    }
    if ($index < 0) return ['ok' => false, 'error' => 'Товар не найден в разделе'];

    $swapIndex = $direction === 'up' ? $index - 1 : $index + 1;
    if (!isset($list[$swapIndex])) return ['ok' => true]; // край списка — молча ничего не делаем

    $neighbour = $list[$swapIndex];

    // Если порядок у обоих одинаковый (например оба нули после
    // ручной вставки), простой обмен ничего не изменит — задаём
    // соседям заведомо разные значения.
    $a = (int)($item['sort_order'] ?? 0);
    $b = (int)($neighbour['sort_order'] ?? 0);
    if ($a === $b) {
        $a = ($index + 1) * 10;
        $b = ($swapIndex + 1) * 10;
    }

    gamecode_pg_exec('UPDATE shop_items SET sort_order = $2 WHERE id = $1', [$itemId, $b]);
    gamecode_pg_exec('UPDATE shop_items SET sort_order = $2 WHERE id = $1', [$neighbour['id'], $a]);

    cache_invalidate_leaderboards_all();
    return ['ok' => true];
}
