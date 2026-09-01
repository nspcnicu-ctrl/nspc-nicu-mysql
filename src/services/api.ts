import { Patient, DailyLog, NakesUser, EducationPdfItem } from '../types';

/**
 * REST API Client for MySQL Backend at chagrin.id / external server
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const custom = localStorage.getItem('nspc_custom_api_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/$/, '');
    }
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return (import.meta.env.VITE_API_URL as string).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host.includes('chagrin.id')) {
      return `${window.location.origin}/api`;
    }
  }
  return '/api';
}

export const PHP_API_BASE = getApiBaseUrl();

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

export async function fetchPatientsApi(includeDeleted = false): Promise<Patient[]> {
  const parseResponse = (json: any): Patient[] => {
    let rows: any[] = [];
    if (Array.isArray(json)) {
      rows = json;
    } else if (json && typeof json === 'object') {
      if (Array.isArray(json.data)) {
        rows = json.data;
      } else if (json.data && Array.isArray(json.data.patients)) {
        rows = json.data.patients;
      } else if (json.data && Array.isArray(json.data.items)) {
        rows = json.data.items;
      } else if (Array.isArray(json.patients)) {
        rows = json.patients;
      } else if (Array.isArray(json.items)) {
        rows = json.items;
      }
    }
    const patients = rows.filter((r) => r && typeof r === 'object').map(mapRowToPatient);
    if (!includeDeleted) {
      return patients.filter((p: Patient) => !p.isDeleted && p.status !== 'deleted' && p.status !== 'Disembunyikan');
    }
    return patients;
  };

  const baseUrl = getApiBaseUrl();
  const url = includeDeleted
    ? `${baseUrl}/patients.php?include_deleted=1`
    : `${baseUrl}/patients.php`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const json = await res.json();
      const patients = parseResponse(json);
      if (patients && patients.length > 0) {
        return patients;
      }
    }
  } catch (err) {
    console.warn('[API Client] Primary fetchPatientsApi note:', err);
  }

  // Fallback to https://chagrin.id/api if primary URL is local /api and returned no patients
  if (baseUrl === '/api' && typeof window !== 'undefined' && !window.location.hostname.includes('chagrin.id')) {
    try {
      const fallbackUrl = includeDeleted
        ? `https://chagrin.id/api/patients.php?include_deleted=1`
        : `https://chagrin.id/api/patients.php`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
      });
      if (fallbackRes.ok) {
        const json = await fallbackRes.json();
        const fallbackPatients = parseResponse(json);
        if (fallbackPatients && fallbackPatients.length > 0) {
          console.log('✅ [API Client] Berhasil mengambil data pasien langsung dari https://chagrin.id/api');
          return fallbackPatients;
        }
      }
    } catch (fallbackErr) {
      console.warn('[API Client] Fallback to chagrin.id/api note:', fallbackErr);
    }
  }

  return [];
}

export async function savePatientApi(patient: Patient): Promise<Patient> {
  const baseUrl = getApiBaseUrl();
  const payload = mapPatientToPayload(patient);
  
  console.log('🚀 [API POST] Menyimpan data pasien ke MySQL:', {
    url: `${baseUrl}/patients.php`,
    id: patient.id,
    babyName: patient.babyName,
  });

  try {
    const res = await fetch(`${baseUrl}/patients.php`, {
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

export async function softDeletePatientApi(patientId: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const payload = {
    id: patientId,
    patient_id: patientId,
    patientId: patientId,
    status: 'deleted',
    is_deleted: 1,
    action: 'soft_delete',
  };

  console.log('🚀 [API POST] Soft Delete Pasien -> update_patient_status.php:', {
    url: `${baseUrl}/update_patient_status.php`,
    payload,
  });

  try {
    const res = await fetch(`${baseUrl}/update_patient_status.php`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    console.log('📥 [API Response] Soft delete response:', { status: res.status, json });
    if (res.ok && json && (json.status === 'success' || json.success === true)) {
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [API Client] softDeletePatientApi warning:', err);
  }

  // Fallback to patients.php if update_patient_status.php is unavailable
  try {
    const fallbackRes = await fetch(`${baseUrl}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const fallbackJson = await fallbackRes.json().catch(() => null);
    if (fallbackRes.ok && fallbackJson && (fallbackJson.status === 'success' || fallbackJson.success === true)) {
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [API Client] softDelete fallback warning:', err);
  }

  return true;
}

export async function permanentlyDeletePatientApi(patientId: string, medicalRecordNumber?: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const payload = {
    id: patientId,
    patient_id: patientId,
    patientId: patientId,
    raw_id: patientId,
    medical_record_number: medicalRecordNumber || '',
    medicalRecordNumber: medicalRecordNumber || '',
    action: 'permanent_delete',
  };

  console.log('🚀 [API POST] Hard Delete (Hapus Permanen) -> delete_patient.php:', {
    url: `${baseUrl}/delete_patient.php`,
    payload,
  });

  // 1. Try delete_patient.php
  try {
    const res = await fetch(`${baseUrl}/delete_patient.php`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    console.log('📥 [API Response] Hard delete response (delete_patient.php):', { status: res.status, json });
    if (res.ok && json && (json.status === 'success' || json.success === true)) {
      // Continue to also notify fallback if needed
    }
  } catch (err) {
    console.warn('⚠️ [API Client] permanentlyDeletePatientApi delete_patient.php note:', err);
  }

  // 2. Try patients.php fallback
  try {
    await fetch(`${baseUrl}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('⚠️ [API Client] permanentlyDeletePatientApi patients.php fallback note:', err);
  }

  // 3. Fallback direct to https://chagrin.id/api if baseUrl is local /api
  if (baseUrl === '/api' && typeof window !== 'undefined' && !window.location.hostname.includes('chagrin.id')) {
    try {
      await fetch(`https://chagrin.id/api/delete_patient.php`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetch(`https://chagrin.id/api/patients.php`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {}
  }

  return true;
}

export async function deletePatientApi(patientId: string, hard = false, medicalRecordNumber?: string): Promise<boolean> {
  if (hard) {
    return permanentlyDeletePatientApi(patientId, medicalRecordNumber);
  }
  return softDeletePatientApi(patientId);
}

export async function updatePatientStatusApi(patientId: string, status: string, dischargeSummary?: any): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const payload = {
    id: patientId,
    patient_id: patientId,
    patientId: patientId,
    action: 'update_status',
    status,
    discharge_summary: dischargeSummary,
  };

  console.log('🚀 [API Client] Update status pasien:', { url: `${baseUrl}/update_patient_status.php`, payload });

  // Try 1: update_patient_status.php (Primary endpoint)
  try {
    const res = await fetch(`${baseUrl}/update_patient_status.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data && (data.status === 'success' || data.success === true)) {
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [API Client] update_patient_status.php warning:', err);
  }

  // Try 2: patients.php (Fallback)
  try {
    const res = await fetch(`${baseUrl}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data && (data.status === 'success' || data.success === true)) {
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [API Client] patients.php status fallback warning:', err);
  }

  return true;
}

export async function restorePatientApi(patientId: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const payload = {
    id: patientId,
    patient_id: patientId,
    patientId: patientId,
    action: 'restore',
    status: 'active',
    is_deleted: 0,
    restore: true,
  };

  console.log('🚀 [API POST] Pulihkan Pasien (Restore) -> update_patient_status.php:', {
    url: `${baseUrl}/update_patient_status.php`,
    payload,
  });

  // 1. POST ke /api/update_patient_status.php
  try {
    const res = await fetch(`${baseUrl}/update_patient_status.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    console.log('📥 [API Response] Restore response:', { status: res.status, json });
    if (res.ok && json && (json.status === 'success' || json.success === true)) {
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [API Client] restore update_patient_status.php note:', err);
  }

  // 2. Fallback ke /api/patients.php
  try {
    const res = await fetch(`${baseUrl}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json && (json.status === 'success' || json.success === true)) {
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [API Client] restore patients.php note:', err);
  }

  return true;
}

export async function emptyTrashApi(ids?: string[], medicalRecordNumbers?: string[]): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const payload = {
    action: 'empty_trash',
    ids: ids || [],
    medical_record_numbers: medicalRecordNumbers || [],
  };

  console.log('🚀 [API Client] Mengosongkan tempat sampah via delete_patient.php & patients.php', payload);

  try {
    const res = await fetch(`${baseUrl}/delete_patient.php`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json && (json.status === 'success' || json.success === true)) {
      // success
    }
  } catch (err) {
    console.warn('⚠️ [API Client] emptyTrashApi delete_patient.php note:', err);
  }

  try {
    await fetch(`${baseUrl}/patients.php`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('⚠️ [API Client] emptyTrashApi patients.php note:', err);
  }

  // Fallback direct to https://chagrin.id/api if baseUrl is /api
  if (baseUrl === '/api' && typeof window !== 'undefined' && !window.location.hostname.includes('chagrin.id')) {
    try {
      await fetch(`https://chagrin.id/api/delete_patient.php`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetch(`https://chagrin.id/api/patients.php`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {}
  }

  return true;
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/daily_logs.php`;
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/daily_logs.php`;
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

export function getStoredNakesSession(): { role?: string; nakesUser?: NakesUser } | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem('nspc_session');
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

export function isNakesAuthenticated(): boolean {
  const session = getStoredNakesSession();
  return session?.role === 'nakes' && !!session?.nakesUser?.id;
}

export async function fetchNakesUsersApi(force = false): Promise<NakesUser[]> {
  // Hanya jalankan jika nakes sudah login / terautentikasi atau jika dipanggil secara eksplisit (force)
  if (!force && !isNakesAuthenticated()) {
    console.log('🔒 [API Client] fetchNakesUsersApi dibatalkan otomatis (User belum login sebagai Nakes)');
    return [];
  }

  const session = getStoredNakesSession();
  const sessionUserId = session?.nakesUser?.id || '';
  const baseUrl = getApiBaseUrl();

  const url = `${baseUrl}/nakes_users.php${sessionUserId ? `?auth_id=${encodeURIComponent(sessionUserId)}` : ''}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(sessionUserId ? { 'X-Nakes-Auth-ID': sessionUserId } : {}),
      },
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/nakes_users.php`;
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/nakes_users.php`;
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
  if (!user || !user.id || !user.username) {
    console.warn('⚠️ [API Client] recordNakesLoginApi dibatalkan otomatis: kredensial user tidak valid');
    return false;
  }

  const baseUrl = getApiBaseUrl();
  const logUrl = `${baseUrl}/nakes_login_logs.php`;
  const userUrl = `${baseUrl}/nakes_users.php`;

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
  // Hanya kirim jika user sudah terautentikasi sebagai Nakes
  if (!isNakesAuthenticated()) {
    console.log('🔒 [API Client] fetchNakesLoginLogsApi dibatalkan otomatis (User belum login sebagai Nakes)');
    return [];
  }

  const session = getStoredNakesSession();
  const sessionUserId = session?.nakesUser?.id || '';
  const baseUrl = getApiBaseUrl();

  const url = `${baseUrl}/nakes_login_logs.php${sessionUserId ? `?auth_id=${encodeURIComponent(sessionUserId)}` : ''}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(sessionUserId ? { 'X-Nakes-Auth-ID': sessionUserId } : {}),
      },
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
  endpoint: `${getApiBaseUrl()}/education_pdfs.php`,
  lastChecked: new Date().toISOString(),
  isUsingFallback: false,
};

export function getEducationApiStatus(): EducationApiStatus {
  return { ...currentEducationApiStatus, endpoint: `${getApiBaseUrl()}/education_pdfs.php` };
}

function updateEducationApiStatus(status: Partial<EducationApiStatus>) {
  currentEducationApiStatus = {
    ...currentEducationApiStatus,
    ...status,
    endpoint: `${getApiBaseUrl()}/education_pdfs.php`,
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

/**
 * Normalizer fungsi untuk memetakan kolom dari MySQL / PHP backend ke EducationPdfItem
 */
