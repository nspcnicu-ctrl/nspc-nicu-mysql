<?php
/**
 * ============================================================================
 * ENDPOINT: /api/nakes_login_logs.php
 * Pencatatan & Riwayat Log Aktivitas Login Nakes NICU
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
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

    // -------------------------------------------------------------------------
    // POST: Simpan Log Login Nakes
    // -------------------------------------------------------------------------
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $userName    = trim((string)($input['user_name'] ?? $input['userName'] ?? $input['name'] ?? 'Tenaga Kesehatan'));
        $userId      = !empty($input['user_id']) ? trim((string)$input['user_id']) : (!empty($input['userId']) ? trim((string)$input['userId']) : null);
        $roleTitle   = trim((string)($input['role_title'] ?? $input['roleTitle'] ?? 'Tenaga Kesehatan'));
        $accountType = trim((string)($input['account_type'] ?? $input['accountType'] ?? 'nakes'));
        
        $ipAddress = trim((string)($input['ip_address'] ?? $input['ipAddress'] ?? ''));
        if (empty($ipAddress)) {
            $ipAddress = $_SERVER['HTTP_CLIENT_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            if (strpos($ipAddress, ',') !== false) {
                $ipAddress = trim(explode(',', $ipAddress)[0]);
            }
        }

        $userAgent = trim((string)($input['user_agent'] ?? $input['userAgent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? 'Web Browser')));
        $loginTime = trim((string)($input['login_time'] ?? $input['loginTime'] ?? date('Y-m-d H:i:s')));

        $stmt = $pdo->prepare("
            INSERT INTO `nakes_login_logs` 
            (`user_name`, `user_id`, `role_title`, `account_type`, `ip_address`, `user_agent`, `login_time`, `created_at`) 
            VALUES 
            (:user_name, :user_id, :role_title, :account_type, :ip_address, :user_agent, :login_time, NOW())
        ");
        
        $stmt->execute([
            ':user_name'    => $userName,
            ':user_id'      => $userId,
            ':role_title'   => $roleTitle,
            ':account_type' => $accountType,
            ':ip_address'   => $ipAddress,
            ':user_agent'   => $userAgent,
            ':login_time'   => $loginTime,
        ]);

        $newId = $pdo->lastInsertId();

        while (ob_get_level() > 0) ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Log aktivitas login nakes berhasil dicatat.',
            'data'      => ['id' => $newId, 'user_name' => $userName, 'login_time' => $loginTime],
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    // -------------------------------------------------------------------------
    // GET: Ambil Daftar Log Login Nakes
    // -------------------------------------------------------------------------
    $stmt = $pdo->query("SELECT * FROM `nakes_login_logs` ORDER BY `id` DESC LIMIT 100");
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'status'    => 'success',
        'success'   => true,
        'message'   => 'Daftar log login berhasil diambil.',
        'data'      => $logs,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;

} catch (Throwable $e) {
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => 'Gagal memproses log login nakes: ' . $e->getMessage(),
        'data'      => [],
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

