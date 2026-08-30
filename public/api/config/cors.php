<?php
/**
 * File: config/cors.php
 * Mengizinkan semua domain untuk akses API & Output Buffer Safety
 */

if (ob_get_level() == 0) {
    ob_start();
}
error_reporting(0);
ini_set('display_errors', '0');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Auth-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(200);
    exit(0);
}

header('Content-Type: application/json; charset=utf-8');

if (!function_exists('sendResponse')) {
    function sendResponse($status, $message, $data = null, $code = 200) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status'    => $status,
            'success'   => ($status === 'success'),
            'message'   => $message,
            'data'      => $data,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
}

if (!function_exists('sendJsonResponse')) {
    function sendJsonResponse($status, $message, $data = null, $httpCode = 200) {
        sendResponse($status, $message, $data, $httpCode);
    }
}

if (!function_exists('sanitizeString')) {
    function sanitizeString($val) {
        if ($val === null) return '';
        return is_string($val) ? trim($val) : (string)$val;
    }
}

if (!function_exists('getJsonInput')) {
    function getJsonInput() {
        $raw = file_get_contents('php://input');
        if (!empty($raw)) {
            $data = json_decode($raw, true);
            if (is_array($data)) return $data;
        }
        return !empty($_POST) ? $_POST : [];
    }
}

if (!function_exists('getJsonInputBody')) {
    function getJsonInputBody() {
        return getJsonInput();
    }
}
