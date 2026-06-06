<?php
declare(strict_types=1);

/**
 * Версионирование CSS/JS через ?v=filemtime — браузер подтягивает новый файл после правок.
 *
 * @param string $pathFromProjectRoot Путь от корня проекта, например css/style.css или admin/admin.css
 */
function asset_mtime(string $pathFromProjectRoot): int {
    $pathFromProjectRoot = str_replace('\\', '/', $pathFromProjectRoot);
    $pathFromProjectRoot = ltrim($pathFromProjectRoot, '/');
    $full = dirname(__DIR__) . '/' . $pathFromProjectRoot;
    return is_file($full) ? (int) filemtime($full) : time();
}

/**
 * Тот же URL, что в href/src, с добавленным query-параметром версии.
 *
 * @param string $href                Относительный URL в разметке (../css/style.css, admin.css)
 * @param string $pathFromProjectRoot Файл на диске от корня проекта для чтения mtime
 */
function asset_url(string $href, string $pathFromProjectRoot): string {
    $v = asset_mtime($pathFromProjectRoot);
    $sep = strpos($href, '?') !== false ? '&' : '?';
    return $href . $sep . 'v=' . $v;
}
