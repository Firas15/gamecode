<?php
/**
 * ============================================================
 *  «СЕТЕВОЙ МАРШРУТ» — серверная часть игры
 *
 *  Задания генерирует сервер: IP-адреса, маски, таблицы
 *  маршрутизации — каждый раз новые и всегда с верным ответом.
 *  Теоретические вопросы лежат в базе (миграция 006-network.sql),
 *  правятся в админке (admin/network.php).
 *
 *  ЗАЩИТА ОТ НАКРУТКИ — как у «Глюк-атаки»:
 *    1. На старте сервер собирает всю партию и хранит её в сессии,
 *       рядом с подписанным раном из api/ping-game.php.
 *    2. Задание выдаётся по одному и без ответа.
 *    3. Верность ответа, время, очки, серию и жизни считает сервер.
 *    4. api/score.php берёт итог из этого состояния — из браузера
 *       не принимается ни одного числа.
 *
 *  Типы заданий (поле type):
 *    same_subnet — кликни устройство из своей подсети (или чужое)
 *    net_addr    — адрес сети            broadcast — широковещательный адрес
 *    hosts       — сколько узлов в сети  mask      — префикс ↔ маска
 *    gateway     — какой адрес годится в шлюзы
 *    private     — частный / публичный адрес
 *    fault       — у какого устройства ошибка в настройке
 *    route       — куда уйдёт пакет по таблице маршрутизации
 *    theory      — вопрос из базы
 * ============================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/game_security.php';

const NET_GAME_ID    = 'network';
const NET_LIVES      = 3;
const NET_MIN_ANSWER = 0.5;   // секунд: ответ быстрее — это скрипт, а не человек
const NET_GRACE_SEC  = 3;     // ответ чуть позже таймера (сеть, анимация) — засчитан, но без очков
const NET_TIME       = 60;   // секунд на любое задание, на всех уровнях
const NET_COMBO_STEP = 5;
const NET_COMBO_AT   = [3, 6, 9];
const NET_SCORE_CAP  = 1500;

const NET_Q_MAX   = 200;      // длины полей теории в админке
const NET_A_MAX   = 80;
const NET_EXP_MAX = 300;

/**
 * Уровни: время на задание (60 с везде), очки (база + до speed за скорость),
 * бонус за прохождение и состав партии.
 * Максимум: Новичок ≈ 455, Практик ≈ 755, Эксперт ≈ 1045.
 */
const NET_LEVELS = [
    1 => [
        'name' => 'НОВИЧОК', 'time' => NET_TIME, 'base' => 30, 'speed' => 15, 'bonus' => 50,
        'plan' => ['same_subnet' => 3, 'net_addr' => 1, 'mask' => 1, 'gateway' => 1, 'theory' => 2],
    ],
    2 => [
        'name' => 'ПРАКТИК', 'time' => NET_TIME, 'base' => 40, 'speed' => 20, 'bonus' => 80,
        'plan' => ['same_subnet' => 2, 'net_addr' => 1, 'broadcast' => 1, 'mask' => 1, 'gateway' => 1,
                   'private' => 1, 'fault' => 1, 'theory' => 2],
    ],
    3 => [
        'name' => 'ЭКСПЕРТ', 'time' => NET_TIME, 'base' => 60, 'speed' => 25, 'bonus' => 120,
        'plan' => ['same_subnet' => 1, 'net_addr' => 1, 'broadcast' => 1, 'hosts' => 1, 'mask' => 1,
                   'route' => 2, 'fault' => 2, 'theory' => 1],
    ],
];

const NET_TYPE_LABELS = [
    'same_subnet' => 'СВОЙ ИЛИ ЧУЖОЙ',
    'net_addr'    => 'АДРЕС СЕТИ',
    'broadcast'   => 'BROADCAST',
    'hosts'       => 'СКОЛЬКО УЗЛОВ',
    'mask'        => 'МАСКА',
    'gateway'     => 'ШЛЮЗ',
    'private'     => 'ЧАСТНЫЙ ИЛИ ПУБЛИЧНЫЙ',
    'fault'       => 'НАЙДИ ПОЛОМКУ',
    'route'       => 'МАРШРУТИЗАЦИЯ',
    'theory'      => 'ТЕОРИЯ',
];

// ============================================================
//  IP-АРИФМЕТИКА (IPv4 как целое 0..2^32-1)
// ============================================================

