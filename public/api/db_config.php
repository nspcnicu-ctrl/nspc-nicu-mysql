<?php
/**
 * ============================================================================
 * KONFIGURASI DATABASE MYSQL - NSPC RSUD UNDATA
 * ============================================================================
 * Simpan file ini di hosting Anda (misal: /public_html/api/db_config.php)
 */

// Konfigurasi Database Anda
define('DB_HOST', 'localhost'); // atau 127.0.0.1
define('DB_NAME', 'u635930009_nspc_db'); // Nama database sesuai phpMyAdmin Anda
define('DB_USER', 'u635930009_nspc_user'); // Ganti dengan username MySQL hosting Anda
define('DB_PASS', 'GantiDenganPasswordMySQLAnda'); // Ganti dengan password database Anda
define('DB_CHARSET', 'utf8mb4');

function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Gagal koneksi ke database MySQL: ' . $e->getMessage()
            ]);
            exit;
        }
    }
    return $pdo;
}
