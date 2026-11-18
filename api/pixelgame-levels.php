<?php
/**
 * Список уровней CodeQuest для меню игры
 * GET /api/pixelgame-levels.php → { levels: [{ level: 1, title: "Level 1: ..." }, ...] }
 *
 * Только номер и название — без карт и вопросов. Источник тот же, что у
 * редактора в админке (PostgreSQL → Redis-кэш, фолбэк на JSON-файлы),
 * поэтому уровень, добавленный в админке, сразу появляется в игре.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';

echo json_encode(['levels' => cached_read_pixelgame_level_list()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
