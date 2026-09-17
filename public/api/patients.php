<?php
/**
 * ============================================================================
 * PATIENTS API ENDPOINT - NSPC RSUD UNDATA
 * ============================================================================
 * Mendukung:
 * - GET: Mengambil daftar pasien (beserta daily_logs)
 * - POST: Menyimpan/menambahkan pasien baru, edit pasien, update status, dan hapus pasien
 * Letakkan file ini di: /public_html/api/patients.php
 */

// 1. CORS HEADERS (Wajib agar Web App di domain lain/preview bisa mengakses tanpa diblokir browser)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Tangani HTTP Preflight request dari browser
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

// ============================================================================
// METODE GET: Mengambil Data Pasien
// ============================================================================
if ($method === 'GET') {
    try {
        $includeDeleted = isset($_GET['include_deleted']) && ($_GET['include_deleted'] === '1' || $_GET['include_deleted'] === 'true');
        
        $sql = "SELECT * FROM `patients`";
        if (!$includeDeleted) {
            $sql .= " WHERE `is_deleted` = 0 AND `status` != 'deleted'";
        }
        $sql .= " ORDER BY `created_at` DESC";

        $stmt = $pdo->query($sql);
        $patients = $stmt->fetchAll();

        // Ambil data daily_logs untuk setiap pasien
        $logStmt = $pdo->query("SELECT * FROM `daily_logs` ORDER BY `log_date` ASC, `created_at` ASC");
        $allLogs = $logStmt->fetchAll();

        $logsByPatient = [];
        foreach ($allLogs as $log) {
            $pid = $log['patient_id'];
            if (!isset($logsByPatient[$pid])) {
                $logsByPatient[$pid] = [];
            }
            $logsByPatient[$pid][] = [
                'id'                 => $log['id'],
                'date'               => $log['log_date'],
                'periodLabel'        => $log['period_label'],
                'weightGram'         => (int)$log['weight_gram'],
                'weightChangeGram'   => (int)($log['weight_change_gram'] ?? 0),
                'vitalSigns'         => json_decode($log['vital_signs'] ?? '{}', true) ?: [
                    'temperature'     => 36.8,
                    'heartRate'       => 140,
                    'respiratoryRate' => 44,
                    'spo2'            => 98,
                ],
                'drinkingAbility'    => json_decode($log['drinking_ability'] ?? '{}', true) ?: [
                    'method'          => 'OGT/Sonde',
                    'volumeCcPerFeeding' => 10,
                    'frequencyPerDay' => 8,
                ],
                'activeEquipment'    => json_decode($log['active_equipment'] ?? '[]', true) ?: [],
                'milestonesList'     => json_decode($log['milestones_list'] ?? '[]', true) ?: [],
                'nakesNotes'         => $log['nakes_notes'] ?? '',
                'updatedBy'          => $log['updated_by'] ?? 'Nakes NICU',
                'createdAt'          => $log['created_at'],
                'photoUrl'           => $log['photo_url'] ?? null,
                'photoCaption'       => $log['photo_caption'] ?? null,
            ];
        }

        // Format hasil pasien
        $formattedPatients = [];
        foreach ($patients as $p) {
            $pid = $p['id'];
            $formattedPatients[] = [
                'id'                   => $p['id'],
                'medicalRecordNumber'  => $p['medical_record_number'] ?? '',
                'medical_record_number'=> $p['medical_record_number'] ?? '',
                'nickname'             => $p['nickname'],
                'accessPassword'       => $p['access_password'],
                'babyName'             => $p['baby_name'],
                'baby_name'            => $p['baby_name'],
                'fatherName'           => $p['father_name'] ?? '',
                'father_name'          => $p['father_name'] ?? '',
                'motherName'           => $p['mother_name'] ?? '',
                'mother_name'          => $p['mother_name'] ?? '',
                'gender'               => $p['gender'],
                'birthDate'            => $p['birth_date'],
                'birth_date'           => $p['birth_date'],
                'admissionDate'        => $p['admission_date'],
                'admission_date'       => $p['admission_date'],
                'gestationalAgeWeeks'  => (int)$p['gestational_age_weeks'],
                'gestationCategory'    => $p['gestation_category'],
                'gestation_category'   => $p['gestation_category'],
                'roomNumber'           => $p['room_number'] ?? '',
                'room_number'          => $p['room_number'] ?? '',
                'status'               => $p['status'],
                'coverPhotoUrl'        => $p['cover_photo_url'] ?? null,
                'initialAnthropometry' => json_decode($p['initial_anthropometry'] ?? '{}', true),
                'currentEquipment'     => json_decode($p['current_equipment'] ?? '[]', true),
                'registeredEquipment'  => json_decode($p['registered_equipment'] ?? '[]', true),
                'milestones'           => json_decode($p['milestones'] ?? '[]', true),
                'immunizationDischarge'=> json_decode($p['immunization_discharge'] ?? 'null', true),
                'dischargeSummary'     => json_decode($p['discharge_summary'] ?? 'null', true),
                'dischargedAt'         => $p['discharged_at'] ?? null,
                'isDeleted'            => (bool)$p['is_deleted'],
                'is_deleted'           => (int)$p['is_deleted'],
                'deletedAt'            => $p['deleted_at'] ?? null,
                'isActive'             => (bool)$p['is_active'],
                'dailyLogs'            => $logsByPatient[$pid] ?? [],
                'progressLogs'         => $logsByPatient[$pid] ?? [],
            ];
        }

        echo json_encode([
            'success'  => true,
            'status'   => 'success',
            'total'    => count($formattedPatients),
            'data'     => $formattedPatients,
            'patients' => $formattedPatients,
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'status'  => 'error',
            'message' => 'Gagal mengambil data pasien: ' . $e->getMessage()
        ]);
        exit;
    }
}

