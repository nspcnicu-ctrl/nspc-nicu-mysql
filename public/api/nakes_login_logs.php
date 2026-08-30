<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Auth-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(200);
    exit(0);
}

header('Content-Type: application/json; charset=utf-8');

try {
    $possiblePaths = [
        __DIR__ . '/config/database.php',
        __DIR__ . '/../config/database.php',
        __DIR__ . '/database.php'
    ];

    $dbLoaded = false;
    foreach ($possiblePaths as $path) {
        if (file_exists($path)) {
            require_once $path;
            $dbLoaded = true;
            break;
        }
    }

    if (!$dbLoaded) {
        throw new Exception("File database.php tidak ditemukan di direktori server.");
    }

    // Ambil koneksi PDO
    if (class_exists('Database')) {
        $pdo = Database::getConnection();
    } elseif (function_exists('getDbConnection')) {
        $pdo = getDbConnection();
    } else {
        throw new Exception("Fungsi koneksi Database tidak ditemukan.");
    }

    // 1. Cek kolom yang tersedia di tabel nakes_login_logs
    $existingColumns = [];
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM `nakes_login_logs`");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $existingColumns[] = strtolower($row['Field']);
        }
    } catch (Throwable $e) {}

    // 2. Susun SELECT dinamis
    $selectFields = ['id'];
    
    $selectFields[] = in_array('user_name', $existingColumns) ? 'user_name' : "'' AS user_name";
    $selectFields[] = in_array('user_id', $existingColumns) ? 'user_id' : "'' AS user_id";
    $selectFields[] = in_array('role_title', $existingColumns) ? 'role_title' : "'' AS role_title";
    $selectFields[] = in_array('account_type', $existingColumns) ? 'account_type' : "'' AS account_type";
    $selectFields[] = in_array('ip_address', $existingColumns) ? 'ip_address' : "'' AS ip_address";
    $selectFields[] = in_array('user_agent', $existingColumns) ? 'user_agent' : "'' AS user_agent";
    
    if (in_array('login_time', $existingColumns)) {
        $selectFields[] = 'login_time';
    } elseif (in_array('created_at', $existingColumns)) {
        $selectFields[] = 'created_at AS login_time';
    } else {
        $selectFields[] = "NOW() AS login_time";
    }

    if (in_array('created_at', $existingColumns)) {
        $selectFields[] = 'created_at';
    }

    $query = "SELECT " . implode(", ", $selectFields) . " FROM `nakes_login_logs` ORDER BY id DESC LIMIT 100";

    $stmt = $pdo->query($query);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    echo json_encode([
        'status'    => 'success',
        'success'   => true,
        'message'   => 'Daftar log login berhasil diambil.',
        'data'      => $logs,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;

} catch (Throwable $e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(200);
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => 'Gagal memuat log login: ' . $e->getMessage(),
        'data'      => [],
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
