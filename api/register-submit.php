<?php

require_once dirname(__DIR__) . '/includes/auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не поддерживается']);
    exit;
}

$nick     = $_POST['nickname'] ?? '';
$pass     = $_POST['password'] ?? '';
$confirm  = $_POST['confirm'] ?? '';
$question = $_POST['secret_question'] ?? '';
$answer   = $_POST['secret_answer'] ?? '';

$result = registerUser($nick, $pass, $confirm, $question, $answer);

if (isset($result['ok'])) {
    echo json_encode(['ok' => true, 'redirect' => 'profile.php?new=1']);
    exit;
}

echo json_encode(['error' => $result['error']]);
