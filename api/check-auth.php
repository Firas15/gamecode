<?php
require_once dirname(__DIR__) . '/includes/auth.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');

if (isLoggedIn()) {
    $u = getCurrentUser();
    $uid = (int)($u['id'] ?? 0);
    $equipped = gc_shop_equipped($uid);
    echo json_encode([
        'loggedIn'     => true,
        'nickname'     => $u['nickname'] ?? '',
        'avatarEmoji'  => $u['avatar_emoji'] ?? '👾',
        'gamesPlayed'  => (int)($u['games_played'] ?? 0),
        'bestScore'    => (int)($u['best_score'] ?? 0),
        'banned'       => !empty($u['banned']),
        'coins'        => gc_shop_coins($uid),
        // Папка спрайтов надетого скина. Пустая строка — базовый персонаж.
        // Игры статические, поэтому узнать свой скин они могут только отсюда.
        'skinDir'      => gc_shop_skin_dir($equipped['skin']),
        'frameCss'     => gc_shop_frame_css($equipped['frame']),
        'titleText'    => gc_shop_title_text($equipped['title']),
    ], JSON_UNESCAPED_UNICODE);
} else {
    echo json_encode(['loggedIn' => false]);
}
