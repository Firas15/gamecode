<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/auth.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function ai_chat_error(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function ai_strlen(string $text): int {
    if (function_exists('mb_strlen')) {
        return mb_strlen($text);
    }
    return strlen($text);
}

function ai_strtolower(string $text): string {
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($text, 'UTF-8');
    }
    return strtolower($text);
}

function ai_substr(string $text, int $start, int $length): string {
    if (function_exists('mb_substr')) {
        return (string)mb_substr($text, $start, $length);
    }
    return substr($text, $start, $length);
}

function ai_normalize(string $text): string {
    $text = ai_strtolower(trim($text));
    $text = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $text) ?? $text;
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    return trim($text);
}

function ai_tokenize(string $text): array {
    $normalized = ai_normalize($text);
    if ($normalized === '') {
        return [];
    }
    return array_values(array_filter(explode(' ', $normalized), static fn(string $part): bool => $part !== ''));
}

function ai_load_faq_map(): array {
    $items = cached_load_faq();
    $faqMap = [];

    foreach ($items as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $question = trim((string)($entry['question'] ?? ''));
        $answer = trim((string)($entry['answer'] ?? ''));
        $keywords = $entry['keywords'] ?? [];
        if ($answer === '' || !is_array($keywords)) {
            continue;
        }

        $normalizedKeywords = [];
        foreach ($keywords as $word) {
            $w = ai_normalize((string)$word);
            if ($w !== '') {
                $normalizedKeywords[] = $w;
            }
        }

        $faqMap[] = [
            'question' => $question,
            'question_norm' => ai_normalize($question),
            'answer' => $answer,
            'keywords' => array_values(array_unique($normalizedKeywords)),
        ];
    }

    return $faqMap;
}

function ai_pick_reply(string $message, array $faqMap): string {
    $tokens = ai_tokenize($message);
    $normalizedText = ai_normalize($message);

    $bestScore = 0;
    $bestAnswer = '';

    foreach ($faqMap as $entry) {
        $score = 0;
        $questionNorm = (string)($entry['question_norm'] ?? '');
        if ($questionNorm !== '' && $questionNorm === $normalizedText) {
            $score += 10;
        } elseif ($questionNorm !== '' && str_contains($normalizedText, $questionNorm)) {
            $score += 5;
        }

        foreach ($entry['keywords'] as $keyword) {
            if ($keyword === '') {
                continue;
            }

            if (str_contains($normalizedText, $keyword)) {
                $score += 2;
                continue;
            }

            foreach ($tokens as $token) {
                if ($token === $keyword) {
                    $score += 2;
                } elseif (str_starts_with($token, $keyword) || str_starts_with($keyword, $token)) {
                    $score += 1;
                }
            }
        }

        if ($score > $bestScore) {
            $bestScore = $score;
            $bestAnswer = (string)$entry['answer'];
        }
    }

    if ($bestScore > 0 && $bestAnswer !== '') {
        return $bestAnswer;
    }

    return 'Пока не нашел точный ответ на этот вопрос. Выбери одну из быстрых кнопок или уточни запрос: про сайт, демо, поддержку, игры, теорию, рейтинг или профиль.';
}

$lastAt = (int)($_SESSION['ai_chat_last_at'] ?? 0);
$now = time();
if ($lastAt > 0 && ($now - $lastAt) < 2) {
    ai_chat_error(429, 'Слишком часто. Подожди пару секунд.');
}
$_SESSION['ai_chat_last_at'] = $now;

$rawInput = (string)file_get_contents('php://input');
$payload = json_decode($rawInput, true);
if (!is_array($payload)) {
    ai_chat_error(400, 'Неверный JSON');
}

$message = trim((string)($payload['message'] ?? ''));
if ($message === '') {
    ai_chat_error(400, 'Сообщение пустое');
}
if (ai_strlen($message) > 500) {
    ai_chat_error(400, 'Сообщение слишком длинное');
}

$sessionHistory = $_SESSION['ai_chat_history'] ?? [];
if (!is_array($sessionHistory)) {
    $sessionHistory = [];
}

$history = array_values(array_filter($sessionHistory, static function ($item): bool {
    return is_array($item)
        && isset($item['role'], $item['content'])
        && in_array($item['role'], ['user', 'assistant'], true)
        && is_string($item['content']);
}));

$faqMap = ai_load_faq_map();
if (count($faqMap) === 0) {
    ai_chat_error(500, 'FAQ база не настроена. Проверь таблицы chat_faq и chat_faq_keywords.');
}

$reply = ai_pick_reply($message, $faqMap);

$history[] = ['role' => 'user', 'content' => $message];
$history[] = ['role' => 'assistant', 'content' => ai_substr($reply, 0, 800)];
if (count($history) > 20) {
    $history = array_slice($history, -20);
}
$_SESSION['ai_chat_history'] = $history;

echo json_encode([
    'ok' => true,
    'reply' => $reply,
], JSON_UNESCAPED_UNICODE);