function net_ip(int $n): string { return long2ip($n & 0xFFFFFFFF); }
function net_int(string $ip): int { return ip2long($ip) & 0xFFFFFFFF; }
function net_mask_int(int $p): int { return $p <= 0 ? 0 : ((0xFFFFFFFF << (32 - $p)) & 0xFFFFFFFF); }
function net_mask(int $p): string { return net_ip(net_mask_int($p)); }
function net_size(int $p): int { return 1 << (32 - $p); }
function net_network(int $ip, int $p): int { return $ip & net_mask_int($p); }
function net_bcast(int $ip, int $p): int { return net_network($ip, $p) | (~net_mask_int($p) & 0xFFFFFFFF); }
function net_same(int $a, int $b, int $p): bool { return net_network($a, $p) === net_network($b, $p); }
function net_cidr(int $ip, int $p): string { return net_ip($ip) . '/' . $p; }
function net_hosts(int $p): int { return $p >= 31 ? 0 : net_size($p) - 2; }

/** Случайный узел подсети (не адрес сети и не broadcast), не из $exclude. */
function net_host(int $net, int $p, array $exclude = []): int {
    $size = net_size($p);
    for ($i = 0; $i < 200; $i++) {
        $h = $net + random_int(1, $size - 2);
        if (!in_array($h, $exclude, true)) return $h;
    }
    return $net + 1;
}

/**
 * Случайная частная сеть с префиксом $p, выровненная по границе.
 * /8 — 10.0.0.0; /9…/15 — внутри 10/8; /16…/23 — 10/8, 172.16/12, 192.168/16;
 * /24 и длиннее — блок внутри случайной /24.
 */
function net_random_net(int $p): int {
    if ($p <= 8) return net_int('10.0.0.0');
    if ($p < 16) return net_network(net_int('10.0.0.0') + random_int(0, 0xFFFFFF), $p);
    $pick = random_int(0, 2);
    if ($pick === 0) $base = net_int('10.0.0.0') + random_int(0, 0xFFFFFF);
    elseif ($pick === 1) $base = net_int('172.16.0.0') + random_int(0, 0xFFFFF);
    else $base = net_int('192.168.0.0') + random_int(0, 0xFFFF);
    $net = net_network($base, $p);
    // Сеть x.x.0.0 /24 бывает, но выглядит странно — чуть реже
    if ($p >= 24 && (($net >> 8) & 0xFF) === 0 && random_int(0, 1)) $net += 256;
    return net_network($net, $p);
}

/**
 * «Похожие, но чужие» адреса для подсети $net/$p: соседние сети,
 * адреса с изменённым битом сети, другой частный диапазон.
 * Всё гарантированно вне подсети.
 */
function net_outside(int $net, int $p, int $count, array $exclude = []): array {
    $size = net_size($p);
    $cand = [];
    // соседние подсети того же размера — самая частая ловушка
    foreach ([1, -1, 2, -2, 3] as $k) {
        $n = $net + $k * $size;
        if ($n > 0 && $n + $size - 1 <= 0xFFFFFFFF) $cand[] = net_host_safe($n, $p);
    }
    // флип одного из последних битов части сети
    for ($b = 0; $b < min(6, $p - 1); $b++) {
        $n = $net ^ (1 << (32 - $p + $b));
        $cand[] = net_host_safe($n, $p);
    }
    // «тот же последний октет, другой третий/второй»
    $cand[] = $net ^ (1 << 8) | random_int(1, 254);
    $cand[] = $net ^ (1 << 16) | random_int(1, 254);
    // совсем другая сеть
    $cand[] = net_int('172.16.0.0') + random_int(256, 0xFFFFF);
    $cand[] = net_int('192.168.0.0') + random_int(256, 0xFFFF);
    $cand[] = net_int('10.0.0.0') + random_int(256, 0xFFFFFF);

    $out = [];
    shuffle($cand);
    // соседние сети ставим вперёд: они интереснее
    if ($net - $size > 0) array_unshift($cand, net_host_safe($net - $size, $p));
    if ($net + $size < 0xFFFFFFFF) array_unshift($cand, net_host_safe($net + $size, $p));
    foreach ($cand as $c) {
        $c &= 0xFFFFFFFF;
        $last = $c & 0xFF;
        if ($last === 0 || $last === 255) $c = ($c & 0xFFFFFF00) | random_int(2, 250);
        if (net_same($c, $net, $p) || in_array($c, $out, true) || in_array($c, $exclude, true)) continue;
        $out[] = $c;
        if (count($out) >= $count) break;
    }
    return $out;
}
/** Случайный узел в сети $n/$p, без проверки, что $n валидна. */
function net_host_safe(int $n, int $p): int {
    $n = net_network($n & 0xFFFFFFFF, $p);
    return $p >= 31 ? $n : $n + random_int(1, net_size($p) - 2);
}

