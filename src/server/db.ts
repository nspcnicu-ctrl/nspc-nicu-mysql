import mysql from 'mysql2/promise';
import dns from 'node:dns';
import { spawn } from 'node:child_process';
import { Patient, DailyLog, NakesUser, EducationPdfItem } from '../types';
import { INITIAL_PATIENTS } from '../data/initialPatients';
import { INITIAL_NAKES_USERS } from '../data/initialNakes';
import { DEFAULT_EDUCATION_PDFS } from '../data/defaultEducation';

// Prioritize IPv4 DNS lookup to prevent IPv6 timeouts when connecting to hosting servers
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const REMOTE_API_BASE = 'https://chagrin.id/api';

export function fetchViaCurl(url: string, postData?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = ['-4', '-s', '--max-time', '15', url];
    if (postData) {
      args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(postData));
    }
    const child = spawn('curl', args);
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`curl exited with code ${code}`));
      try {
        const str = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(str));
      } catch (e) {
        reject(e);
      }
    });
  });
}

let pool: mysql.Pool | null = null;
let isConnected = false;
let connectionError: string | null = null;

// Helper serialization functions
function parseJsonSafe(val: any, fallback: any = null) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function formatDateForMySql(d?: string | Date | null): string | null {
  if (!d) return null;
  const str = String(d);
  if (str.length === 10 && str.includes('-')) return str;
  try {
    const dt = new Date(str);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

function formatDateTimeForMySql(d?: string | Date | null): string | null {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 19).replace('T', ' ');
  } catch (e) {
    return null;
  }
}

function parseRowToPatient(row: any): Patient {
  const isAterm = (row.gestation_category || row.gestationCategory) === 'aterm';
  const rawLogs = (
    row.progress_logs ||
    row.progressLogs ||
    row.daily_logs ||
    row.dailyLogs ||
    []
  );

  const logs: DailyLog[] = (Array.isArray(rawLogs) ? rawLogs : []).map((l: any, idx: number) => ({
    id: String(l.id || `log_${idx}_${Date.now()}`),
    date: l.date || l.log_date || l.logDate || new Date().toISOString().split('T')[0],
    periodLabel: l.periodLabel || l.period_label || l.period || (isAterm ? `Hari ke-${idx + 1}` : `Minggu ke-${idx + 1}`),
    weightGram: Number(l.weightGram || l.weight_gram || l.weight || 0),
    weightChangeGram: Number(l.weightChangeGram || l.weight_change_gram || l.weightDiff || 0),
    vitalSigns: parseJsonSafe(l.vitalSigns || l.vital_signs, {
      temperature: 36.8,
      heartRate: 140,
      respiratoryRate: 44,
      spo2: 98,
    }),
    drinkingAbility: parseJsonSafe(l.drinkingAbility || l.drinking_ability, {
      method: 'OGT/Sonde',
      volumeCcPerFeeding: 10,
      frequencyPerDay: 8,
    }),
    activeEquipment: parseJsonSafe(l.activeEquipment || l.active_equipment, []),
    milestonesList: parseJsonSafe(l.milestonesList || l.milestones_list, []),
    nakesNotes: l.nakesNotes || l.nakes_notes || '',
    updatedBy: l.updatedBy || l.updated_by || 'Nakes NICU',
    createdAt: l.createdAt || l.created_at || new Date().toISOString(),
    photoUrl: l.photoUrl || l.photo_url || undefined,
    photoCaption: l.photoCaption || l.photo_caption || undefined,
  }));

  const isDel = Boolean(
    row.is_deleted === 1 ||
    row.is_deleted === '1' ||
    row.is_deleted === true ||
    row.is_deleted === 'true' ||
    row.isDeleted === 1 ||
    row.isDeleted === '1' ||
    row.isDeleted === true ||
    row.isDeleted === 'true' ||
    row.status === 'deleted' ||
    row.status === 'Deleted' ||
    row.status === 'Disembunyikan'
  );

  let cleanMilestones: string[] = [];
  const rawMilestones = row.milestones;
  const parsedM = typeof rawMilestones === 'string' ? parseJsonSafe(rawMilestones, []) : rawMilestones;
  if (Array.isArray(parsedM)) {
    cleanMilestones = parsedM.filter((m: any) => typeof m === 'string' && m.trim().length > 0);
  } else if (parsedM && typeof parsedM === 'object') {
    cleanMilestones = Object.entries(parsedM).filter(([_, v]) => Boolean(v)).map(([k]) => k);
  }

  return {
    id: String(row.id || `p_${Date.now()}`),
    nickname: row.nickname || '',
    accessPassword: row.access_password || row.accessPassword || row.password || '123456',
    babyName: row.baby_name || row.babyName || row.name || 'Bayi Ny.',
    fatherName: row.father_name || row.fatherName || '',
    motherName: row.mother_name || row.motherName || '',
    parentPhone: row.parent_phone || row.parentPhone || '',
    gender: row.gender || 'Laki-Laki',
    birthDate: formatDateForMySql(row.birth_date || row.birthDate) || new Date().toISOString().split('T')[0],
    birthTime: row.birth_time || row.birthTime || undefined,
    admissionDate: formatDateForMySql(row.admission_date || row.admissionDate) || new Date().toISOString().split('T')[0],
    admissionTime: row.admission_time || row.admissionTime || undefined,
    readyToDischargeDate: row.ready_to_discharge_date || row.readyToDischargeDate || undefined,
    readyToDischargeTime: row.ready_to_discharge_time || row.readyToDischargeTime || undefined,
    dischargeDate: row.discharge_date || row.dischargeDate || undefined,
    dischargeTime: row.discharge_time || row.dischargeTime || undefined,
    gestationalAgeWeeks: Number(row.gestational_age_weeks || row.gestationalAgeWeeks || 36),
    gestationCategory: row.gestation_category || row.gestationCategory || 'preterm',
    status: row.status && row.status !== 'deleted' ? row.status : (isDel ? 'deleted' : 'Rawat NICU'),
    medicalRecordNumber: row.medical_record_number || row.medicalRecordNumber || '',
    roomNumber: row.room_number || row.roomNumber || '',
    coverPhotoUrl: row.cover_photo_url || row.coverPhotoUrl || undefined,
    initialAnthropometry: parseJsonSafe(row.initial_anthropometry || row.initialAnthropometry, {
      weightGram: 2000,
      lengthCm: 45,
      headCircumferenceCm: 32,
      chestCircumferenceCm: 30,
    }),
    currentEquipment: parseJsonSafe(row.current_equipment || row.currentEquipment, []),
    registeredEquipment: parseJsonSafe(row.registered_equipment || row.registeredEquipment, []),
    milestones: cleanMilestones,
    immunizationDischarge: parseJsonSafe(row.immunization_discharge || row.immunizationDischarge, undefined),
    dischargeSummary: parseJsonSafe(row.discharge_summary || row.dischargeSummary, undefined),
    dischargedAt: row.discharged_at || row.dischargedAt || undefined,
    dailyLogs: logs,
    progressLogs: logs,
    progress_logs: logs,
    daily_logs: logs,
    isDeleted: isDel,
    deletedAt: row.deleted_at || row.deletedAt || undefined,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
  };
}