// ============================================================================
// METODE POST: Tambah, Update, Update Status, atau Hapus Pasien
// ============================================================================
if ($method === 'POST') {
    try {
        // Baca payload JSON dari body request
        $rawInput = file_get_contents('php://input');
        $body = json_decode($rawInput, true);

        // Jika request dikirim sebagai Form URL Encoded
        if (!$body && !empty($_POST)) {
            $body = $_POST;
        }

        if (!$body || !is_array($body)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Payload tidak valid atau JSON kosong.'
            ]);
            exit;
        }

        $action = strtolower($body['action'] ?? 'save');
        $patientId = $body['id'] ?? $body['patient_id'] ?? $body['patientId'] ?? '';

        // --------------------------------------------------------------------
        // A. SOFT DELETE PASIEN
        // --------------------------------------------------------------------
        if ($action === 'delete' || $action === 'soft_delete' || (isset($body['is_deleted']) && ($body['is_deleted'] === 1 || $body['is_deleted'] === '1' || $body['is_deleted'] === true))) {
            if (!$patientId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'status' => 'error', 'message' => 'ID pasien wajib disertakan.']);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 1, `deleted_at` = NOW() WHERE `id` = ?");
            $stmt->execute([$patientId]);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'message' => 'Pasien berhasil dipindahkan ke sampah.',
                'id'      => $patientId
            ]);
            exit;
        }

        // --------------------------------------------------------------------
        // B. PERMANENT DELETE (HAPUS PERMANEN)
        // --------------------------------------------------------------------
        if ($action === 'permanent_delete' || $action === 'hard_delete') {
            if (!$patientId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'status' => 'error', 'message' => 'ID pasien wajib disertakan.']);
                exit;
            }

            // Hapus relasi daily logs terlebih dahulu jika ada
            $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = ?");
            $delLogs->execute([$patientId]);

            // Hapus dari tabel patients
            $delPat = $pdo->prepare("DELETE FROM `patients` WHERE `id` = ?");
            $delPat->execute([$patientId]);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'message' => 'Pasien berhasil dihapus permanen dari MySQL.',
                'id'      => $patientId
            ]);
            exit;
        }

        // --------------------------------------------------------------------
        // C. RESTORE (PULIHKAN PASIEN DARI SAMPAH)
        // --------------------------------------------------------------------
        if ($action === 'restore' || (isset($body['restore']) && $body['restore'] === true)) {
            if (!$patientId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'status' => 'error', 'message' => 'ID pasien wajib disertakan.']);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 0, `deleted_at` = NULL WHERE `id` = ?");
            $stmt->execute([$patientId]);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'message' => 'Pasien berhasil dipulihkan.',
                'id'      => $patientId
            ]);
            exit;
        }

        // --------------------------------------------------------------------
        // D. UPDATE STATUS PASIEN (Misal: Rawat NICU -> Siap Pulang -> Sudah Pulang)
        // --------------------------------------------------------------------
        if ($action === 'update_status') {
            if (!$patientId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'status' => 'error', 'message' => 'ID pasien wajib disertakan.']);
                exit;
            }

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
                'success' => true,
                'status'  => 'success',
                'message' => 'Status pasien berhasil diperbarui.',
                'id'      => $patientId,
                'new_status' => $newStatus
            ]);
            exit;
        }

        // --------------------------------------------------------------------
        // E. TAMBAH PASIEN BARU / SIMPAN PERUBAHAN (UPSERT)
        // --------------------------------------------------------------------
        if (!$patientId) {
            $patientId = 'p_' . round(microtime(true) * 1000);
        }

        $babyName          = $body['baby_name'] ?? $body['babyName'] ?? 'Bayi Ny. Baru';
        $nickname          = $body['nickname'] ?? ('bayi_' . rand(100, 999));
        $accessPassword    = $body['access_password'] ?? $body['password'] ?? $body['accessPassword'] ?? '123456';
        $medicalRecordNo   = $body['medical_record_number'] ?? $body['medicalRecordNumber'] ?? ('RM-' . date('Y') . '-' . substr($patientId, -4));
        $fatherName        = $body['father_name'] ?? $body['fatherName'] ?? '';
        $motherName        = $body['mother_name'] ?? $body['motherName'] ?? '';
        $gender            = $body['gender'] ?? 'Laki-Laki';
        $birthDate         = $body['birth_date'] ?? $body['birthDate'] ?? date('Y-m-d');
        $admissionDate     = $body['admission_date'] ?? $body['admissionDate'] ?? date('Y-m-d');
        $gestationalWeeks  = (int)($body['gestational_age_weeks'] ?? $body['gestationalAgeWeeks'] ?? 36);
        $gestationCategory = $body['gestation_category'] ?? $body['gestationCategory'] ?? ($gestationalWeeks >= 37 ? 'aterm' : 'preterm');
        $status            = $body['status'] ?? 'Rawat NICU';
        $roomNumber        = $body['room_number'] ?? $body['roomNumber'] ?? 'Inkubator 01 - NICU RSUD Undata';
        $coverPhotoUrl     = $body['cover_photo_url'] ?? $body['coverPhotoUrl'] ?? null;

        // Field JSON
        $initialAnthropoJson   = isset($body['initial_anthropometry']) ? json_encode($body['initial_anthropometry']) : (isset($body['initialAnthropometry']) ? json_encode($body['initialAnthropometry']) : null);
        $currentEquipmentJson  = isset($body['current_equipment']) ? json_encode($body['current_equipment']) : (isset($body['currentEquipment']) ? json_encode($body['currentEquipment']) : '[]');
        $registeredEquipJson   = isset($body['registered_equipment']) ? json_encode($body['registered_equipment']) : (isset($body['registeredEquipment']) ? json_encode($body['registeredEquipment']) : '[]');
        $milestonesJson        = isset($body['milestones']) ? json_encode($body['milestones']) : '[]';
        $immunizationJson      = isset($body['immunization_discharge']) ? json_encode($body['immunization_discharge']) : (isset($body['immunizationDischarge']) ? json_encode($body['immunizationDischarge']) : null);
        $dischargeSummaryJson  = isset($body['discharge_summary']) ? json_encode($body['discharge_summary']) : (isset($body['dischargeSummary']) ? json_encode($body['dischargeSummary']) : null);
        $dischargedAt          = $body['discharged_at'] ?? $body['dischargedAt'] ?? null;

        // Query INSERT ... ON DUPLICATE KEY UPDATE
        $sql = "
            INSERT INTO `patients` (
                `id`, `nickname`, `access_password`, `baby_name`, `father_name`, `mother_name`,
                `gender`, `birth_date`, `admission_date`, `gestational_age_weeks`, `gestation_category`,
                `status`, `medical_record_number`, `room_number`, `cover_photo_url`,
                `initial_anthropometry`, `current_equipment`, `registered_equipment`,
                `milestones`, `immunization_discharge`, `discharge_summary`, `discharged_at`,
                `is_deleted`, `is_active`
            ) VALUES (
                :id, :nickname, :access_password, :baby_name, :father_name, :mother_name,
                :gender, :birth_date, :admission_date, :gestational_age_weeks, :gestation_category,
                :status, :medical_record_number, :room_number, :cover_photo_url,
                :initial_anthropometry, :current_equipment, :registered_equipment,
                :milestones, :immunization_discharge, :discharge_summary, :discharged_at,
                0, 1
            )
            ON DUPLICATE KEY UPDATE
                `nickname`              = VALUES(`nickname`),
                `access_password`        = VALUES(`access_password`),
                `baby_name`             = VALUES(`baby_name`),
                `father_name`           = VALUES(`father_name`),
                `mother_name`           = VALUES(`mother_name`),
                `gender`                = VALUES(`gender`),
                `birth_date`            = VALUES(`birth_date`),
                `admission_date`        = VALUES(`admission_date`),
                `gestational_age_weeks` = VALUES(`gestational_age_weeks`),
                `gestation_category`    = VALUES(`gestation_category`),
                `status`                = VALUES(`status`),
                `medical_record_number` = VALUES(`medical_record_number`),
                `room_number`           = VALUES(`room_number`),
                `cover_photo_url`       = COALESCE(VALUES(`cover_photo_url`), `cover_photo_url`),
                `initial_anthropometry` = COALESCE(VALUES(`initial_anthropometry`), `initial_anthropometry`),
                `current_equipment`     = VALUES(`current_equipment`),
                `registered_equipment`  = VALUES(`registered_equipment`),
                `milestones`            = VALUES(`milestones`),
                `immunization_discharge`= COALESCE(VALUES(`immunization_discharge`), `immunization_discharge`),
                `discharge_summary`     = COALESCE(VALUES(`discharge_summary`), `discharge_summary`),
                `discharged_at`         = COALESCE(VALUES(`discharged_at`), `discharged_at`)
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id'                    => $patientId,
            ':nickname'              => $nickname,
            ':access_password'        => $accessPassword,
            ':baby_name'             => $babyName,
            ':father_name'           => $fatherName,
            ':mother_name'           => $motherName,
            ':gender'                => $gender,
            ':birth_date'            => $birthDate,
            ':admission_date'        => $admissionDate,
            ':gestational_age_weeks' => $gestationalWeeks,
            ':gestation_category'    => $gestationCategory,
            ':status'                => $status,
            ':medical_record_number' => $medicalRecordNo,
            ':room_number'           => $roomNumber,
            ':cover_photo_url'       => $coverPhotoUrl,
            ':initial_anthropometry' => $initialAnthropoJson,
            ':current_equipment'     => $currentEquipmentJson,
            ':registered_equipment'  => $registeredEquipJson,
            ':milestones'            => $milestonesJson,
            ':immunization_discharge'=> $immunizationJson,
            ':discharge_summary'     => $dischargeSummaryJson,
            ':discharged_at'         => $dischargedAt,
        ]);

        // Simpan log perkembangan awal jika disertakan dalam daily_logs
        $rawLogs = $body['daily_logs'] ?? $body['dailyLogs'] ?? $body['progress_logs'] ?? $body['progressLogs'] ?? [];
        if (is_array($rawLogs) && count($rawLogs) > 0) {
            $insertLogStmt = $pdo->prepare("
                INSERT INTO `daily_logs` (
                    `id`, `patient_id`, `log_date`, `period_label`, `weight_gram`, `weight_change_gram`,
                    `vital_signs`, `drinking_ability`, `active_equipment`, `milestones_list`,
                    `nakes_notes`, `updated_by`
                ) VALUES (
                    :id, :patient_id, :log_date, :period_label, :weight_gram, :weight_change_gram,
                    :vital_signs, :drinking_ability, :active_equipment, :milestones_list,
                    :nakes_notes, :updated_by
                )
                ON DUPLICATE KEY UPDATE
                    `period_label`       = VALUES(`period_label`),
                    `weight_gram`        = VALUES(`weight_gram`),
                    `weight_change_gram` = VALUES(`weight_change_gram`),
                    `vital_signs`        = VALUES(`vital_signs`),
                    `drinking_ability`   = VALUES(`drinking_ability`),
                    `active_equipment`   = VALUES(`active_equipment`),
                    `milestones_list`    = VALUES(`milestones_list`),
                    `nakes_notes`        = VALUES(`nakes_notes`),
                    `updated_by`         = VALUES(`updated_by`)
            ");

            foreach ($rawLogs as $log) {
                if (!is_array($log)) continue;
                $logId = $log['id'] ?? ('log_' . round(microtime(true) * 1000) . '_' . rand(10, 99));
                $logDate = $log['date'] ?? $log['log_date'] ?? $admissionDate;
                $pLabel = $log['periodLabel'] ?? $log['period_label'] ?? 'Hari ke-1 (Awal Masuk)';
                $wGram = (int)($log['weightGram'] ?? $log['weight_gram'] ?? $log['weight'] ?? 2000);
                $wChange = (int)($log['weightChangeGram'] ?? $log['weight_change_gram'] ?? 0);
                $vsJson = isset($log['vitalSigns']) ? json_encode($log['vitalSigns']) : (isset($log['vital_signs']) ? json_encode($log['vital_signs']) : '{}');
                $daJson = isset($log['drinkingAbility']) ? json_encode($log['drinkingAbility']) : (isset($log['drinking_ability']) ? json_encode($log['drinking_ability']) : '{}');
                $eqJson = isset($log['activeEquipment']) ? json_encode($log['activeEquipment']) : (isset($log['active_equipment']) ? json_encode($log['active_equipment']) : '[]');
                $msJson = isset($log['milestonesList']) ? json_encode($log['milestonesList']) : (isset($log['milestones_list']) ? json_encode($log['milestones_list']) : '[]');
                $notes = $log['nakesNotes'] ?? $log['nakes_notes'] ?? '';
                $upBy = $log['updatedBy'] ?? $log['updated_by'] ?? 'Nakes NICU';

                $insertLogStmt->execute([
                    ':id'                 => $logId,
                    ':patient_id'         => $patientId,
                    ':log_date'           => $logDate,
                    ':period_label'       => $pLabel,
                    ':weight_gram'        => $wGram,
                    ':weight_change_gram' => $wChange,
                    ':vital_signs'        => $vsJson,
                    ':drinking_ability'   => $daJson,
                    ':active_equipment'   => $eqJson,
                    ':milestones_list'    => $msJson,
                    ':nakes_notes'        => $notes,
                    ':updated_by'         => $upBy,
                ]);
            }
        }

        echo json_encode([
            'success' => true,
            'status'  => 'success',
            'message' => 'Data pasien berhasil disimpan ke database MySQL.',
            'id'      => $patientId,
            'data'    => [
                'id'                  => $patientId,
                'babyName'            => $babyName,
                'medicalRecordNumber' => $medicalRecordNo,
                'nickname'            => $nickname,
                'status'              => $status,
            ]
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'status'  => 'error',
            'message' => 'Gagal menyimpan pasien ke MySQL: ' . $e->getMessage()
        ]);
        exit;
    }
}

// Jika metode lain
http_response_code(405);
echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Metode HTTP tidak didukung.']);
