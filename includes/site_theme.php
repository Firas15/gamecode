<?php
/**
 * Тема оформления сайта: переключается в админке (admin/settings.php),
 * хранится в таблице site_settings, браузер узнаёт её через api/theme.php.
 * Что меняет каждая тема — js/theme.js и css/theme-newyear.css.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/redis.php';

const GC_THEMES = [
    'original' => 'Оригинальная',
    'newyear'  => 'Новогодняя',
];
const GC_THEME_CACHE_KEY = 'gamecode:site:theme';

function gc_site_theme(): string {
    $cached = cache_get(GC_THEME_CACHE_KEY);
    if (is_array($cached) && isset(GC_THEMES[$cached['theme'] ?? ''])) {
        return $cached['theme'];
    }
    $rows = gamecode_pg_query_all("SELECT value FROM site_settings WHERE key = 'theme'", []);
    $theme = (string)($rows[0]['value'] ?? 'original');
    if (!isset(GC_THEMES[$theme])) $theme = 'original';
    cache_set(GC_THEME_CACHE_KEY, ['theme' => $theme], 300);
    return $theme;
}

function gc_set_site_theme(string $theme): bool {
    if (!isset(GC_THEMES[$theme])) return false;
    $ok = gamecode_pg_exec(
        "INSERT INTO site_settings (key, value, updated_at) VALUES ('theme', $1, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
        [$theme]
    );
    cache_delete(GC_THEME_CACHE_KEY);
    return (bool)$ok;
}