function parseRowToNakes(row: any): NakesUser {
  return {
    id: String(row.id),
    name: row.name || 'Petugas Nakes',
    roleTitle: row.role_title || row.roleTitle || 'Anggota',
    accountType: row.account_type || row.accountType || 'Anggota Biasa',
    username: row.username || '',
    pin: row.pin || '1234',
    hasAccessRights: Boolean(row.has_access_rights ?? row.hasAccessRights),
    isSuperAdmin: Boolean(row.is_super_admin ?? row.isSuperAdmin),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    lastLoginAt: row.last_login_at || row.lastLoginAt || undefined,
  };
}

function parseRowToPdf(row: any): EducationPdfItem {
  return {
    id: String(row.id),
    title: row.title || 'Materi Edukasi NICU',
    category: row.category || 'EDUKASI',
    fileName: row.fileName || row.file_name || 'edukasi.pdf',
    fileSizeText: row.fileSizeText || row.file_size_text || '1.2 MB',
    fileDataUrl: row.fileDataUrl || row.file_data_url || undefined,
    coverImageUrl: row.coverImageUrl || row.cover_image_url || undefined,
    pageCount: Number(row.pageCount || row.page_count || 1),
    nakesNote: row.nakesNote || row.nakes_note || undefined,
    publishedAt: row.publishedAt || row.published_at || new Date().toISOString().split('T')[0],
    isActive: row.isActive !== undefined ? Boolean(row.isActive) : (row.is_active !== undefined ? Boolean(row.is_active) : true),
  };
}

// In-memory storage seeded directly with the real MySQL patient database
let memoryPatients: Patient[] = [...INITIAL_PATIENTS];
let memoryNakesUsers: NakesUser[] = [...INITIAL_NAKES_USERS];
let memoryLoginLogs: any[] = [];
let memoryEducationPdfs: EducationPdfItem[] = [...DEFAULT_EDUCATION_PDFS];

/**
 * Fetch and sync all latest patients, nakes, and education records from the MySQL database API
 */
export async function syncFromRemoteDbApi(): Promise<boolean> {
  try {
    const pData = await fetchViaCurl(`${REMOTE_API_BASE}/patients.php?include_deleted=1`);
    if (pData && Array.isArray(pData.data) && pData.data.length > 0) {
      const mapped = pData.data.map(parseRowToPatient);
      if (mapped.length > 0) {
        memoryPatients = mapped;
        console.log(`[MySQL DB] Successfully synced ${mapped.length} real patients from database.`);
      }
    }

    const nData = await fetchViaCurl(`${REMOTE_API_BASE}/nakes_users.php`);
    if (nData && Array.isArray(nData.data) && nData.data.length > 0) {
      const mappedNakes = nData.data.map(parseRowToNakes);
      if (mappedNakes.length > 0) {
        memoryNakesUsers = mappedNakes;
        console.log(`[MySQL DB] Successfully synced ${mappedNakes.length} nakes users from database.`);
      }
    }

    const eData = await fetchViaCurl(`${REMOTE_API_BASE}/education_pdfs.php`);
    if (eData && Array.isArray(eData.data) && eData.data.length > 0) {
      const mappedPdfs = eData.data.map(parseRowToPdf);
      if (mappedPdfs.length > 0) {
        memoryEducationPdfs = mappedPdfs;
        console.log(`[MySQL DB] Successfully synced ${mappedPdfs.length} education PDFs from database.`);
      }
    }

    return true;
  } catch (err: any) {
    console.warn('[MySQL DB] Sync from remote database API note:', err.message);
    return false;
  }
}

/**
 * Initialize MySQL Connection Pool
 */
export async function initDbPool(): Promise<boolean> {
  // Start background sync from live database API immediately so data is always fresh
  syncFromRemoteDbApi().catch((e) => console.warn('[MySQL DB] Initial live sync note:', e.message));

  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;
  const password = process.env.MYSQL_PASSWORD || '';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);

  if (!host || !user || !database) {
    console.warn('[MySQL DB] MySQL environment variables not fully specified. Running with live database API sync.');
    isConnected = false;
    connectionError = 'Running with live database API sync.';
    return false;
  }

  try {
    let sslOption: any = undefined;
    if (process.env.MYSQL_SSL === 'true') {
      sslOption = { rejectUnauthorized: false };
    } else if (process.env.MYSQL_SSL && process.env.MYSQL_SSL.startsWith('{')) {
      try {
        sslOption = JSON.parse(process.env.MYSQL_SSL);
      } catch (e) {}
    }

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      ssl: sslOption,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    // Test connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    isConnected = true;
    connectionError = null;
    console.log(`[MySQL DB] Successfully connected to MySQL database "${database}" on ${host}:${port}`);

    // Auto-create tables if they do not exist
    await createTablesIfNotExist();
    return true;
  } catch (err: any) {
    console.error('[MySQL DB] Connection failed:', err.message);
    isConnected = false;
    connectionError = err.message;
    return false;
  }
}

/**
 * Helper to ensure the 5 main tables exist in the MySQL database
 */
