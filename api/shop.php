<?php
/**
 * Shop API
 * POST /api/shop.php  {"action":"buy"|"equip","item_id":"frame_gold"}
 *
 * Клиент присылает только id предмета. Цена, право владения и
 * баланс берутся на сервере — подделать в запросе нечего.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Нужно войти в аккаунт'], JSON_UNESCAPED_UNICODE);
    exit;
}

$userId = (int)$_SESSION['user_id'];

$body   = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = $_POST;

$action = isset($body['action'])  ? trim((string)$body['action'])  : '';
$itemId = isset($body['item_id']) ? trim((string)$body['item_id']) : '';

if (!in_array($action, ['buy', 'equip'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
    exit;
}

$result = $action === 'buy'
    ? gc_shop_buy($userId, $itemId)
    : gc_shop_equip($userId, $itemId);

if (empty($result['ok'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $result['error'] ?? 'Не получилось'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Кэш пользователя держит ник и аватар — после смены аватара его надо сбросить,
// иначе в шапке и таблице лидеров ещё какое-то время будет старая картинка.
if ($action === 'equip' && ($result['item']['kind'] ?? '') === 'avatar') {
    cache_invalidate_user($userId, (string)($_SESSION['nickname'] ?? ''));
}

echo json_encode([
    'ok'       => true,
    'action'   => $action,
    'item_id'  => $itemId,
    'kind'     => $result['item']['kind'] ?? '',
    'coins'    => gc_shop_coins($userId),
    'equipped' => gc_shop_equipped($userId),
], JSON_UNESCAPED_UNICODE);
