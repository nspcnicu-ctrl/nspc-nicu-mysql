import { Patient, DailyLog, NakesUser, EducationPdfItem } from '../types';
import { INITIAL_PATIENTS } from '../data/initialPatients';
import { generate25DummyPatients } from '../data/dummy25Patients';
import { INITIAL_NAKES_USERS } from '../data/initialNakes';
import { DEFAULT_EDUCATION_PDFS } from '../data/defaultEducation';
import { savePdfDataUrl, getPdfDataUrlSync } from './pdfStore';
import {
  fetchPatientsApi,
  savePatientApi,
  updatePatientApi,
  updatePatientStatusApi,
  deletePatientApi,
  restorePatientApi,
  emptyTrashApi,
  bulkSyncPatientsApi,
  addDailyLogApi,
  updateDailyLogApi,
  deleteDailyLogApi,
  fetchNakesUsersApi,
  saveNakesUserApi,
  deleteNakesUserApi,
  recordNakesLoginApi,
  fetchEducationPdfsApi,
  saveEducationPdfApi,
  deleteEducationPdfApi,
  reorderEducationPdfsApi,
  initRealtimeEventSource,
} from './api';

const STORAGE_KEY = 'nspc_nicu_patients_v1';
const ADMIN_PIN_KEY = 'nspc_admin_pin_v1';
const NAKES_USERS_KEY = 'nspc_nakes_users_v4';
const GLOBAL_PDFS_CACHE_KEY = 'nspc_global_pdfs_cache_v2';

const DUMMY_PDF_IDS = new Set(['edu_pmk_01', 'edu_asi_02', 'edu_tanda_bahaya_03', 'edu_perawatan_04']);

function getInitialGlobalPdfs(): EducationPdfItem[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem(GLOBAL_PDFS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((p) => p && !DUMMY_PDF_IDS.has(p.id));
          return filtered;
        }
      }
    }
  } catch (e) {
    // Ignore error
  }
  return [];
}

let MEMORY_GLOBAL_PDFS: EducationPdfItem[] = getInitialGlobalPdfs();

// =============================================================================
// REAL-TIME AUTO SYNCHRONIZATION (SSE LISTENER)
// =============================================================================

let isRealtimeInitialized = false;

export function setupRealtimeSync() {
  if (isRealtimeInitialized || typeof window === 'undefined') return;
  isRealtimeInitialized = true;

  initRealtimeEventSource((eventType, data) => {
    // When any event arrives from the server, automatically refresh in-memory state
    switch (eventType) {
      case 'patient_created':
      case 'patient_updated':
      case 'patient_deleted':
      case 'patient_restored':
      case 'daily_log_added':
      case 'daily_log_updated':
      case 'daily_log_deleted':
      case 'data_changed':
        syncFromBackend().catch(() => {});
        break;

      case 'nakes_updated':
      case 'nakes_deleted':
        syncNakesFromBackend().catch(() => {});
        break;

      case 'pdf_updated':
      case 'pdf_deleted':
      case 'pdf_reordered':
        syncGlobalPdfsFromBackend().catch(() => {});
        break;

      default:
        syncFromBackend().catch(() => {});
        break;
    }
  });
}

// Automatically start real-time listener
if (typeof window !== 'undefined') {
  setupRealtimeSync();
}

// =============================================================================
// GLOBAL EDUCATION PDFS
// =============================================================================

export function setMemoryGlobalPdfs(list: EducationPdfItem[]): void {
  MEMORY_GLOBAL_PDFS = [...list];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(GLOBAL_PDFS_CACHE_KEY, JSON.stringify(list));
    }
  } catch (e) {}
}

export function getStoredGlobalPdfs(): EducationPdfItem[] {
  if (!MEMORY_GLOBAL_PDFS || MEMORY_GLOBAL_PDFS.length === 0) {
    MEMORY_GLOBAL_PDFS = getInitialGlobalPdfs();
  }
  return [...MEMORY_GLOBAL_PDFS];
}

export function saveReorderedGlobalPdfs(reorderedList: EducationPdfItem[]): void {
  try {
    const listWithIndex = reorderedList.map((item, idx) => ({
      ...item,
      orderIndex: idx,
    }));
    MEMORY_GLOBAL_PDFS = listWithIndex;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(GLOBAL_PDFS_CACHE_KEY, JSON.stringify(listWithIndex));
      }
    } catch (e) {}
    window.dispatchEvent(new Event('nspc_data_changed'));

    // Persistent sync to MySQL database in background
    reorderEducationPdfsApi(listWithIndex).catch((err) =>
      console.warn('[MySQL Reordered PDF Save Warning]', err)
    );
  } catch (err) {
    console.error('Error saving reordered global education PDFs:', err);
  }
}

