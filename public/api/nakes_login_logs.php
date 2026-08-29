<?php
/**
 * Endpoint API: Nakes Login Logs
 * Path: /api/nakes_login_logs.php
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Cari lokasi file database.php secara dinamis
    $possiblePaths = [
        __DIR__ . '/../config/database.php',
        __DIR__ . '/config/database.php',
        __DIR__ . '/database.php',
        __DIR__ . '/../includes/database.php',
        __DIR__ . '/../db.php'
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
    if (function_exists('getDbConnection')) {
        $pdo = getDbConnection();
    } elseif (class_exists('Database')) {
        $pdo = Database::getConnection();
    } else {
        throw new Exception("Fungsi koneksi Database tidak ditemukan.");
    }

    // 1. Cek kolom yang tersedia di tabel nakes_login_logs
    $existingColumns = [];
    $stmt = $pdo->query("SHOW COLUMNS FROM `nakes_login_logs`");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $existingColumns[] = $row['Field'];
    }

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

    echo json_encode([
        'status'    => 'success',
        'message'   => 'Daftar log login berhasil diambil.',
        'data'      => $logs,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal memuat log login: ' . $e->getMessage(),
        'data'    => [
            'file' => basename($e->getFile()),
            'line' => $e->getLine()
        ],
        'timestamp' => date('c')
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
}
