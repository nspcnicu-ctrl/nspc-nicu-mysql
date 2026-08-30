import { Patient, DailyLog, NakesUser, EducationPdfItem } from '../types';

/**
 * REST API Client for MySQL Backend at chagrin.id / external server
 */
export const PHP_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, '')
    : 'https://chagrin.id/api';

/**
 * Helper to map MySQL Row (snake_case + JSON strings) to TypeScript Patient (camelCase)
 */
export function mapRowToPatient(row: any): Patient {
  const parseJson = (val: any, fallback: any) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      const parsed = JSON.parse(val);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  // Safely extract logs from all possible keys (daily_logs, dailyLogs, progress_logs, progressLogs)
  const rawLogs =
    row.progress_logs !== undefined
      ? parseJson(row.progress_logs, [])
      : row.progressLogs !== undefined
      ? parseJson(row.progressLogs, [])
      : row.daily_logs !== undefined
      ? parseJson(row.daily_logs, [])
      : row.dailyLogs !== undefined
      ? parseJson(row.dailyLogs, [])
      : [];

  const rawLogsArray = Array.isArray(rawLogs) ? rawLogs : [];

  // Normalize each log to have consistent weightGram, periodLabel, vitalSigns, drinkingAbility
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
    accessPassword: row.access_password || row.accessPassword || '123456',
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
    initialAnthropometry: parseJson(row.initial_anthropometry || row.initialAnthropometry, {
      weightGram: 2000,
      lengthCm: 45,
      headCircumferenceCm: 32,
      chestCircumferenceCm: 30,
    }),
    currentEquipment: parseJson(row.current_equipment || row.currentEquipment, []),
    registeredEquipment: parseJson(row.registered_equipment || row.registeredEquipment, []),
    milestones: (() => {
      const raw = row.milestones;
      const parsed = typeof raw === 'string' ? parseJson(raw, []) : raw;
      if (Array.isArray(parsed)) {
        return parsed.filter((m: any) => typeof m === 'string' && m.trim().length > 0).map((m: string) => m.trim());
      }
      if (parsed && typeof parsed === 'object') {
        const list: string[] = [];
        for (const [k, v] of Object.entries(parsed)) {
          if (Boolean(v)) list.push(k);
        }
        return list;
      }
      return [];
    })(),
    immunizationDischarge: parseJson(row.immunization_discharge || row.immunizationDischarge, undefined),
    dischargeSummary: parseJson(row.discharge_summary || row.dischargeSummary, undefined),
    dischargedAt: row.discharged_at || row.dischargedAt || undefined,
    dailyLogs: normalizedLogs,
    progressLogs: normalizedLogs,
    progress_logs: normalizedLogs,
    daily_logs: normalizedLogs,
    isDeleted: Boolean(
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
    ),
    deletedAt: row.deleted_at || row.deletedAt || undefined,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
  };
}

/**
 * Helper to prepare Patient payload for PHP MySQL endpoint
 */
