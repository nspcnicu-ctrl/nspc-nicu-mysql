<?php
/**
 * ============================================================================
 * NSPC NICU RSUD UNDATA - DATABASE AUTO-MIGRATION HELPER
 * ============================================================================
 * Memastikan semua tabel dan kolom yang dibutuhkan aplikasi selalu ada di MySQL.
 * Secara otomatis mengecek tabel dan kolom via `SHOW COLUMNS FROM` dan menjalankan
 * `ALTER TABLE ADD COLUMN` tanpa menghapus atau merusak data lama yang tersimpan.
 */

class DatabaseMigrator {
    private static bool $migrated = false;

    /**
     * Jalankan migrasi otomatis seluruh tabel dan kolom
     */
    public static function run(PDO $pdo): void {
        if (self::$migrated) {
            return;
        }

        try {
            self::migratePatientsTable($pdo);
            self::migrateNakesUsersTable($pdo);
            self::migrateNakesLoginLogsTable($pdo);
            self::migrateDailyLogsTable($pdo);
            self::migrateEducationPdfsTable($pdo);
            self::migrateSystemEventsTable($pdo);
            self::$migrated = true;
        } catch (Throwable $e) {
            // Jangan biarkan migrasi mematikan seluruh aplikasi
            error_log('[DatabaseMigrator] Error running migrations: ' . $e->getMessage());
        }
    }

    /**
     * Memeriksa apakah kolom tertentu ada pada tabel
     */
    public static function columnExists(PDO $pdo, string $tableName, string $columnName): bool {
        try {
            $stmt = $pdo->prepare("SHOW COLUMNS FROM `{$tableName}` LIKE :col");
            $stmt->execute([':col' => $columnName]);
            return (bool)$stmt->fetch();
        } catch (Throwable $e) {
            return false;
        }
    }

    /**
     * Menambahkan kolom ke tabel jika belum ada
     */
    public static function addColumnIfNotExists(PDO $pdo, string $tableName, string $columnName, string $columnDefinition): void {
        try {
            if (!self::columnExists($pdo, $tableName, $columnName)) {
                $pdo->exec("ALTER TABLE `{$tableName}` ADD COLUMN `{$columnName}` {$columnDefinition}");
            }
        } catch (Throwable $e) {
            error_log("[DatabaseMigrator] Failed to add column {$columnName} on {$tableName}: " . $e->getMessage());
        }
    }

