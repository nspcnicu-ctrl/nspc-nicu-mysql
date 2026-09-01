<?php
/**
 * ============================================================================
 * ENDPOINT: /api/delete_patient.php
 * Endpoint Khusus Hapus Permanen & Soft Delete Pasien MySQL
 * Koneksi database dipanggil terpusat melalui /config/database.php
 * ============================================================================
 */

ob_start();
error_reporting(0);
ini_set('display_errors', '0');

// 1. Muat CORS Handler jika tersedia, atau atur Header CORS standar
if (file_exists(__DIR__ . '/config/cors.php')) {
    require_once __DIR__ . '/config/cors.php';
} else {
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
}

try {
    // 2. Muat Konfigurasi Database Terpusat dari /config/database.php
    if (file_exists(__DIR__ . '/config/database.php')) {
        require_once __DIR__ . '/config/database.php';
    } elseif (file_exists(__DIR__ . '/database.php')) {
        require_once __DIR__ . '/database.php';
    } else {
        throw new Exception('File konfigurasi database (database.php) tidak ditemukan.');
    }

    // 3. Inisialisasi Koneksi PDO
    $pdo = null;
    if (class_exists('Database') && method_exists('Database', 'getConnection')) {
        $pdo = Database::getConnection();
    } elseif (function_exists('getDbConnection')) {
        $pdo = getDbConnection();
    } elseif (isset($conn) && $conn instanceof PDO) {
        $pdo = $conn;
    }

    if (!$pdo) {
        throw new Exception('Koneksi database PDO tidak dapat diinisialisasi.');
    }

    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true) ?: $_POST;

    $id = trim((string)($_GET['id'] ?? ($input['id'] ?? ($input['patient_id'] ?? ($input['patientId'] ?? '')))));
    $mrn = trim((string)($_GET['mrn'] ?? ($input['medical_record_number'] ?? ($input['medicalRecordNumber'] ?? ($input['mrn'] ?? '')))));
    $action = strtolower(trim((string)($_GET['action'] ?? ($input['action'] ?? 'permanent_delete'))));
    $method = $_SERVER['REQUEST_METHOD'] ?? 'POST';

    // -------------------------------------------------------------------------
    // Aksi 1: Kosongkan Tempat Sampah (Empty Trash)
    // -------------------------------------------------------------------------
    if ($action === 'empty_trash' || $action === 'clear_trash') {
        $inputIds = $input['ids'] ?? [];
        $inputMrns = $input['medical_record_numbers'] ?? [];

        try {
            $pdo->exec("DELETE FROM `daily_logs` WHERE `patient_id` IN (SELECT `id` FROM `patients` WHERE `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan')");
            $pdo->exec("DELETE FROM `education_pdfs` WHERE `patient_id` IN (SELECT `id` FROM `patients` WHERE `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan')");
        } catch (Throwable $e) {}

        if (!empty($inputIds) && is_array($inputIds)) {
            $inClause = implode(',', array_fill(0, count($inputIds), '?'));
            try {
                $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` IN ($inClause)");
                $delLogs->execute($inputIds);
            } catch (Throwable $e) {}
            try {
                $delPdf = $pdo->prepare("DELETE FROM `education_pdfs` WHERE `patient_id` IN ($inClause)");
                $delPdf->execute($inputIds);
            } catch (Throwable $e) {}
            $delP = $pdo->prepare("DELETE FROM `patients` WHERE `id` IN ($inClause) OR `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan'");
            $delP->execute($inputIds);
        } else {
            $delP = $pdo->prepare("DELETE FROM `patients` WHERE `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan'");
            $delP->execute();
        }
        $count = $delP->rowCount();

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'        => 'success',
            'success'       => true,
            'message'       => "Tempat sampah berhasil dikosongkan ($count pasien dihapus permanen).",
            'deleted_count' => $count,
            'timestamp'     => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    if (empty($id) && empty($mrn)) {
        throw new Exception('ID Pasien atau No. RM wajib disertakan.');
    }

    // -------------------------------------------------------------------------
    // Aksi 2: Soft Delete (Pindahkan ke Tempat Sampah)
    // -------------------------------------------------------------------------
    if ($action === 'soft_delete' || $action === 'trash' || (isset($input['is_deleted']) && $input['is_deleted'] == 1 && $action !== 'permanent_delete')) {
        if (!empty($mrn)) {
            $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 1, `status` = 'deleted', `deleted_at` = NOW(), `updated_at` = NOW() WHERE `id` = :id OR `medical_record_number` = :mrn");
            $stmt->execute([':id' => $id, ':mrn' => $mrn]);
        } else {
            $stmt = $pdo->prepare("UPDATE `patients` SET `is_deleted` = 1, `status` = 'deleted', `deleted_at` = NOW(), `updated_at` = NOW() WHERE `id` = :id");
            $stmt->execute([':id' => $id]);
        }

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Pasien berhasil dipindahkan ke sampah.',
            'id'        => $id,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    // -------------------------------------------------------------------------
    // Aksi 3: Hapus Permanen Pasien & Daily Logs Terkait (Default)
    // -------------------------------------------------------------------------
    try {
        if (!empty($mrn)) {
            $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = :id OR `patient_id` = :mrn");
            $delLogs->execute([':id' => $id, ':mrn' => $mrn]);
            $delPdfs = $pdo->prepare("DELETE FROM `education_pdfs` WHERE `patient_id` = :id OR `patient_id` = :mrn");
            $delPdfs->execute([':id' => $id, ':mrn' => $mrn]);
        } else {
            $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = :id");
            $delLogs->execute([':id' => $id]);
            $delPdfs = $pdo->prepare("DELETE FROM `education_pdfs` WHERE `patient_id` = :id");
            $delPdfs->execute([':id' => $id]);
        }
    } catch (Throwable $e) {}

    if (!empty($mrn)) {
        $delP = $pdo->prepare("DELETE FROM `patients` WHERE `id` = :id OR `medical_record_number` = :mrn");
        $delP->execute([':id' => $id, ':mrn' => $mrn]);
    } else {
        $delP = $pdo->prepare("DELETE FROM `patients` WHERE `id` = :id");
        $delP->execute([':id' => $id]);
    }

    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'status'    => 'success',
        'success'   => true,
        'message'   => 'Pasien berhasil dihapus permanen dari MySQL.',
        'id'        => $id,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;

} catch (Throwable $e) {
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => $e->getMessage(),
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