export function saveGlobalPdf(pdf: EducationPdfItem): void {
  try {
    const existing = [...MEMORY_GLOBAL_PDFS];
    const existingIndex = existing.findIndex((p) => p.id === pdf.id);
    let updated: EducationPdfItem[];
    if (existingIndex >= 0) {
      updated = [...existing];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...pdf,
        orderIndex: pdf.orderIndex !== undefined ? pdf.orderIndex : updated[existingIndex].orderIndex,
      };
    } else {
      const newOrderIndex = pdf.orderIndex !== undefined ? pdf.orderIndex : existing.length;
      updated = [...existing, { ...pdf, orderIndex: newOrderIndex }];
    }

    MEMORY_GLOBAL_PDFS = updated;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(GLOBAL_PDFS_CACHE_KEY, JSON.stringify(updated));
      }
    } catch (e) {}
    window.dispatchEvent(new Event('nspc_data_changed'));

    // Persistent sync to MySQL database
    saveEducationPdfApi(pdf).catch((err) =>
      console.warn('[MySQL Global PDF Save Warning]', err)
    );
  } catch (err) {
    console.error('Error saving global education PDF:', err);
  }
}

export function deleteStoredGlobalPdf(pdfId: string): void {
  try {
    MEMORY_GLOBAL_PDFS = MEMORY_GLOBAL_PDFS.filter((p) => p.id !== pdfId);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(GLOBAL_PDFS_CACHE_KEY, JSON.stringify(MEMORY_GLOBAL_PDFS));
      }
    } catch (e) {}
    window.dispatchEvent(new Event('nspc_data_changed'));

    // Delete from MySQL
    deleteEducationPdfApi(pdfId).catch((err) =>
      console.warn('[MySQL Global PDF Delete Warning]', err)
    );
  } catch (err) {
    console.error('Error deleting global education PDF:', err);
  }
}

export function resolvePatientEducationPdfs(patientPdfs?: EducationPdfItem[]): EducationPdfItem[] {
  const globalPdfs = getStoredGlobalPdfs();
  const map = new Map<string, EducationPdfItem>();

  globalPdfs.forEach((g) => {
    map.set(g.id, {
      ...g,
      fileDataUrl: g.fileDataUrl || getPdfDataUrlSync(g.id),
      coverImageUrl: g.coverImageUrl || getPdfDataUrlSync(`cover_${g.id}`),
    });
  });

  (patientPdfs || []).forEach((p) => {
    if (map.has(p.id)) {
      const existing = map.get(p.id)!;
      map.set(p.id, {
        ...existing,
        ...p,
        fileDataUrl: p.fileDataUrl || existing.fileDataUrl || getPdfDataUrlSync(p.id),
        coverImageUrl: p.coverImageUrl || existing.coverImageUrl || getPdfDataUrlSync(`cover_${p.id}`),
      });
    } else {
      map.set(p.id, {
        ...p,
        fileDataUrl: p.fileDataUrl || getPdfDataUrlSync(p.id),
        coverImageUrl: p.coverImageUrl || getPdfDataUrlSync(`cover_${p.id}`),
      });
    }
  });

  return Array.from(map.values());
}

export async function syncGlobalPdfsFromBackend(): Promise<EducationPdfItem[]> {
  try {
    const remotePdfs = await fetchEducationPdfsApi();
    if (Array.isArray(remotePdfs)) {
      const filtered = remotePdfs.filter((p) => p && !DUMMY_PDF_IDS.has(p.id));
      MEMORY_GLOBAL_PDFS = filtered;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(GLOBAL_PDFS_CACHE_KEY, JSON.stringify(filtered));
        }
      } catch (e) {}
      window.dispatchEvent(new Event('nspc_data_changed'));
      return filtered;
    }
  } catch (err) {
    console.warn('[Storage] Sync Global PDFs failed:', err);
  }
  
  return MEMORY_GLOBAL_PDFS;
}

// Aliases for compatibility
export const syncGlobalPdfsFromSupabase = syncGlobalPdfsFromBackend;

// =============================================================================
// PATIENT STORAGE & SYNCHRONIZATION
// =============================================================================