/** Диапазон сети словами: «192.168.1.64 – 192.168.1.127». */
function net_range(int $ip, int $p): string {
    return net_ip(net_network($ip, $p)) . ' – ' . net_ip(net_bcast($ip, $p));
}

/** Перемешать варианты; вернуть [варианты, индекс верного]. Верный — $opts[0]. */
function net_shuffle_opts(array $opts): array {
    $idx = array_keys($opts);
    shuffle($idx);
    $out = [];
    $answer = 0;
    foreach ($idx as $pos => $i) {
        $out[] = $opts[$i];
        if ($i === 0) $answer = $pos;
    }
    return [$out, $answer];
}

/** Префиксы, из которых выбирают задания на каждом уровне. */
function net_level_prefix(int $level, string $type): int {
    $sets = [
        1 => [24],
        2 => [8, 16, 16, 24, 24],
        3 => in_array($type, ['net_addr', 'broadcast'], true)
            ? [20, 21, 22, 23, 25, 26, 27, 28, 29, 30]
            : [25, 26, 27, 28, 29],
    ];
    $set = $sets[$level];
    return $set[array_rand($set)];
}

const NET_DEVICES = [
    ['ПК бухгалтерии', 'pc'], ['Ноутбук', 'laptop'], ['Принтер', 'printer'], ['Сервер 1С', 'server'],
    ['Камера', 'camera'], ['Хранилище NAS', 'server'], ['Телефон', 'phone'], ['ПК директора', 'pc'],
    ['Wi-Fi точка', 'router'], ['Сервер почты', 'server'], ['Планшет', 'phone'], ['ПК админа', 'pc'],
    ['Smart-TV', 'tv'], ['Касса', 'pc'], ['Терминал', 'laptop'],
];
function net_pick_devices(int $n): array {
    $all = NET_DEVICES;
    shuffle($all);
    return array_map(static fn($d) => ['name' => $d[0], 'kind' => $d[1]], array_slice($all, 0, $n));
}

// ============================================================
//  ГЕНЕРАТОРЫ ЗАДАНИЙ
//  Каждый возвращает: type, mode ('map' — клик по устройствам,
//  'options' — 4 кнопки), text, data (что нарисовать), options,
//  answer (индекс, остаётся на сервере), explain, calc (строки для
//  калькулятора-подсказки или null).
// ============================================================

function net_gen_same_subnet(int $level): array {
    $p = net_level_prefix($level, 'same_subnet');
    $net = net_random_net($p);
    $sender = net_host($net, $p);
    $invert = $level >= 2 && random_int(1, 100) <= 35;   // «найди ЧУЖОЕ»
    $devs = net_pick_devices(4);

    if (!$invert) {
        $good = [net_host($net, $p, [$sender])];
        $bad = net_outside($net, $p, 3, [$sender]);
        $ips = array_merge($good, $bad);
    } else {
        $good = net_outside($net, $p, 1, [$sender]);
        $in = [];
        for ($i = 0; $i < 3; $i++) $in[] = net_host($net, $p, array_merge([$sender], $in));
        $ips = array_merge($good, $in);
    }
    [$ips, $answer] = net_shuffle_opts($ips);
    foreach ($devs as $i => &$d) $d['ip'] = net_ip($ips[$i]);
    unset($d);

    $range = net_range($net, $p);
    $text = $invert
        ? 'Пакет от ' . net_cidr($sender, $p) . ' дойдёт напрямую до всех, кроме одного. Найди устройство из ЧУЖОЙ подсети.'
        : 'Отправь пакет устройству из той же подсети, что и ' . net_cidr($sender, $p) . '.';
    $explain = 'Маска /' . $p . ' (' . net_mask($p) . '): сеть отправителя — ' . $range . '. '
        . ($invert ? 'Вне её только ' : 'В неё входит только ') . net_ip($ips[$answer]) . '.';

    $calc = [['label' => 'Отправитель', 'ip' => net_ip($sender), 'prefix' => $p]];
    foreach ($devs as $d) $calc[] = ['label' => $d['name'], 'ip' => $d['ip'], 'prefix' => $p];

    return [
        'type' => 'same_subnet', 'mode' => 'map', 'text' => $text,
        'data' => ['sender' => ['name' => 'Отправитель', 'ip' => net_ip($sender), 'prefix' => $p, 'mask' => net_mask($p)],
                   'devices' => $devs, 'invert' => $invert],
        'options' => array_map(static fn($d) => $d['name'] . ' · ' . $d['ip'], $devs),
        'answer' => $answer, 'explain' => $explain, 'calc' => $calc,
    ];
}

