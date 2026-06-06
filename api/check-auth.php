<?php
require_once dirname(__DIR__) . '/includes/auth.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');

if (isLoggedIn()) {
    $u = getCurrentUser();
    echo json_encode([
        'loggedIn'     => true,
        'nickname'     => $u['nickname'] ?? '',
        'avatarEmoji'  => $u['avatar_emoji'] ?? '👾',
        'gamesPlayed'  => (int)($u['games_played'] ?? 0),
        'bestScore'    => (int)($u['best_score'] ?? 0),
        'banned'       => !empty($u['banned']),
    ]);
} else {
    echo json_encode(['loggedIn' => false]);
}