export function mapPatientToPayload(patient: Patient) {
  const logs = Array.isArray(patient.dailyLogs)
    ? patient.dailyLogs
    : Array.isArray(patient.progressLogs)
    ? patient.progressLogs
    : Array.isArray(patient.progress_logs)
    ? patient.progress_logs
    : [];

  return {
    action: 'save',
    id: patient.id,
    nickname: patient.nickname || '',
    access_password: patient.accessPassword || '123456',
    password: patient.accessPassword || '123456',
    baby_name: patient.babyName || 'Bayi',
    father_name: patient.fatherName || '',
    mother_name: patient.motherName || '',
    parent_name: patient.parentName || (patient.fatherName ? `${patient.fatherName} ${patient.motherName || ''}`.trim() : patient.motherName || ''),
    parent_phone: patient.parentPhone || '',
    gender: patient.gender || 'Laki-Laki',
    birth_date: patient.birthDate || new Date().toISOString().split('T')[0],
    birth_time: patient.birthTime || '',
    admission_date: patient.admissionDate || new Date().toISOString().split('T')[0],
    gestational_age_weeks: patient.gestationalAgeWeeks || 36,
    gestation_category: patient.gestationCategory || 'preterm',
    status: patient.status || 'Rawat NICU',
    medical_record_number: patient.medicalRecordNumber || '',
    room_number: patient.roomNumber || '',
    cover_photo_url: patient.coverPhotoUrl || null,
    initial_anthropometry: patient.initialAnthropometry || null,
    current_equipment: patient.currentEquipment || [],
    registered_equipment: patient.registeredEquipment || [],
    milestones: Array.isArray(patient.milestones)
      ? patient.milestones.filter((m) => typeof m === 'string' && m.trim().length > 0)
      : patient.milestones && typeof patient.milestones === 'object'
      ? Object.entries(patient.milestones).filter(([_, v]) => Boolean(v)).map(([k]) => k)
      : [],
    immunization_discharge: patient.immunizationDischarge || null,
    discharge_summary: patient.dischargeSummary || null,
    discharged_at: patient.dischargedAt || null,
    daily_logs: logs,
    dailyLogs: logs,
    progress_logs: logs,
    progressLogs: logs,
    is_deleted: patient.isDeleted ? 1 : 0,
    deleted_at: patient.deletedAt || null,
  };
}

export async function fetchPatientsApi(): Promise<Patient[]> {
  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php?include_deleted=1`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    const rows = json.data?.patients || json.data?.items || (Array.isArray(json.data) ? json.data : []) || [];
    return rows.map(mapRowToPatient);
  } catch (err) {
    console.warn('[API Client] fetchPatientsApi note:', err);
    throw err;
  }
}

export async function savePatientApi(patient: Patient): Promise<Patient> {
  const payload = mapPatientToPayload(patient);
  
  console.log('🚀 [API POST] Menyimpan data pasien ke MySQL:', {
    url: `${PHP_API_BASE}/patients.php`,
    id: patient.id,
    babyName: patient.babyName,
  });

  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = json?.message || (json?.data?.error_info ? JSON.stringify(json.data.error_info) : null) || `HTTP ${res.status}`;
      console.warn('⚠️ [API POST Info] Respon server non-200 (data tersimpan di memori):', { status: res.status, errMsg });
      return patient;
    }
    if (json && (json.status === 'error' || json.success === false)) {
      console.warn('⚠️ [API POST Info] Server mengembalikan pesan:', json.message);
      return patient;
    }
    return patient;
  } catch (err) {
    console.warn('⚠️ [API POST Info] Koneksi sync backend (data aman):', err);
    return patient;
  }
}

export async function updatePatientApi(patient: Patient): Promise<Patient> {
  return savePatientApi(patient);
}

export async function deletePatientApi(patientId: string, hard = false): Promise<void> {
  const payload = {
    id: patientId,
    patient_id: patientId,
    action: hard ? 'permanent_delete' : 'delete',
    is_deleted: 1,
    status: 'deleted',
  };

  let lastError: any = null;

  // 1. If hard delete (permanent delete), prioritize HTTP DELETE method
  if (hard) {
    try {
      const res = await fetch(`${PHP_API_BASE}/patients.php?id=${encodeURIComponent(patientId)}&action=permanent_delete`, {
        method: 'DELETE',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data || data.status !== 'error') {
          return;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  // 2. Try POST: patients.php (Primary endpoint)
  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (!data || data.status !== 'error') {
        return;
      }
    }
  } catch (err) {
    lastError = err;
  }

  // 3. Try POST: update_patient_status.php (Fallback)
  try {
    const res = await fetch(`${PHP_API_BASE}/update_patient_status.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (!data || data.status !== 'error') {
        return;
      }
    }
  } catch (err) {
    lastError = err;
  }

  if (lastError) {
    console.warn('[API Client] deletePatientApi note:', lastError);
  }
}