function net_gen_net_addr(int $level, bool $bcast = false): array {
    $p = net_level_prefix($level, $bcast ? 'broadcast' : 'net_addr');
    $net = net_random_net($p);
    $ip = net_host($net, $p);
    $b = net_bcast($net, $p);
    $size = net_size($p);
    $right = $bcast ? $b : $net;

    // Ловушки: «просто .0 / .255 в конце», соседняя сеть, адрес сети ↔ broadcast
    $traps = $bcast
        ? [($ip & 0xFFFFFF00) | 255, $net, $b + $size, $b - 1, ($ip & 0xFFFF0000) | 0xFFFF, $b - $size]
        : [($ip & 0xFFFFFF00), $b, $net + $size, $net - $size, ($ip & 0xFFFF0000), $ip];
    $opts = [$right];
    foreach ($traps as $t) {
        $t &= 0xFFFFFFFF;
        if (!in_array($t, $opts, true)) $opts[] = $t;
        if (count($opts) === 4) break;
    }
    [$opts, $answer] = net_shuffle_opts(array_map('net_ip', $opts));

    $what = $bcast ? 'широковещательный адрес (broadcast)' : 'адрес сети';
    $text = 'Компьютер ' . net_cidr($ip, $p) . '. Какой ' . $what . ' у его подсети?';
    $explain = 'Маска /' . $p . ' — блоки по ' . net_block_words($p) . '. ' . net_ip($ip) . ' лежит в диапазоне '
        . net_range($ip, $p) . ': первый адрес — адрес сети, последний — broadcast.';
    return [
        'type' => $bcast ? 'broadcast' : 'net_addr', 'mode' => 'options', 'text' => $text,
        'data' => ['chips' => [['label' => 'IP', 'value' => net_ip($ip)], ['label' => 'МАСКА', 'value' => net_mask($p) . ' (/' . $p . ')']]],
        'options' => $opts, 'answer' => $answer, 'explain' => $explain,
        'calc' => [['label' => 'IP', 'ip' => net_ip($ip), 'prefix' => $p]],
    ];
}

/** «64 адреса в последнем октете», «4 в третьем октете» — шаг подсетей словами. */
function net_block_words(int $p): string {
    if ($p >= 24) return net_size($p) . ' адрес' . net_plural(net_size($p), '', 'а', 'ов') . ' в последнем октете';
    if ($p >= 16) { $n = 1 << (24 - $p); return $n . ' в третьем октете'; }
    if ($p >= 8)  { $n = 1 << (16 - $p); return $n . ' во втором октете'; }
    return net_size($p) . ' адресов';
}
function net_plural(int $n, string $one, string $few, string $many): string {
    $m10 = $n % 10; $m100 = $n % 100;
    if ($m10 === 1 && $m100 !== 11) return $one;
    if ($m10 >= 2 && $m10 <= 4 && ($m100 < 12 || $m100 > 14)) return $few;
    return $many;
}

function net_gen_hosts(int $level): array {
    $set = $level >= 3 ? [22, 23, 25, 26, 27, 28, 29, 30] : [24, 25, 26];
    $p = $set[array_rand($set)];
    $right = net_hosts($p);
    $opts = [$right];
    foreach ([net_size($p), net_size($p) - 1, net_hosts($p + 1), net_hosts($p - 1), $right - 1] as $t) {
        if ($t > 0 && !in_array($t, $opts, true)) $opts[] = $t;
        if (count($opts) === 4) break;
    }
    [$opts, $answer] = net_shuffle_opts(array_map('strval', $opts));
    $net = net_random_net($p);
    $bits = 32 - $p;
    return [
        'type' => 'hosts', 'mode' => 'options',
        'text' => 'Сеть ' . net_cidr($net, $p) . '. Сколько устройств можно в ней адресовать?',
        'data' => ['chips' => [['label' => 'СЕТЬ', 'value' => net_cidr($net, $p)], ['label' => 'МАСКА', 'value' => net_mask($p)]]],
        'options' => $opts, 'answer' => $answer,
        'explain' => "/$p: на узлы остаётся 32 - $p = $bits бит, это 2^$bits = " . net_size($p)
            . ' адресов. Минус адрес сети и broadcast — ' . $right . '.',
        'calc' => [['label' => 'Сеть', 'ip' => net_ip($net), 'prefix' => $p]],
    ];
}

