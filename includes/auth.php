<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/assets.php';
require_once __DIR__ . '/shop.php';
require_once __DIR__ . '/rate_limit.php';

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


/**
 * Переносит отложенный результат гостя на аккаунт.
 *
 * Очки посчитаны и проверены сервером в score.php ещё до регистрации —
 * здесь они только привязываются к пользователю. Клиент в этой цепочке
 * не участвует, подделать сумму нельзя.
 *
 * Вызывается сразу после успешного входа и регистрации.
 */
function gc_attach_pending_score(int $userId): void {
    $pending = $_SESSION['pending_score'] ?? null;
    unset($_SESSION['pending_score']);

    if (!is_array($pending) || $userId <= 0) {
        return;
    }

    $gameId = (string)($pending['game_id'] ?? '');
    $score  = (int)($pending['score'] ?? 0);
    $meta   = is_array($pending['meta'] ?? null) ? $pending['meta'] : [];
    $age    = time() - (int)($pending['created_at'] ?? 0);

    // Протухшие результаты не переносим: сессия живёт сутки,
    // но результат недельной давности присвоить новому аккаунту странно.
    if ($gameId === '' || $score <= 0 || $age > 86400) {
        return;
    }

    $meta['from_guest'] = true;
    $meta['coins'] = gc_shop_coins_for_score($score);

    if (!addScore($userId, $gameId, $score, $meta)) {
        return;
    }

    cache_invalidate_leaderboard($gameId);

    // Монеты за перенесённый результат: игра сыграна, значит и валюта
    // магазина за неё положена — иначе гость, зарегистрировавшийся
    // ради сохранения очков, получил бы очки без монет.
    gc_shop_award_coins($userId, $score);

    $user = findUserById($userId);
    if ($user) {
        updateUser($userId, [
            'games_played' => (int)($user['games_played'] ?? 0) + 1,
            'best_score'   => (int)($user['best_score'] ?? 0) + $score,
        ]);
        cache_invalidate_user($userId, (string)($user['nickname'] ?? ''));
    }
}

function registerUser(string $nickname, string $password, string $confirm, string $secretQuestion = '', string $secretAnswer = ''): array {
    $nickname = trim($nickname);

    // Не больше 10 новых аккаунтов в час с одного IP (каждый получает
    // приветственные монеты — без лимита их можно было бы фармить)
    $ip = gc_client_ip();
    if (gc_rl_blocked('reg_ip', $ip, 10))
        return ['error' => gc_rl_message(gc_rl_wait('reg_ip', $ip))];

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
    gc_rl_hit('reg_ip', $ip, 3600);

    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['nickname'] = $user['nickname'];
    gc_shop_grant_welcome((int)$user['id']);
    gc_attach_pending_score((int)$user['id']);
    return ['ok' => true];
}

function resetPassword(string $nickname, string $secretAnswer, string $newPassword, string $confirmPassword): array {
    $nickname = trim($nickname);

    // Ответ на секретный вопрос подобрать проще пароля, поэтому лимит строже:
    // 5 неверных ответов в час на аккаунт и 10 в час с одного IP.
    $ip = gc_client_ip();
    foreach ([['reset_ip', $ip, 10], ['reset_nick', $nickname, 5]] as [$b, $subj, $lim]) {
        if (gc_rl_blocked($b, $subj, $lim)) return ['error' => gc_rl_message(gc_rl_wait($b, $subj))];
    }

    if (strlen($newPassword) < 6)
        return ['error' => 'Новый пароль: минимум 6 символов'];
    if ($newPassword !== $confirmPassword)
        return ['error' => 'Пароли не совпадают'];

    $user = findUserByNick($nickname);
    if (!$user)
        return ['error' => 'Пользователь не найден'];
    if (empty($user['secret_question']) || (empty($user['secret_answer_hash']) && empty($user['secret_answer'])))
        return ['error' => 'У этого аккаунта не задан секретный вопрос. Обратитесь к администратору.'];
    if (!gamecode_secret_answer_matches($user, $secretAnswer)) {
        gc_rl_hit('reset_ip', $ip, 3600);
        gc_rl_hit('reset_nick', $nickname, 3600);
        return ['error' => 'Неверный ответ на секретный вопрос'];
    }
    gc_rl_clear('reset_nick', $nickname);

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    updateUser($user['id'], ['password_hash' => $newHash]);
    return ['ok' => true, 'question' => $user['secret_question']];
}

function loginUser(string $nickname, string $password): array {
    $nickname = trim($nickname);

    // Подбор пароля: 10 неверных попыток за 15 минут на аккаунт
    // и 20 с одного IP. Удачный вход обнуляет счётчик аккаунта.
    $ip = gc_client_ip();
    foreach ([['login_ip', $ip, 20], ['login_nick', $nickname, 10]] as [$b, $subj, $lim]) {
        if (gc_rl_blocked($b, $subj, $lim)) return ['error' => gc_rl_message(gc_rl_wait($b, $subj))];
    }

    $user = findUserByNick($nickname);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        gc_rl_hit('login_ip', $ip, 900);
        gc_rl_hit('login_nick', $nickname, 900);
        return ['error' => 'Неверный никнейм или пароль'];
    }
    if (!empty($user['banned']))
        return ['error' => 'Account banned'];

    gc_rl_clear('login_nick', $nickname);
    // Новый идентификатор сессии на вход — защита от подмены сессии
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['nickname'] = $user['nickname'];
    gc_attach_pending_score((int)$user['id']);
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

    // Аватар приходит из формы, а форма — из браузера: без этой проверки
    // платный аватар надевался бы подменённым полем, минуя магазин.
    // Ищем предмет по имени файла, потому что в avatar_emoji лежит
    // именно файл, а не id товара.
    if (isset($fields['avatar_emoji'])) {
        $wanted = $fields['avatar_emoji'];
        $itemId = null;
        foreach (gc_shop_by_kind('avatar') as $item) {
            if ((string)($item['file'] ?? '') === $wanted) {
                $itemId = $item['id'];
                break;
            }
        }
        if ($itemId === null || !gc_shop_owns($userId, $itemId)) {
            return ['error' => 'Этот аватар ещё не куплен'];
        }
    }

    if (empty($fields)) return ['error' => 'Нечего обновлять'];
    updateUser($userId, $fields);

    // Тот же кэш, что и в магазине: аватар из формы профиля точно так же
    // попадает в строки лидерборда. Заодно сбрасываем кэш самого
    // пользователя — из него шапка берёт ник и картинку.
    if (isset($fields['avatar_emoji'])) {
        cache_invalidate_leaderboards_all();
    }
    $u = findUserById($userId);
    cache_invalidate_user($userId, (string)($u['nickname'] ?? ''));

    return ['ok' => true];
}
