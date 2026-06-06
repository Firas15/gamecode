<?php
/**
 * GAME CODE — Games API
 * GET /api/games.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';

$games = cached_read_games();
$result = [];

foreach ($games as $item) {
    if (!is_array($item)) {
        continue;
    }

    $id = trim((string)($item['id'] ?? ''));
    $title = trim((string)($item['title'] ?? ''));
    if ($id === '' || $title === '') {
        continue;
    }

    $result[] = [
        'id' => $id,
        'title' => $title,
        'desc' => trim((string)($item['desc'] ?? $item['description'] ?? '')),
        'tags' => [],
        'stars' => max(0, min(5, (int)($item['stars'] ?? 0))),
        'link' => trim((string)($item['link'] ?? '#')),
        'preview' => '',
        'wip' => !empty($item['wip']),
    ];
}

echo json_encode([
    'ok' => true,
    'games' => $result,
], JSON_UNESCAPED_UNICODE);
