export type GestationCategory = 'aterm' | 'preterm';

export type Gender = 'Laki-Laki' | 'Perempuan';

export type MedicalEquipment = 
  | 'Infus'
  | 'OGT'
  | 'CPAP'
  | 'Ventilator'
  | 'Monitor TTV'
  | 'Nasal Kanul'
  | 'O2 Mask';

export interface EquipmentItem {
  id: string;
  name: string;
  clinicalNotes: string;
  parentExplanation: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Anthropometry {
  weightGram: number;
  lengthCm: number;
  headCircumferenceCm: number;
  chestCircumferenceCm: number;
  abdominalCircumferenceCm?: number;
  upperArmCircumferenceCm?: number;
}

export interface VitalSigns {
  temperature: number;
  heartRate: number;
  respiratoryRate: number;
  spo2: number;
}

export interface DrinkingAbility {
  method: 'OGT/Sonde' | 'Sendok/Cup Feeder' | 'Menyusu Langsung (DBF)' | 'Kombinasi' | 'NPO / Puasa sementara';
  volumeCcPerFeeding: number;
  frequencyPerDay: number;
  notes?: string;
}

export interface Milestones {
  lepasCPAP: boolean;
  lepasVentilator: boolean;
  lepasInfus: boolean;
  lepasOGT: boolean;
  lepasO2Nasal: boolean;
  refleksMenghisapBaik: boolean;
  refleksMenelanBaik: boolean;
  bayiSementaraPemantauanKetat: boolean;
  selesaiPMK: boolean;
  selesaiHBO: boolean;
  hb0?: boolean;
  shk?: boolean;
  skriningPJB?: boolean;
  bolehPulang: boolean;
}

export interface DailyLog {
  id: string;
  date: string;
  periodLabel: string;
  weightGram: number;
  weightChangeGram?: number;
  vitalSigns: VitalSigns;
  drinkingAbility: DrinkingAbility;
  activeEquipment: MedicalEquipment[];
  milestonesList?: string[];
  nakesNotes: string;
  updatedBy: string;
  createdAt: string;
  photoUrl?: string;
  photoCaption?: string;
}

export interface DischargeSummary {
  dischargeDate: string;
  dischargeWeightGram: number;
  dischargeNotes: string;
  doctorInCharge: string;
}

export interface EducationPdfItem {
  id: string;
  title: string;
  category: string;
  fileName: string;
  fileSizeText: string;
  fileDataUrl?: string;
  coverImageUrl?: string;
  pageCount?: number;
  nakesNote?: string;
  publishedAt: string;
  isActive: boolean;
  orderIndex?: number;
}

export interface ImmunizationDischargeRecord {
  hb0VaccineGiven: boolean;
  hb0VaccineDate?: string;
  shkScreening: string;
  ropScreening: string;
  oaeScreening: string;
  pjbScreeningResult: string;
  pjbScreeningNote?: string;
  dischargeSummaryNote?: string;
  updatedAt?: string;
}

export interface Patient {
  id: string;
  nickname: string;
  accessPassword: string;
  babyName: string;
  fatherName: string;
  motherName: string;
  gender: Gender;
  birthDate: string;
  admissionDate: string;
  gestationalAgeWeeks: number;
  gestationCategory: GestationCategory;
  initialAnthropometry: Anthropometry;
  currentEquipment: MedicalEquipment[];
  registeredEquipment?: EquipmentItem[];
  educationPdfs?: EducationPdfItem[];
  immunizationDischarge?: ImmunizationDischargeRecord;
  milestones: Milestones;
  dailyLogs: DailyLog[];
  status: 'Rawat NICU' | 'Siap Pulang' | 'Sudah Pulang';
  medicalRecordNumber?: string;
  roomNumber?: string;
  coverPhotoUrl?: string;
  dischargedAt?: string; // ISO string when baby was discharged
  dischargeSummary?: DischargeSummary;
  isDeleted?: boolean; // Soft delete flag
  deletedAt?: string; // ISO string when patient was moved to trash
  isActive?: boolean;
}

export interface NakesUser {
  id: string;
  name: string;
  roleTitle: string;
  accountType?: string;
  username: string;
  pin: string;
  createdAt: string;
  lastLoginAt?: string;
  hasAccessRights?: boolean; // true: Diberi Hak Akses (Bisa membuat akun admin baru), false: Tanpa Hak Akses
  isSuperAdmin?: boolean; // Flag untuk akun Super Admin Utama
}

export type UserRole = 'parent' | 'nakes' | null;
