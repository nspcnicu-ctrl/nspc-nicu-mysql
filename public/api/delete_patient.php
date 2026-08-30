<?php
/**
 * ============================================================================
 * ENDPOINT: /api/delete_patient.php
 * Endpoint Khusus Hapus Permanen & Soft Delete Pasien MySQL
 * ============================================================================
 */

ob_start();
error_reporting(0);
ini_set('display_errors', '0');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Auth-Token');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200);
    exit(0);
}

try {
    if (file_exists(__DIR__ . '/config/database.php')) {
        require_once __DIR__ . '/config/database.php';
    } elseif (file_exists(__DIR__ . '/config/db.php')) {
        require_once __DIR__ . '/config/db.php';
    } elseif (file_exists(__DIR__ . '/database.php')) {
        require_once __DIR__ . '/database.php';
    }

    $pdo = null;
    if (class_exists('Database') && method_exists('Database', 'getConnection')) {
        $pdo = Database::getConnection();
    } elseif (function_exists('getDatabaseConnection')) {
        $pdo = getDatabaseConnection();
    } elseif (function_exists('getDbConnection')) {
        $pdo = getDbConnection();
    } elseif (isset($conn) && $conn instanceof PDO) {
        $pdo = $conn;
    } elseif (isset($db) && $db instanceof PDO) {
        $pdo = $db;
    }

    if (!$pdo) {
        throw new Exception('Koneksi database (PDO) tidak dapat diinisialisasi.');
    }

    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true) ?: $_POST;

    $id = trim((string)($_GET['id'] ?? ($input['id'] ?? ($input['patient_id'] ?? ($input['patientId'] ?? '')))));
    $action = strtolower(trim((string)($_GET['action'] ?? ($input['action'] ?? 'permanent_delete'))));
    $method = $_SERVER['REQUEST_METHOD'] ?? 'POST';

    // Kosongkan Tempat Sampah
    if ($action === 'empty_trash' || $action === 'clear_trash') {
        try {
            $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` IN (SELECT `id` FROM `patients` WHERE `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan')");
            $delLogs->execute();
        } catch (Throwable $e) {}

        $delP = $pdo->prepare("DELETE FROM `patients` WHERE `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan'");
        $delP->execute();
        $count = $delP->rowCount();

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'        => 'success',
            'success'       => true,
            'message'       => "Tempat sampah berhasil dikosongkan ($count pasien dihapus permanen).",
            'deleted_count' => $count
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (empty($id)) {
        throw new Exception('ID Pasien wajib disertakan.');
    }

    // Soft delete jika diminta secara spesifik
    if ($action === 'soft_delete' || $action === 'trash' || (isset($input['is_deleted']) && $input['is_deleted'] == 1 && $action !== 'permanent_delete')) {
        $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 1, `status` = 'deleted', `deleted_at` = NOW(), `updated_at` = NOW() WHERE `id` = :id");
        $stmt->execute([':id' => $id]);

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'  => 'success',
            'success' => true,
            'message' => 'Pasien berhasil dipindahkan ke sampah.',
            'id'      => $id
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Hapus Permanen (Default)
    try {
        $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = :id");
        $delLogs->execute([':id' => $id]);
    } catch (Throwable $e) {}

    $delP = $pdo->prepare("DELETE FROM `patients` WHERE `id` = :id");
    $delP->execute([':id' => $id]);

    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'status'  => 'success',
        'success' => true,
        'message' => 'Pasien berhasil dihapus permanen dari MySQL.',
        'id'      => $id
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
