<?php
/**
 * Клиент GigaChat API (ПАО Сбербанк) для чат-бота сайта.
 *
 * Настройки — переменные окружения (docker-compose.yml → .env на сервере):
 *   GIGACHAT_AUTH_KEY  — «Ключ авторизации» из личного кабинета Studio
 *                        (Base64 от client_id:client_secret). Пусто — ИИ выключен,
 *                        бот отвечает только из FAQ, как раньше.
 *   GIGACHAT_SCOPE     — GIGACHAT_API_PERS (физлицо), GIGACHAT_API_B2B или _CORP.
 *   GIGACHAT_MODEL     — GigaChat-2 (самая дешёвая, Lite), GigaChat-2-Pro, GigaChat-2-Max.
 *                        Список: GET /v1/models. На api.giga.chat старого имени «GigaChat» нет.
 *   GIGACHAT_PARALLEL  — сколько запросов можно слать одновременно.
 *                        Физлицу Сбер разрешает один поток — значит 1.
 *   GIGACHAT_OAUTH_URL, GIGACHAT_API_URL — адреса; менять не нужно
 *                        (переопределяются только для локальной проверки).
 *
 * Ключ в коде и в git не хранится. Тексты сообщений в журнал не пишутся —
 * только коды ответов.
 *
 * Сертификаты: сервера Сбера подписаны корневым сертификатом Минцифры
 * (Russian Trusted Root CA). Dockerfile кладёт его в системное хранилище
 * (docker/certs), поэтому проверка TLS включена всегда.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/redis.php';

const GC_AI_DEFAULT_OAUTH = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const GC_AI_DEFAULT_API   = 'https://api.giga.chat/v1/chat/completions';

function gc_ai_env(string $name, string $default = ''): string {
    $v = trim((string)gamecode_env($name, $default));
    return $v === '' ? $default : $v;
}

/** Включён ли ИИ: есть ключ и не выключен вручную (AI_ENABLED=0). */
function gc_ai_enabled(): bool {
    return gc_ai_env('GIGACHAT_AUTH_KEY') !== '' && gc_ai_env('AI_ENABLED', '1') !== '0';
}

