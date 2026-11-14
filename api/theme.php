<?php
/**
 * GET /api/theme.php → {"ok":true,"theme":"original"|"newyear"}
 * Тема меняется в админке (admin/settings.php). На сервере она лежит
 * в кэше Redis, а браузер запоминает её в localStorage (js/theme.js).
 */
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/site_theme.php';

header('Content-Type: application/json; charset=utf-8');

echo json_encode(['ok' => true, 'theme' => gc_site_theme()]);
