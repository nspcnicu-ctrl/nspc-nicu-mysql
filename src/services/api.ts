import { Patient, DailyLog, NakesUser, EducationPdfItem } from '../types';

/**
 * REST API Client for MySQL Backend at chagrin.id
 */

export const PHP_API_BASE = 'https://chagrin.id/api';

/**
 * Helper to map MySQL Row (snake_case + JSON strings) to TypeScript Patient (camelCase)
 */
export function mapRowToPatient(row: any): Patient {
  const parseJson = (val: any, fallback: any) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

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
    milestones: parseJson(row.milestones, {
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
    immunizationDischarge: parseJson(row.immunization_discharge || row.immunizationDischarge, undefined),
    dischargeSummary: parseJson(row.discharge_summary || row.dischargeSummary, undefined),
    dischargedAt: row.discharged_at || row.dischargedAt || undefined,
    dailyLogs: parseJson(row.daily_logs || row.dailyLogs, []),
    isDeleted: Boolean(row.is_deleted || row.isDeleted),
    deletedAt: row.deleted_at || row.deletedAt || undefined,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
  };
}

/**
 * Helper to prepare Patient payload for PHP MySQL endpoint
 */
export function mapPatientToPayload(patient: Patient) {
  return {
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
    // Include camelCase too for cross-compatibility
    ...patient,
  };
}

export async function fetchPatientsApi(): Promise<Patient[]> {
  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    const rows = json.data?.patients || json.data?.items || (Array.isArray(json.data) ? json.data : []) || [];
    return rows.map(mapRowToPatient);
  } catch (err) {
    console.warn('[API Client] fetchPatientsApi failed:', err);
    throw err;
  }
}

export async function savePatientApi(patient: Patient): Promise<Patient> {
  const payload = mapPatientToPayload(patient);
  
  // 🔍 DEBUG 1: Payload sebelum dikirim
  console.log('🚀 [DEBUG 1 - BEFORE FETCH] Mengirim data pasien ke MySQL:', {
    url: `${PHP_API_BASE}/patients.php`,
    payload,
  });

  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);

    // 🔍 DEBUG 2: Respons sukses dari server
    console.log('📥 [DEBUG 2 - RESPONSE RECEIVED] Respons server patients.php:', {
      httpStatus: res.status,
      ok: res.ok,
      body: json,
    });

    if (!res.ok) {
      const errMsg = json?.message || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    if (json && json.status === 'error') {
      throw new Error(json.message || 'Gagal menyimpan pasien');
    }
    return patient;
  } catch (err) {
    // 🔍 DEBUG 3: Catch error jika koneksi gagal
    console.error('❌ [DEBUG 3 - CATCH ERROR] Gagal mengirim data pasien:', err);
    throw err;
  }
}

export async function updatePatientApi(patient: Patient): Promise<Patient> {
  return savePatientApi(patient);
}

export async function deletePatientApi(patientId: string, hard = false): Promise<void> {
  const payload = {
    id: patientId,
    action: hard ? 'permanent_delete' : 'delete',
  };

  try {
    const res = await fetch(`${PHP_API_BASE}/update_patient_status.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.status === 'error') {
        throw new Error(data.message || 'Gagal menghapus pasien di server');
      }
      return;
    }
  } catch (err) {
    // Fallback to patients.php
    const fallbackRes = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!fallbackRes.ok) {
      throw new Error(`Server error (${fallbackRes.status}) saat menghapus pasien`);
    }
    const data = await fallbackRes.json().catch(() => null);
    if (data && data.status === 'error') {
      throw new Error(data.message || 'Gagal menghapus pasien di database');
    }
  }
}

export async function updatePatientStatusApi(patientId: string, status: string, dischargeSummary?: any): Promise<void> {
  const payload = {
    id: patientId,
    action: 'update_status',
    status,
    discharge_summary: dischargeSummary,
  };

  try {
    const res = await fetch(`${PHP_API_BASE}/update_patient_status.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.status === 'error') {
        throw new Error(data.message || 'Gagal memperbarui status pasien di server');
      }
      return;
    }
  } catch (err) {
    // Fallback to patients.php
    const fallbackRes = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        id: patientId,
        status,
        discharge_summary: dischargeSummary,
      }),
    });
    if (!fallbackRes.ok) {
      throw new Error(`Server error (${fallbackRes.status}) saat update status pasien`);
    }
    const data = await fallbackRes.json().catch(() => null);
    if (data && data.status === 'error') {
      throw new Error(data.message || 'Gagal memperbarui status di database');
    }
  }
}

export async function restorePatientApi(patientId: string): Promise<void> {
  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        id: patientId,
        action: 'restore',
      }),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    console.log('[API Client] Restored patient in MySQL:', json);
  } catch (err) {
    console.warn('[API Client] restorePatientApi warning:', err);
  }
}

export async function emptyTrashApi(): Promise<void> {
  try {
    const res = await fetch(`${PHP_API_BASE}/patients.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        action: 'empty_trash',
      }),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  } catch (err) {
    console.warn('[API Client] emptyTrashApi warning:', err);
  }
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

      // Coba fallback sekunder ke get_education.php jika tersedia di backend
      try {
        const fallbackRes = await fetch(`${PHP_API_BASE}/get_education.php`, {
          headers: { 'Accept': 'application/json' },
        });
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json().catch(() => null);
          const items = fallbackJson?.data?.items || fallbackJson?.data || [];
          if (Array.isArray(items) && items.length > 0) {
            updateEducationApiStatus({
              isError: false,
              status: 200,
              message: 'Terhubung melalui get_education.php',
              endpoint: `${PHP_API_BASE}/get_education.php`,
              isUsingFallback: false,
            });
            return items;
          }
        }
      } catch {
        // Abaikan jika fallback sekunder juga gagal
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
  const payload = { action: 'save', ...pdf };
  console.log('🚀 [API Client] Menyimpan PDF Edukasi ke:', url, { id: pdf.id, title: pdf.title });

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
      
      // Coba fallback ke upload_education.php
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
    return json?.data || pdf;
  } catch (err) {
    console.info('ℹ️ [API Info] saveEducationPdfApi local save fallback:', err);
    return pdf;
  }
}

export async function deleteEducationPdfApi(pdfId: string): Promise<void> {
  const url = `${PHP_API_BASE}/education_pdfs.php`;
  const payload = { action: 'delete', id: pdfId };
  console.log('🚀 [API Client] Menghapus PDF Edukasi di:', url, { id: pdfId });

  try {
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Network fail
    }

    if (!res || !res.ok) {
      try {
        await fetch(`${PHP_API_BASE}/delete_education.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // Fallback
      }
    }
  } catch (err) {
    console.info('ℹ️ [API Info] deleteEducationPdfApi local fallback:', err);
  }
}

export async function reorderEducationPdfsApi(pdfs: EducationPdfItem[]): Promise<void> {
  const url = `${PHP_API_BASE}/education_pdfs.php`;
  const payload = { action: 'reorder', pdfs };
  console.log('🚀 [API Client] Menyusun ulang PDF Edukasi di:', url, { count: pdfs.length });

  try {
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Fallback
    }

    if (!res || !res.ok) {
      console.warn('[API Client Reorder] Reorder remote sync fallback.');
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
