<?php
/**
 * ============================================================================
 * DELETE PATIENT ENDPOINT - NSPC RSUD UNDATA
 * ============================================================================
 * Letakkan file ini di: /public_html/api/delete_patient.php
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_config.php';
$pdo = getDbConnection();

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: $_POST;

$patientId = $body['id'] ?? $body['patient_id'] ?? $body['patientId'] ?? $_GET['id'] ?? '';
$action = strtolower($body['action'] ?? $_GET['action'] ?? 'permanent_delete');

if ($action === 'empty_trash') {
    try {
        $delLogs = $pdo->query("DELETE FROM `daily_logs` WHERE `patient_id` IN (SELECT `id` FROM `patients` WHERE `is_deleted` = 1)");
        $delPats = $pdo->query("DELETE FROM `patients` WHERE `is_deleted` = 1");
        echo json_encode(['success' => true, 'status' => 'success', 'message' => 'Tempat sampah berhasil dikosongkan.']);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'status' => 'error', 'message' => $e->getMessage()]);
        exit;
    }
}

if (!$patientId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'ID pasien wajib disertakan.']);
    exit;
}

try {
    if ($action === 'soft_delete') {
        $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 1, `deleted_at` = NOW() WHERE `id` = ?");
        $stmt->execute([$patientId]);
        echo json_encode(['success' => true, 'status' => 'success', 'message' => 'Pasien dipindahkan ke sampah.']);
        exit;
    }

    // Default: permanent delete
    $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = ?");
    $delLogs->execute([$patientId]);

    $delPat = $pdo->prepare("DELETE FROM `patients` WHERE `id` = ?");
    $delPat->execute([$patientId]);

    echo json_encode(['success' => true, 'status' => 'success', 'message' => 'Pasien berhasil dihapus permanen dari MySQL.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => $e->getMessage()]);
}