function net_gen_mask(int $level): array {
    $set = [1 => [8, 16, 24], 2 => [8, 12, 16, 20, 22, 23, 24, 25], 3 => [17, 19, 21, 22, 25, 26, 27, 28, 29, 30]][$level];
    $p = $set[array_rand($set)];
    $toMask = random_int(0, 1) === 1;
    $near = $level === 1 ? [8, 16, 24, 32] : [$p, $p - 1, $p + 1, $p - 2, $p + 2, $p + 8, $p - 8];
    $prefixes = [$p];
    foreach ($near as $q) {
        if ($q >= 1 && $q <= 32 && !in_array($q, $prefixes, true)) $prefixes[] = $q;
        if (count($prefixes) === 4) break;
    }
    $opts = $toMask ? array_map('net_mask', $prefixes) : array_map(static fn($q) => '/' . $q, $prefixes);
    [$opts, $answer] = net_shuffle_opts($opts);
    $bin = net_bin_mask($p);
    return [
        'type' => 'mask', 'mode' => 'options',
        'text' => $toMask ? 'Какая маска соответствует префиксу /' . $p . '?' : 'Маска ' . net_mask($p) . ' — какой это префикс?',
        'data' => ['chips' => [$toMask ? ['label' => 'ПРЕФИКС', 'value' => '/' . $p] : ['label' => 'МАСКА', 'value' => net_mask($p)]]],
        'options' => $opts, 'answer' => $answer,
        'explain' => '/' . $p . ' — это ' . $p . ' единиц подряд: ' . $bin . ' = ' . net_mask($p) . '.',
        'calc' => [['label' => 'Маска', 'ip' => net_mask($p), 'prefix' => $p]],
    ];
}
function net_bin_mask(int $p): string {
    $s = str_repeat('1', $p) . str_repeat('0', 32 - $p);
    return implode('.', str_split($s, 8));
}

function net_gen_gateway(int $level): array {
    $p = net_level_prefix($level, 'gateway');
    if ($level >= 3) { $set = [24, 25, 26, 27, 28]; $p = $set[array_rand($set)]; }
    $net = net_random_net($p);
    $b = net_bcast($net, $p);
    $pc = net_host($net, $p, [$net + 1, $b - 1]);
    $gw = random_int(0, 2) > 0 ? $net + 1 : $b - 1;
    if ($gw === $pc) $gw = $net + 1 === $pc ? $b - 1 : $net + 1;
    $other = net_outside($net, $p, 1, [$pc])[0];
    $other = net_network($other, $p) + ($gw - $net);   // «тот же хвост, но другая сеть»
    $opts = [$gw, $net, $b, $other];
    [$opts, $answer] = net_shuffle_opts(array_map('net_ip', $opts));
    return [
        'type' => 'gateway', 'mode' => 'options',
        'text' => 'У ПК ' . net_cidr($pc, $p) . ' нет связи с другими сетями. Какой адрес можно указать ему как шлюз?',
        'data' => ['chips' => [['label' => 'IP ПК', 'value' => net_ip($pc)], ['label' => 'МАСКА', 'value' => net_mask($p) . ' (/' . $p . ')']]],
        'options' => $opts, 'answer' => $answer,
        'explain' => 'Шлюз должен быть в той же подсети (' . net_range($net, $p) . ') и не может быть адресом сети или broadcast. Подходит только '
            . net_ip($gw) . '.',
        'calc' => [['label' => 'IP ПК', 'ip' => net_ip($pc), 'prefix' => $p]],
    ];
}

function net_gen_private(int $level): array {
    $private = [
        '10.' . random_int(0, 255) . '.' . random_int(0, 255) . '.' . random_int(1, 254),
        '172.' . random_int(16, 31) . '.' . random_int(0, 255) . '.' . random_int(1, 254),
        '192.168.' . random_int(0, 255) . '.' . random_int(1, 254),
    ];
    $public = [
        '172.' . random_int(32, 63) . '.' . random_int(0, 255) . '.' . random_int(1, 254),
        '172.' . random_int(1, 15) . '.' . random_int(0, 255) . '.' . random_int(1, 254),
        '192.169.' . random_int(0, 255) . '.' . random_int(1, 254),
        '11.' . random_int(0, 255) . '.' . random_int(0, 255) . '.' . random_int(1, 254),
        '8.8.8.8', '77.88.8.8', '93.' . random_int(150, 190) . '.' . random_int(0, 255) . '.' . random_int(1, 254),
    ];
    shuffle($private); shuffle($public);
    $askPublic = random_int(0, 1) === 1;
    if ($askPublic) { $opts = [$public[0], $private[0], $private[1], $private[2]]; }
    else { $opts = [$private[0], $public[0], $public[1], $public[2]]; }
    [$opts, $answer] = net_shuffle_opts($opts);
    return [
        'type' => 'private', 'mode' => 'options',
        'text' => $askPublic ? 'Какой из адресов публичный («белый»), то есть виден из интернета?'
                             : 'Какой из адресов частный («серый») — для домашней или офисной сети?',
        'data' => ['chips' => []],
        'options' => $opts, 'answer' => $answer,
        'explain' => 'Частные диапазоны: 10.0.0.0/8, 172.16.0.0 – 172.31.255.255 (/12) и 192.168.0.0/16. Всё остальное здесь — публичные адреса. '
            . $opts[$answer] . ($askPublic ? ' — публичный.' : ' — частный.'),
        'calc' => null,
    ];
}

