<?php
require_once dirname(__DIR__) . '/includes/auth.php';
logoutUser();
$ref = $_SERVER['HTTP_REFERER'] ?? '../index.html';
header('Location: ' . $ref);
exit;
