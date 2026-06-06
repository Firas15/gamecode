<?php
/**
 * JSON-вход: форма не перезагружает страницу — пароль остаётся в полях при ошибке.
 */
require_once dirname(__DIR__) . '/includes/auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не поддерживается']);
    exit;
}

$nick = $_POST['nickname'] ?? '';
$pass = $_POST['password'] ?? '';
$result = loginUser($nick, $pass);

if (isset($result['ok'])) {
    $redirect = $_POST['redirect'] ?? '../index.html';
    if (!is_string($redirect) || $redirect === '' || preg_match('#^https?://#i', $redirect)) {
        $redirect = '../index.html';
    }
    echo json_encode(['ok' => true, 'redirect' => $redirect]);
    exit;
}

echo json_encode(['error' => $result['error']]);
