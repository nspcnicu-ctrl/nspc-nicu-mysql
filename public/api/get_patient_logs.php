<?php
/**
 * ============================================================================
 * ENDPOINT: GET /api/get_patient_logs.php
 * ============================================================================
 * Mengambil Riwayat Catatan Perkembangan Harian Bayi (Daily Logs).
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan GET.', null, 405);
}

$patientId = sanitizeString($_GET['patient_id'] ?? $_GET['id'] ?? '');

if (empty($patientId)) {
    sendResponse('error', 'Parameter patient_id wajib disertakan.', null, 400);
}

$pdo = Database::getConnection();

// 1. Ambil Data Pasien
$stmtPatient = $pdo->prepare("
    SELECT id, baby_name, nickname, gender, birth_date, admission_date, status,
           gestational_age_weeks, gestation_category, room_number, medical_record_number,
           cover_photo_url, initial_anthropometry, current_equipment, milestones, discharge_summary
    FROM patients 
    WHERE id = :id AND is_deleted = 0 
    LIMIT 1
");
$stmtPatient->execute([':id' => $patientId]);
$patient = $stmtPatient->fetch();

if (!$patient) {
    sendResponse('error', 'Data pasien tidak ditemukan atau telah dihapus.', null, 404);
}

// Decode JSON fields pasien
foreach (['initial_anthropometry', 'current_equipment', 'milestones', 'discharge_summary'] as $jf) {
    if (!empty($patient[$jf]) && is_string($patient[$jf])) {
        $patient[$jf] = json_decode($patient[$jf], true);
    }
}

// 2. Ambil Riwayat Daily Logs Pasien
$stmtLogs = $pdo->prepare("
    SELECT id, patient_id, log_date, period_label, weight_gram, weight_change_gram,
           vital_signs, drinking_ability, active_equipment, milestones_list,
           nakes_notes, updated_by, photo_url, photo_caption, created_at, updated_at
    FROM daily_logs 
    WHERE patient_id = :pid 
    ORDER BY log_date ASC, created_at ASC
");
$stmtLogs->execute([':pid' => $patientId]);
$logs = $stmtLogs->fetchAll();

// Decode JSON fields untuk setiap log
foreach ($logs as &$log) {
    foreach (['vital_signs', 'drinking_ability', 'active_equipment', 'milestones_list'] as $jf) {
        if (!empty($log[$jf]) && is_string($log[$jf])) {
            $log[$jf] = json_decode($log[$jf], true);
        }
    }
    $log['weight_gram'] = intval($log['weight_gram']);
    $log['weight_change_gram'] = intval($log['weight_change_gram']);
}

sendResponse('success', 'Riwayat log harian pasien berhasil diambil.', [
    'patient'    => $patient,
    'total_logs' => count($logs),
    'logs'       => $logs
]);
