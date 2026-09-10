<?php
/**
 * ============================================================
 *  АДМИНКА: ПАРАМЕТРЫ СЕССИИ И ЗАЩИТА ФОРМ ОТ CSRF
 *
 *  Почему отдельный файл, а не config.php.
 *
 *  config.php лежит в .gitignore — в нём логин и пароль админки,
 *  и на сервере он свой. Когда эти функции жили там, страницы
 *  админки уехали на прод, а функции, которые они вызывают, —
 *  нет: на сервере остался config.php месячной давности, и вся
 *  админка легла с «Call to undefined function admin_csrf_field».
 *
 *  Отсюда правило: в config.php — только настройки и секреты,
 *  любой код — в файлах, которые ездят вместе с остальным
 *  проектом. Этот файл подключается сразу после config.php на
 *  каждой странице админки.
 *
 *  Все объявления обёрнуты в function_exists: на сервере может
 *  оказаться старый config.php, который эти же функции ещё
 *  определяет сам. Тогда мы просто уступаем ему и не падаем
 *  с «cannot redeclare».
 * ============================================================
 */

// ПАРАМЕТРЫ КУКИ СЕССИИ — те же, что у сайта (includes/auth.php).
//
// Без HttpOnly куку админки читает любой JavaScript на странице,
// без SameSite браузер по своей прихоти отправляет её вместе с
// запросом с чужого сайта. Ставим до первого session_start:
// config.php только объявляет функции, сессию никто ещё не начал.
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/* ============================================================
   ЗАЩИТА ФОРМ АДМИНКИ ОТ ЗАПРОСОВ С ЧУЖИХ САЙТОВ (CSRF)

   Одного «залогинен как админ» мало: браузер отправит куку и с
   чужой страницы, и тогда невидимая форма на постороннем сайте
   могла бы начислить коины, забанить или удалить пользователя.
   Токен лежит в сессии, приходит вместе с формой и сверяется на
   каждый POST — подсмотреть его с другого домена нельзя.
   ============================================================ */

if (!function_exists('admin_csrf_token')) {
    function admin_csrf_token(): string {
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (empty($_SESSION['gc_admin_csrf'])) {
            $_SESSION['gc_admin_csrf'] = bin2hex(random_bytes(32));
        }
        return (string)$_SESSION['gc_admin_csrf'];
    }
}

/** Скрытое поле для вставки в любую форму админки. */
if (!function_exists('admin_csrf_field')) {
    function admin_csrf_field(): string {
        return '<input type="hidden" name="csrf" value="'
            . htmlspecialchars(admin_csrf_token(), ENT_QUOTES, 'UTF-8') . '"/>';
    }
}

if (!function_exists('admin_csrf_valid')) {
    function admin_csrf_valid($token): bool {
        if (session_status() === PHP_SESSION_NONE) session_start();
        $expected = (string)($_SESSION['gc_admin_csrf'] ?? '');
        return $expected !== '' && is_string($token) && hash_equals($expected, $token);
    }
}

/**
 * Вызывать в начале обработки POST. Токен ищем в поле формы, а для
 * запросов из JavaScript — ещё и в заголовке X-CSRF-Token: там тело
 * уходит как JSON, и скрытому полю взяться неоткуда.
 */
if (!function_exists('admin_csrf_check')) {
    function admin_csrf_check(bool $json = false): void {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') return;

        $token = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null);
        if (admin_csrf_valid($token)) return;

        http_response_code(403);
        if ($json) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'Устаревшая форма. Обновите страницу и повторите.'],
                             JSON_UNESCAPED_UNICODE);
            exit;
        }
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><meta charset="utf-8">'
           . '<div style="font-family:monospace;padding:24px;line-height:1.7">'
           . '<b>Действие отклонено.</b><br>'
           . 'Форма устарела или запрос пришёл не из админки.<br>'
           . 'Вернитесь назад, обновите страницу и повторите.<br><br>'
           . '<a href="javascript:history.back()">← Назад</a></div>';
        exit;
    }
}