function gc_ai_uuid4(): string {
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

/**
 * HTTP-запрос через curl. Возвращает [код, тело]; код 0 — сеть/TLS.
 */
function gc_ai_http(string $url, array $headers, string $body, int $timeout): array {
    $ch = curl_init($url);
    $opts = [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ];
    $ca = gc_ai_env('GIGACHAT_CA_FILE');
    if ($ca !== '') {
        $opts[CURLOPT_CAINFO] = $ca;
    }
    curl_setopt_array($ch, $opts);
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($resp === false) {
        error_log('[GameCode AI] curl: ' . curl_error($ch));
        $code = 0;
        $resp = '';
    }
    curl_close($ch);
    return [$code, (string)$resp];
}

function gc_ai_token_key(): string {
    // В имени ключа — хеш ключа авторизации: сменили ключ — старый токен не используется
    return 'gamecode:gigachat:token:' . substr(hash('sha256', gc_ai_env('GIGACHAT_AUTH_KEY')), 0, 12);
}

/**
 * Токен доступа. Живёт 30 минут; держим его в Redis, чтобы не
 * получать новый на каждый вопрос.
 */
function gc_ai_token(bool $fresh = false): ?string {
    static $local = null;
    $r = gamecode_redis();
    $key = gc_ai_token_key();

    if (!$fresh) {
        if ($local !== null) return $local;
        if ($r) {
            try {
                $t = $r->get($key);
                if (is_string($t) && $t !== '') return $local = $t;
            } catch (\Throwable $e) {
            }
        }
    }

    [$code, $body] = gc_ai_http(
        gc_ai_env('GIGACHAT_OAUTH_URL', GC_AI_DEFAULT_OAUTH),
        [
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
            'RqUID: ' . gc_ai_uuid4(),
            'Authorization: Basic ' . gc_ai_env('GIGACHAT_AUTH_KEY'),
        ],
        http_build_query(['scope' => gc_ai_env('GIGACHAT_SCOPE', 'GIGACHAT_API_PERS')]),
        12
    );
    $j = json_decode($body, true);
    $token = is_array($j) ? (string)($j['access_token'] ?? '') : '';
    if ($code !== 200 || $token === '') {
        error_log('[GameCode AI] oauth HTTP ' . $code . ' — проверьте GIGACHAT_AUTH_KEY и GIGACHAT_SCOPE');
        return null;
    }

    // expires_at приходит в миллисекундах (а в части примеров — в секундах)
    $exp = (int)($j['expires_at'] ?? 0);
    if ($exp > 100000000000) $exp = intdiv($exp, 1000);
    $ttl = $exp > time() ? $exp - time() - 60 : 25 * 60;
    $ttl = max(60, min($ttl, 29 * 60));

    if ($r) {
        try {
            $r->setex($key, $ttl, $token);
        } catch (\Throwable $e) {
        }
    }
    return $local = $token;
}

/**
 * Очередь: не больше GIGACHAT_PARALLEL запросов одновременно со всего сайта
 * (у физлица Сбер пропускает один поток, лишние получают 429).
 * Возвращает ключ занятого места или '' (Redis нет — идём без очереди),
 * null — место не освободилось за $waitSec.
 */
function gc_ai_slot_take(float $waitSec): ?string {
    $r = gamecode_redis();
    if (!$r) return '';
    $slots = max(1, (int)gc_ai_env('GIGACHAT_PARALLEL', '1'));
    $deadline = microtime(true) + $waitSec;
    do {
        for ($i = 0; $i < $slots; $i++) {
            $key = 'gamecode:gigachat:slot:' . $i;
            try {
                // 100 с — на случай, если PHP упадёт и не освободит место
                if ($r->set($key, '1', ['nx', 'ex' => 100])) return $key;
            } catch (\Throwable $e) {
                return '';
            }
        }
        usleep(250000);
    } while (microtime(true) < $deadline);
    return null;
}

function gc_ai_slot_release(string $key): void {
    if ($key === '') return;
    $r = gamecode_redis();
    if (!$r) return;
    try {
        $r->del($key);
    } catch (\Throwable $e) {
    }
}

/**
 * Запрос к модели.
 *
 * @param array $messages [['role' => 'system'|'user'|'assistant', 'content' => '…'], …]
 * @return array ['ok' => true, 'text' => '…'] или
 *               ['ok' => false, 'reason' => 'off'|'busy'|'blocked'|'error']
 */
function gc_gigachat_chat(array $messages, int $maxTokens = 500): array {
    if (!gc_ai_enabled()) return ['ok' => false, 'reason' => 'off'];

    $slot = gc_ai_slot_take(12.0);
    if ($slot === null) return ['ok' => false, 'reason' => 'busy'];

    try {
        $payload = json_encode([
            'model'              => gc_ai_env('GIGACHAT_MODEL', 'GigaChat-2'),
            'messages'           => $messages,
            'stream'             => false,
            'max_tokens'         => $maxTokens,
            'repetition_penalty' => 1.0,
        ], JSON_UNESCAPED_UNICODE);

        $token = gc_ai_token();
        if ($token === null) return ['ok' => false, 'reason' => 'error'];

        $url = gc_ai_env('GIGACHAT_API_URL', GC_AI_DEFAULT_API);
        $code = 0;
        $body = '';
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            [$code, $body] = gc_ai_http($url, [
                'Content-Type: application/json',
                'Accept: application/json',
                'Authorization: Bearer ' . $token,
            ], (string)$payload, 30);

            if ($code === 401 && $attempt === 1) {
                // Токен истёк раньше срока — берём новый и пробуем ещё раз
                $token = gc_ai_token(true);
                if ($token === null) return ['ok' => false, 'reason' => 'error'];
                continue;
            }
            if ($code === 429 && $attempt < 3) {
                usleep(1500000);
                continue;
            }
            break;
        }

        if ($code === 429) return ['ok' => false, 'reason' => 'busy'];
        if ($code !== 200) {
            error_log('[GameCode AI] chat HTTP ' . $code);
            return ['ok' => false, 'reason' => 'error'];
        }

        $j = json_decode($body, true);
        $choice = is_array($j) ? ($j['choices'][0] ?? null) : null;
        $finish = is_array($choice) ? (string)($choice['finish_reason'] ?? '') : '';
        $text = is_array($choice) ? trim((string)($choice['message']['content'] ?? '')) : '';

        if ($finish === 'blacklist') return ['ok' => false, 'reason' => 'blocked'];
        if ($text === '') {
            error_log('[GameCode AI] пустой ответ, finish_reason=' . $finish);
            return ['ok' => false, 'reason' => 'error'];
        }
        return ['ok' => true, 'text' => $text, 'cut' => $finish === 'length'];
    } finally {
        gc_ai_slot_release($slot);
    }
}