    /**
     * 1. Migrasi Tabel `patients`
     */
    private static function migratePatientsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `patients` (
                `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                `nickname` VARCHAR(100) NOT NULL,
                `access_password` VARCHAR(255) NOT NULL,
                `baby_name` VARCHAR(255) NOT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        self::addColumnIfNotExists($pdo, 'patients', 'father_name', "VARCHAR(255) DEFAULT ''");
        self::addColumnIfNotExists($pdo, 'patients', 'mother_name', "VARCHAR(255) DEFAULT ''");
        self::addColumnIfNotExists($pdo, 'patients', 'gender', "ENUM('Laki-Laki', 'Perempuan') NOT NULL DEFAULT 'Laki-Laki'");
        self::addColumnIfNotExists($pdo, 'patients', 'birth_date', "DATE NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'admission_date', "DATE NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'gestational_age_weeks', "INT NOT NULL DEFAULT 36");
        self::addColumnIfNotExists($pdo, 'patients', 'gestation_category', "ENUM('aterm', 'preterm') NOT NULL DEFAULT 'preterm'");
        self::addColumnIfNotExists($pdo, 'patients', 'status', "ENUM('Rawat NICU', 'Siap Pulang', 'Sudah Pulang') NOT NULL DEFAULT 'Rawat NICU'");
        self::addColumnIfNotExists($pdo, 'patients', 'medical_record_number', "VARCHAR(100) DEFAULT ''");
        self::addColumnIfNotExists($pdo, 'patients', 'room_number', "VARCHAR(100) DEFAULT ''");
        self::addColumnIfNotExists($pdo, 'patients', 'cover_photo_url', "LONGTEXT DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'initial_anthropometry', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'current_equipment', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'registered_equipment', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'milestones', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'immunization_discharge', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'discharge_summary', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'discharged_at', "DATETIME DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'is_deleted', "TINYINT(1) NOT NULL DEFAULT 0");
        self::addColumnIfNotExists($pdo, 'patients', 'deleted_at', "DATETIME DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'patients', 'is_active', "TINYINT(1) NOT NULL DEFAULT 1");
        self::addColumnIfNotExists($pdo, 'patients', 'updated_at', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }

    /**
     * 2. Migrasi Tabel `nakes_users`
     */
    private static function migrateNakesUsersTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `nakes_users` (
                `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                `name` VARCHAR(255) NOT NULL,
                `username` VARCHAR(100) NOT NULL UNIQUE,
                `pin` VARCHAR(255) NOT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        self::addColumnIfNotExists($pdo, 'nakes_users', 'role_title', "VARCHAR(100) NOT NULL DEFAULT 'Perawat NICU'");
        self::addColumnIfNotExists($pdo, 'nakes_users', 'account_type', "VARCHAR(100) NOT NULL DEFAULT 'Anggota Biasa'");
        self::addColumnIfNotExists($pdo, 'nakes_users', 'has_access_rights', "TINYINT(1) NOT NULL DEFAULT 0");
        self::addColumnIfNotExists($pdo, 'nakes_users', 'is_super_admin', "TINYINT(1) NOT NULL DEFAULT 0");
        self::addColumnIfNotExists($pdo, 'nakes_users', 'last_login_at', "DATETIME DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'nakes_users', 'updated_at', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }

    /**
     * 3. Migrasi Tabel `nakes_login_logs`
     */
    private static function migrateNakesLoginLogsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `nakes_login_logs` (
                `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                `user_name` VARCHAR(255) NOT NULL,
                `login_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        self::addColumnIfNotExists($pdo, 'nakes_login_logs', 'user_id', "VARCHAR(64) DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'nakes_login_logs', 'role_title', "VARCHAR(100) DEFAULT ''");
        self::addColumnIfNotExists($pdo, 'nakes_login_logs', 'account_type', "VARCHAR(100) DEFAULT ''");
        self::addColumnIfNotExists($pdo, 'nakes_login_logs', 'ip_address', "VARCHAR(100) DEFAULT ''");
        self::addColumnIfNotExists($pdo, 'nakes_login_logs', 'user_agent', "TEXT DEFAULT NULL");
    }

    /**
     * 4. Migrasi Tabel `daily_logs`
     */
    private static function migrateDailyLogsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `daily_logs` (
                `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                `patient_id` VARCHAR(64) NOT NULL,
                `log_date` DATE NOT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        self::addColumnIfNotExists($pdo, 'daily_logs', 'period_label', "VARCHAR(100) NOT NULL DEFAULT 'Pagi'");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'weight_gram', "INT NOT NULL DEFAULT 0");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'weight_change_gram', "INT DEFAULT 0");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'vital_signs', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'drinking_ability', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'active_equipment', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'milestones_list', "JSON DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'nakes_notes', "TEXT DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'updated_by', "VARCHAR(255) NOT NULL DEFAULT 'Nakes NICU'");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'photo_url', "LONGTEXT DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'photo_caption', "TEXT DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'daily_logs', 'updated_at', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }

    /**
     * 5. Migrasi Tabel `education_pdfs`
     */
    private static function migrateEducationPdfsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `education_pdfs` (
                `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                `title` VARCHAR(255) NOT NULL,
                `file_name` VARCHAR(255) NOT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        self::addColumnIfNotExists($pdo, 'education_pdfs', 'patient_id', "VARCHAR(64) DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'category', "VARCHAR(100) NOT NULL DEFAULT 'EDUKASI'");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'file_size_text', "VARCHAR(64) NOT NULL DEFAULT '1.2 MB'");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'file_data_url', "LONGTEXT DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'cover_image_url', "LONGTEXT DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'page_count', "INT NOT NULL DEFAULT 1");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'nakes_note', "TEXT DEFAULT NULL");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'published_at', "VARCHAR(64) NOT NULL DEFAULT ''");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'is_active', "TINYINT(1) NOT NULL DEFAULT 1");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'order_index', "INT NOT NULL DEFAULT 0");
        self::addColumnIfNotExists($pdo, 'education_pdfs', 'updated_at', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }

    /**
     * 6. Migrasi Tabel `system_events`
     */
    private static function migrateSystemEventsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `system_events` (
                `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                `event_type` VARCHAR(64) NOT NULL,
                `reference_id` VARCHAR(64) DEFAULT '',
                `payload` JSON DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_system_events_created` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    }
}
