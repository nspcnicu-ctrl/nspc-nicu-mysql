<?php
/**
 * Database Connection & Auto-Migrator Setup
 * Chagrin.id API System
 */

define('DB_HOST', 'localhost');
define('DB_USER', 'u635930009_nspc_user'); // Sesuaikan user DB
define('DB_PASS', 'Mysqlku_22');     // Sesuaikan password DB
define('DB_NAME', 'u635930009_nspc_db');   // Sesuaikan nama DB
define('DB_CHAR', 'utf8mb4');

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            try {
                $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHAR;
                $options = [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ];

                self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);

                // Jalankan auto-patch migrasi skema tabel
                DatabaseMigrator::run(self::$instance);

            } catch (PDOException $e) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'status'    => 'error',
                    'message'   => 'Koneksi database gagal: ' . $e->getMessage(),
                    'timestamp' => date('c')
                ], JSON_UNESCAPED_SLASHES);
                exit;
            }
        }
        return self::$instance;
    }
}

class DatabaseMigrator {
    private static bool $hasRun = false;

    public static function run(PDO $pdo): void {
        if (self::$hasRun) {
            return;
        }

        try {
            self::createBaseTables($pdo);
            self::ensureColumnsExist($pdo);
            self::$hasRun = true;
        } catch (Throwable $e) {
            error_log('[DatabaseMigrator Error] ' . $e->getMessage());
        }
    }