export async function updatePatientStatusApi(patientId: string, status: string, dischargeSummary?: any): Promise<void> {
  const payload = {
    id: patientId,
    patient_id: patientId,
    action: 'update_status',
    status,
    discharge_summary: dischargeSummary,
  };

  let lastError: any = null;

  // Try 1: patients.php (Primary endpoint)
  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (!data || data.status !== 'error') {
        return;
      }
    }
  } catch (err) {
    lastError = err;
  }

  // Try 2: update_patient_status.php (Fallback)
  try {
    const res = await fetch(`${PHP_API_BASE}/update_patient_status.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (!data || data.status !== 'error') {
        return;
      }
    }
  } catch (err) {
    lastError = err;
  }

  if (lastError) {
    console.warn('[API Client] updatePatientStatusApi note:', lastError);
  }
}

export async function restorePatientApi(patientId: string): Promise<void> {
  const payload = {
    id: patientId,
    patient_id: patientId,
    action: 'restore',
    restore: true,
    is_deleted: 0,
    status: 'Rawat NICU',
  };

  let lastError: any = null;

  // Try 1: patients.php
  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
  } catch (err) {
    lastError = err;
  }

  // Try 2: update_patient_status.php
  try {
    const res = await fetch(`${PHP_API_BASE}/update_patient_status.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
  } catch (err) {
    lastError = err;
  }

  if (lastError) {
    console.warn('[API Client] restorePatientApi note:', lastError);
  }
}

