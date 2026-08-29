import { Patient, NakesUser } from '../types';

export const DEFAULT_ADMIN_USER: NakesUser = {
  id: 'nakes-admin-01',
  name: 'Admin Utama NSPC',
  roleTitle: 'Administrator & Perawat Kepala NICU',
  accountType: 'Admin',
  username: 'admin',
  pin: '1234',
  createdAt: new Date().toISOString(),
};

export const DEFAULT_PATIENT_USER: Patient = {
  id: 'patient-default-01',
  nickname: 'bayi_fitriani',
  accessPassword: 'Fitri123',
  babyName: 'Bayi Ny. Fitriani',
  fatherName: 'Tn. Hendra',
  motherName: 'Ny. Fitriani',
  gender: 'Laki-Laki',
  birthDate: '2026-08-01',
  admissionDate: '2026-08-01',
  gestationalAgeWeeks: 32,
  gestationCategory: 'preterm',
  initialAnthropometry: {
    weightGram: 1600,
    lengthCm: 41,
    headCircumferenceCm: 29,
    chestCircumferenceCm: 26,
    abdominalCircumferenceCm: 25,
    upperArmCircumferenceCm: 9,
  },
  currentEquipment: ['Infus', 'CPAP', 'Monitor TTV'],
  milestones: {
    lepasCPAP: false,
    lepasVentilator: true,
    lepasInfus: false,
    lepasOGT: false,
    lepasO2Nasal: false,
    refleksMenghisapBaik: true,
    refleksMenelanBaik: true,
    bayiSementaraPemantauanKetat: true,
    selesaiPMK: false,
    selesaiHBO: true,
    hb0: true,
    shk: true,
    skriningPJB: true,
    bolehPulang: false,
  },
  dailyLogs: [
    {
      id: 'log-default-01',
      date: '2026-08-12',
      periodLabel: 'Pagi',
      weightGram: 1750,
      weightChangeGram: 150,
      vitalSigns: {
        temperature: 36.8,
        heartRate: 138,
        respiratoryRate: 44,
        spo2: 98,
      },
      drinkingAbility: {
        method: 'OGT/Sonde',
        volumeCcPerFeeding: 15,
        frequencyPerDay: 8,
        notes: 'Residu sonde jernih, reflek hisap mulai aktif',
      },
      activeEquipment: ['Infus', 'CPAP', 'Monitor TTV'],
      nakesNotes: 'Kondisi stabil, BB meningkat +150gr sejak masuk. Toleransi minum OGT baik.',
      updatedBy: 'Admin Utama NSPC',
      createdAt: new Date().toISOString(),
    },
  ],
  status: 'Rawat NICU',
  medicalRecordNumber: 'RM-2026-001',
  roomNumber: 'Inkubator 01 (NICU)',
  isActive: true,
  isDeleted: false,
};

export const DEFAULT_PATIENTS_LIST: Patient[] = [];
export const DEFAULT_NAKES_LIST: NakesUser[] = [DEFAULT_ADMIN_USER];
