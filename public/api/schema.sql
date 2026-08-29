-- =============================================================================
-- NSPC NICU RSUD UNDATA - MYSQL DATABASE SCHEMA (CPANEL / NIAGAHOSTER)
-- =============================================================================
-- Cara Import:
-- 1. Buka cPanel Niagahoster -> phpMyAdmin.
-- 2. Pilih nama database Anda (misal: u1234567_nspc).
-- 3. Klik menu 'Import', pilih file 'schema.sql' ini, lalu klik 'Go' / 'Kirim'.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. TABEL: PATIENTS (Data Pasien Bayi Baru Lahir & Kredensial Orang Tua)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patients` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `nickname` VARCHAR(100) NOT NULL,
  `access_password` VARCHAR(255) NOT NULL,
  `baby_name` VARCHAR(255) NOT NULL,
  `father_name` VARCHAR(255) DEFAULT '',
  `mother_name` VARCHAR(255) DEFAULT '',
  `gender` ENUM('Laki-Laki', 'Perempuan') NOT NULL DEFAULT 'Laki-Laki',
  `birth_date` DATE NOT NULL,
  `admission_date` DATE NOT NULL,
  `gestational_age_weeks` INT NOT NULL DEFAULT 36,
  `gestation_category` ENUM('aterm', 'preterm') NOT NULL DEFAULT 'preterm',
  `status` ENUM('Rawat NICU', 'Siap Pulang', 'Sudah Pulang') NOT NULL DEFAULT 'Rawat NICU',
  `medical_record_number` VARCHAR(100) DEFAULT '',
  `room_number` VARCHAR(100) DEFAULT '',
  `cover_photo_url` LONGTEXT DEFAULT NULL,
  
  -- Struktur JSON untuk Antropometri Awal, Alat Medis, Milestones, Skrining, dan Ringkasan Pulang
  `initial_anthropometry` JSON DEFAULT NULL,
  `current_equipment` JSON DEFAULT NULL,
  `registered_equipment` JSON DEFAULT NULL,
  `milestones` JSON DEFAULT NULL,
  `immunization_discharge` JSON DEFAULT NULL,
  `discharge_summary` JSON DEFAULT NULL,
  `discharged_at` DATETIME DEFAULT NULL,
  
  -- Soft Delete & Audit Flags
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `deleted_at` DATETIME DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_patients_nickname` (`nickname`),
  INDEX `idx_patients_status` (`status`),
  INDEX `idx_patients_is_deleted` (`is_deleted`),
  INDEX `idx_patients_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. TABEL: NAKES_USERS (Akun Tenaga Kesehatan / Dokter / Perawat / Admin NICU)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `nakes_users` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `role_title` VARCHAR(100) NOT NULL DEFAULT 'Perawat NICU',
  `account_type` VARCHAR(100) NOT NULL DEFAULT 'Anggota Biasa',
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `pin` VARCHAR(255) NOT NULL,
  `has_access_rights` TINYINT(1) NOT NULL DEFAULT 0,
  `is_super_admin` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_nakes_username` (`username`),
  INDEX `idx_nakes_account_type` (`account_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. TABEL: NAKES_LOGIN_LOGS (Riwayat Log Masuk Nakes untuk Audit Keamanan)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `nakes_login_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) DEFAULT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `role_title` VARCHAR(100) DEFAULT '',
  `account_type` VARCHAR(100) DEFAULT '',
  `ip_address` VARCHAR(100) DEFAULT '',
  `user_agent` TEXT DEFAULT NULL,
  `login_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_login_user_id` (`user_id`),
  INDEX `idx_login_time` (`login_time`),
  CONSTRAINT `fk_nakes_login_user` FOREIGN KEY (`user_id`) REFERENCES `nakes_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. TABEL: DAILY_LOGS (Catatan Perkembangan Harian Bayi & Pemantauan Klinis)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `daily_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `patient_id` VARCHAR(64) NOT NULL,
  `log_date` DATE NOT NULL,
  `period_label` VARCHAR(100) NOT NULL DEFAULT 'Pagi',
  `weight_gram` INT NOT NULL DEFAULT 0,
  `weight_change_gram` INT DEFAULT 0,
  
  -- Struktur JSON untuk TTV, Cara Minum ASI, Alat Terpasang, & Milestone Harian
  `vital_signs` JSON DEFAULT NULL,
  `drinking_ability` JSON DEFAULT NULL,
  `active_equipment` JSON DEFAULT NULL,
  `milestones_list` JSON DEFAULT NULL,
  
  `nakes_notes` TEXT DEFAULT NULL,
  `updated_by` VARCHAR(255) NOT NULL DEFAULT 'Nakes NICU',
  `photo_url` LONGTEXT DEFAULT NULL,
  `photo_caption` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_daily_logs_patient_id` (`patient_id`),
  INDEX `idx_daily_logs_log_date` (`log_date`),
  CONSTRAINT `fk_daily_logs_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. TABEL: EDUCATION_PDFS (Materi & File Edukasi Digital untuk Orang Tua)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `education_pdfs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `patient_id` VARCHAR(64) DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'EDUKASI',
  `file_name` VARCHAR(255) NOT NULL,
  `file_size_text` VARCHAR(64) NOT NULL DEFAULT '1.2 MB',
  `file_data_url` LONGTEXT DEFAULT NULL,
  `cover_image_url` LONGTEXT DEFAULT NULL,
  `page_count` INT NOT NULL DEFAULT 1,
  `nakes_note` TEXT DEFAULT NULL,
  `published_at` VARCHAR(64) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `order_index` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_education_pdfs_patient` (`patient_id`),
  INDEX `idx_education_pdfs_order` (`order_index`),
  INDEX `idx_education_pdfs_is_active` (`is_active`),
  CONSTRAINT `fk_education_pdfs_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 6. TABEL: SYSTEM_EVENTS (Pemberitahuan Event untuk Real-Time SSE Stream)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_events` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `event_type` VARCHAR(64) NOT NULL,
  `reference_id` VARCHAR(64) DEFAULT '',
  `payload` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_system_events_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- SEED DATA AWAL (DEFAULT SUPER ADMIN & SAMPLE NAKES)
-- =============================================================================
INSERT INTO `nakes_users` (`id`, `name`, `role_title`, `account_type`, `username`, `pin`, `has_access_rights`, `is_super_admin`, `created_at`)
VALUES 
('nakes-superadmin-01', 'Admin Utama NICU', 'Super Admin Ruangan', 'Admin', 'admin', '123456', 1, 1, NOW()),
('nakes-perawat-01', 'Ns. Rizma El Fariani, S.Kep', 'Perawat Primer NICU', 'Admin', 'rizma', '250297', 1, 1, NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
