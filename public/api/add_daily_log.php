<?php
/**
 * ============================================================================
 * ENDPOINT: POST /api/add_daily_log.php
 * ============================================================================
 * Nakes menambah atau memperbarui catatan perkembangan harian (Daily Log) pasien.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan POST.', null, 405);
}

$input = getJsonInput();
$pdo = Database::getConnection();

// 1. VALIDASI INPUT
$patientId  = sanitizeString($input['patient_id'] ?? '');
$logDate    = sanitizeString($input['date'] ?? $input['log_date'] ?? date('Y-m-d'));
$weightGram = intval($input['weight_gram'] ?? $input['weight'] ?? 0);
$period     = sanitizeString($input['period_label'] ?? $input['period'] ?? 'Pagi');
$nakesNotes = trim($input['nakes_notes'] ?? $input['notes'] ?? '');
$updatedBy  = sanitizeString($input['updated_by'] ?? 'Nakes NICU');
$logId      = $input['id'] ?? ('log_' . time() . '_' . substr(md5(uniqid()), 0, 4));

if (empty($patientId)) {
    sendResponse('error', 'patient_id wajib disertakan.', null, 400);
}
if ($weightGram <= 0) {
    sendResponse('error', 'Berat badan bayi (weight_gram) harus lebih dari 0.', null, 400);
}

// 2. CEK APAKAH PASIEN ADA
$stmtP = $pdo->prepare("SELECT id, baby_name FROM patients WHERE id = :id AND is_deleted = 0 LIMIT 1");
$stmtP->execute([':id' => $patientId]);
$patient = $stmtP->fetch();

if (!$patient) {
    sendResponse('error', 'Pasien tidak ditemukan.', null, 404);
}

// 3. HITUNG PERUBAHAN BERAT BADAN DIBANDINGKAN LOG TERAKHIR
$stmtPrev = $pdo->prepare("
    SELECT weight_gram FROM daily_logs 
    WHERE patient_id = :pid AND id != :lid 
    ORDER BY log_date DESC, created_at DESC 
    LIMIT 1
");
$stmtPrev->execute([':pid' => $patientId, ':lid' => $logId]);
$prevWeight = $stmtPrev->fetchColumn();

$weightChange = isset($input['weight_change_gram']) 
    ? intval($input['weight_change_gram']) 
    : ($prevWeight ? ($weightGram - intval($prevWeight)) : 0);

// 4. PROSES FOTO PERKEMBANGAN JIKA ADA UPLOAD (FILE ATAU BASE64)
$photoUrl = $input['photo_url'] ?? null;

// Jika dikirim sebagai file multipart
if (isset($_FILES['photo_file']) && $_FILES['photo_file']['error'] === UPLOAD_ERR_OK) {
    $uploadDir = dirname(__DIR__) . '/uploads/photos/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $ext = strtolower(pathinfo($_FILES['photo_file']['name'], PATHINFO_EXTENSION));
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
        $fileName = 'log_' . $patientId . '_' . time() . '.' . $ext;
        $destPath = $uploadDir . $fileName;
        if (move_uploaded_file($_FILES['photo_file']['tmp_name'], $destPath)) {
            $config = require __DIR__ . '/config/db_config.php';
            $photoUrl = rtrim($config['base_url'], '/') . '/uploads/photos/' . $fileName;
        }
    }
}

// 5. STRUKTUR DATA JSON
$vitalSigns = $input['vital_signs'] ?? [
    'heart_rate'        => intval($input['heart_rate'] ?? 140),
    'respiration_rate'  => intval($input['respiration_rate'] ?? 45),
    'temperature'       => floatval($input['temperature'] ?? 36.8),
    'oxygen_saturation' => intval($input['oxygen_saturation'] ?? 98)
];

$drinkingAbility = $input['drinking_ability'] ?? [
    'status'    => sanitizeString($input['drinking_status'] ?? 'Menyusu Langsung'),
    'volume_ml' => intval($input['drinking_volume_ml'] ?? 20),
    'method'    => sanitizeString($input['drinking_method'] ?? 'Oral / Pipet')
];

$activeEquipment = $input['active_equipment'] ?? [
    'incubator' => true,
    'cpap'      => false,
    'monitor'   => true,
    'infusion'  => false
];

try {
    $stmt = $pdo->prepare("
        INSERT INTO daily_logs (
            id, patient_id, log_date, period_label, weight_gram, weight_change_gram,
            vital_signs, drinking_ability, active_equipment, nakes_notes, updated_by,
            photo_url, created_at, updated_at
        ) VALUES (
            :id, :pid, :ldate, :period, :weight, :wchange,
            :vitals, :drinking, :equip, :notes, :updated_by,
            :photo, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
            log_date           = VALUES(log_date),
            period_label       = VALUES(period_label),
            weight_gram        = VALUES(weight_gram),
            weight_change_gram = VALUES(weight_change_gram),
            vital_signs        = VALUES(vital_signs),
            drinking_ability   = VALUES(drinking_ability),
            active_equipment   = VALUES(active_equipment),
            nakes_notes        = VALUES(nakes_notes),
            updated_by         = VALUES(updated_by),
            photo_url          = COALESCE(VALUES(photo_url), photo_url),
            updated_at         = NOW()
    ");

    $stmt->execute([
        ':id'         => $logId,
        ':pid'        => $patientId,
        ':ldate'      => $logDate,
        ':period'     => $period,
        ':weight'     => $weightGram,
        ':wchange'    => $weightChange,
        ':vitals'     => json_encode($vitalSigns),
        ':drinking'   => json_encode($drinkingAbility),
        ':equip'      => json_encode($activeEquipment),
        ':notes'      => $nakesNotes,
        ':updated_by' => $updatedBy,
        ':photo'      => $photoUrl
    ]);

    // Update timestamp pasien
    $pdo->prepare("UPDATE patients SET updated_at = NOW() WHERE id = :id")->execute([':id' => $patientId]);

    // Rekam event sistem untuk real-time update
    recordSystemEvent($pdo, 'DAILY_LOG_UPDATED', $patientId, [
        'log_id'      => $logId,
        'baby_name'   => $patient['baby_name'],
        'weight_gram' => $weightGram
    ]);

    sendResponse('success', "Catatan harian untuk {$patient['baby_name']} berhasil disimpan.", [
        'id'                 => $logId,
        'patient_id'         => $patientId,
        'log_date'           => $logDate,
        'weight_gram'        => $weightGram,
        'weight_change_gram' => $weightChange,
        'photo_url'          => $photoUrl,
        'vital_signs'        => $vitalSigns,
        'drinking_ability'   => $drinkingAbility,
        'updated_by'         => $updatedBy
    ]);

} catch (PDOException $e) {
    sendResponse('error', 'Gagal menyimpan log harian ke database: ' . $e->getMessage(), null, 500);
}
