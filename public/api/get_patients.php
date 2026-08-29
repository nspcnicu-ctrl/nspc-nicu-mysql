<?php
/**
 * ============================================================================
 * ENDPOINT: GET /api/get_patients.php
 * ============================================================================
 * Mengambil Daftar Seluruh Pasien NICU untuk Dashboard Tenaga Kesehatan.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan GET.', null, 405);
}

$pdo = Database::getConnection();

$status         = sanitizeString($_GET['status'] ?? '');
$search         = sanitizeString($_GET['search'] ?? '');
$includeDeleted = isset($_GET['include_deleted']) && $_GET['include_deleted'] === '1';

$sql = "SELECT id, nickname, access_password, baby_name, father_name, mother_name,
               gender, birth_date, admission_date, gestational_age_weeks, gestation_category,
               status, medical_record_number, room_number, cover_photo_url,
               initial_anthropometry, current_equipment, registered_equipment,
               milestones, immunization_discharge, discharge_summary, discharged_at,
               is_deleted, deleted_at, created_at, updated_at
        FROM patients 
        WHERE 1=1 ";

$params = [];

if (!$includeDeleted) {
    $sql .= " AND is_deleted = 0 ";
}

if (!empty($status)) {
    $sql .= " AND status = :status ";
    $params[':status'] = $status;
}

if (!empty($search)) {
    $sql .= " AND (LOWER(baby_name) LIKE :search OR LOWER(nickname) LIKE :search OR medical_record_number LIKE :search) ";
    $params[':search'] = '%' . strtolower($search) . '%';
}

$sql .= " ORDER BY created_at DESC ";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$patients = $stmt->fetchAll();

// Ambil semua daily logs untuk pasien yang ditampilkan
$patientIds = array_column($patients, 'id');
$logsByPatient = [];

if (!empty($patientIds)) {
    $placeholders = implode(',', array_fill(0, count($patientIds), '?'));
    $logStmt = $pdo->prepare("
        SELECT * FROM daily_logs 
        WHERE patient_id IN ($placeholders) 
        ORDER BY log_date ASC, created_at ASC
    ");
    $logStmt->execute($patientIds);
    $allLogs = $logStmt->fetchAll();

    foreach ($allLogs as $l) {
        $pid = $l['patient_id'];
        foreach (['vital_signs', 'drinking_ability', 'active_equipment', 'milestones_list'] as $jf) {
            if (!empty($l[$jf]) && is_string($l[$jf])) {
                $l[$jf] = json_decode($l[$jf], true);
            }
        }
        $l['weight_gram'] = intval($l['weight_gram']);
        $l['weight_change_gram'] = intval($l['weight_change_gram']);
        $logsByPatient[$pid][] = $l;
    }
}

// Decode JSON fields untuk setiap pasien
$jsonFields = [
    'initial_anthropometry', 'current_equipment', 'registered_equipment',
    'milestones', 'immunization_discharge', 'discharge_summary'
];

foreach ($patients as &$p) {
    foreach ($jsonFields as $jf) {
        if (!empty($p[$jf]) && is_string($p[$jf])) {
            $p[$jf] = json_decode($p[$jf], true);
        }
    }
    $p['is_deleted'] = (bool)$p['is_deleted'];
    $p['gestational_age_weeks'] = intval($p['gestational_age_weeks']);
    $p['daily_logs'] = $logsByPatient[$p['id']] ?? [];
}

sendResponse('success', 'Daftar pasien berhasil diambil.', [
    'total'    => count($patients),
    'patients' => $patients
]);
