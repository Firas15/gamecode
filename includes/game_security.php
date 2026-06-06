<?php
declare(strict_types=1);

/**
 * GAME CODE — Minimal server-side anti-tamper helpers
 *
 * - Generates/stores an application secret locally (data/app_secret.key)
 * - Signs/verifies per-run tokens to prevent trivial replay/tampering
 */

function gc_get_app_secret(): string {
    $path = dirname(__DIR__) . '/data/app_secret.key';
    $dir  = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    if (is_file($path)) {
        $raw = (string)@file_get_contents($path);
        $raw = trim($raw);
        if ($raw !== '') return $raw;
    }

    $secret = bin2hex(random_bytes(32)); // 64 hex chars
    @file_put_contents($path, $secret, LOCK_EX);
    return $secret;
}

function gc_hmac(string $data): string {
    $secret = gc_get_app_secret();
    return hash_hmac('sha256', $data, $secret);
}

function gc_sign_run_token(int $userId, string $runId, string $gameId, int $startedAtUnix): string {
    return gc_hmac($userId . '|' . $runId . '|' . $gameId . '|' . $startedAtUnix);
}

function gc_verify_run_token(int $userId, string $runId, string $gameId, int $startedAtUnix, string $token): bool {
    $expected = gc_sign_run_token($userId, $runId, $gameId, $startedAtUnix);
    return hash_equals($expected, $token);
}