async function createTablesIfNotExist() {
  if (!pool) return;
  try {
    // 1. patients table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`patients\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`nickname\` VARCHAR(100) NOT NULL,
        \`access_password\` VARCHAR(100) NOT NULL,
        \`baby_name\` VARCHAR(255) NOT NULL,
        \`father_name\` VARCHAR(255) DEFAULT '',
        \`mother_name\` VARCHAR(255) DEFAULT '',
        \`gender\` ENUM('Laki-Laki', 'Perempuan') NOT NULL DEFAULT 'Laki-Laki',
        \`birth_date\` DATE NOT NULL,
        \`admission_date\` DATE NOT NULL,
        \`gestational_age_weeks\` INT NOT NULL DEFAULT 36,
        \`gestation_category\` ENUM('aterm', 'preterm') NOT NULL DEFAULT 'preterm',
        \`status\` ENUM('Rawat NICU', 'Siap Pulang', 'Sudah Pulang') NOT NULL DEFAULT 'Rawat NICU',
        \`medical_record_number\` VARCHAR(100) DEFAULT '',
        \`room_number\` VARCHAR(100) DEFAULT '',
        \`cover_photo_url\` LONGTEXT DEFAULT NULL,
        \`initial_anthropometry\` JSON DEFAULT NULL,
        \`current_equipment\` JSON DEFAULT NULL,
        \`registered_equipment\` JSON DEFAULT NULL,
        \`milestones\` JSON DEFAULT NULL,
        \`immunization_discharge\` JSON DEFAULT NULL,
        \`discharge_summary\` JSON DEFAULT NULL,
        \`discharged_at\` DATETIME DEFAULT NULL,
        \`is_deleted\` TINYINT(1) NOT NULL DEFAULT 0,
        \`deleted_at\` DATETIME DEFAULT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_patients_nickname\` (\`nickname\`),
        INDEX \`idx_patients_status\` (\`status\`),
        INDEX \`idx_patients_is_deleted\` (\`is_deleted\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. nakes_users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`nakes_users\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`role_title\` VARCHAR(100) NOT NULL DEFAULT 'Perawat NICU',
        \`account_type\` VARCHAR(100) NOT NULL DEFAULT 'Anggota Biasa',
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`pin\` VARCHAR(100) NOT NULL,
        \`has_access_rights\` TINYINT(1) NOT NULL DEFAULT 0,
        \`is_super_admin\` TINYINT(1) NOT NULL DEFAULT 0,
        \`last_login_at\` DATETIME DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_nakes_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. nakes_login_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`nakes_login_logs\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`user_id\` VARCHAR(64) DEFAULT NULL,
        \`user_name\` VARCHAR(255) NOT NULL,
        \`role_title\` VARCHAR(100) DEFAULT '',
        \`account_type\` VARCHAR(100) DEFAULT '',
        \`ip_address\` VARCHAR(100) DEFAULT '',
        \`user_agent\` TEXT DEFAULT NULL,
        \`login_time\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_login_user_id\` (\`user_id\`),
        INDEX \`idx_login_time\` (\`login_time\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. daily_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`daily_logs\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`patient_id\` VARCHAR(64) NOT NULL,
        \`log_date\` DATE NOT NULL,
        \`period_label\` VARCHAR(100) NOT NULL DEFAULT 'Pagi',
        \`weight_gram\` INT NOT NULL DEFAULT 0,
        \`weight_change_gram\` INT DEFAULT 0,
        \`vital_signs\` JSON DEFAULT NULL,
        \`drinking_ability\` JSON DEFAULT NULL,
        \`active_equipment\` JSON DEFAULT NULL,
        \`milestones_list\` JSON DEFAULT NULL,
        \`nakes_notes\` TEXT DEFAULT NULL,
        \`updated_by\` VARCHAR(255) NOT NULL DEFAULT 'Nakes NICU',
        \`photo_url\` LONGTEXT DEFAULT NULL,
        \`photo_caption\` TEXT DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_daily_logs_patient_id\` (\`patient_id\`),
        INDEX \`idx_daily_logs_log_date\` (\`log_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. education_pdfs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`education_pdfs\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`patient_id\` VARCHAR(64) DEFAULT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL DEFAULT 'EDUKASI',
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_size_text\` VARCHAR(64) NOT NULL DEFAULT '1.2 MB',
        \`file_data_url\` LONGTEXT DEFAULT NULL,
        \`cover_image_url\` LONGTEXT DEFAULT NULL,
        \`page_count\` INT NOT NULL DEFAULT 1,
        \`nakes_note\` TEXT DEFAULT NULL,
        \`published_at\` VARCHAR(64) NOT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`order_index\` INT NOT NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_education_pdfs_patient\` (\`patient_id\`),
        INDEX \`idx_education_pdfs_order\` (\`order_index\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure default initial nakes accounts exist
    await pool.query(`
      INSERT INTO \`nakes_users\` (\`id\`, \`name\`, \`role_title\`, \`account_type\`, \`username\`, \`pin\`, \`has_access_rights\`, \`is_super_admin\`, \`created_at\`)
      VALUES 
      ('nakes_superadmin', 'Super Admin NICU', 'Super Administrator', 'Super Admin', 'superadmin', '1234', 1, 1, NOW())
      ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);
    `);

    console.log('[MySQL DB] All 5 database tables verified & ready.');
  } catch (err: any) {
    console.error('[MySQL DB] Table verification error:', err.message);
  }
}

export function getDbStatus() {
  return {
    connected: isConnected,
    mode: isConnected ? 'mysql' : 'memory_fallback',
    error: connectionError,
    config: {
      host: process.env.MYSQL_HOST || '(not set)',
      database: process.env.MYSQL_DATABASE || '(not set)',
      user: process.env.MYSQL_USER || '(not set)',
      port: process.env.MYSQL_PORT || 3306,
    }
  };
}

// =============================================================================
// PATIENTS OPERATIONS (CRUD WITH PREPARED STATEMENTS)
// =============================================================================