function net_gen_fault(int $level): array {
    $p = $level >= 3 ? [25, 26, 27, 28][random_int(0, 3)] : 24;
    $net = net_random_net($p);
    $b = net_bcast($net, $p);
    $gw = $net + 1;
    $devs = net_pick_devices(4);
    $used = [$gw];
    foreach ($devs as &$d) {
        $d['ip'] = net_ip($h = net_host($net, $p, $used));
        $used[] = $h;
        $d['prefix'] = $p;
        $d['gw'] = net_ip($gw);
    }
    unset($d);

    $kinds = $level >= 3 ? ['other_net', 'gw', 'net_addr', 'bcast', 'mask'] : ['other_net', 'other_net', 'mask'];
    $kind = $kinds[array_rand($kinds)];
    $i = random_int(0, 3);
    $name = $devs[$i]['name'];
    switch ($kind) {
        case 'other_net':
            $devs[$i]['ip'] = net_ip(net_outside($net, $p, 1, $used)[0]);
            $why = $name . ': адрес ' . $devs[$i]['ip'] . ' не из сети офиса (' . net_range($net, $p) . ').';
            break;
        case 'mask':
            $wrong = $p === 24 ? [16, 8][random_int(0, 1)] : ($p + (random_int(0, 1) ? 1 : -1));
            $devs[$i]['prefix'] = $wrong;
            $why = $name . ': маска /' . $wrong . ' (' . net_mask($wrong) . ') вместо /' . $p . ' — устройство неверно считает, кто с ним в одной сети.';
            break;
        case 'gw':
            $devs[$i]['gw'] = net_ip(net_network(net_outside($net, $p, 1, $used)[0], $p) + 1);
            $why = $name . ': шлюз ' . $devs[$i]['gw'] . ' не в его подсети ' . net_range($net, $p) . ' — до шлюза пакет не дойдёт.';
            break;
        case 'net_addr':
            $devs[$i]['ip'] = net_ip($net);
            $why = $name . ': ' . net_ip($net) . ' — это адрес самой сети, его нельзя дать устройству.';
            break;
        default: // bcast
            $devs[$i]['ip'] = net_ip($b);
            $why = $name . ': ' . net_ip($b) . ' — широковещательный адрес сети, устройству его давать нельзя.';
    }

    $calc = [];
    foreach ($devs as $d) $calc[] = ['label' => $d['name'], 'ip' => $d['ip'], 'prefix' => (int)$d['prefix']];
    return [
        'type' => 'fault', 'mode' => 'map',
        'text' => 'Сеть офиса ' . net_cidr($net, $p) . ', шлюз ' . net_ip($gw) . '. Одно устройство настроено с ошибкой — найди его.',
        'data' => ['office' => ['net' => net_cidr($net, $p), 'gw' => net_ip($gw)], 'devices' => $devs],
        'options' => array_map(static fn($d) => $d['name'] . ' · ' . $d['ip'] . '/' . $d['prefix'], $devs),
        'answer' => $i, 'explain' => $why, 'calc' => $calc,
    ];
}

