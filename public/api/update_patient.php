<?php
/**
 * ============================================================================
 * ENDPOINT: POST /api/update_patient.php
 * ============================================================================
 * Nakes memperbarui status, data antropometri, milestones, foto, atau soft delete pasien.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan POST.', null, 405);
}

$input = getJsonInput();
$pdo = Database::getConnection();

$patientId = sanitizeString($input['id'] ?? $input['patient_id'] ?? '');

if (empty($patientId)) {
    sendResponse('error', 'ID Pasien (id) wajib disertakan.', null, 400);
}

// Cek keberadaan pasien
$stmt = $pdo->prepare("SELECT * FROM patients WHERE id = :id LIMIT 1");
$stmt->execute([':id' => $patientId]);
$existing = $stmt->fetch();

if (!$existing) {
    sendResponse('error', 'Data pasien tidak ditemukan.', null, 404);
}

// 1. SOFT DELETE JIKA DIMINTA
if (isset($input['is_deleted']) && ($input['is_deleted'] === true || $input['is_deleted'] === 1 || $input['is_deleted'] === '1')) {
    $delStmt = $pdo->prepare("
        UPDATE patients 
        SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() 
        WHERE id = :id
    ");
    $delStmt->execute([':id' => $patientId]);
    
    recordSystemEvent($pdo, 'PATIENT_DELETED', $patientId, ['baby_name' => $existing['baby_name']]);
    sendResponse('success', "Pasien {$existing['baby_name']} berhasil dipindahkan ke arsip sampah.");
}

// 2. RESTORE DARI TRASH JIKA DIMINTA
if (isset($input['restore']) && $input['restore'] === true) {
    $resStmt = $pdo->prepare("
        UPDATE patients 
        SET is_deleted = 0, deleted_at = NULL, updated_at = NOW() 
        WHERE id = :id
    ");
    $resStmt->execute([':id' => $patientId]);
    
    recordSystemEvent($pdo, 'PATIENT_RESTORED', $patientId, ['baby_name' => $existing['baby_name']]);
    sendResponse('success', "Pasien {$existing['baby_name']} berhasil dipulihkan dari arsip sampah.");
}

// 3. UPDATE DETAIL PASIEN
$babyName     = isset($input['baby_name']) ? sanitizeString($input['baby_name']) : $existing['baby_name'];
$nickname     = isset($input['nickname']) ? sanitizeString($input['nickname']) : $existing['nickname'];
$fatherName   = isset($input['father_name']) ? sanitizeString($input['father_name']) : $existing['father_name'];
$motherName   = isset($input['mother_name']) ? sanitizeString($input['mother_name']) : $existing['mother_name'];
$gender       = isset($input['gender']) ? sanitizeString($input['gender']) : $existing['gender'];
$birthDate    = isset($input['birth_date']) ? sanitizeString($input['birth_date']) : $existing['birth_date'];
$admission    = isset($input['admission_date']) ? sanitizeString($input['admission_date']) : $existing['admission_date'];
$gestAge      = isset($input['gestational_age_weeks']) ? intval($input['gestational_age_weeks']) : $existing['gestational_age_weeks'];
$gestCat      = isset($input['gestation_category']) ? sanitizeString($input['gestation_category']) : $existing['gestation_category'];
$status       = isset($input['status']) ? sanitizeString($input['status']) : $existing['status'];
$roomNumber   = isset($input['room_number']) ? sanitizeString($input['room_number']) : $existing['room_number'];
$mrNo         = isset($input['medical_record_number']) ? sanitizeString($input['medical_record_number']) : $existing['medical_record_number'];
$photoUrl     = isset($input['cover_photo_url']) ? $input['cover_photo_url'] : $existing['cover_photo_url'];

// Handle JSON fields
$initialAnthropo = isset($input['initial_anthropometry']) ? json_encode($input['initial_anthropometry']) : $existing['initial_anthropometry'];
$currentEquip    = isset($input['current_equipment']) ? json_encode($input['current_equipment']) : $existing['current_equipment'];
$registeredEquip = isset($input['registered_equipment']) ? json_encode($input['registered_equipment']) : $existing['registered_equipment'];
$milestones      = isset($input['milestones']) ? json_encode($input['milestones']) : $existing['milestones'];
$immunization    = isset($input['immunization_discharge']) ? json_encode($input['immunization_discharge']) : $existing['immunization_discharge'];
$dischargeSum    = isset($input['discharge_summary']) ? json_encode($input['discharge_summary']) : $existing['discharge_summary'];
$dischargedAt    = isset($input['discharged_at']) ? $input['discharged_at'] : $existing['discharged_at'];

try {
    $updStmt = $pdo->prepare("
        UPDATE patients SET
            baby_name              = :baby_name,
            nickname               = :nickname,
            father_name            = :father_name,
            mother_name            = :mother_name,
            gender                 = :gender,
            birth_date             = :birth_date,
            admission_date         = :admission_date,
            gestational_age_weeks  = :gest_age,
            gestation_category     = :gest_cat,
            status                 = :status,
            room_number            = :room,
            medical_record_number  = :mr_no,
            cover_photo_url        = :photo,
            initial_anthropometry  = :initial_anthropo,
            current_equipment      = :current_equip,
            registered_equipment   = :reg_equip,
            milestones             = :milestones,
            immunization_discharge = :immunization,
            discharge_summary      = :discharge_sum,
            discharged_at          = :discharged_at,
            updated_at             = NOW()
        WHERE id = :id
    ");

    $updStmt->execute([
        ':id'               => $patientId,
        ':baby_name'        => $babyName,
        ':nickname'         => $nickname,
        ':father_name'      => $fatherName,
        ':mother_name'      => $motherName,
        ':gender'           => $gender,
        ':birth_date'       => $birthDate,
        ':admission_date'   => $admission,
        ':gest_age'         => $gestAge,
        ':gest_cat'         => $gestCat,
        ':status'           => $status,
        ':room'             => $roomNumber,
        ':mr_no'            => $mrNo,
        ':photo'            => $photoUrl,
        ':initial_anthropo' => $initialAnthropo,
        ':current_equip'    => $currentEquip,
        ':reg_equip'        => $registeredEquip,
        ':milestones'       => $milestones,
        ':immunization'     => $immunization,
        ':discharge_sum'    => $dischargeSum,
        ':discharged_at'    => $dischargedAt
    ]);

    recordSystemEvent($pdo, 'PATIENT_UPDATED', $patientId, [
        'baby_name' => $babyName,
        'status'    => $status
    ]);

    sendResponse('success', "Data pasien {$babyName} berhasil diperbarui.", [
        'id'        => $patientId,
        'baby_name' => $babyName,
        'status'    => $status
    ]);

} catch (PDOException $e) {
    sendResponse('error', 'Gagal memperbarui data pasien: ' . $e->getMessage(), null, 500);
}