export async function getAllPatients(options?: { includeDeleted?: boolean; onlyDeleted?: boolean }): Promise<Patient[]> {
  if (!isConnected || !pool) {
    if (memoryPatients.length === 0) {
      await syncFromRemoteDbApi();
    }
    if (options?.onlyDeleted) {
      return memoryPatients.filter((p) => p.isDeleted || p.status === 'deleted' || p.status === 'Disembunyikan');
    }
    if (options?.includeDeleted) {
      return [...memoryPatients];
    }
    return memoryPatients.filter((p) => !p.isDeleted && p.status !== 'deleted' && p.status !== 'Disembunyikan');
  }

  try {
    let query = 'SELECT * FROM `patients` WHERE 1=1';
    if (options?.onlyDeleted) {
      query += " AND (`is_deleted` = 1 OR `status` = 'deleted' OR `status` = 'Disembunyikan')";
    } else if (!options?.includeDeleted) {
      query += " AND (`is_deleted` = 0 OR `is_deleted` IS NULL) AND `status` != 'deleted' AND `status` != 'Disembunyikan'";
    }
    query += ' ORDER BY `created_at` DESC';

    // 1. Fetch patients
    const [patientRows] = await pool.query<any[]>(query);

    // 2. Fetch all daily logs
    const [dailyLogRows] = await pool.query<any[]>(`
      SELECT * FROM \`daily_logs\` ORDER BY \`log_date\` ASC, \`created_at\` ASC
    `);

    // Group daily logs by patient_id
    const logsByPatient = new Map<string, DailyLog[]>();
    dailyLogRows.forEach((row: any) => {
      const pid = row.patient_id;
      if (!logsByPatient.has(pid)) logsByPatient.set(pid, []);
      logsByPatient.get(pid)!.push({
        id: row.id,
        date: formatDateForMySql(row.log_date) || row.log_date,
        periodLabel: row.period_label || 'Pagi',
        weightGram: Number(row.weight_gram) || 0,
        weightChangeGram: Number(row.weight_change_gram) || 0,
        vitalSigns: parseJsonSafe(row.vital_signs, {
          temperature: 36.8,
          heartRate: 140,
          respiratoryRate: 44,
          spo2: 98,
        }),
        drinkingAbility: parseJsonSafe(row.drinking_ability, {
          method: 'OGT/Sonde',
          volumeCcPerFeeding: 10,
          frequencyPerDay: 8,
        }),
        activeEquipment: parseJsonSafe(row.active_equipment, []),
        milestonesList: parseJsonSafe(row.milestones_list, []),
        nakesNotes: row.nakes_notes || '',
        updatedBy: row.updated_by || 'Nakes NICU',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        photoUrl: row.photo_url || undefined,
        photoCaption: row.photo_caption || undefined,
      });
    });

    // Construct full Patient entities
    const patients: Patient[] = patientRows.map((row: any) => {
      const pLogs = logsByPatient.get(row.id) || [];
      return {
        id: row.id,
        nickname: row.nickname,
        accessPassword: row.access_password,
        babyName: row.baby_name,
        fatherName: row.father_name || '',
        motherName: row.mother_name || '',
        gender: row.gender || 'Laki-Laki',
        birthDate: formatDateForMySql(row.birth_date) || String(row.birth_date),
        birthTime: row.birth_time || undefined,
        admissionDate: formatDateForMySql(row.admission_date) || String(row.admission_date),
        admissionTime: row.admission_time || parseJsonSafe(row.initial_anthropometry, {})?.admissionTime || undefined,
        readyToDischargeDate: row.ready_to_discharge_date || parseJsonSafe(row.discharge_summary, {})?.readyToDischargeDate || undefined,
        readyToDischargeTime: row.ready_to_discharge_time || parseJsonSafe(row.discharge_summary, {})?.readyToDischargeTime || undefined,
        dischargeDate: row.discharge_date || parseJsonSafe(row.discharge_summary, {})?.dischargeDate || undefined,
        dischargeTime: row.discharge_time || parseJsonSafe(row.discharge_summary, {})?.dischargeTime || undefined,
        gestationalAgeWeeks: Number(row.gestational_age_weeks) || 36,
        gestationCategory: row.gestation_category || 'preterm',
        status: row.status || 'Rawat NICU',
        medicalRecordNumber: row.medical_record_number || '',
        roomNumber: row.room_number || '',
        coverPhotoUrl: row.cover_photo_url || undefined,
        initialAnthropometry: parseJsonSafe(row.initial_anthropometry, {
          weightGram: 2200,
          lengthCm: 45,
          headCircumferenceCm: 32,
          chestCircumferenceCm: 30,
        }),
        currentEquipment: parseJsonSafe(row.current_equipment, []),
        registeredEquipment: parseJsonSafe(row.registered_equipment, []),
        milestones: (() => {
          const parsed = parseJsonSafe(row.milestones, []);
          if (Array.isArray(parsed)) return parsed.filter((m: any) => typeof m === 'string' && m.trim().length > 0);
          if (parsed && typeof parsed === 'object') {
            return Object.entries(parsed).filter(([_, v]) => Boolean(v)).map(([k]) => k);
          }
          return [];
        })(),
        immunizationDischarge: parseJsonSafe(row.immunization_discharge, undefined),
        dischargeSummary: parseJsonSafe(row.discharge_summary, undefined),
        dischargedAt: row.discharged_at ? new Date(row.discharged_at).toISOString() : undefined,
        isDeleted: Boolean(row.is_deleted),
        deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : undefined,
        isActive: Boolean(row.is_active !== undefined ? row.is_active : 1),
        dailyLogs: pLogs,
      };
    });

    memoryPatients = patients; // Keep local memory in sync
    return patients;
  } catch (err: any) {
    console.error('[MySQL DB] getAllPatients error:', err.message);
    return [...memoryPatients];
  }
}

