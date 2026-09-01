<?php
/**
 * ============================================================================
 * ENDPOINT: /api/nakes_users.php
 * Manajemen Akun Tenaga Kesehatan (Nakes) & Hak Akses NICU
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
        throw new Exception("File konfigurasi database (database.php) tidak ditemukan.");
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
        throw new Exception("Koneksi database PDO gagal diinisialisasi.");
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Helper pembaca JSON input
    $rawInput = file_get_contents('php://input');
    $input = !empty($rawInput) ? json_decode($rawInput, true) : null;
    if (!is_array($input)) {
        $input = $_POST;
    }

    // -------------------------------------------------------------------------
    // GET: Ambil Daftar Pengguna Nakes
    // -------------------------------------------------------------------------
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM `nakes_users` ORDER BY `created_at` ASC");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($users as &$u) {
            $u['isSuperAdmin']    = (bool)($u['is_super_admin'] ?? false);
            $u['hasAccessRights'] = (bool)($u['has_access_rights'] ?? true);
            $u['roleTitle']       = $u['role_title'] ?? 'Tenaga Kesehatan';
            $u['accountType']     = $u['account_type'] ?? 'nakes';
        }

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Daftar nakes berhasil diambil.',
            'data'      => $users,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    // -------------------------------------------------------------------------
    // POST: Simpan, Edit, atau Hapus Nakes
    // -------------------------------------------------------------------------
    if ($method === 'POST') {
        $action = strtolower(trim((string)($input['action'] ?? 'save')));

        // Aksi Hapus Nakes
        if ($action === 'delete') {
            $id = trim((string)($input['id'] ?? ''));
            if (!empty($id)) {
                $stmt = $pdo->prepare("DELETE FROM `nakes_users` WHERE `id` = :id");
                $stmt->execute([':id' => $id]);

                while (ob_get_level() > 0) ob_end_clean();
                http_response_code(200);
                echo json_encode([
                    'status'    => 'success',
                    'success'   => true,
                    'message'   => 'Akun nakes berhasil dihapus dari MySQL.',
                    'data'      => ['id' => $id],
                    'timestamp' => date('c')
                ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
                exit;
            }
            
            while (ob_get_level() > 0) ob_end_clean();
            http_response_code(200);
            echo json_encode([
                'status'    => 'error',
                'success'   => false,
                'message'   => 'ID Nakes tidak valid untuk dihapus.',
                'data'      => null,
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }

        // Aksi Simpan / Tambah / Edit Nakes (Upsert)
        $id              = !empty($input['id']) ? trim((string)$input['id']) : ('nakes_' . time() . '_' . rand(10, 99));
        $name            = trim((string)($input['name'] ?? 'Tenaga Kesehatan'));
        $roleTitle       = trim((string)($input['role_title'] ?? $input['roleTitle'] ?? $input['role'] ?? 'Tenaga Kesehatan'));
        $accountType     = trim((string)($input['account_type'] ?? $input['accountType'] ?? 'nakes'));
        $username        = trim((string)($input['username'] ?? strtolower(str_replace(' ', '', $name))));
        $pin             = trim((string)($input['pin'] ?? '123456'));
        $isSuperAdmin    = (!empty($input['is_super_admin']) || !empty($input['isSuperAdmin'])) ? 1 : 0;
        $hasAccessRights = (!empty($input['has_access_rights']) || !empty($input['hasAccessRights'])) ? 1 : 0;

        $sql = "INSERT INTO `nakes_users` (
                    `id`, `name`, `role_title`, `account_type`, `username`, `pin`, `is_super_admin`, `has_access_rights`, `created_at`, `updated_at`
                ) VALUES (
                    :id, :name, :role_title, :account_type, :username, :pin, :is_super_admin, :has_access_rights, NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE
                    `name`              = VALUES(`name`),
                    `role_title`        = VALUES(`role_title`),
                    `account_type`      = VALUES(`account_type`),
                    `username`          = VALUES(`username`),
                    `pin`               = VALUES(`pin`),
                    `is_super_admin`    = VALUES(`is_super_admin`),
                    `has_access_rights` = VALUES(`has_access_rights`),
                    `updated_at`        = NOW()";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id'                => $id,
            ':name'              => $name,
            ':role_title'        => $roleTitle,
            ':account_type'      => $accountType,
            ':username'          => $username,
            ':pin'               => $pin,
            ':is_super_admin'    => $isSuperAdmin,
            ':has_access_rights' => $hasAccessRights
        ]);

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Data nakes berhasil disimpan di MySQL.',
            'data'      => ['id' => $id, 'name' => $name],
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => 'Metode HTTP tidak didukung.',
        'data'      => null,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;

} catch (Throwable $e) {
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => 'Gagal memproses data nakes: ' . $e->getMessage(),
        'data'      => null,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

