<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';

function formatNewsDate(string $raw): string {
    $timestamp = strtotime($raw);
    if ($timestamp === false) {
        return date('d.m.Y');
    }
    return date('d.m.Y', $timestamp);
}

$newsRows = cached_read_news();
$news = [];

foreach (array_slice($newsRows, 0, 3) as $item) {
    if (!is_array($item)) {
        continue;
    }

    $id = trim((string)($item['id'] ?? ''));
    $title = trim((string)($item['title'] ?? ''));
    if ($id === '' || $title === '') {
        continue;
    }

    $news[] = [
        'id' => $id,
        'title' => $title,
        'description' => trim((string)($item['description'] ?? '')),
        'image' => trim((string)($item['image'] ?? '')),
        'layout' => trim((string)($item['layout'] ?? 'left')) === 'right' ? 'right' : 'left',
        'date' => formatNewsDate((string)($item['created_at'] ?? '')),
    ];
}

echo json_encode([
    'ok' => true,
    'news' => $news,
], JSON_UNESCAPED_UNICODE);
