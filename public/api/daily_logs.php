<?php
/**
 * ============================================================================
 * ENDPOINT: /api/daily_logs.php (GET, POST, OPTIONS)
 * ============================================================================
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// GET DAILY LOGS
if ($method === 'GET') {
    try {
        $patientId = trim($_GET['patient_id'] ?? $_GET['patientId'] ?? $_GET['id'] ?? '');

        if (!empty($patientId)) {
            $stmt = $pdo->prepare("
                SELECT id, patient_id, log_date, period_label, weight_gram, weight_change_gram,
                       vital_signs, drinking_ability, active_equipment, milestones_list,
                       nakes_notes, updated_by, photo_url, photo_caption, created_at, updated_at
                FROM daily_logs 
                WHERE patient_id = :pid 
                ORDER BY log_date ASC, created_at ASC
            ");
            $stmt->execute([':pid' => $patientId]);
        } else {
            $limit = isset($_GET['limit']) ? max(1, min(500, intval($_GET['limit']))) : 100;
            $stmt = $pdo->prepare("
                SELECT id, patient_id, log_date, period_label, weight_gram, weight_change_gram,
                       vital_signs, drinking_ability, active_equipment, milestones_list,
                       nakes_notes, updated_by, photo_url, photo_caption, created_at, updated_at
                FROM daily_logs 
                ORDER BY log_date DESC, created_at DESC 
                LIMIT " . intval($limit)
            );
            $stmt->execute();
        }

        $logs = $stmt->fetchAll();

        foreach ($logs as &$log) {
            foreach (['vital_signs', 'drinking_ability', 'active_equipment', 'milestones_list'] as $jf) {
                if (!empty($log[$jf]) && is_string($log[$jf])) {
                    $decoded = json_decode($log[$jf], true);
                    $log[$jf] = is_array($decoded) ? $decoded : $log[$jf];
                }
            }
            $log['weight_gram'] = intval($log['weight_gram']);
            $log['weight_change_gram'] = intval($log['weight_change_gram']);

            // CamelCase Formatting
            $log['patientId']       = $log['patient_id'];
            $log['date']            = $log['log_date'];
            $log['period']          = $log['period_label'];
            $log['weight']          = $log['weight_gram'];
            $log['weightDiff']      = $log['weight_change_gram'];
            $log['vitalSigns']      = $log['vital_signs'];
            $log['drinkingAbility']  = $log['drinking_ability'];
            $log['activeEquipment'] = $log['active_equipment'];
            $log['milestonesList']  = $log['milestones_list'];
            $log['nakesNotes']      = $log['nakes_notes'];
            $log['updatedBy']       = $log['updated_by'];
            $log['photoUrl']        = $log['photo_url'];
            $log['photoCaption']    = $log['photo_caption'];
        }

        sendJsonResponse('success', 'Catatan harian berhasil dimuat.', [
            'total' => count($logs),
            'items' => $logs,
            'logs'  => $logs
        ]);
    } catch (PDOException $e) {
        sendJsonResponse('error', 'Gagal memuat catatan harian: ' . $e->getMessage(), null, 200);
    }
}

// POST DAILY LOG
if ($method === 'POST') {
    try {
        $input = getJsonInputBody();
        if (empty($input)) $input = $_POST;

        $patientId = trim($input['patient_id'] ?? $input['patientId'] ?? '');
        if (empty($patientId)) {
            sendJsonResponse('error', 'Parameter patient_id wajib diisi.', null, 400);
        }

        $logId        = !empty($input['id']) ? trim($input['id']) : ('log_' . time() . '_' . substr(md5(uniqid()), 0, 5));
        $logDate      = trim($input['log_date'] ?? $input['date'] ?? date('Y-m-d'));
        $periodLabel  = trim($input['period_label'] ?? $input['period'] ?? 'Pagi');
        $weightGram   = intval($input['weight_gram'] ?? $input['weight'] ?? 0);
        $weightChange = intval($input['weight_change_gram'] ?? $input['weightDiff'] ?? 0);

        $vitalSigns      = !empty($input['vital_signs'] ?? $input['vitalSigns']) ? json_encode($input['vital_signs'] ?? $input['vitalSigns'], JSON_UNESCAPED_UNICODE) : null;
        $drinkingAbility = !empty($input['drinking_ability'] ?? $input['drinkingAbility']) ? json_encode($input['drinking_ability'] ?? $input['drinkingAbility'], JSON_UNESCAPED_UNICODE) : null;
        $activeEquipment = !empty($input['active_equipment'] ?? $input['activeEquipment']) ? json_encode($input['active_equipment'] ?? $input['activeEquipment'], JSON_UNESCAPED_UNICODE) : null;
        $milestonesList  = !empty($input['milestones_list'] ?? $input['milestonesList']) ? json_encode($input['milestones_list'] ?? $input['milestonesList'], JSON_UNESCAPED_UNICODE) : null;

        $nakesNotes   = trim($input['nakes_notes'] ?? $input['nakesNotes'] ?? '');
        $updatedBy    = trim($input['updated_by'] ?? $input['updatedBy'] ?? 'Nakes NICU');
        $photoUrl     = $input['photo_url'] ?? $input['photoUrl'] ?? null;
        $photoCaption = trim($input['photo_caption'] ?? $input['photoCaption'] ?? '');

        $stmt = $pdo->prepare("
            INSERT INTO daily_logs (
                id, patient_id, log_date, period_label, weight_gram, weight_change_gram,
                vital_signs, drinking_ability, active_equipment, milestones_list,
                nakes_notes, updated_by, photo_url, photo_caption, created_at, updated_at
            ) VALUES (
                :id, :pid, :ldate, :period, :wgram, :wchange,
                :vital, :drink, :equip, :miles,
                :notes, :upby, :photo, :caption, NOW(), NOW()
            )
            ON DUPLICATE KEY UPDATE
                log_date           = VALUES(log_date),
                period_label       = VALUES(period_label),
                weight_gram        = VALUES(weight_gram),
                weight_change_gram = VALUES(weight_change_gram),
                vital_signs        = VALUES(vital_signs),
                drinking_ability   = VALUES(drinking_ability),
                active_equipment   = VALUES(active_equipment),
                milestones_list    = VALUES(milestones_list),
                nakes_notes        = VALUES(nakes_notes),
                updated_by         = VALUES(updated_by),
                photo_url          = COALESCE(VALUES(photo_url), photo_url),
                photo_caption      = VALUES(photo_caption),
                updated_at         = NOW()
        ");

        $stmt->execute([
            ':id'      => $logId,
            ':pid'     => $patientId,
            ':ldate'   => $logDate,
            ':period'  => $periodLabel,
            ':wgram'   => $weightGram,
            ':wchange' => $weightChange,
            ':vital'   => $vitalSigns,
            ':drink'   => $drinkingAbility,
            ':equip'   => $activeEquipment,
            ':miles'   => $milestonesList,
            ':notes'   => $nakesNotes,
            ':upby'    => $updatedBy,
            ':photo'   => $photoUrl,
            ':caption' => $photoCaption
        ]);

        sendJsonResponse('success', 'Catatan harian berhasil disimpan.', ['id' => $logId]);
    } catch (PDOException $e) {
        sendJsonResponse('error', 'Gagal menyimpan catatan harian: ' . $e->getMessage(), null, 200);
    }
}

sendJsonResponse('error', 'Metode HTTP tidak didukung.', null, 405);
