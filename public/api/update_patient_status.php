<?php
/**
 * ============================================================================
 * ENDPOINT: /api/update_patient_status.php (GET, POST, OPTIONS)
 * Deskripsi: Endpoint untuk Update Status Pasien & Soft Delete / Restore
 * ============================================================================
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Jika dibuka via browser (GET), tampilkan info endpoint
if ($method === 'GET') {
    sendJsonResponse('success', 'Endpoint update_patient_status.php aktif dan siap menerima request POST.', [
        'usage' => [
            'method' => 'POST',
            'actions' => [
                'update_status' => ['id' => 'ID_PASIEN', 'action' => 'update_status', 'status' => 'Siap Pulang'],
                'delete'        => ['id' => 'ID_PASIEN', 'action' => 'delete'],
                'restore'       => ['id' => 'ID_PASIEN', 'action' => 'restore'],
                'permanent_delete' => ['id' => 'ID_PASIEN', 'action' => 'permanent_delete']
            ]
        ]
    ]);
}

if ($method === 'POST') {
    try {
        $input = getJsonInputBody();
        if (empty($input)) {
            $input = $_POST;
        }

        $patientId = trim($input['id'] ?? $input['patient_id'] ?? '');
        $action    = strtolower(trim($input['action'] ?? 'update_status'));

        if (empty($patientId)) {
            sendJsonResponse('error', 'ID Pasien wajib disertakan.', null, 400);
        }

        // 1. SOFT DELETE
        if ($action === 'delete' || $action === 'soft_delete') {
            $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 1, `deleted_at` = NOW(), `updated_at` = NOW() WHERE `id` = :id");
            $stmt->execute([':id' => $patientId]);

            sendJsonResponse('success', 'Pasien berhasil dipindahkan ke tempat sampah (Soft Delete).', [
                'id'         => $patientId,
                'is_deleted' => true,
                'action'     => 'delete'
            ]);
        }

        // 2. PERMANENT DELETE
        if ($action === 'permanent_delete' || $action === 'hard_delete') {
            $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = :id")->execute([':id' => $patientId]);
            $stmt = $pdo->prepare("DELETE FROM `patients` WHERE `id` = :id");
            $stmt->execute([':id' => $patientId]);

            sendJsonResponse('success', 'Data pasien berhasil dihapus permanen.', [
                'id'         => $patientId,
                'action'     => 'permanent_delete'
            ]);
        }

        // 3. RESTORE
        if ($action === 'restore') {
            $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 0, `deleted_at` = NULL, `updated_at` = NOW() WHERE `id` = :id");
            $stmt->execute([':id' => $patientId]);

            sendJsonResponse('success', 'Data pasien berhasil dipulihkan.', [
                'id'         => $patientId,
                'is_deleted' => false,
                'action'     => 'restore'
            ]);
        }

        // 4. UPDATE STATUS
        if ($action === 'update_status' || $action === 'save_status') {
            $newStatus = trim($input['status'] ?? '');
            $dischargeSummary = !empty($input['discharge_summary']) 
                ? (is_string($input['discharge_summary']) ? $input['discharge_summary'] : json_encode($input['discharge_summary'], JSON_UNESCAPED_UNICODE))
                : null;

            $statusMap = [
                'rawat_nicu'   => 'Rawat NICU',
                'rawat nicu'   => 'Rawat NICU',
                'siap_pulang'  => 'Siap Pulang',
                'siap pulang'  => 'Siap Pulang',
                'sudah_pulang' => 'Sudah Pulang',
                'sudah pulang' => 'Sudah Pulang',
                'pulang'       => 'Sudah Pulang'
            ];

            $normalizedStatus = $statusMap[strtolower($newStatus)] ?? $newStatus;

            if (empty($normalizedStatus)) {
                sendJsonResponse('error', 'Parameter status baru wajib diisi.', null, 400);
            }

            $dischargedAtSql = ($normalizedStatus === 'Sudah Pulang') 
                ? "COALESCE(`discharged_at`, NOW())" 
                : "NULL";

            $sql = "
                UPDATE `patients` 
                SET `status` = :status,
                    `discharged_at` = {$dischargedAtSql},
                    `discharge_summary` = COALESCE(:disc_summary, `discharge_summary`),
                    `updated_at` = NOW() 
                WHERE `id` = :id
            ";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':status'       => $normalizedStatus,
                ':disc_summary' => $dischargeSummary,
                ':id'           => $patientId
            ]);

            sendJsonResponse('success', "Status pasien berhasil diperbarui menjadi '{$normalizedStatus}'.", [
                'id'             => $patientId,
                'status'         => $normalizedStatus,
                'status_slug'    => strtolower(str_replace(' ', '_', $normalizedStatus)),
                'discharge_time' => date('c')
            ]);
        }

        sendJsonResponse('error', "Aksi '{$action}' tidak dikenal.", null, 400);

    } catch (PDOException $e) {
        sendJsonResponse('error', 'Terjadi kesalahan database: ' . $e->getMessage(), null, 200);
    }
}