export async function upsertPatient(patient: Patient): Promise<Patient> {
  // Update in memory cache first
  const existingIdx = memoryPatients.findIndex((p) => p.id === patient.id);
  if (existingIdx >= 0) {
    memoryPatients[existingIdx] = { ...patient };
  } else {
    memoryPatients.unshift({ ...patient });
  }

  // Always forward to Live Remote MySQL API (https://chagrin.id/api/patients.php)
  try {
    const payload = {
      action: 'save',
      id: patient.id,
      nickname: patient.nickname || '',
      access_password: patient.accessPassword || '123456',
      password: patient.accessPassword || '123456',
      baby_name: patient.babyName || 'Bayi',
      babyName: patient.babyName || 'Bayi',
      name: patient.babyName || 'Bayi',
      father_name: patient.fatherName || '',
      fatherName: patient.fatherName || '',
      mother_name: patient.motherName || '',
      motherName: patient.motherName || '',
      parent_name: patient.parentName || (patient.fatherName ? `${patient.fatherName} ${patient.motherName || ''}`.trim() : patient.motherName || ''),
      parentName: patient.parentName || (patient.fatherName ? `${patient.fatherName} ${patient.motherName || ''}`.trim() : patient.motherName || ''),
      parent_phone: patient.parentPhone || '',
      parentPhone: patient.parentPhone || '',
      gender: patient.gender || 'Laki-Laki',
      birth_date: formatDateForMySql(patient.birthDate) || new Date().toISOString().split('T')[0],
      birthDate: formatDateForMySql(patient.birthDate) || new Date().toISOString().split('T')[0],
      birth_time: patient.birthTime || '',
      birthTime: patient.birthTime || '',
      admission_date: formatDateForMySql(patient.admissionDate) || new Date().toISOString().split('T')[0],
      admissionDate: formatDateForMySql(patient.admissionDate) || new Date().toISOString().split('T')[0],
      admission_time: patient.admissionTime || '',
      admissionTime: patient.admissionTime || '',
      ready_to_discharge_date: patient.readyToDischargeDate || null,
      readyToDischargeDate: patient.readyToDischargeDate || null,
      ready_to_discharge_time: patient.readyToDischargeTime || '',
      readyToDischargeTime: patient.readyToDischargeTime || '',
      discharge_date: patient.dischargeDate || null,
      dischargeDate: patient.dischargeDate || null,
      discharge_time: patient.dischargeTime || '',
      dischargeTime: patient.dischargeTime || '',
      gestational_age_weeks: patient.gestationalAgeWeeks || 36,
      gestationalAgeWeeks: patient.gestationalAgeWeeks || 36,
      gestation_category: patient.gestationCategory || 'preterm',
      gestationCategory: patient.gestationCategory || 'preterm',
      status: patient.status || 'Rawat NICU',
      medical_record_number: patient.medicalRecordNumber || '',
      medicalRecordNumber: patient.medicalRecordNumber || '',
      room_number: patient.roomNumber || '',
      roomNumber: patient.roomNumber || '',
      cover_photo_url: patient.coverPhotoUrl || null,
      coverPhotoUrl: patient.coverPhotoUrl || null,
      initial_anthropometry: patient.initialAnthropometry || null,
      initialAnthropometry: patient.initialAnthropometry || null,
      current_equipment: patient.currentEquipment || [],
      currentEquipment: patient.currentEquipment || [],
      registered_equipment: patient.registeredEquipment || [],
      registeredEquipment: patient.registeredEquipment || [],
      milestones: patient.milestones || [],
      immunization_discharge: patient.immunizationDischarge || null,
      immunizationDischarge: patient.immunizationDischarge || null,
      discharge_summary: patient.dischargeSummary || null,
      dischargeSummary: patient.dischargeSummary || null,
      discharged_at: patient.dischargedAt || null,
      dischargedAt: patient.dischargedAt || null,
      daily_logs: patient.dailyLogs || [],
      dailyLogs: patient.dailyLogs || [],
      progress_logs: patient.dailyLogs || [],
      progressLogs: patient.dailyLogs || [],
      is_deleted: patient.isDeleted ? 1 : 0,
      deleted_at: patient.deletedAt || null,
    };

    fetch(`${REMOTE_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .then((d) => console.log('[Remote Sync] upsertPatient response from live MySQL:', d))
      .catch((err) => console.warn('[Remote Sync] upsertPatient note:', err.message));
  } catch (err: any) {
    console.warn('[Remote Sync] upsertPatient payload error:', err.message);
  }

  if (!isConnected || !pool) {
    return patient;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const sql = `
      INSERT INTO \`patients\` (
        \`id\`, \`nickname\`, \`access_password\`, \`baby_name\`, \`father_name\`, \`mother_name\`,
        \`gender\`, \`birth_date\`, \`admission_date\`, \`gestational_age_weeks\`, \`gestation_category\`,
        \`status\`, \`medical_record_number\`, \`room_number\`, \`cover_photo_url\`,
        \`initial_anthropometry\`, \`current_equipment\`, \`registered_equipment\`,
        \`milestones\`, \`immunization_discharge\`, \`discharge_summary\`,
        \`discharged_at\`, \`is_deleted\`, \`deleted_at\`, \`is_active\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`nickname\` = VALUES(\`nickname\`),
        \`access_password\` = VALUES(\`access_password\`),
        \`baby_name\` = VALUES(\`baby_name\`),
        \`father_name\` = VALUES(\`father_name\`),
        \`mother_name\` = VALUES(\`mother_name\`),
        \`gender\` = VALUES(\`gender\`),
        \`birth_date\` = VALUES(\`birth_date\`),
        \`admission_date\` = VALUES(\`admission_date\`),
        \`gestational_age_weeks\` = VALUES(\`gestational_age_weeks\`),
        \`gestation_category\` = VALUES(\`gestation_category\`),
        \`status\` = VALUES(\`status\`),
        \`medical_record_number\` = VALUES(\`medical_record_number\`),
        \`room_number\` = VALUES(\`room_number\`),
        \`cover_photo_url\` = VALUES(\`cover_photo_url\`),
        \`initial_anthropometry\` = VALUES(\`initial_anthropometry\`),
        \`current_equipment\` = VALUES(\`current_equipment\`),
        \`registered_equipment\` = VALUES(\`registered_equipment\`),
        \`milestones\` = VALUES(\`milestones\`),
        \`immunization_discharge\` = VALUES(\`immunization_discharge\`),
        \`discharge_summary\` = VALUES(\`discharge_summary\`),
        \`discharged_at\` = VALUES(\`discharged_at\`),
        \`is_deleted\` = VALUES(\`is_deleted\`),
        \`deleted_at\` = VALUES(\`deleted_at\`),
        \`is_active\` = VALUES(\`is_active\`);
    `;

    const params = [
      patient.id,
      patient.nickname,
      patient.accessPassword,
      patient.babyName,
      patient.fatherName || '',
      patient.motherName || '',
      patient.gender,
      formatDateForMySql(patient.birthDate),
      formatDateForMySql(patient.admissionDate),
      patient.gestationalAgeWeeks || 36,
      patient.gestationCategory || 'preterm',
      patient.status || 'Rawat NICU',
      patient.medicalRecordNumber || '',
      patient.roomNumber || '',
      patient.coverPhotoUrl || null,
      JSON.stringify({
        ...(patient.initialAnthropometry || {}),
        admissionTime: patient.admissionTime || (patient.initialAnthropometry as any)?.admissionTime || undefined,
      }),
      JSON.stringify(patient.currentEquipment || []),
      JSON.stringify(patient.registeredEquipment || []),
      JSON.stringify(
        Array.isArray(patient.milestones)
          ? patient.milestones.filter((m) => typeof m === 'string' && m.trim().length > 0)
          : patient.milestones && typeof patient.milestones === 'object'
          ? Object.entries(patient.milestones).filter(([_, v]) => Boolean(v)).map(([k]) => k)
          : []
      ),
      patient.immunizationDischarge ? JSON.stringify(patient.immunizationDischarge) : null,
      JSON.stringify({
        ...(patient.dischargeSummary || {}),
        readyToDischargeDate: patient.readyToDischargeDate || (patient.dischargeSummary as any)?.readyToDischargeDate || undefined,
        readyToDischargeTime: patient.readyToDischargeTime || (patient.dischargeSummary as any)?.readyToDischargeTime || undefined,
        dischargeDate: patient.dischargeDate || undefined,
        dischargeTime: patient.dischargeTime || undefined,
      }),
      formatDateTimeForMySql(patient.dischargedAt),
      patient.isDeleted ? 1 : 0,
      formatDateTimeForMySql(patient.deletedAt),
      patient.isActive !== false ? 1 : 0,
    ];

    await conn.query(sql, params);

    // Save Daily Logs for this patient
    if (patient.dailyLogs && patient.dailyLogs.length > 0) {
      for (const log of patient.dailyLogs) {
        const logSql = `
          INSERT INTO \`daily_logs\` (
            \`id\`, \`patient_id\`, \`log_date\`, \`period_label\`, \`weight_gram\`, \`weight_change_gram\`,
            \`vital_signs\`, \`drinking_ability\`, \`active_equipment\`, \`milestones_list\`,
            \`nakes_notes\`, \`updated_by\`, \`photo_url\`, \`photo_caption\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            \`log_date\` = VALUES(\`log_date\`),
            \`period_label\` = VALUES(\`period_label\`),
            \`weight_gram\` = VALUES(\`weight_gram\`),
            \`weight_change_gram\` = VALUES(\`weight_change_gram\`),
            \`vital_signs\` = VALUES(\`vital_signs\`),
            \`drinking_ability\` = VALUES(\`drinking_ability\`),
            \`active_equipment\` = VALUES(\`active_equipment\`),
            \`milestones_list\` = VALUES(\`milestones_list\`),
            \`nakes_notes\` = VALUES(\`nakes_notes\`),
            \`updated_by\` = VALUES(\`updated_by\`),
            \`photo_url\` = VALUES(\`photo_url\`),
            \`photo_caption\` = VALUES(\`photo_caption\`);
        `;

        await conn.query(logSql, [
          log.id,
          patient.id,
          formatDateForMySql(log.date),
          log.periodLabel || 'Pagi',
          log.weightGram || 0,
          log.weightChangeGram || 0,
          JSON.stringify(log.vitalSigns || {}),
          JSON.stringify(log.drinkingAbility || {}),
          JSON.stringify(log.activeEquipment || []),
          JSON.stringify(log.milestonesList || []),
          log.nakesNotes || '',
          log.updatedBy || 'Nakes NICU',
          log.photoUrl || null,
          log.photoCaption || null,
        ]);
      }
    }

    await conn.commit();
    return patient;
  } catch (err: any) {
    await conn.rollback();
    console.error('[MySQL DB] upsertPatient error:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

export async function deletePatientById(patientId: string, hardDelete = false, medicalRecordNumber?: string): Promise<boolean> {
  const cleanMrn = (medicalRecordNumber || '').trim().toLowerCase();
  const cleanId = (patientId || '').trim().toLowerCase();

  // Update memory
  if (hardDelete) {
    memoryPatients = memoryPatients.filter((p) => {
      const pId = String(p.id).trim().toLowerCase();
      const pMrn = String(p.medicalRecordNumber || '').trim().toLowerCase();
      if (cleanId && pId === cleanId) return false;
      if (cleanMrn && pMrn === cleanMrn) return false;
      return true;
    });
  } else {
    const idx = memoryPatients.findIndex((p) => {
      const pId = String(p.id).trim().toLowerCase();
      const pMrn = String(p.medicalRecordNumber || '').trim().toLowerCase();
      return (cleanId && pId === cleanId) || (cleanMrn && pMrn === cleanMrn);
    });
    if (idx >= 0) {
      memoryPatients[idx].isDeleted = true;
      memoryPatients[idx].deletedAt = new Date().toISOString();
      memoryPatients[idx].status = 'deleted';
    }
  }

  // Always forward delete to live remote API (https://chagrin.id/api)
  try {
    const delUrl = `${REMOTE_API_BASE}/delete_patient.php?id=${encodeURIComponent(patientId)}&action=${hardDelete ? 'permanent_delete' : 'soft_delete'}`;
    fetch(delUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: patientId,
        action: hardDelete ? 'permanent_delete' : 'soft_delete',
        medical_record_number: medicalRecordNumber,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    fetch(`${REMOTE_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: patientId,
        action: hardDelete ? 'permanent_delete' : 'soft_delete',
        is_deleted: hardDelete ? 2 : 1,
        status: hardDelete ? 'deleted' : 'deleted',
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
  } catch (err: any) {
    console.warn('[Remote Sync] deletePatientById note:', err.message);
  }

  if (!isConnected || !pool) return true;

  try {
    if (hardDelete) {
      if (medicalRecordNumber) {
        await pool.query('DELETE FROM `daily_logs` WHERE `patient_id` = ? OR `patient_id` = ?', [patientId, medicalRecordNumber]);
        await pool.query('DELETE FROM `education_pdfs` WHERE `patient_id` = ? OR `patient_id` = ?', [patientId, medicalRecordNumber]);
        await pool.query('DELETE FROM `patients` WHERE `id` = ? OR `medical_record_number` = ?', [patientId, medicalRecordNumber]);
      } else {
        await pool.query('DELETE FROM `daily_logs` WHERE `patient_id` = ?', [patientId]);
        await pool.query('DELETE FROM `education_pdfs` WHERE `patient_id` = ?', [patientId]);
        await pool.query('DELETE FROM `patients` WHERE `id` = ?', [patientId]);
      }
    } else {
      if (medicalRecordNumber) {
        await pool.query(
          'UPDATE `patients` SET `is_deleted` = 1, `status` = \'deleted\', `deleted_at` = NOW(), `updated_at` = NOW() WHERE `id` = ? OR `medical_record_number` = ?',
          [patientId, medicalRecordNumber]
        );
      } else {
        await pool.query(
          'UPDATE `patients` SET `is_deleted` = 1, `status` = \'deleted\', `deleted_at` = NOW(), `updated_at` = NOW() WHERE `id` = ?',
          [patientId]
        );
      }
    }
    return true;
  } catch (err: any) {
    console.error('[MySQL DB] deletePatientById error:', err.message);
    throw err;
  }
}

export async function restorePatientById(patientId: string): Promise<boolean> {
  const idx = memoryPatients.findIndex((p) => p.id === patientId);
  if (idx >= 0) {
    memoryPatients[idx].isDeleted = false;
    memoryPatients[idx].deletedAt = undefined;
    memoryPatients[idx].status = 'Rawat NICU';
  }

  // Always forward restore to live remote API (https://chagrin.id/api)
  try {
    fetch(`${REMOTE_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restore',
        id: patientId,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
  } catch (err: any) {
    console.warn('[Remote Sync] restorePatientById note:', err.message);
  }

  if (!isConnected || !pool) return true;

  try {
    await pool.query(
      'UPDATE `patients` SET `is_deleted` = 0, `status` = \'Rawat NICU\', `deleted_at` = NULL, `updated_at` = NOW() WHERE `id` = ?',
      [patientId]
    );
    return true;
  } catch (err: any) {
    console.error('[MySQL DB] restorePatientById error:', err.message);
    throw err;
  }
}

// =============================================================================
// DAILY LOGS OPERATIONS
// =============================================================================

export async function addOrUpdateDailyLog(patientId: string, log: DailyLog): Promise<DailyLog> {
  // Update in memory
  const pIdx = memoryPatients.findIndex((p) => p.id === patientId);
  if (pIdx >= 0) {
    const patient = memoryPatients[pIdx];
    const logIdx = (patient.dailyLogs || []).findIndex((l) => l.id === log.id);
    if (logIdx >= 0) {
      patient.dailyLogs[logIdx] = { ...log };
    } else {
      patient.dailyLogs = [...(patient.dailyLogs || []), log];
    }
  }

  // Always forward daily log to live remote API (https://chagrin.id/api)
  try {
    fetch(`${REMOTE_API_BASE}/daily_logs.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        ...log,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
  } catch (err: any) {
    console.warn('[Remote Sync] addOrUpdateDailyLog note:', err.message);
  }

  if (!isConnected || !pool) return log;

  try {
    const sql = `
      INSERT INTO \`daily_logs\` (
        \`id\`, \`patient_id\`, \`log_date\`, \`period_label\`, \`weight_gram\`, \`weight_change_gram\`,
        \`vital_signs\`, \`drinking_ability\`, \`active_equipment\`, \`milestones_list\`,
        \`nakes_notes\`, \`updated_by\`, \`photo_url\`, \`photo_caption\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`log_date\` = VALUES(\`log_date\`),
        \`period_label\` = VALUES(\`period_label\`),
        \`weight_gram\` = VALUES(\`weight_gram\`),
        \`weight_change_gram\` = VALUES(\`weight_change_gram\`),
        \`vital_signs\` = VALUES(\`vital_signs\`),
        \`drinking_ability\` = VALUES(\`drinking_ability\`),
        \`active_equipment\` = VALUES(\`active_equipment\`),
        \`milestones_list\` = VALUES(\`milestones_list\`),
        \`nakes_notes\` = VALUES(\`nakes_notes\`),
        \`updated_by\` = VALUES(\`updated_by\`),
        \`photo_url\` = VALUES(\`photo_url\`),
        \`photo_caption\` = VALUES(\`photo_caption\`);
    `;

    await pool.query(sql, [
      log.id,
      patientId,
      formatDateForMySql(log.date),
      log.periodLabel || 'Pagi',
      log.weightGram || 0,
      log.weightChangeGram || 0,
      JSON.stringify(log.vitalSigns || {}),
      JSON.stringify(log.drinkingAbility || {}),
      JSON.stringify(log.activeEquipment || []),
      JSON.stringify(log.milestonesList || []),
      log.nakesNotes || '',
      log.updatedBy || 'Nakes NICU',
      log.photoUrl || null,
      log.photoCaption || null,
    ]);

    return log;
  } catch (err: any) {
    console.error('[MySQL DB] addOrUpdateDailyLog error:', err.message);
    throw err;
  }
}

export async function deleteDailyLogById(patientId: string, logId: string): Promise<boolean> {
  const pIdx = memoryPatients.findIndex((p) => p.id === patientId);
  if (pIdx >= 0) {
    memoryPatients[pIdx].dailyLogs = (memoryPatients[pIdx].dailyLogs || []).filter(
      (l) => l.id !== logId
    );
  }

  // Always forward daily log deletion to live remote API (https://chagrin.id/api)
  try {
    fetch(`${REMOTE_API_BASE}/daily_logs.php?id=${encodeURIComponent(logId)}&patient_id=${encodeURIComponent(patientId)}&action=delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: logId, patient_id: patientId, action: 'delete' }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
  } catch (err: any) {
    console.warn('[Remote Sync] deleteDailyLogById note:', err.message);
  }

  if (!isConnected || !pool) return true;

  try {
    await pool.query('DELETE FROM `daily_logs` WHERE `id` = ? AND `patient_id` = ?', [
      logId,
      patientId,
    ]);
    return true;
  } catch (err: any) {
    console.error('[MySQL DB] deleteDailyLogById error:', err.message);
    throw err;
  }
}

// =============================================================================
// NAKES USERS & LOGIN LOGS OPERATIONS
// =============================================================================

export async function getAllNakesUsers(): Promise<NakesUser[]> {
  if (!isConnected || !pool) {
    if (memoryNakesUsers.length === 0) {
      await syncFromRemoteDbApi();
    }
    return [...memoryNakesUsers];
  }

  try {
    const [rows] = await pool.query<any[]>(`
      SELECT * FROM \`nakes_users\` ORDER BY \`created_at\` ASC
    `);

    const users: NakesUser[] = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      roleTitle: r.role_title || 'Anggota',
      accountType: r.account_type || 'Anggota Biasa',
      username: r.username,
      pin: r.pin,
      hasAccessRights: Boolean(r.has_access_rights),
      isSuperAdmin: Boolean(r.is_super_admin),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : undefined,
    }));

    memoryNakesUsers = users;
    return users;
  } catch (err: any) {
    console.error('[MySQL DB] getAllNakesUsers error:', err.message);
    return [...memoryNakesUsers];
  }
}

export async function upsertNakesUser(user: NakesUser): Promise<NakesUser> {
  const idx = memoryNakesUsers.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    memoryNakesUsers[idx] = { ...user };
  } else {
    memoryNakesUsers.push({ ...user });
  }

  if (!isConnected || !pool) return user;

  try {
    const sql = `
      INSERT INTO \`nakes_users\` (
        \`id\`, \`name\`, \`role_title\`, \`account_type\`, \`username\`, \`pin\`,
        \`has_access_rights\`, \`is_super_admin\`, \`last_login_at\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`name\` = VALUES(\`name\`),
        \`role_title\` = VALUES(\`role_title\`),
        \`account_type\` = VALUES(\`account_type\`),
        \`username\` = VALUES(\`username\`),
        \`pin\` = VALUES(\`pin\`),
        \`has_access_rights\` = VALUES(\`has_access_rights\`),
        \`is_super_admin\` = VALUES(\`is_super_admin\`),
        \`last_login_at\` = VALUES(\`last_login_at\`);
    `;

    await pool.query(sql, [
      user.id,
      user.name,
      user.roleTitle || 'Anggota',
      user.accountType || 'Anggota Biasa',
      user.username,
      user.pin,
      user.hasAccessRights ? 1 : 0,
      user.isSuperAdmin ? 1 : 0,
      formatDateTimeForMySql(user.lastLoginAt),
    ]);

    return user;
  } catch (err: any) {
    console.error('[MySQL DB] upsertNakesUser error:', err.message);
    throw err;
  }
}

export async function deleteNakesUserById(userId: string): Promise<boolean> {
  memoryNakesUsers = memoryNakesUsers.filter((u) => u.id !== userId);

  if (!isConnected || !pool) return true;

  try {
    await pool.query('DELETE FROM `nakes_users` WHERE `id` = ?', [userId]);
    return true;
  } catch (err: any) {
    console.error('[MySQL DB] deleteNakesUserById error:', err.message);
    throw err;
  }
}

export async function recordNakesLoginLog(
  user: NakesUser,
  ipAddress = '',
  userAgent = ''
): Promise<boolean> {
  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    user_id: user.id,
    user_name: user.name,
    role_title: user.roleTitle,
    account_type: user.accountType || 'Anggota Biasa',
    ip_address: ipAddress,
    user_agent: userAgent,
    login_time: new Date().toISOString(),
  };

  memoryLoginLogs.unshift(logEntry);

  // Update user's lastLoginAt
  const updatedUser: NakesUser = {
    ...user,
    lastLoginAt: new Date().toISOString(),
  };
  await upsertNakesUser(updatedUser);

  if (!isConnected || !pool) return true;

  try {
    await pool.query(
      `INSERT INTO \`nakes_login_logs\` (\`id\`, \`user_id\`, \`user_name\`, \`role_title\`, \`account_type\`, \`ip_address\`, \`user_agent\`, \`login_time\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        logEntry.id,
        user.id,
        user.name,
        user.roleTitle,
        user.accountType || 'Anggota Biasa',
        ipAddress,
        userAgent,
      ]
    );
    return true;
  } catch (err: any) {
    console.error('[MySQL DB] recordNakesLoginLog error:', err.message);
    return false;
  }
}

export async function getNakesLoginLogs(limit = 50): Promise<any[]> {
  if (!isConnected || !pool) return memoryLoginLogs.slice(0, limit);

  try {
    const [rows] = await pool.query<any[]>(
      `SELECT * FROM \`nakes_login_logs\` ORDER BY \`login_time\` DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (err: any) {
    console.error('[MySQL DB] getNakesLoginLogs error:', err.message);
    return memoryLoginLogs.slice(0, limit);
  }
}

// =============================================================================
// EDUCATION PDFS OPERATIONS
// =============================================================================

export async function getAllEducationPdfs(): Promise<EducationPdfItem[]> {
  if (!isConnected || !pool) {
    if (memoryEducationPdfs.length === 0) {
      await syncFromRemoteDbApi();
    }
    return [...memoryEducationPdfs];
  }

  try {
    const [rows] = await pool.query<any[]>(`
      SELECT * FROM \`education_pdfs\` ORDER BY \`order_index\` ASC, \`created_at\` ASC
    `);

    const pdfs: EducationPdfItem[] = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      category: r.category || 'EDUKASI',
      fileName: r.file_name,
      fileSizeText: r.file_size_text || '1.2 MB',
      fileDataUrl: r.file_data_url || undefined,
      coverImageUrl: r.cover_image_url || undefined,
      pageCount: Number(r.page_count) || 1,
      nakesNote: r.nakes_note || undefined,
      publishedAt: r.published_at || new Date().toISOString(),
      isActive: Boolean(r.is_active !== undefined ? r.is_active : 1),
      orderIndex: Number(r.order_index) || 0,
    }));

    memoryEducationPdfs = pdfs;
    return pdfs;
  } catch (err: any) {
    console.error('[MySQL DB] getAllEducationPdfs error:', err.message);
    return [...memoryEducationPdfs];
  }
}