export const ONE_MINUTE_MS = 1 * 60 * 1000;
export const THREE_DAYS_MS = ONE_MINUTE_MS;

let MEMORY_PATIENTS: Patient[] = [];

export function getStoredPatients(): Patient[] {
  if (MEMORY_PATIENTS && MEMORY_PATIENTS.length > 0) {
    return [...MEMORY_PATIENTS];
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      let list: Patient[] = JSON.parse(data);
      if (Array.isArray(list)) {
        list = list.filter(
          (p) =>
            p &&
            p.id &&
            p.id !== 'p1-fitriani' &&
            p.id !== 'p2-rahmawati' &&
            p.id !== 'patient-default-01' &&
            !p.id.startsWith('dummy-')
        );
        MEMORY_PATIENTS = list;
        return [...list];
      }
    }
  } catch (err) {
    console.error('Error loading patients from storage:', err);
  }
  return [];
}

export function clearAllPatientsData(): void {
  try {
    MEMORY_PATIENTS = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event('nspc_data_changed'));
    bulkSyncPatientsApi([]).catch((err) =>
      console.warn('Clear Patients Error:', err)
    );
  } catch (err) {
    console.error('Error clearing patients:', err);
  }
}

export const getPatients = getStoredPatients;

function safeSaveToLocalStorage(key: string, patients: Patient[]): void {
  MEMORY_PATIENTS = [...patients];

  // Offload heavy data
  patients.forEach((p) => {
    p.educationPdfs?.forEach((pdf) => {
      if (pdf.fileDataUrl && pdf.fileDataUrl.length > 300) {
        savePdfDataUrl(pdf.id, pdf.fileDataUrl);
      }
    });
    if (p.coverPhotoUrl && p.coverPhotoUrl.length > 10000) {
      savePdfDataUrl(`cover_${p.id}`, p.coverPhotoUrl);
    }
    p.dailyLogs?.forEach((log) => {
      if (log.photoUrl && log.photoUrl.length > 10000) {
        savePdfDataUrl(`log_img_${log.id}`, log.photoUrl);
      }
    });
  });

  const cleanPatients = patients.map((p) => ({
    ...p,
    coverPhotoUrl: (p.coverPhotoUrl && p.coverPhotoUrl.length > 10000) ? undefined : p.coverPhotoUrl,
    educationPdfs: p.educationPdfs?.map((pdf) => {
      if (pdf.fileDataUrl && pdf.fileDataUrl.length > 300) {
        const { fileDataUrl, ...rest } = pdf;
        return rest;
      }
      return pdf;
    }),
    dailyLogs: (p.dailyLogs || []).map((log) => {
      if (log.photoUrl && log.photoUrl.length > 10000) {
        const { photoUrl, ...rest } = log;
        return rest;
      }
      return log;
    }),
  }));

  try {
    localStorage.setItem(key, JSON.stringify(cleanPatients));
  } catch (err) {
    try {
      const minimalist = cleanPatients.map((p) => ({
        ...p,
        dailyLogs: (p.dailyLogs || []).slice(0, 15),
      }));
      localStorage.setItem(key, JSON.stringify(minimalist));
    } catch (e) {}
  }
}

/**
 * Real-time Bidirectional Synchronization: Sync data directly from MySQL backend
 */
export async function syncFromBackend(): Promise<Patient[]> {
  try {
    const remotePatients = await fetchPatientsApi();
    if (remotePatients && Array.isArray(remotePatients)) {
      MEMORY_PATIENTS = remotePatients;
      safeSaveToLocalStorage(STORAGE_KEY, remotePatients);
      window.dispatchEvent(new Event('nspc_data_changed'));
      return remotePatients;
    }
  } catch (err) {
    console.warn('[Storage] Sync from backend warning (using cache):', err);
  }
  return getStoredPatients();
}

// Aliases for compatibility
export const syncFromSupabase = syncFromBackend;

export function savePatients(patients: Patient[]): void {
  try {
    safeSaveToLocalStorage(STORAGE_KEY, patients);
  } catch (err) {
    console.error('Error saving patients to storage:', err);
  }

  window.dispatchEvent(new Event('nspc_data_changed'));

  // Background sync to MySQL
  bulkSyncPatientsApi(patients).catch((err) =>
    console.warn('Background MySQL Sync Error:', err)
  );
}

