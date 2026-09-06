<?php

require_once dirname(__DIR__) . '/includes/assets.php';
require_once dirname(__DIR__) . '/includes/db.php';

// ШАБЛОН. Скопируйте в admin/config.php — сам config.php в гит не попадает.
//
// Логин и пароль админки берутся из переменных окружения (.env -> docker compose).
// Фолбэков намеренно нет: пустой пароль ниже не даст войти, пока ADMIN_PASSWORD
// не задан в .env. Так забытая настройка оборачивается отказом во входе,
// а не открытой админкой со значением по умолчанию.
if (!defined('ADMIN_LOGIN')) define('ADMIN_LOGIN', gamecode_env('ADMIN_LOGIN', 'admin'));
if (!defined('ADMIN_PASSWORD')) define('ADMIN_PASSWORD', gamecode_env('ADMIN_PASSWORD', ''));
if (!defined('ADMIN_SESSION')) define('ADMIN_SESSION', 'gc_admin_auth');

if (!defined('NEWS_UPLOAD_DIR')) define('NEWS_UPLOAD_DIR', dirname(__DIR__) . '/img/news');
if (!defined('NEWS_UPLOAD_WEB')) define('NEWS_UPLOAD_WEB', 'img/news');

function adminIsLoggedIn(): bool {
    if (session_status() === PHP_SESSION_NONE) session_start();
    return !empty($_SESSION[ADMIN_SESSION]);
}

function requireAdmin(): void {
    if (!adminIsLoggedIn()) {
        header('Location: index.php');
        exit;
    }
}
