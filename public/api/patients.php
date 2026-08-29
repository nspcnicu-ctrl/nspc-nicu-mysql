<?php
/**
 * ============================================================================
 * ENDPOINT: /api/patients.php (GET, POST, OPTIONS)
 * ============================================================================
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// GET PATIENTS
if ($method === 'GET') {
    try {
        $patientId = trim($_GET['id'] ?? '');
        $includeDeleted = isset($_GET['only_active']) ? false : true;

        $sql = "SELECT id, nickname, access_password, baby_name, father_name, mother_name,
                       gender, birth_date, admission_date, gestational_age_weeks, gestation_category,
                       status, medical_record_number, room_number, cover_photo_url,
                       initial_anthropometry, current_equipment, registered_equipment,
                       milestones, immunization_discharge, discharge_summary, discharged_at,
                       is_deleted, deleted_at, is_active, created_at, updated_at
                FROM patients WHERE 1=1";
        
        $params = [];
        if (!$includeDeleted) {
            $sql .= " AND is_deleted = 0";
        }
        if (!empty($patientId)) {
            $sql .= " AND id = :id";
            $params[':id'] = $patientId;
        }
        $sql .= " ORDER BY created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $patients = $stmt->fetchAll();

        $patientIds = array_column($patients, 'id');
        $logsByPatient = [];
        if (!empty($patientIds)) {
            $placeholders = implode(',', array_fill(0, count($patientIds), '?'));
            $logStmt = $pdo->prepare("
                SELECT id, patient_id, log_date, period_label, weight_gram, weight_change_gram,
                       vital_signs, drinking_ability, active_equipment, milestones_list,
                       nakes_notes, updated_by, photo_url, photo_caption, created_at, updated_at
                FROM daily_logs 
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
                
                // Format CamelCase Mapping
                $l['patientId']       = $l['patient_id'];
                $l['date']            = $l['log_date'];
                $l['period']          = $l['period_label'];
                $l['weight']          = $l['weight_gram'];
                $l['weightDiff']      = $l['weight_change_gram'];
                $l['vitalSigns']      = $l['vital_signs'];
                $l['drinkingAbility']  = $l['drinking_ability'];
                $l['activeEquipment'] = $l['active_equipment'];
                $l['milestonesList']  = $l['milestones_list'];
                $l['nakesNotes']      = $l['nakes_notes'];
                $l['updatedBy']       = $l['updated_by'];
                $l['photoUrl']        = $l['photo_url'];
                $l['photoCaption']    = $l['photo_caption'];

                $logsByPatient[$pid][] = $l;
            }
        }

        $jsonFields = ['initial_anthropometry', 'current_equipment', 'registered_equipment', 'milestones', 'immunization_discharge', 'discharge_summary'];
        foreach ($patients as &$p) {
            foreach ($jsonFields as $jf) {
                if (!empty($p[$jf]) && is_string($p[$jf])) {
                    $p[$jf] = json_decode($p[$jf], true);
                }
            }
            $p['is_deleted'] = (bool)$p['is_deleted'];
            $p['is_active'] = (bool)$p['is_active'];
            $p['gestational_age_weeks'] = intval($p['gestational_age_weeks']);
            $p['daily_logs'] = $logsByPatient[$p['id']] ?? [];
            $p['dailyLogs']  = $p['daily_logs'];

            // Format CamelCase Mapping
            $p['accessPassword']        = $p['access_password'];
            $p['babyName']              = $p['baby_name'];
            $p['fatherName']            = $p['father_name'];
            $p['motherName']            = $p['mother_name'];
            $p['birthDate']             = $p['birth_date'];
            $p['admissionDate']         = $p['admission_date'];
            $p['gestationalAgeWeeks']  = $p['gestational_age_weeks'];
            $p['gestationCategory']     = $p['gestation_category'];
            $p['medicalRecordNumber']  = $p['medical_record_number'];
            $p['roomNumber']            = $p['room_number'];
            $p['coverPhotoUrl']         = $p['cover_photo_url'];
            $p['initialAnthropometry']  = $p['initial_anthropometry'];
            $p['currentEquipment']      = $p['current_equipment'];
            $p['registeredEquipment']   = $p['registered_equipment'];
            $p['immunizationDischarge'] = $p['immunization_discharge'];
            $p['dischargeSummary']      = $p['discharge_summary'];
            $p['dischargedAt']          = $p['discharged_at'];
            $p['isDeleted']             = $p['is_deleted'];
            $p['isActive']              = $p['is_active'];
        }

        sendJsonResponse('success', 'Data pasien berhasil diambil.', [
            'total'    => count($patients),
            'items'    => $patients,
            'patients' => $patients
        ]);
    } catch (PDOException $e) {
        sendJsonResponse('error', 'Gagal memuat pasien: ' . $e->getMessage(), null, 200);
    }
}

// POST PATIENTS (Insert / Update / Soft Delete)
if ($method === 'POST') {
    try {
        $input = getJsonInputBody();
        if (empty($input)) $input = $_POST;

        $action = strtolower(trim($input['action'] ?? 'save'));

        // Soft Delete
        if ($action === 'delete' || $action === 'soft_delete') {
            $pid = trim($input['id'] ?? '');
            if (empty($pid)) sendJsonResponse('error', 'ID wajib diisi untuk delete.', null, 400);

            $stmt = $pdo->prepare("UPDATE patients SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() WHERE id = :id");
            $stmt->execute([':id' => $pid]);
            sendJsonResponse('success', 'Pasien berhasil dihapus (soft delete).', ['id' => $pid]);
        }

        // Permanent Delete
        if ($action === 'permanent_delete' || $action === 'hard_delete') {
            $pid = trim($input['id'] ?? '');
            if (empty($pid)) sendJsonResponse('error', 'ID wajib diisi untuk delete.', null, 400);

            $pdo->prepare("DELETE FROM daily_logs WHERE patient_id = :id")->execute([':id' => $pid]);
            $stmt = $pdo->prepare("DELETE FROM patients WHERE id = :id");
            $stmt->execute([':id' => $pid]);
            sendJsonResponse('success', 'Pasien berhasil dihapus permanen.', ['id' => $pid]);
        }

        // Restore
        if ($action === 'restore') {
            $pid = trim($input['id'] ?? '');
            if (empty($pid)) sendJsonResponse('error', 'ID wajib diisi untuk restore.', null, 400);

            $stmt = $pdo->prepare("UPDATE patients SET is_deleted = 0, deleted_at = NULL, updated_at = NOW() WHERE id = :id");
            $stmt->execute([':id' => $pid]);
            sendJsonResponse('success', 'Pasien berhasil dipulihkan.', ['id' => $pid]);
        }

        // Empty Trash
        if ($action === 'empty_trash') {
            $pdo->query("DELETE FROM daily_logs WHERE patient_id IN (SELECT id FROM patients WHERE is_deleted = 1)");
            $pdo->query("DELETE FROM patients WHERE is_deleted = 1");
            sendJsonResponse('success', 'Tempat sampah berhasil dikosongkan.');
        }

        $id            = trim($input['id'] ?? ('p_' . time() . '_' . substr(md5(uniqid()), 0, 5)));
        $nickname      = trim($input['nickname'] ?? '');
        $password      = trim($input['access_password'] ?? $input['accessPassword'] ?? $input['password'] ?? '');
        $babyName      = trim($input['baby_name'] ?? $input['babyName'] ?? '');
        $fatherName    = trim($input['father_name'] ?? $input['fatherName'] ?? '');
        $motherName    = trim($input['mother_name'] ?? $input['motherName'] ?? '');
        $gender        = trim($input['gender'] ?? 'Laki-Laki');
        $birthDate     = trim($input['birth_date'] ?? $input['birthDate'] ?? date('Y-m-d'));
        $admDate       = trim($input['admission_date'] ?? $input['admissionDate'] ?? date('Y-m-d'));
        $gaWeeks       = intval($input['gestational_age_weeks'] ?? $input['gestationalAgeWeeks'] ?? 36);
        $gCat          = trim($input['gestation_category'] ?? $input['gestationCategory'] ?? 'preterm');
        $status        = trim($input['status'] ?? 'Rawat NICU');
        $mrn           = trim($input['medical_record_number'] ?? $input['medicalRecordNumber'] ?? '');
        $room          = trim($input['room_number'] ?? $input['roomNumber'] ?? '');
        $cover         = $input['cover_photo_url'] ?? $input['coverPhotoUrl'] ?? null;
        
        $initialAnthro = !empty($input['initial_anthropometry'] ?? $input['initialAnthropometry']) ? json_encode($input['initial_anthropometry'] ?? $input['initialAnthropometry'], JSON_UNESCAPED_UNICODE) : null;
        $currentEquip  = !empty($input['current_equipment'] ?? $input['currentEquipment']) ? json_encode($input['current_equipment'] ?? $input['currentEquipment'], JSON_UNESCAPED_UNICODE) : null;
        $regEquip      = !empty($input['registered_equipment'] ?? $input['registeredEquipment']) ? json_encode($input['registered_equipment'] ?? $input['registeredEquipment'], JSON_UNESCAPED_UNICODE) : null;
        $milestones    = !empty($input['milestones']) ? json_encode($input['milestones'], JSON_UNESCAPED_UNICODE) : null;
        $immu          = !empty($input['immunization_discharge'] ?? $input['immunizationDischarge']) ? json_encode($input['immunization_discharge'] ?? $input['immunizationDischarge'], JSON_UNESCAPED_UNICODE) : null;
        $discSummary   = !empty($input['discharge_summary'] ?? $input['dischargeSummary']) ? json_encode($input['discharge_summary'] ?? $input['dischargeSummary'], JSON_UNESCAPED_UNICODE) : null;
        $discAt        = $input['discharged_at'] ?? $input['dischargedAt'] ?? null;

        if (empty($nickname) || empty($babyName)) {
            sendJsonResponse('error', 'Nama panggilan dan nama lengkap bayi wajib diisi.', null, 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO patients (
                id, nickname, access_password, baby_name, father_name, mother_name,
                gender, birth_date, admission_date, gestational_age_weeks, gestation_category,
                status, medical_record_number, room_number, cover_photo_url,
                initial_anthropometry, current_equipment, registered_equipment,
                milestones, immunization_discharge, discharge_summary, discharged_at,
                is_deleted, is_active, created_at, updated_at
            ) VALUES (
                :id, :nick, :pass, :bname, :fname, :mname,
                :gender, :bdate, :adate, :ga_weeks, :g_cat,
                :status, :mrn, :room, :cover,
                :anthro, :cur_eq, :reg_eq,
                :miles, :immu, :disc_sum, :disc_at,
                0, 1, NOW(), NOW()
            )
            ON DUPLICATE KEY UPDATE
                nickname               = VALUES(nickname),
                access_password        = IF(VALUES(access_password) != '', VALUES(access_password), access_password),
                baby_name              = VALUES(baby_name),
                father_name            = VALUES(father_name),
                mother_name            = VALUES(mother_name),
                gender                 = VALUES(gender),
                birth_date             = VALUES(birth_date),
                admission_date         = VALUES(admission_date),
                gestational_age_weeks  = VALUES(gestational_age_weeks),
                gestation_category     = VALUES(gestation_category),
                status                 = VALUES(status),
                medical_record_number  = VALUES(medical_record_number),
                room_number            = VALUES(room_number),
                cover_photo_url        = COALESCE(VALUES(cover_photo_url), cover_photo_url),
                initial_anthropometry  = VALUES(initial_anthropometry),
                current_equipment      = VALUES(current_equipment),
                registered_equipment   = VALUES(registered_equipment),
                milestones             = VALUES(milestones),
                immunization_discharge = VALUES(immunization_discharge),
                discharge_summary      = VALUES(discharge_summary),
                discharged_at          = VALUES(discharged_at),
                is_deleted             = 0,
                updated_at             = NOW()
        ");

        $stmt->execute([
            ':id'       => $id,
            ':nick'     => $nickname,
            ':pass'     => $password,
            ':bname'    => $babyName,
            ':fname'    => $fatherName,
            ':mname'    => $motherName,
            ':gender'   => $gender,
            ':bdate'    => $birthDate,
            ':adate'    => $admDate,
            ':ga_weeks' => $gaWeeks,
            ':g_cat'    => $gCat,
            ':status'   => $status,
            ':mrn'      => $mrn,
            ':room'     => $room,
            ':cover'    => $cover,
            ':anthro'   => $initialAnthro,
            ':cur_eq'   => $currentEquip,
            ':reg_eq'   => $regEquip,
            ':miles'    => $milestones,
            ':immu'     => $immu,
            ':disc_sum' => $discSummary,
            ':disc_at'  => $discAt
        ]);

        sendJsonResponse('success', "Data pasien '{$babyName}' berhasil disimpan.", ['id' => $id]);

    } catch (PDOException $e) {
        sendJsonResponse('error', 'Gagal menyimpan data pasien: ' . $e->getMessage(), null, 200);
    }
}

sendJsonResponse('error', 'Metode HTTP tidak didukung.', null, 405);