export function findPatientByCredentials(nickname: string, accessPassword: string): Patient | undefined {
  const patients = getStoredPatients();
  const cleanNick = nickname.trim().toLowerCase();
  const cleanPass = accessPassword.trim();

  return patients.find(
    (p) => p.nickname.toLowerCase() === cleanNick && p.accessPassword === cleanPass
  );
}

export function findPatientById(id: string): Patient | undefined {
  const patients = getStoredPatients();
  return patients.find((p) => p.id === id);
}

export function addPatient(newPatient: Omit<Patient, 'id' | 'dailyLogs'>): Patient {
  const patients = getStoredPatients();
  const id = 'p_' + Date.now();

  // Ensure nickname and access password exist (auto-generate if missing)
  const autoNick = newPatient.nickname?.trim() || `bayi.${newPatient.babyName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'nicu'}_${Math.floor(100 + Math.random() * 900)}`;
  const autoPass = newPatient.accessPassword?.trim() || String(Math.floor(100000 + Math.random() * 900000));

  const createdPatient: Patient = {
    ...newPatient,
    id,
    nickname: autoNick,
    accessPassword: autoPass,
    dailyLogs: [
      {
        id: 'log_' + Date.now(),
        date: newPatient.admissionDate,
        periodLabel: newPatient.gestationCategory === 'aterm' ? 'Hari ke-1 (Awal Masuk)' : 'Minggu ke-1 (Awal Masuk)',
        weightGram: newPatient.initialAnthropometry.weightGram,
        weightChangeGram: 0,
        vitalSigns: {
          temperature: 36.7,
          heartRate: 140,
          respiratoryRate: 44,
          spo2: 97,
        },
        drinkingAbility: {
          method: 'OGT/Sonde',
          volumeCcPerFeeding: 10,
          frequencyPerDay: 8,
          notes: 'Mulai perawatan di NICU RSUD Undata.',
        },
        activeEquipment: newPatient.currentEquipment,
        nakesNotes: `Selamat datang di NICU RSUD Undata. Rekam medis awal untuk ${newPatient.babyName} telah dibuat.`,
        updatedBy: 'Tenaga Kesehatan NICU',
        createdAt: new Date().toISOString(),
      }
    ],
  };

  const updatedList = [createdPatient, ...patients];
  safeSaveToLocalStorage(STORAGE_KEY, updatedList);
  window.dispatchEvent(new Event('nspc_data_changed'));
  savePatientApi(createdPatient).catch((err) => console.warn('MySQL Add Patient error:', err));
  return createdPatient;
}

export function seed25DummyPatients(): Patient[] {
  const existing = getStoredPatients();
  const dummyList = generate25DummyPatients();

  const existingIds = new Set(existing.map((p) => p.id));
  const newDummies = dummyList.filter((d) => !existingIds.has(d.id));

  const merged = [...existing, ...newDummies];
  savePatients(merged);
  return merged;
}

export function updatePatient(updatedPatient: Patient): void {
  const patients = getStoredPatients();
  const index = patients.findIndex((p) => p.id === updatedPatient.id);
  if (index !== -1) {
    if (updatedPatient.status === 'Sudah Pulang' && !updatedPatient.dischargedAt) {
      updatedPatient.dischargedAt = new Date().toISOString();
    }
    patients[index] = updatedPatient;

    // 1. Instant safe save & dispatch
    safeSaveToLocalStorage(STORAGE_KEY, patients);
    window.dispatchEvent(new Event('nspc_data_changed'));

    // 2. Background async API call to server
    updatePatientApi(updatedPatient).catch((err) => {
      console.warn('[Sync] Update Patient saved locally, background sync warning:', err);
    });
  }
}

export function addDailyLog(patientId: string, log: Omit<DailyLog, 'id' | 'createdAt'>): Patient | undefined {
  const patients = getStoredPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) return undefined;

  const newLog: DailyLog = {
    ...log,
    id: 'log_' + Date.now(),
    createdAt: new Date().toISOString(),
  };

  patient.dailyLogs = [newLog, ...patient.dailyLogs];

  if (log.activeEquipment) {
    patient.currentEquipment = log.activeEquipment;
  }

  updatePatient(patient);
  addDailyLogApi(patientId, newLog).catch((err) => console.warn('MySQL Add Daily Log warning:', err));
  return patient;
}