function net_gen_route(int $level): array {
    // Две вложенные сети: «широкая» и «узкая» внутри неё, плюс посторонняя и маршрут по умолчанию
    $variant = random_int(0, 1);
    if ($variant === 0) {
        $wide = net_random_net(16); $wp = 16;
        $narrow = $wide + random_int(1, 254) * 256; $np = 24;
    } else {
        $wide = net_random_net(24); $wp = 24;
        $np = [25, 26][random_int(0, 1)];
        $narrow = $wide + random_int(1, (1 << ($np - 24)) - 1) * net_size($np);
    }
    $wideInt = $wide;
    $otherNet = (($wide >> 24) === 10) ? net_int('172.16.0.0') : net_int('10.0.0.0');
    $op = ($otherNet >> 24) === 10 ? 8 : 12;

    $routes = [
        ['net' => $narrow, 'p' => $np, 'iface' => 'eth2', 'label' => ['Бухгалтерия', 'Склад', 'Серверная', 'Лаборатория'][random_int(0, 3)]],
        ['net' => $wideInt, 'p' => $wp, 'iface' => 'eth1', 'label' => ['Филиал', 'Офис', 'Кампус', 'Цех'][random_int(0, 3)]],
        ['net' => $otherNet, 'p' => $op, 'iface' => 'eth3', 'label' => 'VPN'],
        ['net' => 0, 'p' => 0, 'iface' => 'eth0', 'label' => 'Интернет'],
    ];

    // Куда отправить пакет: в узкую (ловушка «широкая тоже подходит»), в широкую, в постороннюю, мимо всех
    $roll = random_int(1, 100);
    if ($roll <= 40)      $dest = net_host($narrow, $np);
    elseif ($roll <= 65) {
        do { $dest = net_host($wideInt, $wp); } while (net_same($dest, $narrow, $np));
    }
    elseif ($roll <= 82)  $dest = net_host($otherNet, max($op, 16));
    else                  $dest = net_int(['8.8.8.8', '77.88.55.242', '1.1.1.1', '87.250.250.242'][random_int(0, 3)]);

    // Ответ — самый длинный подходящий префикс
    $best = -1; $bestP = -1; $matches = [];
    foreach ($routes as $k => $r) {
        if (net_same($dest, $r['net'], $r['p'])) {
            $matches[] = net_cidr($r['net'], $r['p']);
            if ($r['p'] > $bestP) { $best = $k; $bestP = $r['p']; }
        }
    }
    // Порядок строк в таблице — случайный, чтобы «первая подходящая» не работала
    $order = [0, 1, 2, 3];
    shuffle($order);
    $table = []; $answer = 0;
    foreach ($order as $pos => $k) {
        $r = $routes[$k];
        $table[] = ['dest' => $r['p'] === 0 ? '0.0.0.0/0' : net_cidr($r['net'], $r['p']), 'iface' => $r['iface'], 'label' => $r['label']];
        if ($k === $best) $answer = $pos;
    }
    $r = $routes[$best];
    $explain = count($matches) > 1
        ? 'Под ' . net_ip($dest) . ' подходят ' . implode(', ', $matches) . '. Роутер выбирает самый длинный префикс — /' . $r['p'] . ', пакет уходит в ' . $r['iface'] . ' (' . $r['label'] . ').'
        : 'Под ' . net_ip($dest) . ' не подходит ни одна сеть из таблицы, срабатывает маршрут по умолчанию 0.0.0.0/0 — пакет уходит в ' . $r['iface'] . ' (' . $r['label'] . ').';

    // prefix 0 у получателя — калькулятор не подсвечивает его биты, только показывает
    $calc = [['label' => 'Получатель', 'ip' => net_ip($dest), 'prefix' => 0]];
    foreach ($order as $k) {
        if ($routes[$k]['p'] > 0) $calc[] = ['label' => $routes[$k]['iface'], 'ip' => net_ip($routes[$k]['net']), 'prefix' => $routes[$k]['p']];
    }
    return [
        'type' => 'route', 'mode' => 'map',
        'text' => 'Пакет для ' . net_ip($dest) . ' пришёл на роутер. Через какой интерфейс он уйдёт?',
        'data' => ['dest' => net_ip($dest), 'table' => $table],
        'options' => array_map(static fn($t) => $t['iface'] . ' · ' . $t['label'], $table),
        'answer' => $answer, 'explain' => $explain, 'calc' => $calc,
    ];
}

// ============================================================
//  ТЕОРИЯ ИЗ БАЗЫ
// ============================================================

function network_tables_ready(): bool {
    static $ready = null;
    if ($ready === null) $ready = gamecode_pg_table_exists('network_questions');
    return $ready;
}

