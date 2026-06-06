<?php
/**
 * GAME CODE — Auth Functions
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/assets.php';

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function isLoggedIn(): bool {
    return isset($_SESSION['user_id']);
}

function getCurrentUser(): ?array {
    if (!isLoggedIn()) return null;
    return findUserById((int)$_SESSION['user_id']);
}

function registerUser(string $nickname, string $password, string $confirm, string $secretQuestion = '', string $secretAnswer = ''): array {
    $nickname = trim($nickname);

    if (strlen($nickname) < 3 || strlen($nickname) > 24)
        return ['error' => 'Никнейм: от 3 до 24 символов'];
    if (!preg_match('/^[a-zA-Z0-9_\-а-яёА-ЯЁ]+$/u', $nickname))
        return ['error' => 'Никнейм: только буквы, цифры, _ и -'];
    if (strlen($password) < 6)
        return ['error' => 'Пароль: минимум 6 символов'];
    if ($password !== $confirm)
        return ['error' => 'Пароли не совпадают'];
    if (empty(trim($secretQuestion)))
        return ['error' => 'Выберите секретный вопрос'];
    if (strlen(trim($secretAnswer)) < 2)
        return ['error' => 'Ответ на вопрос: минимум 2 символа'];
    if (findUserByNick($nickname))
        return ['error' => 'Этот никнейм уже занят'];

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $user = createUser($nickname, $hash, trim($secretQuestion), trim($secretAnswer));

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['nickname'] = $user['nickname'];
    return ['ok' => true];
}

function resetPassword(string $nickname, string $secretAnswer, string $newPassword, string $confirmPassword): array {
    $nickname = trim($nickname);

    if (strlen($newPassword) < 6)
        return ['error' => 'Новый пароль: минимум 6 символов'];
    if ($newPassword !== $confirmPassword)
        return ['error' => 'Пароли не совпадают'];

    $user = findUserByNick($nickname);
    if (!$user)
        return ['error' => 'Пользователь не найден'];
    if (empty($user['secret_question']) || (empty($user['secret_answer_hash']) && empty($user['secret_answer'])))
        return ['error' => 'У этого аккаунта не задан секретный вопрос. Обратитесь к администратору.'];
    if (!gamecode_secret_answer_matches($user, $secretAnswer))
        return ['error' => 'Неверный ответ на секретный вопрос'];

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    updateUser($user['id'], ['password_hash' => $newHash]);
    return ['ok' => true, 'question' => $user['secret_question']];
}

function loginUser(string $nickname, string $password): array {
    $nickname = trim($nickname);
    $user = findUserByNick($nickname);

    if (!$user || !password_verify($password, $user['password_hash']))
        return ['error' => 'Неверный никнейм или пароль'];
    if (!empty($user['banned']))
        return ['error' => 'Account banned'];

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['nickname'] = $user['nickname'];
    return ['ok' => true];
}

function logoutUser(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600,
            $p['path'], $p['domain'], $p['secure'] ?? false, $p['httponly'] ?? true);
    }
    session_destroy();
}

function updateProfile(int $userId, array $data): array {
    $allowed = ['bio', 'favorite_lang', 'favorite_game', 'avatar_emoji'];
    $fields = [];
    foreach ($allowed as $key) {
        if (isset($data[$key])) {
            $fields[$key] = substr(trim($data[$key]), 0, 300);
        }
    }
    if (empty($fields)) return ['error' => 'Нечего обновлять'];
    updateUser($userId, $fields);
    return ['ok' => true];
}