export function softDeletePatient(patientId: string): void {
  const patients = getStoredPatients();
  const index = patients.findIndex((p) => p.id === patientId);
  if (index !== -1) {
    // 1. Instantly mark as deleted locally
    patients[index].isDeleted = true;
    patients[index].deletedAt = new Date().toISOString();
    safeSaveToLocalStorage(STORAGE_KEY, patients);
    window.dispatchEvent(new Event('nspc_data_changed'));

    // 2. Background API call to server
    deletePatientApi(patientId, false).catch((err) => {
      console.warn('[Sync] Soft delete saved locally, background sync warning:', err);
    });
  }
}

export function restorePatient(patientId: string): void {
  const patients = getStoredPatients();
  const index = patients.findIndex((p) => p.id === patientId);
  if (index !== -1) {
    // 1. Instantly restore locally
    patients[index].isDeleted = false;
    delete patients[index].deletedAt;
    safeSaveToLocalStorage(STORAGE_KEY, patients);
    window.dispatchEvent(new Event('nspc_data_changed'));

    // 2. Background API call to server
    restorePatientApi(patientId).catch((err) => {
      console.warn('[Sync] Restore saved locally, background sync warning:', err);
    });
  }
}

export function permanentlyDeletePatient(patientId: string): void {
  const patients = getStoredPatients();
  const filtered = patients.filter((p) => p.id !== patientId);
  safeSaveToLocalStorage(STORAGE_KEY, filtered);
  window.dispatchEvent(new Event('nspc_data_changed'));

  deletePatientApi(patientId, true).catch((err) => {
    console.warn('[Sync] Permanent delete saved locally, background sync warning:', err);
  });
}

export function emptyTrash(): void {
  const patients = getStoredPatients();
  const toDelete = patients.filter((p) => p.isDeleted);
  const active = patients.filter((p) => !p.isDeleted);
  safeSaveToLocalStorage(STORAGE_KEY, active);
  window.dispatchEvent(new Event('nspc_data_changed'));
  emptyTrashApi().catch(() => {
    toDelete.forEach((p) => {
      deletePatientApi(p.id, true).catch((err) => console.warn('MySQL Empty Trash error:', err));
    });
  });
}

export function deletePatient(patientId: string): void {
  softDeletePatient(patientId);
}

export function markPatientDischarged(patientId: string, notes?: string, doctor?: string): Patient | undefined {
  const patients = getStoredPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) return undefined;

  const nowIso = new Date().toISOString();
  const latestWeight = patient.dailyLogs[0]?.weightGram || patient.initialAnthropometry.weightGram;

  patient.status = 'Sudah Pulang';
  patient.dischargedAt = nowIso;
  if (!patient.milestones) {
    patient.milestones = { bolehPulang: true } as any;
  } else {
    patient.milestones.bolehPulang = true;
  }
  patient.dischargeSummary = {
    dischargeDate: nowIso.split('T')[0],
    dischargeWeightGram: latestWeight,
    dischargeNotes: notes || 'Selamat! Si kecil telah memenuhi syarat medis dan dinyatakan LULUS dari NICU RSUD Undata.',
    doctorInCharge: doctor || 'Tim Dokter Penanggung Jawab Pasien (DPJP) NICU',
  };

  updatePatient(patient);
  updatePatientStatusApi(patient.id, 'Sudah Pulang', patient.dischargeSummary).catch((e) => console.warn('[Sync] updatePatientStatusApi warning:', e));
  return patient;
}

export function cancelPatientDischarge(patientId: string): Patient | undefined {
  const patients = getStoredPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) return undefined;

  patient.status = 'Rawat NICU';
  delete patient.dischargedAt;
  delete patient.dischargeSummary;
  if (patient.milestones) {
    patient.milestones.bolehPulang = false;
  }

  updatePatient(patient);
  updatePatientStatusApi(patient.id, 'Rawat NICU').catch((e) => console.warn('[Sync] cancelPatientDischarge warning:', e));
  return patient;
}

export function getAdminPin(): string {
  return localStorage.getItem(ADMIN_PIN_KEY) || 'adminnicu';
}

export function setAdminPin(pin: string): void {
  localStorage.setItem(ADMIN_PIN_KEY, pin);
}