    private static function createBaseTables(PDO $pdo): void {
        // Tabel Patients
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `patients` (
                `id` VARCHAR(64) PRIMARY KEY,
                `nickname` VARCHAR(100) NOT NULL,
                `baby_name` VARCHAR(255) NOT NULL,
                `access_password` VARCHAR(100) NOT NULL DEFAULT '123456',
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // Tabel Daily Logs
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `daily_logs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `patient_id` VARCHAR(64) NOT NULL,
                `log_date` DATE NOT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX (`patient_id`),
                INDEX (`log_date`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // Tabel Nakes Login Logs
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `nakes_login_logs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_name` VARCHAR(255) NOT NULL DEFAULT '',
                `login_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    }

    private static function ensureColumnsExist(PDO $pdo): void {
        // --- PATCH TABEL `patients` ---
        self::addColumnIfMissing($pdo, 'patients', 'nickname', "VARCHAR(100) NOT NULL DEFAULT '' AFTER `id`");
        self::addColumnIfMissing($pdo, 'patients', 'access_password', "VARCHAR(100) NOT NULL DEFAULT '123456' AFTER `nickname`");
        self::addColumnIfMissing($pdo, 'patients', 'baby_name', "VARCHAR(255) NOT NULL DEFAULT '' AFTER `access_password`");
        self::addColumnIfMissing($pdo, 'patients', 'father_name', "VARCHAR(255) DEFAULT '' AFTER `baby_name`");
        self::addColumnIfMissing($pdo, 'patients', 'mother_name', "VARCHAR(255) DEFAULT '' AFTER `father_name`");
        self::addColumnIfMissing($pdo, 'patients', 'parent_name', "VARCHAR(255) DEFAULT '' AFTER `mother_name`");
        self::addColumnIfMissing($pdo, 'patients', 'parent_phone', "VARCHAR(50) DEFAULT '' AFTER `parent_name`");
        self::addColumnIfMissing($pdo, 'patients', 'gender', "VARCHAR(30) NOT NULL DEFAULT 'Laki-Laki' AFTER `parent_phone`");
        self::addColumnIfMissing($pdo, 'patients', 'birth_date', "DATE NOT NULL DEFAULT '2026-01-01' AFTER `gender`");
        self::addColumnIfMissing($pdo, 'patients', 'birth_time', "VARCHAR(20) DEFAULT '' AFTER `birth_date`");
        self::addColumnIfMissing($pdo, 'patients', 'admission_date', "DATE NOT NULL DEFAULT '2026-01-01' AFTER `birth_time`");
        self::addColumnIfMissing($pdo, 'patients', 'gestational_age_weeks', "INT NOT NULL DEFAULT 36 AFTER `admission_date`");
        self::addColumnIfMissing($pdo, 'patients', 'gestational_age', "INT NOT NULL DEFAULT 36 AFTER `gestational_age_weeks`");
        self::addColumnIfMissing($pdo, 'patients', 'gestation_category', "VARCHAR(50) NOT NULL DEFAULT 'preterm' AFTER `gestational_age`");
        self::addColumnIfMissing($pdo, 'patients', 'status', "VARCHAR(50) NOT NULL DEFAULT 'Rawat NICU' AFTER `gestation_category`");
        self::addColumnIfMissing($pdo, 'patients', 'medical_record_number', "VARCHAR(100) DEFAULT '' AFTER `status`");
        self::addColumnIfMissing($pdo, 'patients', 'room_number', "VARCHAR(100) DEFAULT '' AFTER `medical_record_number`");
        self::addColumnIfMissing($pdo, 'patients', 'cover_photo_url', "LONGTEXT DEFAULT NULL AFTER `room_number`");
        self::addColumnIfMissing($pdo, 'patients', 'initial_anthropometry', "JSON DEFAULT NULL AFTER `cover_photo_url`");
        self::addColumnIfMissing($pdo, 'patients', 'current_equipment', "JSON DEFAULT NULL AFTER `initial_anthropometry`");
        self::addColumnIfMissing($pdo, 'patients', 'registered_equipment', "JSON DEFAULT NULL AFTER `current_equipment`");
        self::addColumnIfMissing($pdo, 'patients', 'required_equipment', "JSON DEFAULT NULL AFTER `registered_equipment`");
        self::addColumnIfMissing($pdo, 'patients', 'milestones', "JSON DEFAULT NULL AFTER `required_equipment`");
        self::addColumnIfMissing($pdo, 'patients', 'immunization_discharge', "JSON DEFAULT NULL AFTER `milestones`");
        self::addColumnIfMissing($pdo, 'patients', 'discharge_summary', "JSON DEFAULT NULL AFTER `immunization_discharge`");
        self::addColumnIfMissing($pdo, 'patients', 'discharged_at', "DATETIME DEFAULT NULL AFTER `discharge_summary`");
        self::addColumnIfMissing($pdo, 'patients', 'is_deleted', "TINYINT(1) NOT NULL DEFAULT 0 AFTER `discharged_at`");
        self::addColumnIfMissing($pdo, 'patients', 'deleted_at', "DATETIME DEFAULT NULL AFTER `is_deleted`");
        self::addColumnIfMissing($pdo, 'patients', 'is_active', "TINYINT(1) NOT NULL DEFAULT 1 AFTER `deleted_at`");
        self::addColumnIfMissing($pdo, 'patients', 'created_at', "DATETIME DEFAULT CURRENT_TIMESTAMP AFTER `is_active`");
        self::addColumnIfMissing($pdo, 'patients', 'updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`");

        // --- PATCH TABEL `daily_logs` ---
        self::addColumnIfMissing($pdo, 'daily_logs', 'log_date', "DATE NOT NULL DEFAULT '2026-01-01' AFTER `patient_id`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'period_label', "VARCHAR(100) NOT NULL DEFAULT 'Pagi' AFTER `log_date`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'weight_gram', "INT NOT NULL DEFAULT 0 AFTER `period_label`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'weight_change_gram', "INT DEFAULT 0 AFTER `weight_gram`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'vital_signs', "JSON DEFAULT NULL AFTER `weight_change_gram`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'drinking_ability', "JSON DEFAULT NULL AFTER `vital_signs`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'active_equipment', "JSON DEFAULT NULL AFTER `drinking_ability`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'milestones_list', "JSON DEFAULT NULL AFTER `active_equipment`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'nakes_notes', "TEXT DEFAULT NULL AFTER `milestones_list`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'updated_by', "VARCHAR(255) NOT NULL DEFAULT 'Nakes NICU' AFTER `nakes_notes`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'photo_url', "LONGTEXT DEFAULT NULL AFTER `updated_by`");
        self::addColumnIfMissing($pdo, 'daily_logs', 'photo_caption', "TEXT DEFAULT NULL AFTER `photo_url`");

        // --- PATCH TABEL `nakes_login_logs` ---
        self::addColumnIfMissing($pdo, 'nakes_login_logs', 'user_name', "VARCHAR(255) NOT NULL DEFAULT '' AFTER `id`");
        self::addColumnIfMissing($pdo, 'nakes_login_logs', 'user_id', "VARCHAR(64) DEFAULT NULL AFTER `user_name`");
        self::addColumnIfMissing($pdo, 'nakes_login_logs', 'role_title', "VARCHAR(100) DEFAULT '' AFTER `user_id`");
        self::addColumnIfMissing($pdo, 'nakes_login_logs', 'account_type', "VARCHAR(100) DEFAULT '' AFTER `role_title`");
        self::addColumnIfMissing($pdo, 'nakes_login_logs', 'ip_address', "VARCHAR(100) DEFAULT '' AFTER `account_type`");
        self::addColumnIfMissing($pdo, 'nakes_login_logs', 'user_agent', "TEXT DEFAULT NULL AFTER `ip_address`");
        self::addColumnIfMissing($pdo, 'nakes_login_logs', 'login_time', "DATETIME DEFAULT CURRENT_TIMESTAMP AFTER `user_agent`");
        self::addColumnIfMissing($pdo, 'nakes_login_logs', 'created_at', "DATETIME DEFAULT CURRENT_TIMESTAMP AFTER `login_time`");
    }

    private static function addColumnIfMissing(PDO $pdo, string $table, string $column, string $definition): void {
        try {
            $stmt = $pdo->prepare("SHOW COLUMNS FROM `{$table}` LIKE :col");
            $stmt->execute([':col' => $column]);
            $exists = $stmt->fetch();

            if (!$exists) {
                $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
            }
        } catch (Throwable $e) {
            error_log("[Migrator Column Patch Error] Tabel `{$table}`, Kolom `{$column}`: " . $e->getMessage());
        }
    }
}

function getDbConnection(): PDO {
    return Database::getConnection();
}
