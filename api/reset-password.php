<?php
/**
 * POST /api/reset-password.php
 * Сбрасывает пароль пользователя по секретному вопросу.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Метод не поддерживается']);
    exit;
}

$nickname        = $_POST['nickname']         ?? '';
$secretAnswer    = $_POST['secret_answer']    ?? '';
$newPassword     = $_POST['new_password']     ?? '';
$confirmPassword = $_POST['confirm_password'] ?? '';

$result = resetPassword($nickname, $secretAnswer, $newPassword, $confirmPassword);
echo json_encode($result);