export function getShareableLink(patient: Patient): string {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?nickname=${encodeURIComponent(patient.nickname)}&pass=${encodeURIComponent(patient.accessPassword)}`;
}

// =============================================================================
// NAKES USER MANAGEMENT
// =============================================================================

export function getStoredNakesUsers(): NakesUser[] {
  try {
    const data = localStorage.getItem(NAKES_USERS_KEY);
    if (data) {
      const parsed: NakesUser[] = JSON.parse(data);
      if (parsed && parsed.length > 0) {
        const hasSuperAdmin = parsed.some((u) => u.username === 'superadmin' || u.isSuperAdmin || u.username === 'admin');
        if (!hasSuperAdmin) {
          const superAdminUser = INITIAL_NAKES_USERS[0];
          const merged = [superAdminUser, ...parsed];
          localStorage.setItem(NAKES_USERS_KEY, JSON.stringify(merged));
          return merged;
        }
        return parsed;
      }
    }
    localStorage.setItem(NAKES_USERS_KEY, JSON.stringify(INITIAL_NAKES_USERS));
    return INITIAL_NAKES_USERS;
  } catch (err) {
    console.error('Error reading nakes users:', err);
    return INITIAL_NAKES_USERS;
  }
}

export function saveNakesUsers(users: NakesUser[]): void {
  try {
    localStorage.setItem(NAKES_USERS_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event('nspc_nakes_changed'));
  } catch (err) {
    console.error('Error saving nakes users:', err);
  }
}

export function addNakesUser(newUser: Omit<NakesUser, 'id' | 'createdAt'>): NakesUser {
  const users = getStoredNakesUsers();
  const created: NakesUser = {
    ...newUser,
    id: 'nakes_' + Date.now(),
    hasAccessRights: newUser.hasAccessRights ?? false,
    createdAt: new Date().toISOString(),
  };

  const updated = [created, ...users];
  saveNakesUsers(updated);
  saveNakesUserApi(created).catch((err) => console.warn('MySQL Nakes Save error:', err));
  return created;
}

export function deleteNakesUser(userId: string): void {
  const users = getStoredNakesUsers();
  const filtered = users.filter((u) => u.id !== userId && !u.isSuperAdmin && u.username !== 'superadmin');
  saveNakesUsers(filtered);
  deleteNakesUserApi(userId).catch((err) => console.warn('MySQL Delete Nakes error:', err));
}

export function hasNakesAccessRights(user?: NakesUser | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin || user.username === 'superadmin' || user.username === 'admin' || user.id === 'nakes_superadmin' || user.id === 'master_admin') {
    return true;
  }
  return user.hasAccessRights === true;
}

export function updateNakesUser(updatedUser: NakesUser): void {
  const users = getStoredNakesUsers();
  const index = users.findIndex((u) => u.id === updatedUser.id);
  let updatedList: NakesUser[];
  if (index >= 0) {
    updatedList = [...users];
    updatedList[index] = updatedUser;
  } else {
    updatedList = [updatedUser, ...users];
  }
  saveNakesUsers(updatedList);
  saveNakesUserApi(updatedUser).catch((err) => console.warn('MySQL Nakes Update error:', err));
}

export function findNakesUserByCredentials(usernameInput: string, pinInput: string): NakesUser | undefined {
  const users = getStoredNakesUsers();
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPin = pinInput.trim();

  if (cleanUser) {
    const match = users.find(
      (u) => u.username.toLowerCase() === cleanUser && u.pin === cleanPin
    );
    if (match) return match;
  }

  const pinMatch = users.find((u) => u.pin === cleanPin);
  if (pinMatch) return pinMatch;

  return undefined;
}

export async function syncNakesFromBackend(): Promise<NakesUser[]> {
  try {
    const remoteUsers = await fetchNakesUsersApi();
    if (remoteUsers && remoteUsers.length > 0) {
      const localUsers = getStoredNakesUsers();
      const userMap = new Map<string, NakesUser>();

      localUsers.forEach((u) => userMap.set(u.id || u.username, u));
      remoteUsers.forEach((u) => userMap.set(u.id || u.username, u));

      const merged = Array.from(userMap.values());
      localStorage.setItem(NAKES_USERS_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event('nspc_nakes_changed'));
      return merged;
    }
  } catch (err) {
    console.warn('[Storage] Sync Nakes failed, fallback to local:', err);
  }
  return getStoredNakesUsers();
}

// Aliases for compatibility
export const syncNakesFromSupabase = syncNakesFromBackend;

export function recordNakesLoginSession(user: NakesUser): void {
  const users = getStoredNakesUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  const nowIso = new Date().toISOString();

  if (idx !== -1) {
    users[idx].lastLoginAt = nowIso;
    saveNakesUsers(users);
  }

  // Record login event to MySQL
  recordNakesLoginApi(user).catch((e) =>
    console.warn('Background MySQL Record Login error:', e)
  );
}
