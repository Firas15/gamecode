<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$root = dirname(__DIR__);
$targets = [
    $root . '/index.html',
    $root . '/css',
    $root . '/js',
    $root . '/img',
    $root . '/pages',
    $root . '/games',
    $root . '/includes',
];

$latest = 0;

$touch = static function (string $path) use (&$latest): void {
    if (is_file($path)) {
        $latest = max($latest, (int) filemtime($path));
        return;
    }

    if (!is_dir($path)) {
        return;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $item) {
        if ($item->isFile()) {
            $latest = max($latest, (int) $item->getMTime());
        }
    }
};

foreach ($targets as $target) {
    $touch($target);
}

if ($latest <= 0) {
    $latest = time();
}

echo json_encode([
    'ok' => true,
    'version' => (string) $latest,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