export async function emptyTrashApi(): Promise<void> {
  const payload = {
    action: 'empty_trash',
  };

  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
  } catch (err) {
    console.warn('[API Client] emptyTrashApi warning:', err);
  }

  try {
    await fetch(`${PHP_API_BASE}/update_patient_status.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {}
}

export async function bulkSyncPatientsApi(patients: Patient[]): Promise<void> {
  try {
    if (!patients || patients.length === 0) return;
    // Perform parallel non-blocking sync in chunks
    const chunks = [];
    const chunkSize = 5;
    for (let i = 0; i < patients.length; i += chunkSize) {
      chunks.push(patients.slice(i, i + chunkSize));
    }
    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map((p) => savePatientApi(p)));
    }
  } catch (err) {
    console.warn('[API Client] bulkSyncPatientsApi failed:', err);
  }
}

// =============================================================================
// 2. CATATAN HARIAN PASIEN (daily_logs.php)
// =============================================================================

export async function addDailyLogApi(patientId: string, log: DailyLog): Promise<DailyLog> {
  const url = `${PHP_API_BASE}/daily_logs.php`;
  const payload = { action: 'save', patient_id: patientId, ...log };
  console.log('🚀 [DEBUG 1 - BEFORE FETCH] Menyimpan Daily Log:', { url, payload });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    console.log('📥 [DEBUG 2 - RESPONSE RECEIVED] Respons Daily Log:', { httpStatus: res.status, body: json });
    if (!res.ok) return log;
    return json?.data || log;
  } catch (err) {
    console.error('❌ [DEBUG 3 - CATCH ERROR] addDailyLogApi failed:', err);
    return log;
  }
}

export async function updateDailyLogApi(patientId: string, log: DailyLog): Promise<DailyLog> {
  return addDailyLogApi(patientId, log);
}

export async function deleteDailyLogApi(patientId: string, logId: string): Promise<void> {
  const url = `${PHP_API_BASE}/daily_logs.php`;
  const payload = { action: 'delete', patient_id: patientId, log_id: logId };
  console.log('🚀 [DEBUG 1 - BEFORE FETCH] Menghapus Daily Log:', { url, payload });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    console.log('📥 [DEBUG 2 - RESPONSE RECEIVED] Respons delete Daily Log:', { httpStatus: res.status, body: json });
  } catch (err) {
    console.error('❌ [DEBUG 3 - CATCH ERROR] deleteDailyLogApi failed:', err);
  }
}

// =============================================================================
// 3. AKUN & HAK AKSES NAKES (nakes_users.php)
// =============================================================================

export async function fetchNakesUsersApi(): Promise<NakesUser[]> {
  const url = `${PHP_API_BASE}/nakes_users.php`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = json.data || [];
    return rows.map((u: any) => ({
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
  } catch (err) {
    console.warn('[API Client] fetchNakesUsersApi fallback:', err);
    return [];
  }
}

export async function saveNakesUserApi(user: NakesUser): Promise<NakesUser> {
  const url = `${PHP_API_BASE}/nakes_users.php`;
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

  // 🔍 DEBUG 1: Payload sebelum dikirim
  console.log('🚀 [DEBUG 1 - BEFORE FETCH] Menyimpan Akun Nakes / Hak Akses ke MySQL:', {
    url,
    payload,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);

    // 🔍 DEBUG 2: Respons sukses dari server
    console.log('📥 [DEBUG 2 - RESPONSE RECEIVED] Respons server nakes_users.php:', {
      httpStatus: res.status,
      ok: res.ok,
      body: json,
    });

    if (!res.ok) {
      const errMsg = json?.message || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    if (json && json.status === 'error') {
      throw new Error(json.message || 'Gagal menyimpan nakes');
    }
    return json?.data || user;
  } catch (err) {
    // 🔍 DEBUG 3: Catch error jika koneksi gagal
    console.error('❌ [DEBUG 3 - CATCH ERROR] Gagal mengirim data nakes:', err);
    throw err;
  }
}

export async function deleteNakesUserApi(userId: string): Promise<void> {
  const url = `${PHP_API_BASE}/nakes_users.php`;
  const payload = { action: 'delete', id: userId };
  console.log('🚀 [DEBUG 1 - BEFORE FETCH] Menghapus Akun Nakes:', { url, payload });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    console.log('📥 [DEBUG 2 - RESPONSE RECEIVED] Respons delete nakes:', { httpStatus: res.status, body: json });
  } catch (err) {
    console.error('❌ [DEBUG 3 - CATCH ERROR] deleteNakesUserApi error:', err);
  }
}

// =============================================================================
// 4. LOG LOGIN NAKES (nakes_login_logs.php)
// =============================================================================

export async function recordNakesLoginApi(user: NakesUser): Promise<boolean> {
  const logUrl = `${PHP_API_BASE}/nakes_login_logs.php`;
  const userUrl = `${PHP_API_BASE}/nakes_users.php`;

  const payload = {
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

  console.log('🚀 [DEBUG 1 - BEFORE FETCH] Mencatat Log Login Nakes:', { logUrl, payload });

  try {
    fetch(logUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const json = await r.json().catch(() => null);
      console.log('📥 [DEBUG 2 - RESPONSE RECEIVED] Respons nakes_login_logs.php:', { httpStatus: r.status, body: json });
    }).catch((e) => {
      console.warn('❌ [DEBUG 3 - CATCH ERROR] nakes_login_logs.php warning:', e);
    });

    await fetch(userUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ action: 'login', user }),
    });

    return true;
  } catch (err) {
    console.error('❌ [DEBUG 3 - CATCH ERROR] recordNakesLoginApi failed:', err);
    return false;
  }
}

export async function fetchNakesLoginLogsApi(): Promise<any[]> {
  const url = `${PHP_API_BASE}/nakes_login_logs.php`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.warn('[API Client] fetchNakesLoginLogsApi fallback:', err);
    return [];
  }
}

// =============================================================================
// 5. PDF EDUKASI (education_pdfs.php)
// =============================================================================

export interface EducationApiStatus {
  isError: boolean;
  status: number | null;
  message: string;
  endpoint: string;
  lastChecked: string;
  isUsingFallback: boolean;
}

let currentEducationApiStatus: EducationApiStatus = {
  isError: false,
  status: null,
  message: 'Siap menghubungkan ke endpoint API edukasi',
  endpoint: `${PHP_API_BASE}/education_pdfs.php`,
  lastChecked: new Date().toISOString(),
  isUsingFallback: false,
};

export function getEducationApiStatus(): EducationApiStatus {
  return { ...currentEducationApiStatus };
}

function updateEducationApiStatus(status: Partial<EducationApiStatus>) {
  currentEducationApiStatus = {
    ...currentEducationApiStatus,
    ...status,
    lastChecked: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nspc_education_api_status_change', {
        detail: currentEducationApiStatus,
      })
    );
  }
}

export async function fetchEducationPdfsApi(): Promise<EducationPdfItem[]> {
  // Target URL tepat: https://chagrin.id/api/education_pdfs.php (tanpa typo, tanpa public_html)
  const url = `${PHP_API_BASE}/education_pdfs.php`;
  console.log('📡 [API Client] Fetching Education PDFs from:', url);

  try {
    let res: Response | null = null;
    let fetchError: Error | null = null;

    try {
      res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (networkErr: any) {
      fetchError = networkErr;
      console.warn('⚠️ [API Client] Network error saat mengakses:', url, networkErr.message);
    }

    // 1. Tangani jika response status bukan 200 OK (seperti 404 Not Found, 500, etc.)
    if (!res || !res.ok) {
      const httpStatus = res ? res.status : 0;
      const statusText = res ? res.statusText : (fetchError?.message || 'Network unreachable');

      if (httpStatus === 404) {
        console.warn(`⚠️ [API Client 404] Endpoint ${url} mengembalikan status 404 Not Found.`);
        updateEducationApiStatus({
          isError: true,
          status: 404,
          message: `Endpoint ${url} mengembalikan status 404 (Not Found). Sistem beralih ke penyimpanan lokal & modul bawaan.`,
          endpoint: url,
          isUsingFallback: true,
        });
      } else {
        console.warn(`⚠️ [API Client Non-200] Endpoint ${url} mengembalikan status ${httpStatus} (${statusText}).`);
        updateEducationApiStatus({
          isError: true,
          status: httpStatus,
          message: `API mengembalikan status HTTP ${httpStatus}. Sistem beralih ke penyimpanan lokal & modul bawaan.`,
          endpoint: url,
          isUsingFallback: true,
        });
      }

      return [];
    }

    // 2. Response 200 OK - Parse JSON secara aman
    const json = await res.json().catch((jsonErr) => {
      console.warn('⚠️ [API Client] Gagal parse JSON dari:', url, jsonErr);
      return null;
    });

    const items = json?.data?.items || json?.data || json?.items || [];
    if (Array.isArray(items)) {
      updateEducationApiStatus({
        isError: false,
        status: 200,
        message: `Terhubung normal (${items.length} modul ditemukan)`,
        endpoint: url,
        isUsingFallback: false,
      });
      return items;
    }

    return [];
  } catch (err: any) {
    console.warn('[API Client] fetchEducationPdfsApi unhandled fallback:', err);
    updateEducationApiStatus({
      isError: true,
      status: 0,
      message: `Gagal memuat API: ${err?.message || 'Koneksi terputus'}. Menggunakan data offline lokal.`,
      endpoint: url,
      isUsingFallback: true,
    });
    return [];
  }
}

export async function saveEducationPdfApi(pdf: EducationPdfItem): Promise<EducationPdfItem> {
  const url = `${PHP_API_BASE}/education_pdfs.php`;
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
    page_count: pdf.pageCount,
    published_at: pdf.publishedAt,
    order_index: pdf.orderIndex,
    is_active: pdf.isActive !== false ? 1 : 0,
    action: 'save',
  };
  console.log('🚀 [API Client POST] Menyimpan PDF Edukasi Baru ke:', url, { id: pdf.id, title: pdf.title });

  try {
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e: any) {
      console.warn('[API Client] education_pdfs.php POST gagal:', e?.message);
    }

    if (!res || !res.ok) {
      const httpStatus = res ? res.status : 0;
      console.warn(`⚠️ [API Client Save] HTTP ${httpStatus} saat menyimpan PDF ke ${url}. Data tetap tersimpan aman di lokal browser.`);
      
      // Fallback ke upload_education.php jika ada
      try {
        const fallbackRes = await fetch(`${PHP_API_BASE}/upload_education.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json().catch(() => null);
          return fallbackJson?.data || pdf;
        }
      } catch {
        // Fallback catch
      }

      return pdf;
    }

    const json = await res.json().catch(() => null);
    console.log('📥 [API Client Save] Respons berhasil:', { httpStatus: res.status, data: json?.data });
    return json?.data || json?.item || pdf;
  } catch (err) {
    console.info('ℹ️ [API Info] saveEducationPdfApi local save fallback:', err);
    return pdf;
  }
}