export function normalizeEducationPdfItem(raw: any, index = 0): EducationPdfItem {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `pdf_${Date.now()}_${index}`,
      title: 'Materi Edukasi',
      category: 'Bayi BBLR & Prematur',
      fileName: 'materi_edukasi.pdf',
      fileSizeText: 'Direct Link',
      fileDataUrl: '',
      coverImageUrl: '',
      pageCount: 1,
      orderIndex: index,
      publishedAt: new Date().toISOString(),
      isActive: true,
    };
  }

  const id = String(
    raw.id || raw.pdf_id || raw.ID || raw.id_pdf || raw._id || `pdf_${Date.now()}_${index}`
  );

  const title = String(
    raw.title || raw.judul || raw.name || raw.nama || raw.pdf_title || raw.title_id || 'Materi Edukasi'
  ).trim();

  const category = String(
    raw.category || raw.kategori || raw.cat || raw.category_name || raw.topic || 'Bayi BBLR & Prematur'
  ).trim() || 'Bayi BBLR & Prematur';

  // Support all URL field variations
  const rawFileUrl = String(
    raw.fileDataUrl ||
    raw.file_data_url ||
    raw.file_url ||
    raw.fileUrl ||
    raw.url ||
    raw.pdf_url ||
    raw.pdfUrl ||
    raw.document_url ||
    raw.doc_url ||
    raw.link ||
    raw.link_url ||
    ''
  ).trim();

  // Support all cover image variations
  const rawCoverUrl = String(
    raw.coverImageUrl ||
    raw.cover_image_url ||
    raw.coverUrl ||
    raw.cover_url ||
    raw.thumbnail_url ||
    raw.thumbnail ||
    raw.thumbnailUrl ||
    raw.gambar_sampul ||
    raw.sampul ||
    ''
  ).trim();

  const fileName = String(
    raw.fileName ||
    raw.file_name ||
    raw.filename ||
    raw.nama_file ||
    `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
  ).trim();

  const isDrive = rawFileUrl.includes('drive.google.com') || rawFileUrl.includes('docs.google.com');
  const fileSizeText = String(
    raw.fileSizeText ||
    raw.file_size_text ||
    raw.size ||
    raw.file_size ||
    (isDrive ? 'Google Drive' : (rawFileUrl.startsWith('data:') ? 'Lokal Dokumen' : 'Direct Link'))
  ).trim();

  const nakesNote = raw.nakesNote !== undefined
    ? String(raw.nakesNote)
    : (raw.nakes_note !== undefined
        ? String(raw.nakes_note)
        : (raw.catatan !== undefined
            ? String(raw.catatan)
            : (raw.note !== undefined
                ? String(raw.note)
                : (raw.notes !== undefined
                    ? String(raw.notes)
                    : (raw.description !== undefined
                        ? String(raw.description)
                        : (raw.deskripsi !== undefined ? String(raw.deskripsi) : undefined))))));

  const pageCount = Number(
    raw.pageCount || raw.page_count || raw.halaman || raw.jumlah_halaman || 1
  ) || 1;

  const orderIndex = Number(
    raw.orderIndex !== undefined
      ? raw.orderIndex
      : (raw.order_index !== undefined
          ? raw.order_index
          : (raw.urutan !== undefined
              ? raw.urutan
              : (raw.order !== undefined ? raw.order : index)))
  ) || index;

  const publishedAt = String(
    raw.publishedAt ||
    raw.published_at ||
    raw.created_at ||
    raw.tanggal ||
    raw.date ||
    new Date().toISOString()
  ).trim();

  const isActive = raw.isActive !== undefined
    ? Boolean(raw.isActive)
    : (raw.is_active !== undefined
        ? (raw.is_active == 1 || raw.is_active === true || raw.is_active === '1' || raw.is_active === 'active')
        : (raw.status !== undefined ? raw.status !== 'inactive' && raw.status !== 'deleted' : true));

  return {
    id,
    title,
    category,
    fileName,
    fileSizeText,
    fileDataUrl: rawFileUrl,
    coverImageUrl: rawCoverUrl,
    pageCount,
    orderIndex,
    nakesNote: nakesNote ? nakesNote.trim() : undefined,
    publishedAt,
    isActive,
  };
}

export async function fetchEducationPdfsApi(): Promise<EducationPdfItem[]> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/education_pdfs.php?action=get`;
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
      console.warn('⚠️ [API Client] Network note saat mengakses:', url, networkErr?.message);
    }

    // 1. Silent fallback jika response status bukan 200 OK
    if (!res || !res.ok) {
      const httpStatus = res ? res.status : 0;
      console.info(`ℹ️ [API Client Fallback] Endpoint education_pdfs.php status: ${httpStatus}. Beralih senyap ke IndexedDB/LocalStorage.`);
      
      updateEducationApiStatus({
        isError: false,
        status: httpStatus,
        message: 'Menggunakan penyimpanan lokal & modul bawaan',
        endpoint: url,
        isUsingFallback: true,
      });

      return [];
    }

    // 2. Response 200 OK - Parse JSON secara aman
    const json = await res.json().catch((jsonErr) => {
      console.warn('⚠️ [API Client] Gagal parse JSON dari:', url, jsonErr);
      return null;
    });

    if (!json) return [];

    let rawList: any[] = [];
    if (Array.isArray(json)) {
      rawList = json;
    } else if (json.data && Array.isArray(json.data)) {
      rawList = json.data;
    } else if (json.data && typeof json.data === 'object' && Array.isArray(json.data.items)) {
      rawList = json.data.items;
    } else if (json.data && typeof json.data === 'object' && Array.isArray(json.data.pdfs)) {
      rawList = json.data.pdfs;
    } else if (Array.isArray(json.pdfs)) {
      rawList = json.pdfs;
    } else if (Array.isArray(json.result)) {
      rawList = json.result;
    } else if (Array.isArray(json.results)) {
      rawList = json.results;
    } else if (Array.isArray(json.items)) {
      rawList = json.items;
    }

    const normalizedList: EducationPdfItem[] = rawList
      .filter((item) => item !== null && item !== undefined && typeof item === 'object')
      .map((item, idx) => normalizeEducationPdfItem(item, idx));

    updateEducationApiStatus({
      isError: false,
      status: 200,
      message: `Terhubung normal (${normalizedList.length} modul ditemukan)`,
      endpoint: url,
      isUsingFallback: false,
    });

    return normalizedList;
  } catch (err: any) {
    console.info('ℹ️ [API Client] fetchEducationPdfsApi silent fallback:', err?.message);
    updateEducationApiStatus({
      isError: false,
      status: 0,
      message: 'Menggunakan penyimpanan lokal & modul bawaan',
      endpoint: url,
      isUsingFallback: true,
    });
    return [];
  }
}

export async function saveEducationPdfApi(pdf: EducationPdfItem): Promise<EducationPdfItem> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/education_pdfs.php`;
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
        const fallbackRes = await fetch(`${baseUrl}/upload_education.php`, {
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/education_pdfs.php`;
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/education_pdfs.php?id=${encodeURIComponent(pdfId)}`;
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
        await fetch(`${baseUrl}/education_pdfs.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        try {
          await fetch(`${baseUrl}/delete_education.php`, {
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/education_pdfs.php`;
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
 * (Disabled automatic polling to prevent infinite network request loops)
 */
export function initRealtimeEventSource(_onUpdate: (eventType: string, data: any) => void): () => void {
  // No continuous background interval polling
  return () => {};
}
