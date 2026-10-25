<?php
/**
 * Ограничение числа попыток (вход, сброс пароля, регистрация, админка).
 *
 * Счётчики живут в Redis: ключ gamecode:rl:{корзина}:{хеш}, TTL = окно.
 * Считаются только НЕУДАЧНЫЕ попытки входа/сброса (gc_rl_hit после ошибки),
 * удачная попытка обнуляет счётчик (gc_rl_clear). Регистрация считается
 * целиком — каждая успешная.
 *
 * Если Redis недоступен, ограничение не действует (сайт не должен
 * ломаться из-за кэша) — в лог пишется предупреждение.
 *
 * IP клиента. Снаружи web доступен только через nginx (WEB_BIND=127.0.0.1),
 * поэтому REMOTE_ADDR — это адрес контейнера nginx. Настоящий адрес
 * nginx кладёт в X-Real-IP (docker/nginx/proxy.inc). Заголовку верим
 * ТОЛЬКО если запрос пришёл из частной сети (docker/localhost) —
 * иначе любой мог бы подставить себе чужой IP.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

function gc_client_ip(): string {
    $remote = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $fromProxy = $remote !== '' && filter_var(
        $remote,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) === false;

    if ($fromProxy) {
        $real = trim((string)($_SERVER['HTTP_X_REAL_IP'] ?? ''));
        if ($real !== '' && filter_var($real, FILTER_VALIDATE_IP)) {
            return $real;
        }
    }
    return $remote !== '' ? $remote : '0.0.0.0';
}

function gc_rl_key(string $bucket, string $subject): string {
    // Хеш, а не сам ник/IP: в ключе не будет произвольных символов
    return 'gamecode:rl:' . $bucket . ':' . substr(hash('sha256', mb_strtolower($subject)), 0, 32);
}

/** Исчерпан ли лимит: true — пора отказывать. */
function gc_rl_blocked(string $bucket, string $subject, int $limit): bool {
    $r = gamecode_redis();
    if (!$r) return false;
    try {
        return (int)$r->get(gc_rl_key($bucket, $subject)) >= $limit;
    } catch (\Throwable $e) {
        error_log('[GameCode RL] get failed: ' . $e->getMessage());
        return false;
    }
}

/** Засчитать попытку. Окно отсчитывается от первой попытки. */
function gc_rl_hit(string $bucket, string $subject, int $windowSec): void {
    $r = gamecode_redis();
    if (!$r) return;
    try {
        $key = gc_rl_key($bucket, $subject);
        $n = (int)$r->incr($key);
        if ($n === 1) $r->expire($key, $windowSec);
    } catch (\Throwable $e) {
        error_log('[GameCode RL] incr failed: ' . $e->getMessage());
    }
}

function gc_rl_clear(string $bucket, string $subject): void {
    $r = gamecode_redis();
    if (!$r) return;
    try {
        $r->del(gc_rl_key($bucket, $subject));
    } catch (\Throwable $e) {
        error_log('[GameCode RL] del failed: ' . $e->getMessage());
    }
}

/** Сколько секунд ещё ждать (для текста ошибки). */
function gc_rl_wait(string $bucket, string $subject): int {
    $r = gamecode_redis();
    if (!$r) return 0;
    try {
        return max(0, (int)$r->ttl(gc_rl_key($bucket, $subject)));
    } catch (\Throwable $e) {
        return 0;
    }
}

function gc_rl_message(int $wait): string {
    $min = max(1, (int)ceil($wait / 60));
    return 'Слишком много попыток. Попробуйте через ' . $min . ' мин.';
}
