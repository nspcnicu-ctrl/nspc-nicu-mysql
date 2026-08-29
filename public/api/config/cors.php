<?php
/**
 * File: config/cors.php
 * Mengizinkan semua domain untuk akses API
 */

if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
} else {
    header("Access-Control-Allow-Origin: *");
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    }
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    } else {
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin");
    }
    http_response_code(200);
    exit(0);
}

header('Content-Type: application/json; charset=UTF-8');

function sendResponse($status, $message, $data = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'status'    => $status,
        'message'   => $message,
        'data'      => $data,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sendJsonResponse($status, $message, $data = null, $httpCode = 200) {
    sendResponse($status, $message, $data, $httpCode);
}

function sanitizeString($val) {
    if ($val === null) return '';
    return is_string($val) ? trim($val) : (string)$val;
}

function recordSystemEvent($pdo, $eventType, $entityId, $details = []) {
    // Safe placeholder or audit logger if table exists
    try {
        if ($pdo instanceof PDO) {
            $stmt = $pdo->prepare("SHOW TABLES LIKE 'system_events'");
            $stmt->execute();
            if ($stmt->fetch()) {
                $ins = $pdo->prepare("INSERT INTO system_events (event_type, entity_id, details, created_at) VALUES (:ev, :ent, :dt, NOW())");
                $ins->execute([
                    ':ev'  => $eventType,
                    ':ent' => $entityId,
                    ':dt'  => json_encode($details, JSON_UNESCAPED_UNICODE)
                ]);
            }
        }
    } catch (Throwable $e) {
        // Suppress non-critical audit log errors
    }
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function getJsonInputBody() {
    return getJsonInput();
}