export async function upsertEducationPdf(pdf: EducationPdfItem): Promise<EducationPdfItem> {
  const idx = memoryEducationPdfs.findIndex((p) => p.id === pdf.id);
  if (idx >= 0) {
    memoryEducationPdfs[idx] = { ...pdf };
  } else {
    memoryEducationPdfs.push({ ...pdf });
  }

  if (!isConnected || !pool) return pdf;

  try {
    const sql = `
      INSERT INTO \`education_pdfs\` (
        \`id\`, \`title\`, \`category\`, \`file_name\`, \`file_size_text\`,
        \`file_data_url\`, \`cover_image_url\`, \`page_count\`, \`nakes_note\`,
        \`published_at\`, \`is_active\`, \`order_index\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`title\` = VALUES(\`title\`),
        \`category\` = VALUES(\`category\`),
        \`file_name\` = VALUES(\`file_name\`),
        \`file_size_text\` = VALUES(\`file_size_text\`),
        \`file_data_url\` = COALESCE(VALUES(\`file_data_url\`), \`file_data_url\`),
        \`cover_image_url\` = COALESCE(VALUES(\`cover_image_url\`), \`cover_image_url\`),
        \`page_count\` = VALUES(\`page_count\`),
        \`nakes_note\` = VALUES(\`nakes_note\`),
        \`published_at\` = VALUES(\`published_at\`),
        \`is_active\` = VALUES(\`is_active\`),
        \`order_index\` = VALUES(\`order_index\`);
    `;

    await pool.query(sql, [
      pdf.id,
      pdf.title,
      pdf.category || 'EDUKASI',
      pdf.fileName,
      pdf.fileSizeText || '1.2 MB',
      pdf.fileDataUrl || null,
      pdf.coverImageUrl || null,
      pdf.pageCount || 1,
      pdf.nakesNote || null,
      pdf.publishedAt || new Date().toISOString(),
      pdf.isActive !== false ? 1 : 0,
      pdf.orderIndex || 0,
    ]);

    return pdf;
  } catch (err: any) {
    console.error('[MySQL DB] upsertEducationPdf error:', err.message);
    throw err;
  }
}

export async function deleteEducationPdfById(pdfId: string): Promise<boolean> {
  memoryEducationPdfs = memoryEducationPdfs.filter((p) => p.id !== pdfId);

  if (!isConnected || !pool) return true;

  try {
    await pool.query('DELETE FROM \`education_pdfs\` WHERE \`id\` = ?', [pdfId]);
    return true;
  } catch (err: any) {
    console.error('[MySQL DB] deleteEducationPdfById error:', err.message);
    throw err;
  }
}

export async function reorderEducationPdfs(list: EducationPdfItem[]): Promise<boolean> {
  memoryEducationPdfs = list.map((item, idx) => ({ ...item, orderIndex: idx }));

  if (!isConnected || !pool) return true;

  try {
    for (let idx = 0; idx < list.length; idx++) {
      await pool.query('UPDATE `education_pdfs` SET `order_index` = ? WHERE `id` = ?', [
        idx,
        list[idx].id,
      ]);
    }
    return true;
  } catch (err: any) {
    console.error('[MySQL DB] reorderEducationPdfs error:', err.message);
    throw err;
  }
}
