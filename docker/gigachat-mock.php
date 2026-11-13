<?php
/**
 * Поддельный GigaChat для локальной проверки чат-бота (на прод не нужен).
 *
 *   docker compose exec -d web php -S 127.0.0.1:9999 /var/www/html/docker/gigachat-mock.php
 *   и в .env:  GIGACHAT_AUTH_KEY=test
 *              GIGACHAT_OAUTH_URL=http://127.0.0.1:9999/oauth
 *              GIGACHAT_API_URL=http://127.0.0.1:9999/chat
 *
 * Отвечает эхом. Слова в вопросе меняют поведение:
 *   «мок-бан» — finish_reason=blacklist, «мок-429» — всегда 429,
 *   «мок-500» — ошибка сервера, «мок-401» — первый запрос 401.
 * Последний запрос к /chat сохраняется в /tmp/gigachat-mock-last.json.
 */
header('Content-Type: application/json');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if ($path === '/oauth') {
    if ($auth !== 'Basic test' || empty($_SERVER['HTTP_RQUID'])) {
        http_response_code(401);
        echo '{"code":6,"message":"credentials doesn\'t match db data"}';
        exit;
    }
    @file_put_contents('/tmp/gigachat-mock-oauth', (string)((int)@file_get_contents('/tmp/gigachat-mock-oauth') + 1));
    echo json_encode(['access_token' => 'tok' . bin2hex(random_bytes(4)), 'expires_at' => (time() + 1800) * 1000]);
    exit;
}

if ($path === '/chat') {
    $body = (string)file_get_contents('php://input');
    file_put_contents('/tmp/gigachat-mock-last.json', json_encode([
        'auth' => $auth, 'body' => json_decode($body, true),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    $req = json_decode($body, true);
    $last = (string)end($req['messages'])['content'];

    if (!str_starts_with($auth, 'Bearer tok')) { http_response_code(401); exit; }
    if (str_contains($last, 'мок-401') && !file_exists('/tmp/gigachat-mock-401')) {
        touch('/tmp/gigachat-mock-401');
        http_response_code(401);
        exit;
    }
    if (str_contains($last, 'мок-429')) { http_response_code(429); echo '{"status":429}'; exit; }
    if (str_contains($last, 'мок-500')) { http_response_code(500); exit; }
    if (str_contains($last, 'мок-медленно')) sleep(4);

    $ban = str_contains($last, 'мок-бан');
    echo json_encode([
        'choices' => [[
            'message' => ['role' => 'assistant', 'content' => $ban ? 'Не люблю менять тему.' : "**Это тестовый ответ** локальной копии — на сайте здесь ответит нейросеть. Ты спросил: «{$last}».\n\nВот так выглядит код в ответе. Цикл `while` повторяет действия, пока условие истинно:\n\n```python\ni = 0\nwhile i < 3:\n    print(i)  # выводим число\n    i += 1\n```\n\nВыведет 0, 1, 2."],
            'index' => 0,
            'finish_reason' => $ban ? 'blacklist' : 'stop',
        ]],
        'model' => $req['model'] ?? '', 'object' => 'chat.completion',
        'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1, 'total_tokens' => 2],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
http_response_code(404);
