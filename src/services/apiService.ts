/**
 * REST API Service Layer for MySQL Backend (Niagahoster / cPanel)
 * Endpoint: https://chagrin.id/api
 */

import { Patient, DailyLog, NakesUser, EducationPdfItem } from '../types';

export const API_BASE_URL = 'https://chagrin.id/api';

/**
 * Standard API Response Structure from PHP
 */
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message: string;
  data?: T;
}

/**
 * Helper to safely parse JSON strings or return fallback
 */
function safeJsonParse<T>(val: any, fallback: T): T {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

/**
 * Helper to transform PHP MySQL snake_case row to TypeScript Patient object (camelCase)
 */
export function mapRowToPatient(row: any): Patient {
  return {
    id: String(row.id || `p_${Date.now()}`),
    nickname: row.nickname || '',
    accessPassword: row.access_password || row.accessPassword || row.password || '123456',
    babyName: row.baby_name || row.babyName || 'Bayi Ny.',
    fatherName: row.father_name || row.fatherName || '',
    motherName: row.mother_name || row.motherName || '',
    gender: row.gender || 'Laki-Laki',
    birthDate: row.birth_date || row.birthDate || new Date().toISOString().split('T')[0],
    admissionDate: row.admission_date || row.admissionDate || new Date().toISOString().split('T')[0],
    gestationalAgeWeeks: Number(row.gestational_age_weeks || row.gestationalAgeWeeks || 36),
    gestationCategory: row.gestation_category || row.gestationCategory || 'preterm',
    status: row.status || 'Rawat NICU',
    medicalRecordNumber: row.medical_record_number || row.medicalRecordNumber || '',
    roomNumber: row.room_number || row.roomNumber || '',
    coverPhotoUrl: row.cover_photo_url || row.coverPhotoUrl || undefined,
    initialAnthropometry: safeJsonParse(row.initial_anthropometry || row.initialAnthropometry, {
      weightGram: 2000,
      lengthCm: 45,
      headCircumferenceCm: 32,
      chestCircumferenceCm: 30,
    }),
    currentEquipment: safeJsonParse(row.current_equipment || row.currentEquipment, []),
    registeredEquipment: safeJsonParse(row.registered_equipment || row.registeredEquipment, []),
    milestones: safeJsonParse(row.milestones, {
      lepasCPAP: false,
      lepasVentilator: false,
      lepasInfus: false,
      lepasOGT: false,
      lepasO2Nasal: false,
      refleksMenghisapBaik: false,
      refleksMenelanBaik: false,
      bayiSementaraPemantauanKetat: true,
      selesaiPMK: false,
      selesaiHBO: false,
      bolehPulang: false,
    }),
    immunizationDischarge: safeJsonParse(row.immunization_discharge || row.immunizationDischarge, undefined),
    dischargeSummary: safeJsonParse(row.discharge_summary || row.dischargeSummary, undefined),
    dischargedAt: row.discharged_at || row.dischargedAt || undefined,
    dailyLogs: safeJsonParse(row.daily_logs || row.dailyLogs, []),
    isDeleted: Boolean(row.is_deleted || row.isDeleted),
    deletedAt: row.deleted_at || row.deletedAt || undefined,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
  };
}

/**
 * Generic Fetch Wrapper with timeout & robust JSON error handling
 */
async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`;
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = json?.message || `Server error (${res.status}): ${res.statusText}`;
      throw new Error(errorMsg);
    }

    if (json && json.status === 'error') {
      throw new Error(json.message || 'API request returned an error status');
    }

    return json as ApiResponse<T>;
  } catch (err: any) {
    console.warn(`[apiService] Error on ${options.method || 'GET'} ${url}:`, err.message);
    throw err;
  }
}

// =============================================================================
// 1. PATIENTS API ENDPOINTS (patients.php)
// =============================================================================

/**
 * Ambil Seluruh Data Pasien (GET /patients.php)
 */
export async function getPatients(): Promise<Patient[]> {
  const res = await apiRequest<any[]>('patients.php', { method: 'GET' });
  const rows = res.data || [];
  return rows.map(mapRowToPatient);
}

/**
 * Simpan / Edit Pasien (POST /patients.php with action: 'save')
 */
export async function savePatient(patient: Patient): Promise<Patient> {
  const payload = {
    action: 'save',
    id: patient.id,
    nickname: patient.nickname,
    access_password: patient.accessPassword,
    password: patient.accessPassword,
    baby_name: patient.babyName,
    father_name: patient.fatherName || '',
    mother_name: patient.motherName || '',
    gender: patient.gender,
    birth_date: patient.birthDate,
    admission_date: patient.admissionDate,
    gestational_age_weeks: patient.gestationalAgeWeeks,
    gestation_category: patient.gestationCategory,
    status: patient.status,
    medical_record_number: patient.medicalRecordNumber || '',
    room_number: patient.roomNumber || '',
    cover_photo_url: patient.coverPhotoUrl || null,
    initial_anthropometry: patient.initialAnthropometry,
    current_equipment: patient.currentEquipment || [],
    registered_equipment: patient.registeredEquipment || [],
    milestones: patient.milestones,
    immunization_discharge: patient.immunizationDischarge || null,
    discharge_summary: patient.dischargeSummary || null,
    discharged_at: patient.dischargedAt || null,
    is_deleted: patient.isDeleted ? 1 : 0,
    deleted_at: patient.deletedAt || null,
    ...patient,
  };

  await apiRequest('patients.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return patient;
}

/**
 * Hapus Pasien ke Sampah (Soft Delete)
 */
export async function softDeletePatient(patientId: string): Promise<boolean> {
  await apiRequest('patients.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'soft_delete', id: patientId }),
  });
  return true;
}

/**
 * Pulihkan Pasien dari Sampah (Restore)
 */
export async function restorePatient(patientId: string): Promise<boolean> {
  await apiRequest('patients.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'restore', id: patientId }),
  });
  return true;
}

/**
 * Hapus Pasien Secara Permanen
 */
export async function permanentDeletePatient(patientId: string): Promise<boolean> {
  await apiRequest('patients.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'permanent_delete', id: patientId }),
  });
  return true;
}

/**
 * Kosongkan Sampah
 */
export async function emptyTrashPatients(): Promise<boolean> {
  await apiRequest('patients.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'empty_trash' }),
  });
  return true;
}

// =============================================================================
// 2. DAILY LOGS API ENDPOINTS (daily_logs.php)
// =============================================================================

export async function saveDailyLog(patientId: string, log: DailyLog): Promise<DailyLog> {
  const payload = { action: 'save', patient_id: patientId, ...log };
  const res = await apiRequest('daily_logs.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data || log;
}

export async function deleteDailyLog(patientId: string, logId: string): Promise<boolean> {
  await apiRequest('daily_logs.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', patient_id: patientId, log_id: logId }),
  });
  return true;
}

// =============================================================================
// 3. NAKES USERS API ENDPOINTS (nakes_users.php)
// =============================================================================

/**
 * Ambil Seluruh Data Nakes (GET /nakes_users.php)
 */
export async function getNakesUsers(): Promise<NakesUser[]> {
  const res = await apiRequest<any[]>('nakes_users.php', { method: 'GET' });
  const rows = res.data || [];
  return rows.map((u) => ({
    id: String(u.id),
    name: u.name || 'Tenaga Kesehatan',
    roleTitle: u.role_title || u.roleTitle || 'Tenaga Kesehatan',
    accountType: u.account_type || u.accountType || (u.is_super_admin ? 'admin' : 'nakes'),
    username: u.username || '',
    pin: u.pin || '123456',
    createdAt: u.created_at || u.createdAt || new Date().toISOString(),
    isSuperAdmin: Boolean(u.is_super_admin || u.isSuperAdmin),
    hasAccessRights: u.is_authorized !== undefined ? Boolean(u.is_authorized) : (u.has_access_rights !== undefined ? Boolean(u.has_access_rights) : true),
    lastLoginAt: u.last_login_at || undefined,
  }));
}

/**
 * Simpan / Update Akun Nakes (POST /nakes_users.php)
 */
export async function saveNakesUser(user: NakesUser): Promise<NakesUser> {
  const isAuth = user.hasAccessRights ? 1 : 0;
  const isSuper = user.isSuperAdmin ? 1 : 0;

  const payload = {
    action: 'save',
    id: user.id,
    name: user.name,
    role_title: user.roleTitle || 'Tenaga Kesehatan',
    role: user.roleTitle || 'Tenaga Kesehatan',
    account_type: user.isSuperAdmin ? 'admin' : (user.hasAccessRights ? 'Diberi Hak Akses' : 'Tanpa Hak Akses'),
    username: user.username || user.name.toLowerCase().replace(/\s+/g, ''),
    pin: user.pin || '123456',
    is_super_admin: isSuper,
    isSuperAdmin: isSuper,
    is_authorized: isAuth,
    has_access_rights: isAuth,
    hasAccessRights: isAuth,
    ...user,
  };

  await apiRequest('nakes_users.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return user;
}

/**
 * Hapus Akun Nakes (POST /nakes_users.php with action: 'delete')
 */
export async function deleteNakesUser(userId: string): Promise<boolean> {
  await apiRequest('nakes_users.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id: userId }),
  });
  return true;
}

/**
 * Catat Waktu Login Nakes (POST /nakes_login_logs.php & nakes_users.php)
 */
export async function loginNakes(user: NakesUser): Promise<boolean> {
  try {
    const logPayload = {
      action: 'save',
      nakes_id: user.id,
      user_id: user.id,
      username: user.username,
      name: user.name,
      role_title: user.roleTitle || 'Tenaga Kesehatan',
      login_time: new Date().toISOString(),
      ip_address: window.location.hostname,
      user_agent: navigator.userAgent,
    };

    // Log to nakes_login_logs.php
    apiRequest('nakes_login_logs.php', {
      method: 'POST',
      body: JSON.stringify(logPayload),
    }).catch(() => {});

    // Update last_login in nakes_users.php
    await apiRequest('nakes_users.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', user }),
    });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// 4. EDUCATION PDFS API ENDPOINTS (education_pdfs.php)
// =============================================================================

export async function getEducationPdfs(): Promise<EducationPdfItem[]> {
  try {
    const res = await apiRequest<EducationPdfItem[]>('education_pdfs.php', { method: 'GET' });
    const items = (res.data as any)?.items || res.data || [];
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.warn('[apiService] getEducationPdfs fallback:', err);
    try {
      const fallbackRes = await apiRequest<EducationPdfItem[]>('get_education.php', { method: 'GET' });
      const fallbackItems = (fallbackRes.data as any)?.items || fallbackRes.data || [];
      return Array.isArray(fallbackItems) ? fallbackItems : [];
    } catch {
      return [];
    }
  }
}

export async function saveEducationPdf(pdf: EducationPdfItem): Promise<EducationPdfItem> {
  const payload = { action: 'save', ...pdf };
  try {
    const res = await apiRequest('education_pdfs.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return (res.data as any)?.data || res.data || pdf;
  } catch {
    try {
      const res = await apiRequest('upload_education.php', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return (res.data as any)?.data || res.data || pdf;
    } catch {
      return pdf;
    }
  }
}

export async function deleteEducationPdf(pdfId: string): Promise<boolean> {
  try {
    await apiRequest('education_pdfs.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id: pdfId }),
    });
    return true;
  } catch {
    try {
      await apiRequest('delete_education.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id: pdfId }),
      });
      return true;
    } catch {
      return false;
    }
  }
}

export async function reorderEducationPdfs(pdfs: EducationPdfItem[]): Promise<boolean> {
  try {
    await apiRequest('education_pdfs.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'reorder', pdfs }),
    });
    return true;
  } catch {
    return false;
  }
}
