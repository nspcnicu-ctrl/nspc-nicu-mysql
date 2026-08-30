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
  // Safely extract logs from all possible keys
  const rawLogs =
    row.progress_logs !== undefined
      ? safeJsonParse(row.progress_logs, [])
      : row.progressLogs !== undefined
      ? safeJsonParse(row.progressLogs, [])
      : row.daily_logs !== undefined
      ? safeJsonParse(row.daily_logs, [])
      : row.dailyLogs !== undefined
      ? safeJsonParse(row.dailyLogs, [])
      : [];

  const rawLogsArray = Array.isArray(rawLogs) ? rawLogs : [];
  const isAterm = (row.gestation_category || row.gestationCategory) === 'aterm';

  const normalizedLogs: DailyLog[] = rawLogsArray.map((l: any, idx: number) => {
    if (!l || typeof l !== 'object') {
      return {
        id: `log_${idx}_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        periodLabel: isAterm ? `Hari ke-${idx + 1}` : `Minggu ke-${idx + 1}`,
        weightGram: 2000,
        vitalSigns: { temperature: 36.7, heartRate: 140, respiratoryRate: 42, spo2: 98 },
        drinkingAbility: { method: 'OGT/Sonde', volumeCcPerFeeding: 15, frequencyPerDay: 8, notes: 'Toleransi minum baik.' },
        activeEquipment: [],
        nakesNotes: '',
        updatedBy: 'Tenaga Kesehatan NICU',
        createdAt: new Date().toISOString(),
      };
    }

    const weightVal = Number(l.weightGram ?? l.weight ?? l.weight_gram ?? 0);
    const dateVal = l.date || l.logDate || l.log_date || l.createdAt || l.created_at || new Date().toISOString().split('T')[0];
    const periodLabelVal = l.periodLabel || l.period_label || l.label || l.dayLabel || (isAterm ? `Hari ke-${idx + 1}` : `Minggu ke-${idx + 1}`);

    const vs = l.vitalSigns || l.vital_signs || {};
    const vitalSigns = {
      temperature: Number(vs.temperature ?? l.temp ?? l.temperature ?? 36.7),
      heartRate: Number(vs.heartRate ?? vs.heart_rate ?? l.hr ?? l.heartRate ?? 138),
      respiratoryRate: Number(vs.respiratoryRate ?? vs.respiratory_rate ?? l.rr ?? l.respiratoryRate ?? 42),
      spo2: Number(vs.spo2 ?? l.spo2 ?? 98),
    };

    const da = l.drinkingAbility || l.drinking_ability || {};
    const drinkingAbility = {
      method: (da.method || l.drinkMethod || l.drink_method || 'OGT/Sonde') as any,
      volumeCcPerFeeding: Number(da.volumeCcPerFeeding ?? da.volume_cc_per_feeding ?? l.drinkCc ?? l.volumeCc ?? 15),
      frequencyPerDay: Number(da.frequencyPerDay ?? da.frequency_per_day ?? l.drinkFreq ?? l.frequencyPerDay ?? 8),
      notes: da.notes || da.note || l.drinkNotes || l.drink_notes || 'Toleransi minum baik.',
    };

    return {
      id: String(l.id || `log_${idx}_${Date.now()}`),
      date: dateVal,
      periodLabel: periodLabelVal,
      weightGram: weightVal,
      weight: weightVal,
      weightChangeGram: l.weightChangeGram !== undefined ? Number(l.weightChangeGram) : (l.weight_change_gram !== undefined ? Number(l.weight_change_gram) : undefined),
      vitalSigns,
      drinkingAbility,
      activeEquipment: Array.isArray(l.activeEquipment) ? l.activeEquipment : (Array.isArray(l.active_equipment) ? l.active_equipment : (Array.isArray(l.equipment) ? l.equipment : [])),
      milestonesList: Array.isArray(l.milestonesList) ? l.milestonesList : (Array.isArray(l.milestones_list) ? l.milestones_list : (Array.isArray(l.milestonesChips) ? l.milestonesChips : undefined)),
      nakesNotes: l.nakesNotes || l.nakes_notes || l.notes || l.note || '',
      updatedBy: l.updatedBy || l.updated_by || 'Tenaga Kesehatan NICU',
      createdAt: l.createdAt || l.created_at || dateVal,
      photoUrl: l.photoUrl || l.photo_url || l.photo || undefined,
      photoCaption: l.photoCaption || l.photo_caption || undefined,
    } as DailyLog;
  });

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
    dailyLogs: normalizedLogs,
    progressLogs: normalizedLogs,
    progress_logs: normalizedLogs,
    daily_logs: normalizedLogs,
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
  const logs = Array.isArray(patient.dailyLogs)
    ? patient.dailyLogs
    : Array.isArray(patient.progressLogs)
    ? patient.progressLogs
    : Array.isArray(patient.progress_logs)
    ? patient.progress_logs
    : [];

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
    daily_logs: logs,
    dailyLogs: logs,
    progress_logs: logs,
    progressLogs: logs,
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
    console.warn('[apiService] getEducationPdfs failed, falling back to empty/local:', err);
    return [];
  }
}

export async function saveEducationPdf(pdf: EducationPdfItem): Promise<EducationPdfItem> {
  const payload = {
    action: 'save',
    id: pdf.id,
    title: pdf.title,
    category: pdf.category,
    file_name: pdf.fileName,
    file_size_text: pdf.fileSizeText,
    file_data_url: pdf.fileDataUrl,
    file_url: pdf.fileDataUrl,
    cover_image_url: pdf.coverImageUrl,
    thumbnail_url: pdf.coverImageUrl,
    nakes_note: pdf.nakesNote,
    page_count: pdf.pageCount,
    published_at: pdf.publishedAt,
    order_index: pdf.orderIndex,
  };
  try {
    const res = await apiRequest('education_pdfs.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return (res.data as any)?.data || (res.data as any)?.item || res.data || pdf;
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

export async function updateEducationPdf(pdf: EducationPdfItem): Promise<EducationPdfItem> {
  const payload = {
    id: pdf.id,
    title: pdf.title,
    category: pdf.category,
    file_name: pdf.fileName,
    file_size_text: pdf.fileSizeText,
    file_data_url: pdf.fileDataUrl,
    file_url: pdf.fileDataUrl,
    cover_image_url: pdf.coverImageUrl,
    thumbnail_url: pdf.coverImageUrl,
    nakes_note: pdf.nakesNote,
    order_index: pdf.orderIndex,
  };
  try {
    const res = await apiRequest(`education_pdfs.php?id=${encodeURIComponent(pdf.id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return (res.data as any)?.data || (res.data as any)?.item || res.data || pdf;
  } catch {
    return saveEducationPdf(pdf);
  }
}

export async function deleteEducationPdf(pdfId: string): Promise<boolean> {
  try {
    await apiRequest(`education_pdfs.php?id=${encodeURIComponent(pdfId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ id: pdfId }),
    });
    return true;
  } catch {
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
}

export async function reorderEducationPdfs(pdfs: EducationPdfItem[]): Promise<boolean> {
  try {
    await apiRequest('education_pdfs.php', {
      method: 'PUT',
      body: JSON.stringify({ action: 'reorder', pdfs }),
    });
    return true;
  } catch {
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
}
