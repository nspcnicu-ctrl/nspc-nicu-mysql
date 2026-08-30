<?php
/**
 * ============================================================================
 * ENDPOINT: /api/patients.php
 * Real-time CRUD Pasien NICU RSUD Undata dengan Toleransi Kolom & Global Error Handling
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

// -----------------------------------------------------------------------------
// GLOBAL TRY - CATCH THROWABLE (Mencegah Fatal 500 Error di Server Hostinger)
// -----------------------------------------------------------------------------
try {
    // 1. Muat Konfigurasi Database
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
        throw new Exception('Koneksi Database (PDO) tidak dapat diinisialisasi.');
    }

    // 2. Helper Functions dengan Pengecekan Keberadaan Fungsi
    if (!function_exists('safeJsonDecode')) {
        function safeJsonDecode($val, $default = null) {
            if ($val === null || $val === '') return $default;
            if (is_array($val)) return $val;
            if (is_object($val)) return (array)$val;
            if (is_string($val)) {
                $trimmed = trim($val);
                if ($trimmed === '' || $trimmed === 'null') return $default;
                $res = json_decode($trimmed, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return $res !== null ? $res : $default;
                }
            }
            return $default;
        }
    }

    if (!function_exists('safeJsonEncode')) {
        function safeJsonEncode($val) {
            if ($val === null) return null;
            if (is_string($val)) {
                $trimmed = trim($val);
                if ($trimmed === '' || $trimmed === 'null') return null;
                $decoded = json_decode($trimmed, true);
                if (json_last_error() === JSON_ERROR_NONE) return $trimmed;
                return json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
            }
            return json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        }
    }

    if (!function_exists('getPatientsTableCols')) {
        function getPatientsTableCols($pdo, $table = 'patients') {
            static $cache = [];
            if (isset($cache[$table])) return $cache[$table];
            try {
                $stmt = $pdo->prepare("DESCRIBE `$table`");
                $stmt->execute();
                $cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
                $cache[$table] = array_map('strtolower', $cols);
                return $cache[$table];
            } catch (Throwable $e) {
                return [];
            }
        }
    }

    if (!function_exists('normalizePatientLog')) {
        function normalizePatientLog($item, $patientId = '') {
            if (!is_array($item)) return null;
            $id = !empty($item['id']) ? trim((string)$item['id']) : ('log_' . time() . '_' . substr(md5(uniqid()), 0, 5));
            $pid = !empty($item['patient_id']) ? trim((string)$item['patient_id']) : (!empty($item['patientId']) ? trim((string)$item['patientId']) : $patientId);
            $date = !empty($item['log_date']) ? trim((string)$item['log_date']) : (!empty($item['date']) ? trim((string)$item['date']) : date('Y-m-d'));
            $period = !empty($item['period_label']) ? trim((string)$item['period_label']) : (!empty($item['period']) ? trim((string)$item['period']) : 'Pagi');
            $weight = isset($item['weight_gram']) ? intval($item['weight_gram']) : (isset($item['weight']) ? intval($item['weight']) : 0);
            $weightDiff = isset($item['weight_change_gram']) ? intval($item['weight_change_gram']) : (isset($item['weightDiff']) ? intval($item['weightDiff']) : 0);

            $vitalSigns = safeJsonDecode($item['vital_signs'] ?? $item['vitalSigns'] ?? null, null);
            $drinkingAbility = safeJsonDecode($item['drinking_ability'] ?? $item['drinkingAbility'] ?? null, null);
            $activeEquipment = safeJsonDecode($item['active_equipment'] ?? $item['activeEquipment'] ?? [], []);
            $milestonesList = safeJsonDecode($item['milestones_list'] ?? $item['milestonesList'] ?? [], []);

            return [
                'id'                 => $id,
                'patient_id'         => $pid,
                'patientId'          => $pid,
                'log_date'           => $date,
                'date'               => $date,
                'period_label'       => $period,
                'period'             => $period,
                'weight_gram'        => $weight,
                'weight'             => $weight,
                'weight_change_gram' => $weightDiff,
                'weightDiff'         => $weightDiff,
                'vital_signs'        => is_array($vitalSigns) ? $vitalSigns : null,
                'vitalSigns'         => is_array($vitalSigns) ? $vitalSigns : null,
                'drinking_ability'   => is_array($drinkingAbility) ? $drinkingAbility : null,
                'drinkingAbility'    => is_array($drinkingAbility) ? $drinkingAbility : null,
                'active_equipment'   => is_array($activeEquipment) ? $activeEquipment : [],
                'activeEquipment'    => is_array($activeEquipment) ? $activeEquipment : [],
                'milestones_list'    => is_array($milestonesList) ? $milestonesList : [],
                'milestonesList'     => is_array($milestonesList) ? $milestonesList : [],
                'nakes_notes'        => trim((string)($item['nakes_notes'] ?? $item['nakesNotes'] ?? $item['notes'] ?? '')),
                'nakesNotes'         => trim((string)($item['nakes_notes'] ?? $item['nakesNotes'] ?? $item['notes'] ?? '')),
                'updated_by'         => trim((string)($item['updated_by'] ?? $item['updatedBy'] ?? 'Nakes NICU')),
                'updatedBy'          => trim((string)($item['updated_by'] ?? $item['updatedBy'] ?? 'Nakes NICU')),
                'photo_url'          => $item['photo_url'] ?? $item['photoUrl'] ?? null,
                'photoUrl'           => $item['photo_url'] ?? $item['photoUrl'] ?? null,
                'photo_caption'      => trim((string)($item['photo_caption'] ?? $item['photoCaption'] ?? '')),
                'photoCaption'       => trim((string)($item['photo_caption'] ?? $item['photoCaption'] ?? '')),
                'created_at'         => $item['created_at'] ?? $item['createdAt'] ?? date('Y-m-d H:i:s'),
                'createdAt'          => $item['created_at'] ?? $item['createdAt'] ?? date('Y-m-d H:i:s'),
                'updated_at'         => $item['updated_at'] ?? $item['updatedAt'] ?? date('Y-m-d H:i:s'),
                'updatedAt'          => $item['updated_at'] ?? $item['updatedAt'] ?? date('Y-m-d H:i:s'),
            ];
        }
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $tableCols = getPatientsTableCols($pdo, 'patients');

    // =========================================================================
    // 3. DELETE METHOD (Hapus Permanen / Kosongkan Sampah via HTTP DELETE)
    // =========================================================================
    if ($method === 'DELETE') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: [];
        $pid = trim((string)($_GET['id'] ?? ($input['id'] ?? ($input['patient_id'] ?? ($input['patientId'] ?? '')))));
        $action = strtolower(trim((string)($_GET['action'] ?? ($input['action'] ?? 'permanent_delete'))));

        // A. Kosongkan Sampah via DELETE
        if ($action === 'empty_trash' || $action === 'clear_trash' || empty($pid)) {
            if ($action === 'empty_trash' || $action === 'clear_trash') {
                try {
                    $delLogs = $pdo->prepare("
                        DELETE FROM `daily_logs` 
                        WHERE `patient_id` IN (
                            SELECT `id` FROM `patients` 
                            WHERE `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan'
                        )
                    ");
                    $delLogs->execute();
                } catch (Throwable $e) {}

                $sql = "DELETE FROM `patients` WHERE `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan'";
                $stmt = $pdo->prepare($sql);
                $stmt->execute();
                $count = $stmt->rowCount();

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
        }

        if (empty($pid)) {
            throw new Exception('ID pasien wajib disertakan untuk penghapusan permanen.');
        }

        try {
            $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = :id");
            $delLogs->execute([':id' => $pid]);
        } catch (Throwable $e) {}

        $delPatient = $pdo->prepare("DELETE FROM `patients` WHERE `id` = :id");
        $delPatient->execute([':id' => $pid]);

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'  => 'success',
            'success' => true,
            'message' => 'Pasien berhasil dihapus permanen dari MySQL.',
            'id'      => $pid
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================================
    // 4. GET PATIENTS
    // =========================================================================
    if ($method === 'GET') {
        $patientId = trim((string)($_GET['id'] ?? $_GET['patient_id'] ?? ''));
        $includeDeleted = isset($_GET['include_deleted']) || isset($_GET['all']) || isset($_GET['all_status']);
        $onlyDeleted = isset($_GET['trash']) || isset($_GET['only_deleted']) || (isset($_GET['status']) && strtolower($_GET['status']) === 'deleted');

        $hasIsDeleted = in_array('is_deleted', $tableCols);
        $hasStatus = in_array('status', $tableCols);

        $where = ["1=1"];
        $params = [];

        if (!empty($patientId)) {
            $where[] = "`id` = :id";
            $params[':id'] = $patientId;
        } elseif ($onlyDeleted) {
            if ($hasIsDeleted && $hasStatus) {
                $where[] = "(`is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan')";
            } elseif ($hasIsDeleted) {
                $where[] = "`is_deleted` = 1";
            } elseif ($hasStatus) {
                $where[] = "(`status` = 'deleted' OR `status` = 'Disembunyikan')";
            }
        } elseif (!$includeDeleted) {
            if ($hasIsDeleted) {
                $where[] = "(`is_deleted` = 0 OR `is_deleted` IS NULL)";
            }
            if ($hasStatus) {
                $where[] = "`status` != 'deleted' AND `status` != 'Disembunyikan'";
            }
        }

        $orderCol = in_array('updated_at', $tableCols) ? 'updated_at' : (in_array('created_at', $tableCols) ? 'created_at' : '1');
        $sql = "SELECT * FROM `patients` WHERE " . implode(' AND ', $where) . " ORDER BY `$orderCol` DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch logs dari daily_logs jika ada
        $patientIds = array_filter(array_column($patients, 'id'));
        $logsByPatient = [];
        if (!empty($patientIds)) {
            $dailyCols = getPatientsTableCols($pdo, 'daily_logs');
            if (!empty($dailyCols)) {
                try {
                    $placeholders = implode(',', array_fill(0, count($patientIds), '?'));
                    $orderLogs = in_array('log_date', $dailyCols) ? "ORDER BY log_date ASC, id ASC" : "";
                    $lStmt = $pdo->prepare("SELECT * FROM `daily_logs` WHERE `patient_id` IN ($placeholders) $orderLogs");
                    $lStmt->execute(array_values($patientIds));
                    $allLogs = $lStmt->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($allLogs as $l) {
                        $pid = $l['patient_id'] ?? '';
                        $normalized = normalizePatientLog($l, $pid);
                        if ($normalized) {
                            $logsByPatient[$pid][] = $normalized;
                        }
                    }
                } catch (Throwable $e) {}
            }
        }

        // Normalisasi dan toleransi nama kolom untuk setiap pasien
        $formattedPatients = [];
        foreach ($patients as $p) {
            $pId = $p['id'] ?? '';
            if (empty($pId)) continue;

            // Toleransi nama bayi: dukung baby_name maupun name
            $babyName = $p['baby_name'] ?? ($p['name'] ?? ($p['nickname'] ?? 'Bayi'));
            $nickname = !empty($p['nickname']) ? $p['nickname'] : $babyName;
            $parentName = $p['parent_name'] ?? ($p['father_name'] ?? ($p['mother_name'] ?? ''));
            $mrn = $p['medical_record_number'] ?? ($p['med_record_number'] ?? ($p['mrn'] ?? ($p['no_rm'] ?? '')));
            $room = $p['room_number'] ?? ($p['room'] ?? '');
            $password = $p['access_password'] ?? ($p['password'] ?? '123456');

            // Parse JSON fields dengan aman
            $initialAnthropometry = safeJsonDecode($p['initial_anthropometry'] ?? null, null);
            $currentEquipment = safeJsonDecode($p['current_equipment'] ?? null, []);
            $registeredEquipment = safeJsonDecode($p['registered_equipment'] ?? ($p['required_equipment'] ?? null), []);
            $requiredEquipment = safeJsonDecode($p['required_equipment'] ?? ($p['registered_equipment'] ?? null), []);
            $immunizationDischarge = safeJsonDecode($p['immunization_discharge'] ?? null, null);
            $dischargeSummary = safeJsonDecode($p['discharge_summary'] ?? null, null);

            // Clean milestones array
            $rawMilestones = safeJsonDecode($p['milestones'] ?? null, []);
            $cleanMilestones = [];
            if (is_array($rawMilestones)) {
                $isAssoc = array_keys($rawMilestones) !== range(0, count($rawMilestones) - 1);
                if ($isAssoc) {
                    foreach ($rawMilestones as $k => $v) {
                        if ($v === true || $v === 1 || $v === '1' || $v === 'true') {
                            $cleanMilestones[] = (string)$k;
                        }
                    }
                } else {
                    foreach ($rawMilestones as $m) {
                        if (is_string($m) && trim($m) !== '') {
                            $cleanMilestones[] = trim($m);
                        }
                    }
                }
            }

            // Logs parsing
            $colLogs = safeJsonDecode($p['progress_logs'] ?? ($p['daily_logs'] ?? null), []);
            $tableLogs = $logsByPatient[$pId] ?? [];
            $allLogsCombined = [];
            if (is_array($colLogs)) {
                foreach ($colLogs as $cl) {
                    $norm = normalizePatientLog($cl, $pId);
                    if ($norm && !empty($norm['id'])) $allLogsCombined[$norm['id']] = $norm;
                }
            }
            if (is_array($tableLogs)) {
                foreach ($tableLogs as $tl) {
                    $norm = normalizePatientLog($tl, $pId);
                    if ($norm && !empty($norm['id'])) $allLogsCombined[$norm['id']] = $norm;
                }
            }
            $finalLogs = array_values($allLogsCombined);

            $isDeleted = (
                (isset($p['is_deleted']) && ($p['is_deleted'] === 1 || $p['is_deleted'] === '1' || $p['is_deleted'] === true)) ||
                (($p['status'] ?? '') === 'deleted') ||
                (($p['status'] ?? '') === 'Deleted') ||
                (($p['status'] ?? '') === 'Disembunyikan')
            );

            $formattedPatients[] = [
                'id'                    => $pId,
                'nickname'              => $nickname,
                'name'                  => $babyName,
                'baby_name'             => $babyName,
                'babyName'              => $babyName,
                'parent_name'           => $parentName,
                'parentName'            => $parentName,
                'father_name'           => $p['father_name'] ?? $parentName,
                'fatherName'            => $p['father_name'] ?? $parentName,
                'mother_name'           => $p['mother_name'] ?? '',
                'motherName'            => $p['mother_name'] ?? '',
                'parent_phone'          => $p['parent_phone'] ?? '',
                'parentPhone'           => $p['parent_phone'] ?? '',
                'gender'                => $p['gender'] ?? 'Laki-Laki',
                'birth_date'            => $p['birth_date'] ?? date('Y-m-d'),
                'birthDate'             => $p['birth_date'] ?? date('Y-m-d'),
                'birth_time'            => $p['birth_time'] ?? '00:00',
                'birthTime'             => $p['birth_time'] ?? '00:00',
                'admission_date'        => $p['admission_date'] ?? date('Y-m-d'),
                'admissionDate'         => $p['admission_date'] ?? date('Y-m-d'),
                'gestational_age_weeks' => intval($p['gestational_age_weeks'] ?? ($p['gestational_age'] ?? 36)),
                'gestationalAgeWeeks'   => intval($p['gestational_age_weeks'] ?? ($p['gestational_age'] ?? 36)),
                'gestation_category'    => $p['gestation_category'] ?? 'preterm',
                'gestationCategory'     => $p['gestation_category'] ?? 'preterm',
                'status'                => $p['status'] ?? 'Rawat NICU',
                'medical_record_number' => $mrn,
                'medicalRecordNumber'   => $mrn,
                'room_number'           => $room,
                'roomNumber'            => $room,
                'access_password'       => $password,
                'accessPassword'        => $password,
                'cover_photo_url'       => $p['cover_photo_url'] ?? null,
                'coverPhotoUrl'         => $p['cover_photo_url'] ?? null,
                'initial_anthropometry' => $initialAnthropometry,
                'initialAnthropometry'  => $initialAnthropometry,
                'current_equipment'     => $currentEquipment,
                'currentEquipment'      => $currentEquipment,
                'registered_equipment'  => $registeredEquipment,
                'registeredEquipment'   => $registeredEquipment,
                'required_equipment'    => $requiredEquipment,
                'requiredEquipment'     => $requiredEquipment,
                'milestones'            => array_values(array_unique($cleanMilestones)),
                'immunization_discharge'=> $immunizationDischarge,
                'immunizationDischarge' => $immunizationDischarge,
                'discharge_summary'     => $dischargeSummary,
                'dischargeSummary'      => $dischargeSummary,
                'discharged_at'         => $p['discharged_at'] ?? null,
                'dischargedAt'          => $p['discharged_at'] ?? null,
                'is_deleted'            => $isDeleted,
                'isDeleted'             => $isDeleted,
                'deleted_at'            => $p['deleted_at'] ?? null,
                'deletedAt'             => $p['deleted_at'] ?? null,
                'is_active'             => isset($p['is_active']) ? (bool)$p['is_active'] : true,
                'isActive'              => isset($p['is_active']) ? (bool)$p['is_active'] : true,
                'created_at'            => $p['created_at'] ?? date('Y-m-d H:i:s'),
                'createdAt'             => $p['created_at'] ?? date('Y-m-d H:i:s'),
                'updated_at'            => $p['updated_at'] ?? date('Y-m-d H:i:s'),
                'updatedAt'             => $p['updated_at'] ?? date('Y-m-d H:i:s'),
                'progress_logs'         => $finalLogs,
                'progressLogs'          => $finalLogs,
                'daily_logs'            => $finalLogs,
                'dailyLogs'             => $finalLogs,
            ];
        }

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'        => 'success',
            'success'       => true,
            'message'       => 'Daftar pasien berhasil diambil.',
            'total'         => count($formattedPatients),
            'data'          => $formattedPatients,
            'items'         => $formattedPatients,
            'patients'      => $formattedPatients,
            'progress_logs' => (!empty($patientId) && count($formattedPatients) > 0) ? ($formattedPatients[0]['progress_logs'] ?? []) : []
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // =========================================================================
    // 4. POST PATIENTS (Save, Soft Delete, Restore, Permanent Delete)
    // =========================================================================
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $action = strtolower(trim((string)($input['action'] ?? 'save')));
        $pid = trim((string)($input['id'] ?? $input['patient_id'] ?? $input['patientId'] ?? ''));

        // A. Soft Delete
        if ($action === 'delete' || $action === 'soft_delete' || (isset($input['is_deleted']) && ($input['is_deleted'] === 1 || $input['is_deleted'] === '1' || $input['is_deleted'] === true || $input['is_deleted'] === 'true') && $action !== 'save')) {
            if (empty($pid)) {
                throw new Exception('ID pasien wajib diisi untuk soft delete.');
            }

            $sets = [];
            $params = [':id' => $pid];
            if (in_array('is_deleted', $tableCols)) $sets[] = "`is_deleted` = 1";
            if (in_array('deleted_at', $tableCols)) $sets[] = "`deleted_at` = NOW()";
            if (in_array('updated_at', $tableCols)) $sets[] = "`updated_at` = NOW()";
            if (in_array('status', $tableCols)) $sets[] = "`status` = 'deleted'";
            if (empty($sets)) $sets[] = "`id` = :id";

            $sql = "UPDATE `patients` SET " . implode(', ', $sets) . " WHERE `id` = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            while (ob_get_level() > 0) ob_end_clean();
            http_response_code(200);
            echo json_encode([
                'status'     => 'success',
                'success'    => true,
                'message'    => 'Pasien berhasil dipindahkan ke sampah.',
                'id'         => $pid,
                'new_status' => 'deleted',
                'is_deleted' => true
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // B. Restore
        if ($action === 'restore' || (isset($input['restore']) && ($input['restore'] === true || $input['restore'] === 'true'))) {
            if (empty($pid)) {
                throw new Exception('ID pasien wajib diisi untuk restore.');
            }

            $sets = [];
            $params = [':id' => $pid];
            if (in_array('is_deleted', $tableCols)) $sets[] = "`is_deleted` = 0";
            if (in_array('deleted_at', $tableCols)) $sets[] = "`deleted_at` = NULL";
            if (in_array('updated_at', $tableCols)) $sets[] = "`updated_at` = NOW()";
            if (in_array('status', $tableCols)) $sets[] = "`status` = 'Rawat NICU'";
            if (empty($sets)) $sets[] = "`id` = :id";

            $sql = "UPDATE `patients` SET " . implode(', ', $sets) . " WHERE `id` = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            while (ob_get_level() > 0) ob_end_clean();
            http_response_code(200);
            echo json_encode([
                'status'     => 'success',
                'success'    => true,
                'message'    => 'Pasien berhasil dipulihkan.',
                'id'         => $pid,
                'new_status' => 'Rawat NICU',
                'is_deleted' => false
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // C. Hard Delete
        if ($action === 'permanent_delete' || $action === 'hard_delete') {
            if (empty($pid)) {
                throw new Exception('ID pasien wajib diisi untuk hapus permanen.');
            }
            try {
                $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = :id");
                $delLogs->execute([':id' => $pid]);
            } catch (Throwable $e) {}

            $delP = $pdo->prepare("DELETE FROM `patients` WHERE `id` = :id");
            $delP->execute([':id' => $pid]);

            while (ob_get_level() > 0) ob_end_clean();
            http_response_code(200);
            echo json_encode([
                'status'  => 'success',
                'success' => true,
                'message' => 'Pasien berhasil dihapus permanen.',
                'id'      => $pid
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // D. Insert / Update Pasien
        $babyName = trim((string)($input['baby_name'] ?? ($input['babyName'] ?? ($input['name'] ?? ($input['nickname'] ?? '')))));
        if (empty($pid)) {
            $pid = 'patient_' . time() . '_' . substr(md5(uniqid()), 0, 5);
        }
        if (empty($babyName)) {
            $babyName = 'Bayi ' . ($input['nickname'] ?? 'NICU');
        }

        $parentName = trim((string)($input['parent_name'] ?? ($input['parentName'] ?? ($input['father_name'] ?? ($input['mother_name'] ?? '')))));
        $fatherName = trim((string)($input['father_name'] ?? ($input['fatherName'] ?? $parentName)));
        $motherName = trim((string)($input['mother_name'] ?? ($input['motherName'] ?? '')));
        $mrn = trim((string)($input['medical_record_number'] ?? ($input['medicalRecordNumber'] ?? ($input['med_record_number'] ?? ($input['mrn'] ?? '')))));
        $room = trim((string)($input['room_number'] ?? ($input['roomNumber'] ?? ($input['room'] ?? ''))));
        $password = trim((string)($input['access_password'] ?? ($input['accessPassword'] ?? ($input['password'] ?? '123456'))));

        // Mapping kandidat data ke berbagai nama kolom yang mungkin ada di MySQL
        $candidateData = [
            'id'                    => $pid,
            'nickname'              => !empty($input['nickname']) ? trim((string)$input['nickname']) : $babyName,
            'baby_name'             => $babyName,
            'name'                  => $babyName,
            'parent_name'           => $parentName,
            'father_name'           => $fatherName,
            'mother_name'           => $motherName,
            'parent_phone'          => $input['parent_phone'] ?? ($input['parentPhone'] ?? ''),
            'gender'                => $input['gender'] ?? 'Laki-Laki',
            'birth_date'            => $input['birth_date'] ?? ($input['birthDate'] ?? date('Y-m-d')),
            'birth_time'            => $input['birth_time'] ?? ($input['birthTime'] ?? '00:00'),
            'admission_date'        => $input['admission_date'] ?? ($input['admissionDate'] ?? date('Y-m-d')),
            'gestational_age_weeks' => intval($input['gestational_age_weeks'] ?? ($input['gestationalAgeWeeks'] ?? ($input['gestational_age'] ?? 36))),
            'gestational_age'       => intval($input['gestational_age'] ?? ($input['gestational_age_weeks'] ?? ($input['gestationalAgeWeeks'] ?? 36))),
            'gestation_category'    => $input['gestation_category'] ?? ($input['gestationCategory'] ?? 'preterm'),
            'status'                => $input['status'] ?? 'Rawat NICU',
            'medical_record_number' => $mrn,
            'med_record_number'     => $mrn,
            'mrn'                   => $mrn,
            'room_number'           => $room,
            'room'                  => $room,
            'access_password'       => $password,
            'password'              => $password,
            'cover_photo_url'       => $input['cover_photo_url'] ?? ($input['coverPhotoUrl'] ?? null),
            'initial_anthropometry' => safeJsonEncode($input['initial_anthropometry'] ?? ($input['initialAnthropometry'] ?? null)),
            'current_equipment'     => safeJsonEncode($input['current_equipment'] ?? ($input['currentEquipment'] ?? null)),
            'registered_equipment'  => safeJsonEncode($input['registered_equipment'] ?? ($input['registeredEquipment'] ?? null)),
            'required_equipment'    => safeJsonEncode($input['required_equipment'] ?? ($input['requiredEquipment'] ?? null)),
            'milestones'            => safeJsonEncode($input['milestones'] ?? null),
            'immunization_discharge'=> safeJsonEncode($input['immunization_discharge'] ?? ($input['immunizationDischarge'] ?? null)),
            'discharge_summary'     => safeJsonEncode($input['discharge_summary'] ?? ($input['dischargeSummary'] ?? null)),
            'discharged_at'         => $input['discharged_at'] ?? ($input['dischargedAt'] ?? null),
            'is_deleted'            => (isset($input['is_deleted']) && ($input['is_deleted'] === 1 || $input['is_deleted'] === '1' || $input['is_deleted'] === true)) ? 1 : 0,
            'is_active'             => 1,
        ];

        // Parse & Simpan logs jika dikirim bersama payload
        $rawLogs = $input['progress_logs'] ?? ($input['progressLogs'] ?? ($input['daily_logs'] ?? ($input['dailyLogs'] ?? null)));
        if (!empty($rawLogs)) {
            $parsedLogs = safeJsonDecode($rawLogs, []);
            if (is_array($parsedLogs)) {
                $candidateData['progress_logs'] = safeJsonEncode($parsedLogs);
                $candidateData['daily_logs'] = safeJsonEncode($parsedLogs);
            }
        }

        // Dynamic Query Builder berdasarkan kolom riil tabel di MySQL
        $insertCols = [];
        $placeholders = [];
        $updateAssignments = [];
        $execParams = [];

        foreach ($candidateData as $col => $val) {
            if (in_array(strtolower($col), $tableCols)) {
                $insertCols[] = "`$col`";
                $placeholders[] = ":$col";
                $execParams[":$col"] = $val;

                if ($col === 'id') continue;
                if ($col === 'access_password' || $col === 'password') {
                    $updateAssignments[] = "`$col` = IF(VALUES(`$col`) != '', VALUES(`$col`), `$col`)";
                } elseif ($col === 'cover_photo_url') {
                    $updateAssignments[] = "`cover_photo_url` = COALESCE(VALUES(`cover_photo_url`), `cover_photo_url`)";
                } else {
                    $updateAssignments[] = "`$col` = VALUES(`$col`)";
                }
            }
        }

        if (in_array('created_at', $tableCols)) {
            $insertCols[] = "`created_at`";
            $placeholders[] = "NOW()";
        }
        if (in_array('updated_at', $tableCols)) {
            $insertCols[] = "`updated_at`";
            $placeholders[] = "NOW()";
            $updateAssignments[] = "`updated_at` = NOW()";
        }

        if (empty($insertCols)) {
            throw new Exception('Struktur kolom tabel patients tidak sesuai.');
        }

        $sql = "INSERT INTO `patients` (" . implode(', ', $insertCols) . ") VALUES (" . implode(', ', $placeholders) . ")";
        if (!empty($updateAssignments)) {
            $sql .= " ON DUPLICATE KEY UPDATE " . implode(', ', $updateAssignments);
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($execParams);

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'     => 'success',
            'success'    => true,
            'message'    => "Data pasien '{$babyName}' berhasil disimpan.",
            'id'         => $pid,
            'baby_name'  => $babyName,
            'name'       => $babyName,
            'status'     => $candidateData['status']
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    throw new Exception('Metode HTTP ' . $method . ' tidak didukung.');

} catch (Throwable $e) {
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200); // Mengembalikan HTTP 200 dengan payload JSON error agar frontend tidak crash 500
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => $e->getMessage(),
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
