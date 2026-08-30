<?php
/**
 * ============================================================================
 * ENDPOINT: /api/update_patient_status.php
 * Endpoint Khusus Update Status, Soft Delete, Hard Delete & Restore Pasien
 * Mencegah Penimpaan Kolom Lain (Nama, Orang Tua, MRN, dll tetap utuh)
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
    // 1. Muat File Koneksi Database
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

    if (!function_exists('getColsForStatusUpdate')) {
        function getColsForStatusUpdate($pdo, $table = 'patients') {
            try {
                $stmt = $pdo->prepare("DESCRIBE `$table`");
                $stmt->execute();
                $cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
                return array_map('strtolower', $cols);
            } catch (Throwable $e) {
                return [];
            }
        }
    }

    if (!function_exists('safeJsonEncodeStatus')) {
        function safeJsonEncodeStatus($val) {
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

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Endpoint update_patient_status.php aktif dan siap menerima request.',
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // 2. Baca Input JSON / POST
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    if (empty($input) && !empty($_POST)) {
        $input = $_POST;
    }

    $id = trim((string)($input['id'] ?? ($input['patient_id'] ?? ($input['patientId'] ?? ($_GET['id'] ?? '')))));
    $action = strtolower(trim((string)($input['action'] ?? ($_GET['action'] ?? ''))));
    $status = trim((string)($input['status'] ?? ($_GET['status'] ?? '')));
    $isDelParam = isset($input['is_deleted']) && ($input['is_deleted'] === 1 || $input['is_deleted'] === '1' || $input['is_deleted'] === true || $input['is_deleted'] === 'true');

    $tableCols = getColsForStatusUpdate($pdo, 'patients');

    // =========================================================================
    // AKSI 1: Kosongkan Tempat Sampah (Empty Trash)
    // =========================================================================
    if ($action === 'empty_trash' || $action === 'clear_trash' || $action === 'empty_bin') {
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

        if (in_array('is_deleted', $tableCols) && in_array('status', $tableCols)) {
            $sql = "DELETE FROM `patients` WHERE `is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan'";
        } elseif (in_array('is_deleted', $tableCols)) {
            $sql = "DELETE FROM `patients` WHERE `is_deleted` = 1";
        } elseif (in_array('status', $tableCols)) {
            $sql = "DELETE FROM `patients` WHERE `status` = 'deleted' OR `status` = 'Disembunyikan'";
        } else {
            throw new Exception('Tabel tidak memiliki kolom status atau is_deleted.');
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $deletedCount = $stmt->rowCount();

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'        => 'success',
            'success'       => true,
            'message'       => "Berhasil mengosongkan tempat sampah ($deletedCount pasien dihapus permanen).",
            'deleted_count' => $deletedCount
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (empty($id)) {
        throw new Exception('ID Pasien (id / patient_id) wajib disertakan.');
    }

    // =========================================================================
    // AKSI 2: Soft Delete (Pindahkan ke Sampah)
    // =========================================================================
    if ($action === 'delete' || $action === 'soft_delete' || $isDelParam || strtolower($status) === 'deleted' || strtolower($status) === 'disembunyikan') {
        $sets = [];
        $params = [':id' => $id];

        if (in_array('is_deleted', $tableCols)) {
            $sets[] = "`is_deleted` = 1";
        }
        if (in_array('deleted_at', $tableCols)) {
            $sets[] = "`deleted_at` = NOW()";
        }
        if (in_array('updated_at', $tableCols)) {
            $sets[] = "`updated_at` = NOW()";
        }
        if (in_array('status', $tableCols)) {
            $sets[] = "`status` = 'deleted'";
        }
        if (empty($sets)) {
            $sets[] = "`id` = :id";
        }

        $sql = "UPDATE `patients` SET " . implode(', ', $sets) . " WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'     => 'success',
            'success'    => true,
            'message'    => 'Pasien berhasil dipindahkan ke sampah.',
            'id'         => $id,
            'new_status' => 'deleted',
            'is_deleted' => true
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================================
    // AKSI 3: Restore (Pulihkan dari Sampah ke Status Aktif)
    // =========================================================================
    if ($action === 'restore' || (isset($input['restore']) && ($input['restore'] === true || $input['restore'] === 'true'))) {
        $sets = [];
        $params = [':id' => $id];

        if (in_array('is_deleted', $tableCols)) {
            $sets[] = "`is_deleted` = 0";
        }
        if (in_array('deleted_at', $tableCols)) {
            $sets[] = "`deleted_at` = NULL";
        }
        if (in_array('updated_at', $tableCols)) {
            $sets[] = "`updated_at` = NOW()";
        }
        if (in_array('status', $tableCols)) {
            $sets[] = "`status` = 'Rawat NICU'";
        }
        if (empty($sets)) {
            $sets[] = "`id` = :id";
        }

        $sql = "UPDATE `patients` SET " . implode(', ', $sets) . " WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'     => 'success',
            'success'    => true,
            'message'    => 'Pasien berhasil dipulihkan dari sampah.',
            'id'         => $id,
            'new_status' => 'Rawat NICU',
            'is_deleted' => false
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================================
    // AKSI 4: Hard Delete (Hapus Total Permanen)
    // =========================================================================
    if ($action === 'permanent_delete' || $action === 'hard_delete' || $action === 'destroy') {
        try {
            $delLogs = $pdo->prepare("DELETE FROM `daily_logs` WHERE `patient_id` = :id");
            $delLogs->execute([':id' => $id]);
        } catch (Throwable $e) {}

        $delPatient = $pdo->prepare("DELETE FROM `patients` WHERE `id` = :id");
        $delPatient->execute([':id' => $id]);

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'  => 'success',
            'success' => true,
            'message' => 'Pasien berhasil dihapus permanen.',
            'id'      => $id
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================================
    // AKSI 5: Update Status Pasien (Rawat NICU / Siap Pulang / Sudah Pulang)
    // =========================================================================
    if (!empty($status)) {
        $sets = [];
        $params = [':id' => $id];

        if (in_array('status', $tableCols)) {
            $sets[] = "`status` = :status";
            $params[':status'] = $status;
        }

        if (in_array('updated_at', $tableCols)) {
            $sets[] = "`updated_at` = NOW()";
        }

        if ($status === 'Sudah Pulang' && in_array('discharged_at', $tableCols)) {
            $dischargedAtVal = $input['discharged_at'] ?? ($input['dischargedAt'] ?? date('Y-m-d H:i:s'));
            $sets[] = "`discharged_at` = :discharged_at";
            $params[':discharged_at'] = $dischargedAtVal;
        }

        $dischargeSummary = $input['discharge_summary'] ?? ($input['dischargeSummary'] ?? null);
        if ($dischargeSummary !== null && in_array('discharge_summary', $tableCols)) {
            $sets[] = "`discharge_summary` = :discharge_summary";
            $params[':discharge_summary'] = safeJsonEncodeStatus($dischargeSummary);
        }

        if (empty($sets)) {
            $sets[] = "`id` = :id";
        }

        $sql = "UPDATE `patients` SET " . implode(', ', $sets) . " WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'     => 'success',
            'success'    => true,
            'message'    => "Status pasien berhasil diperbarui menjadi '$status'.",
            'id'         => $id,
            'new_status' => $status,
            'status_val' => $status
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    throw new Exception("Parameter 'action' atau 'status' tidak valid.");

} catch (Throwable $e) {
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200); // Mengembalikan HTTP 200 dengan JSON error bersih agar frontend tidak 500
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => $e->getMessage(),
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