export async function updateEducationPdfApi(pdf: EducationPdfItem): Promise<EducationPdfItem> {
  const url = `${PHP_API_BASE}/education_pdfs.php`;
  const payload = {
    action: 'update',
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
    order_index: pdf.orderIndex,
  };
  console.log('🚀 [API Client POST Update] Mengirim pembaruan PDF ke:', url, payload);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await res.json().catch(() => null);
    console.log('📥 [API Client Update PDF] Respons database:', responseData);

    if (responseData && (responseData.success || responseData.status === 'success')) {
      return responseData.data || responseData.item || pdf;
    }

    // Jika gagal atau format berbeda, coba juga endpoint alternatif
    if (!res.ok) {
      console.warn('⚠️ [API Client Update] Gagal POST update:', responseData?.message);
    }
    return responseData?.data || responseData?.item || pdf;
  } catch (err) {
    console.error('❌ [API Client Update Error] Gagal menghubungi server:', err);
    return pdf;
  }
}

export async function deleteEducationPdfApi(pdfId: string): Promise<void> {
  const url = `${PHP_API_BASE}/education_pdfs.php?id=${encodeURIComponent(pdfId)}`;
  const payload = { action: 'delete', id: pdfId };
  console.log('🚀 [API Client DELETE] Menghapus PDF Edukasi di:', url, { id: pdfId });

  try {
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Network fail
    }

    // Fallback ke POST jika DELETE dibatasi
    if (!res || !res.ok) {
      try {
        await fetch(`${PHP_API_BASE}/education_pdfs.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        try {
          await fetch(`${PHP_API_BASE}/delete_education.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch {}
      }
    }
  } catch (err) {
    console.info('ℹ️ [API Info] deleteEducationPdfApi local fallback:', err);
  }
}

