<?php
/**
 * ============================================================================
 * UPDATE PATIENT STATUS ENDPOINT - NSPC RSUD UNDATA
 * ============================================================================
 * Letakkan file ini di: /public_html/api/update_patient_status.php
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

$patientId = $body['id'] ?? $body['patient_id'] ?? $body['patientId'] ?? '';
$action = strtolower($body['action'] ?? 'update_status');

if (!$patientId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'ID pasien wajib disertakan.']);
    exit;
}

try {
    if ($action === 'soft_delete' || (isset($body['is_deleted']) && ($body['is_deleted'] === 1 || $body['is_deleted'] === '1' || $body['is_deleted'] === true))) {
        $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 1, `deleted_at` = NOW() WHERE `id` = ?");
        $stmt->execute([$patientId]);
        echo json_encode(['success' => true, 'status' => 'success', 'message' => 'Pasien dipindahkan ke sampah.']);
        exit;
    }

    if ($action === 'restore' || (isset($body['restore']) && $body['restore'] === true)) {
        $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 0, `deleted_at` = NULL WHERE `id` = ?");
        $stmt->execute([$patientId]);
        echo json_encode(['success' => true, 'status' => 'success', 'message' => 'Pasien berhasil dipulihkan.']);
        exit;
    }

    // Default: update status
    $newStatus = $body['status'] ?? 'Rawat NICU';
    $dischargeSummaryJson = isset($body['discharge_summary']) ? json_encode($body['discharge_summary']) : null;
    $dischargedAt = ($newStatus === 'Sudah Pulang') ? date('Y-m-d H:i:s') : null;

    $stmt = $pdo->prepare("
        UPDATE `patients` 
        SET `status` = ?, 
            `discharge_summary` = COALESCE(?, `discharge_summary`),
            `discharged_at` = COALESCE(?, `discharged_at`)
        WHERE `id` = ?
    ");
    $stmt->execute([$newStatus, $dischargeSummaryJson, $dischargedAt, $patientId]);

    echo json_encode([
        'success'    => true,
        'status'     => 'success',
        'message'    => 'Status pasien berhasil diperbarui.',
        'new_status' => $newStatus
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => $e->getMessage()]);
}
