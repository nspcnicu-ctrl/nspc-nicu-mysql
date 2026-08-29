<?php
/**
 * ============================================================================
 * ENDPOINT: POST /api/register_patient.php
 * ============================================================================
 * Nakes mendaftarkan pasien baru di NICU & otomatis menggenerate akun login Orang Tua.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan POST.', null, 405);
}

$input = getJsonInput();
$pdo = Database::getConnection();

// 1. VALIDASI INPUT WAJIB
$babyName    = sanitizeString($input['baby_name'] ?? '');
$gender      = sanitizeString($input['gender'] ?? 'Laki-Laki');
$birthDate   = sanitizeString($input['birth_date'] ?? date('Y-m-d'));
$admission   = sanitizeString($input['admission_date'] ?? date('Y-m-d'));
$gestAge     = intval($input['gestational_age_weeks'] ?? 36);
$gestCat     = sanitizeString($input['gestation_category'] ?? ($gestAge < 37 ? 'preterm' : 'aterm'));
$fatherName  = sanitizeString($input['father_name'] ?? '');
$motherName  = sanitizeString($input['mother_name'] ?? '');
$roomNumber  = sanitizeString($input['room_number'] ?? 'NICU Incubator');
$medRecordNo = sanitizeString($input['medical_record_number'] ?? '');
$photoUrl    = $input['cover_photo_url'] ?? null;

if (empty($babyName)) {
    sendResponse('error', 'Nama bayi wajib diisi.', null, 400);
}

// 2. OTOMATIS GENERATE NICKNAME & PASSWORD ORANG TUA JIKA BELUM ADA
$rawNickname = trim($input['nickname'] ?? '');
if (empty($rawNickname)) {
    // Generate nickname bersih dari nama bayi
    $firstWord = explode(' ', $babyName)[0];
    $cleanNick = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $firstWord));
    if (strlen($cleanNick) < 3) {
        $cleanNick = 'bayi' . substr(str_shuffle('abcdefghijklmnopqrstuvwxyz'), 0, 3);
    }
    
    // Cek keunikan nickname di database
    $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM patients WHERE LOWER(nickname) = :nick");
    $stmtCheck->execute([':nick' => $cleanNick]);
    $count = $stmtCheck->fetchColumn();
    if ($count > 0) {
        $cleanNick .= rand(10, 99);
    }
    $rawNickname = $cleanNick;
}

$rawPassword = trim($input['access_password'] ?? '');
if (empty($rawPassword)) {
    // Generate 6-digit password acak yang mudah diingat orang tua
    $rawPassword = strval(rand(100000, 999999));
}

// 3. SIAPKAN ID PASIEN & HASH KATA SANDI
$patientId = $input['id'] ?? ('p_' . time() . '_' . substr(md5(uniqid()), 0, 6));
$hashedPassword = hashPassword($rawPassword);

// 4. SIAPKAN DATA JSON
$initialAnthropo = $input['initial_anthropometry'] ?? [
    'weight' => intval($input['weight_gram'] ?? 2500),
    'length' => intval($input['length_cm'] ?? 45),
    'head_circumference' => intval($input['head_circumference_cm'] ?? 32),
    'chest_circumference' => intval($input['chest_circumference_cm'] ?? 30)
];

$currentEquip = $input['current_equipment'] ?? [
    'incubator' => true,
    'cpap'      => false,
    'monitor'   => true,
    'infusion'  => true
];

$milestones = $input['milestones'] ?? [
    'first_cry'        => true,
    'meconium_passed'  => true,
    'first_feeding'    => false,
    'kangaroo_care'    => false,
    'stable_temp'      => false,
    'independent_breath' => false
];

try {
    $stmt = $pdo->prepare("
        INSERT INTO patients (
            id, nickname, access_password, baby_name, father_name, mother_name,
            gender, birth_date, admission_date, gestational_age_weeks, gestation_category,
            status, medical_record_number, room_number, cover_photo_url,
            initial_anthropometry, current_equipment, milestones, is_deleted, created_at, updated_at
        ) VALUES (
            :id, :nickname, :access_password, :baby_name, :father_name, :mother_name,
            :gender, :birth_date, :admission_date, :gest_age, :gest_cat,
            'Rawat NICU', :mr_no, :room, :photo_url,
            :initial_anthropo, :current_equip, :milestones, 0, NOW(), NOW()
        )
    ");

    $stmt->execute([
        ':id'               => $patientId,
        ':nickname'         => $rawNickname,
        ':access_password'  => $hashedPassword,
        ':baby_name'        => $babyName,
        ':father_name'      => $fatherName,
        ':mother_name'      => $motherName,
        ':gender'           => $gender,
        ':birth_date'       => $birthDate,
        ':admission_date'   => $admission,
        ':gest_age'         => $gestAge,
        ':gest_cat'         => $gestCat,
        ':mr_no'            => $medRecordNo,
        ':room'             => $roomNumber,
        ':photo_url'        => $photoUrl,
        ':initial_anthropo' => json_encode($initialAnthropo),
        ':current_equip'    => json_encode($currentEquip),
        ':milestones'       => json_encode($milestones)
    ]);

    // Tambahkan log harian pertama (Baseline Admission Log)
    $firstLogId = 'log_' . time();
    $firstWeight = intval($initialAnthropo['weight'] ?? 2500);
    
    $logStmt = $pdo->prepare("
        INSERT INTO daily_logs (
            id, patient_id, log_date, period_label, weight_gram, weight_change_gram,
            vital_signs, drinking_ability, active_equipment, nakes_notes, updated_by, created_at
        ) VALUES (
            :id, :pid, :log_date, 'Hari Pertama Masuk', :weight, 0,
            :vitals, :drinking, :equip, 'Pasien baru masuk ruang perawatan NICU RSUD Undata.', :updated_by, NOW()
        )
    ");

    $logStmt->execute([
        ':id'         => $firstLogId,
        ':pid'        => $patientId,
        ':log_date'   => $admission,
        ':weight'     => $firstWeight,
        ':vitals'     => json_encode([
            'heart_rate' => 140,
            'respiration_rate' => 45,
            'temperature' => 36.8,
            'oxygen_saturation' => 98
        ]),
        ':drinking'   => json_encode([
            'status' => 'Parenteral / TPN',
            'volume_ml' => 0,
            'method' => 'Infus'
        ]),
        ':equip'      => json_encode($currentEquip),
        ':updated_by' => sanitizeString($input['registered_by'] ?? 'Nakes NICU')
    ]);

    // Rekam event sistem untuk real-time update
    recordSystemEvent($pdo, 'PATIENT_REGISTERED', $patientId, [
        'baby_name' => $babyName,
        'nickname'  => $rawNickname
    ]);

    // Kembalikan data lengkap beserta kredensial plain untuk kartu orang tua
    sendResponse('success', "Pasien {$babyName} berhasil didaftarkan dan akun Orang Tua siap digunakan!", [
        'patient_id'        => $patientId,
        'baby_name'         => $babyName,
        'parent_credential' => [
            'nickname' => $rawNickname,
            'password' => $rawPassword,
            'login_url'=> ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/?nickname=' . urlencode($rawNickname) . '&pass=' . urlencode($rawPassword))
        ]
    ], 201);

} catch (PDOException $e) {
    sendResponse('error', 'Gagal mendaftarkan pasien ke database: ' . $e->getMessage(), null, 500);
}