/** $count случайных видимых вопросов, доступных на уровне $level. */
function network_theory_pick(int $level, int $count): array {
    if ($count <= 0 || !network_tables_ready()) return [];
    $rows = gamecode_pg_query_all(
        'SELECT * FROM network_questions WHERE NOT hidden AND level <= $1 ORDER BY random() LIMIT $2',
        [$level, $count]
    );
    if (!is_array($rows)) return [];
    $out = [];
    foreach ($rows as $q) {
        $opts = [(string)$q['answer1'], (string)$q['answer2'], (string)$q['answer3'], (string)$q['answer4']];
        $right = (int)$q['correct'];
        $first = $opts[$right];
        unset($opts[$right]);
        [$shuffled, $answer] = net_shuffle_opts(array_merge([$first], array_values($opts)));
        $out[] = [
            'type' => 'theory', 'mode' => 'options', 'text' => (string)$q['question'],
            'data' => ['chips' => [], 'qid' => (int)$q['id']],
            'options' => $shuffled, 'answer' => $answer,
            'explain' => (string)$q['explanation'], 'calc' => null,
        ];
    }
    return $out;
}

// ============================================================
//  ПАРТИЯ
// ============================================================

/** Собрать партию уровня: задания в случайном порядке, первое — «свой или чужой». */
function network_build_tasks(int $level): array {
    $cfg = NET_LEVELS[$level];
    $plan = $cfg['plan'];
    $theory = network_theory_pick($level, $plan['theory'] ?? 0);
    // Если теории в базе не хватило — добираем генерируемыми заданиями
    $missing = ($plan['theory'] ?? 0) - count($theory);
    unset($plan['theory']);
    if ($missing > 0) $plan['mask'] = ($plan['mask'] ?? 0) + $missing;

    $tasks = $theory;
    foreach ($plan as $type => $n) {
        for ($i = 0; $i < $n; $i++) $tasks[] = network_generate($type, $level);
    }
    shuffle($tasks);
    // Первым — знакомое задание с картой, если оно есть
    foreach ($tasks as $k => $t) {
        if ($t['type'] === 'same_subnet') { array_unshift($tasks, $t); unset($tasks[$k + 1]); break; }
    }
    return array_values($tasks);
}

function network_generate(string $type, int $level): array {
    switch ($type) {
        case 'same_subnet': return net_gen_same_subnet($level);
        case 'net_addr':    return net_gen_net_addr($level, false);
        case 'broadcast':   return net_gen_net_addr($level, true);
        case 'hosts':       return net_gen_hosts($level);
        case 'mask':        return net_gen_mask($level);
        case 'gateway':     return net_gen_gateway($level);
        case 'private':     return net_gen_private($level);
        case 'fault':       return net_gen_fault($level);
        case 'route':       return net_gen_route($level);
    }
    throw new InvalidArgumentException('Unknown task type ' . $type);
}

function network_time_limit(array $task, int $level): int {
    return NET_LEVELS[$level]['time'];
}

/** Бонус за серию: 0 / +5 / +10 / +15. */
function network_combo_bonus(int $streak): int {
    $n = 0;
    foreach (NET_COMBO_AT as $at) if ($streak >= $at) $n++;
    return $n * NET_COMBO_STEP;
}

/** То, что можно показать браузеру: задание без ответа и пояснения. */
function network_public_task(array $t, int $index, int $total, int $level): array {
    return [
        'index'   => $index,
        'total'   => $total,
        'type'    => $t['type'],
        'label'   => NET_TYPE_LABELS[$t['type']] ?? '',
        'mode'    => $t['mode'],
        'text'    => $t['text'],
        'data'    => $t['data'],
        'options' => $t['options'],
        'calc'    => $t['calc'],
        'time'    => network_time_limit($t, $level),
    ];
}

function network_public_state(array $g): array {
    return [
        'score'    => (int)$g['score'],
        'lives'    => (int)$g['lives'],
        'streak'   => (int)$g['streak'],
        'combo'    => network_combo_bonus((int)$g['streak']),
        'finished' => !empty($g['finished']),
        'won'      => !empty($g['won']),
        'bonus'    => (int)($g['bonus'] ?? 0),
    ];
}

/** Ран из api/ping-game.php: проверка подписи. Возвращает ран или текст ошибки. */
function network_load_run(string $runId, string $runToken) {
    if ($runId === '' || $runToken === '') return 'Нет run_id/run_token';
    $run = $_SESSION['game_runs'][$runId] ?? null;
    if (!is_array($run) || ($run['game_id'] ?? '') !== NET_GAME_ID) return 'Неизвестная партия';
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $startedAt = (int)($run['started_at'] ?? 0);
    if ($startedAt <= 0 || !gc_verify_run_token($userId, $runId, NET_GAME_ID, $startedAt, $runToken)) {
        return 'Неверная подпись партии';
    }
    if (!empty($run['used'])) return 'Партия уже завершена';
    return $run;
}
