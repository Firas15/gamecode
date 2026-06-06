<?php
/**
 * GET /api/get-question.php?nickname=...
 * Возвращает секретный вопрос пользователя (без ответа).
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';

$nickname = trim($_GET['nickname'] ?? '');
if (!$nickname) {
    echo json_encode(['error' => 'Укажите никнейм']);
    exit;
}

$user = findUserByNick($nickname);
if (!$user) {
    
    echo json_encode(['error' => 'Пользователь не найден']);
    exit;
}

if (empty($user['secret_question'])) {
    echo json_encode(['error' => 'У этого аккаунта нет секретного вопроса. Обратитесь к администратору.']);
    exit;
}

echo json_encode(['ok' => true, 'question' => $user['secret_question']]);
