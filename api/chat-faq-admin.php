<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/auth.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function faq_admin_error(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function faq_is_admin(): bool {
    if (!isLoggedIn()) {
        return false;
    }

    $user = getCurrentUser();
    if (!is_array($user)) {
        return false;
    }

    $nickname = strtolower(trim((string)($user['nickname'] ?? '')));
    $allowed = ['firas', 'llinajoo', 'admin'];
    return in_array($nickname, $allowed, true);
}

if (!faq_is_admin()) {
    faq_admin_error(403, 'Доступ только для администратора');
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(['ok' => true, 'items' => gamecode_chat_faq_load_items()], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    faq_admin_error(405, 'Метод не поддерживается');
}

$rawInput = (string)file_get_contents('php://input');
$payload = json_decode($rawInput, true);
if (!is_array($payload)) {
    faq_admin_error(400, 'Неверный JSON');
}

$items = $payload['items'] ?? null;
if (!is_array($items)) {
    faq_admin_error(400, 'items должен быть массивом');
}

$normalized = [];
foreach ($items as $entry) {
    if (!is_array($entry)) {
        continue;
    }

    $question = trim((string)($entry['question'] ?? ''));
    $answer = trim((string)($entry['answer'] ?? ''));
    $keywords = $entry['keywords'] ?? [];
    if (!is_array($keywords)) {
        $keywords = [];
    }

    $cleanKeywords = [];
    foreach ($keywords as $keyword) {
        $kw = trim((string)$keyword);
        if ($kw !== '') {
            $cleanKeywords[] = $kw;
        }
    }

    if ($question === '' || $answer === '' || count($cleanKeywords) === 0) {
        continue;
    }

    $normalized[] = [
        'question' => $question,
        'keywords' => array_values(array_unique($cleanKeywords)),
        'answer' => $answer,
    ];
}

if (!gamecode_chat_faq_save_items($normalized)) {
    faq_admin_error(500, 'Не удалось сохранить FAQ');
}

echo json_encode([
    'ok' => true,
    'saved_count' => count($normalized),
], JSON_UNESCAPED_UNICODE);