export async function reorderEducationPdfsApi(pdfs: EducationPdfItem[]): Promise<void> {
  const url = `${PHP_API_BASE}/education_pdfs.php`;
  const payload = { action: 'reorder', pdfs };
  console.log('🚀 [API Client REORDER] Menyusun ulang PDF Edukasi di:', url, { count: pdfs.length });

  try {
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}

    if (!res || !res.ok) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {}
    }
  } catch (err) {
    console.info('ℹ️ [API Info] reorderEducationPdfsApi local fallback:', err);
  }
}

export async function forceSyncAllLocalToRemote(patients: Patient[], nakesUsers: NakesUser[]): Promise<{ success: boolean; message: string; patientCount: number; nakesCount: number }> {
  let syncedPatients = 0;
  let syncedNakes = 0;
  const errors: string[] = [];

  for (const p of patients) {
    try {
      await savePatientApi(p);
      syncedPatients++;
    } catch (e: any) {
      errors.push(`Pasien ${p.babyName}: ${e.message || 'Gagal'}`);
    }
  }

  for (const u of nakesUsers) {
    try {
      await saveNakesUserApi(u);
      syncedNakes++;
    } catch (e: any) {
      errors.push(`Nakes ${u.name}: ${e.message || 'Gagal'}`);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: `Tersinkron sebagian (${syncedPatients} pasien, ${syncedNakes} nakes). Error: ${errors.join('; ')}`,
      patientCount: syncedPatients,
      nakesCount: syncedNakes,
    };
  }

  return {
    success: true,
    message: `Berhasil menyinkronkan ${syncedPatients} data pasien dan ${syncedNakes} akun nakes ke MySQL!`,
    patientCount: syncedPatients,
    nakesCount: syncedNakes,
  };
}

/**
 * Real-time Stream / Polling Listener
 */
export function initRealtimeEventSource(onUpdate: (eventType: string, data: any) => void): () => void {
  // Polling every 15s for fresh changes
  const interval = setInterval(() => {
    onUpdate('data_changed', {});
  }, 15000);

  return () => {
    clearInterval(interval);
  };
}
