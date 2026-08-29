<?php
/**
 * ============================================================================
 * NSPC NICU RSUD UNDATA - DATABASE CONFIGURATION
 * ============================================================================
 * Sesuaikan informasi di bawah ini dengan database MySQL di cPanel Niagahoster.
 */

return [
    'host'     => getenv('DB_HOST')     ?: 'localhost',
    'port'     => getenv('DB_PORT')     ?: '3306',
    'database' => getenv('DB_NAME')     ?: 'nspc_nicu_db',
    'username' => getenv('DB_USER')     ?: 'root',
    'password' => getenv('DB_PASS')     ?: '',
    'charset'  => 'utf8mb4',
    'timezone' => '+08:00', // Waktu Indonesia Tengah (WITA / Palu)
    
    // Konfigurasi Upload Berkas
    'upload_dir' => dirname(__DIR__) . '/uploads/',
    'base_url'   => (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/api/'
];
