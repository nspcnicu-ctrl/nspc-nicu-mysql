import * as XLSX from 'xlsx';
import { Patient, DailyLog } from '../types';
import { normalizeMilestones } from './milestones';
import { formatIndonesianDate, calculateDaysBetween } from './dateUtils';

export interface ExportSpreadsheetOptions {
  filename?: string;
  scopeLabel?: string;
}

/**
 * Helper to safely extract the latest daily log from a patient.
 */
function getLatestDailyLog(patient: Patient): DailyLog | null {
  const logs = patient.dailyLogs || (patient as any).progressLogs || (patient as any).daily_logs || [];
  if (!Array.isArray(logs) || logs.length === 0) return null;
  return logs[logs.length - 1];
}

/**
 * Transforms patient data into comprehensive master rows for Sheet 1.
 */
export function generateMasterPatientRows(patients: Patient[]) {
  return patients.map((p, index) => {
    const latestLog = getLatestDailyLog(p);
    const logs = p.dailyLogs || (p as any).progressLogs || (p as any).daily_logs || [];
    const normalizedMs = normalizeMilestones(p.milestones);
    const imm = p.immunizationDischarge;
    const discharge = p.dischargeSummary;

    // Calculate length of stay
    const daysInNicu = p.admissionDate 
      ? calculateDaysBetween(p.admissionDate, p.dischargedAt || undefined)
      : '-';

    return {
      'No.': index + 1,
      'ID Pasien': p.id,
      'No. Rekam Medis (RM)': p.medicalRecordNumber || '-',
      'Ruangan / Bed': p.roomNumber || '-',
      'Status Pasien': p.isDeleted ? 'Sampah / Dihapus' : (p.status || 'Rawat NICU'),
      'Nama Panggilan': p.nickname || '-',
      'Nama Lengkap Bayi': p.babyName || '-',
      'Nama Ayah': p.fatherName || '-',
      'Nama Ibu': p.motherName || '-',
      'No. HP Orang Tua': p.parentPhone || '-',
      'PIN / Password Akses': p.accessPassword || '-',
      'Jenis Kelamin': p.gender || '-',
      'Tanggal Lahir': p.birthDate ? formatIndonesianDate(p.birthDate) : '-',
      'Jam Lahir': p.birthTime || '-',
      'Tanggal Masuk NICU': p.admissionDate ? formatIndonesianDate(p.admissionDate) : '-',
      'Lama Rawat (Hari)': daysInNicu,
      'Usia Gestasi (Minggu)': p.gestationalAgeWeeks ? `${p.gestationalAgeWeeks} Minggu` : '-',
      'Kategori Gestasi': p.gestationCategory === 'preterm' ? 'Prematur (Preterm)' : 'Cukup Bulan (Aterm)',
      
      // Antropometri Awal
      'BB Lahir (gram)': p.initialAnthropometry?.weightGram || '-',
      'PB Lahir (cm)': p.initialAnthropometry?.lengthCm || '-',
      'LK Lahir (cm)': p.initialAnthropometry?.headCircumferenceCm || '-',
      'LD Lahir (cm)': p.initialAnthropometry?.chestCircumferenceCm || '-',
      'LP Lahir (cm)': p.initialAnthropometry?.abdominalCircumferenceCm || '-',
      'LiLA Lahir (cm)': p.initialAnthropometry?.upperArmCircumferenceCm || '-',
      
      // Status Terkini / Log Terakhir
      'Total Log Perkembangan': logs.length,
      'BB Terkini (gram)': latestLog ? (latestLog.weightGram || (latestLog as any).weight || '-') : (p.initialAnthropometry?.weightGram || '-'),
      'Perubahan BB Terakhir (gram)': latestLog?.weightChangeGram !== undefined ? latestLog.weightChangeGram : '-',
      'Suhu Terkini (°C)': latestLog?.vitalSigns?.temperature ? `${latestLog.vitalSigns.temperature} °C` : '-',
      'HR / Detak Jantung Terkini': latestLog?.vitalSigns?.heartRate ? `${latestLog.vitalSigns.heartRate} x/m` : '-',
      'RR / Laju Nafas Terkini': latestLog?.vitalSigns?.respiratoryRate ? `${latestLog.vitalSigns.respiratoryRate} x/m` : '-',
      'SpO2 Terkini (%)': latestLog?.vitalSigns?.spo2 ? `${latestLog.vitalSigns.spo2} %` : '-',
      'Metode Minum Terkini': latestLog?.drinkingAbility?.method || '-',
      'Volume Minum (cc/pemberian)': latestLog?.drinkingAbility?.volumeCcPerFeeding || '-',
      'Frekuensi Minum (x/hari)': latestLog?.drinkingAbility?.frequencyPerDay || '-',
      'Alat Medis Terpasang': (p.currentEquipment && p.currentEquipment.length > 0) 
        ? p.currentEquipment.join(', ') 
        : (latestLog?.activeEquipment && latestLog.activeEquipment.length > 0 ? latestLog.activeEquipment.join(', ') : 'Tidak ada'),
      
      // Kepulangan
      'Tanggal Pulang': p.dischargedAt ? formatIndonesianDate(p.dischargedAt) : (discharge?.dischargeDate ? formatIndonesianDate(discharge.dischargeDate) : '-'),
      'BB Saat Pulang (gram)': discharge?.dischargeWeightGram || '-',
      'DPJP (Dokter Penanggung Jawab)': discharge?.doctorInCharge || '-',
      'Catatan Resume Medis Pulang': discharge?.dischargeNotes || '-',
      
      // Skrining & Imunisasi
      'Vaksin HB0': imm?.hb0VaccineGiven ? 'Sudah Diberikan' : 'Belum',
      'Tanggal Vaksin HB0': imm?.hb0VaccineDate ? formatIndonesianDate(imm.hb0VaccineDate) : '-',
      'Skrining SHK (Hipotiroid)': imm?.shkScreening || '-',
      'Skrining ROP (Mata Prematur)': imm?.ropScreening || '-',
      'Skrining OAE (Pendengaran)': imm?.oaeScreening || '-',
      'Skrining PJB Kritis': imm?.pjbScreeningResult || '-',
      'Catatan Skrining PJB': imm?.pjbScreeningNote || '-',

      // Milestone Tercapai
      'Milestone Tercapai': normalizedMs.length > 0 ? normalizedMs.join(' | ') : '-'
    };
  });
}

/**
 * Transforms all daily logs across all patients into detailed rows for Sheet 2.
 */
export function generateDailyLogRows(patients: Patient[]) {
  const rows: any[] = [];
  let logCounter = 1;

  patients.forEach((p) => {
    const logs = p.dailyLogs || (p as any).progressLogs || (p as any).daily_logs || [];
    if (Array.isArray(logs) && logs.length > 0) {
      logs.forEach((log) => {
        rows.push({
          'No.': logCounter++,
          'ID Pasien': p.id,
          'No. RM': p.medicalRecordNumber || '-',
          'Nama Bayi': p.babyName || p.nickname || '-',
          'Nama Ayah / Ibu': `${p.fatherName || '-'} / ${p.motherName || '-'}`,
          'Tanggal Log': log.date ? formatIndonesianDate(log.date) : (log.createdAt ? formatIndonesianDate(log.createdAt) : '-'),
          'Periode / Hari Ke': log.periodLabel || (log as any).dayLabel || '-',
          'Berat Badan (gram)': log.weightGram || (log as any).weight || (log as any).weight_gram || '-',
          'Perubahan BB (gram)': log.weightChangeGram !== undefined ? log.weightChangeGram : ((log as any).weight_change_gram ?? '-'),
          'Suhu Tubuh (°C)': log.vitalSigns?.temperature ? `${log.vitalSigns.temperature} °C` : '-',
          'Detak Jantung (HR x/menit)': log.vitalSigns?.heartRate || '-',
          'Laju Pernapasan (RR x/menit)': log.vitalSigns?.respiratoryRate || '-',
          'Saturasi Oksigen (SpO2 %)': log.vitalSigns?.spo2 ? `${log.vitalSigns.spo2} %` : '-',
          'Metode Minum': log.drinkingAbility?.method || '-',
          'Volume Minum (cc/kali)': log.drinkingAbility?.volumeCcPerFeeding || '-',
          'Frekuensi Minum (/hari)': log.drinkingAbility?.frequencyPerDay || '-',
          'Catatan Minum': log.drinkingAbility?.notes || '-',
          'Alat Medis Terpasang': (log.activeEquipment && log.activeEquipment.length > 0) ? log.activeEquipment.join(', ') : 'Nihil / Mandiri',
          'Catatan / Pesan Edukasi Nakes': log.nakesNotes || (log as any).notes || (log as any).note || '-',
          'Petugas Input': log.updatedBy || '-',
          'Waktu Input Sistem': log.createdAt ? new Date(log.createdAt).toLocaleString('id-ID') : '-'
        });
      });
    }
  });

  return rows;
}

/**
 * Transforms screening & immunization summary for Sheet 3.
 */
export function generateScreeningRows(patients: Patient[]) {
  return patients.map((p, index) => {
    const imm = p.immunizationDischarge;
    return {
      'No.': index + 1,
      'ID Pasien': p.id,
      'No. RM': p.medicalRecordNumber || '-',
      'Nama Bayi': p.babyName || p.nickname || '-',
      'Nama Orang Tua': `Ayah: ${p.fatherName || '-'} | Ibu: ${p.motherName || '-'}`,
      'Status Pasien': p.isDeleted ? 'Sampah' : (p.status || 'Rawat NICU'),
      'Vaksin Hepatitis B (HB0)': imm?.hb0VaccineGiven ? 'Lengkap / Diberikan' : 'Belum Diberikan',
      'Tanggal Pemberian HB0': imm?.hb0VaccineDate ? formatIndonesianDate(imm.hb0VaccineDate) : '-',
      'Skrining Hipotiroid Kongenital (SHK)': imm?.shkScreening || 'Belum Dilakukan',
      'Skrining Retinopati Prematuritas (ROP)': imm?.ropScreening || 'Belum Dilakukan',
      'Skrining Pendengaran (OAE)': imm?.oaeScreening || 'Belum Dilakukan',
      'Skrining PJB Kritis': imm?.pjbScreeningResult || 'Belum Dilakukan',
      'Catatan Evaluasi Skrining PJB': imm?.pjbScreeningNote || '-',
      'Catatan Resume Medis': imm?.dischargeSummaryNote || p.dischargeSummary?.dischargeNotes || '-'
    };
  });
}

/**
 * Automatically calculates column widths for a worksheet.
 */
function autoFitColumns(rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    let maxLength = key.length;
    for (const row of rows) {
      const val = row[key];
      if (val !== null && val !== undefined) {
        const strVal = String(val);
        if (strVal.length > maxLength) {
          maxLength = Math.min(strVal.length, 60); // Cap at 60 characters
        }
      }
    }
    return { wch: Math.max(maxLength + 3, 10) };
  });
}

/**
 * Main export function to generate a multi-sheet Excel spreadsheet (.xlsx).
 */
export function exportAllPatientsToExcel(patients: Patient[], options?: ExportSpreadsheetOptions) {
  if (!patients || patients.length === 0) {
    alert('Tidak ada data pasien yang tersedia untuk diekspor.');
    return false;
  }

  try {
    const wb = XLSX.utils.book_new();

    // 1. Sheet 1: Master Data Pasien
    const masterRows = generateMasterPatientRows(patients);
    const wsMaster = XLSX.utils.json_to_sheet(masterRows);
    wsMaster['!cols'] = autoFitColumns(masterRows);
    XLSX.utils.book_append_sheet(wb, wsMaster, 'Data Pasien NICU');

    // 2. Sheet 2: Riwayat Log Harian Pasien
    const logRows = generateDailyLogRows(patients);
    if (logRows.length > 0) {
      const wsLogs = XLSX.utils.json_to_sheet(logRows);
      wsLogs['!cols'] = autoFitColumns(logRows);
      XLSX.utils.book_append_sheet(wb, wsLogs, 'Riwayat Log Harian');
    }

    // 3. Sheet 3: Skrining & Imunisasi
    const screeningRows = generateScreeningRows(patients);
    const wsScreening = XLSX.utils.json_to_sheet(screeningRows);
    wsScreening['!cols'] = autoFitColumns(screeningRows);
    XLSX.utils.book_append_sheet(wb, wsScreening, 'Skrining & Imunisasi');

    // Generate formatted filename
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = options?.filename || `Data_Lengkap_Pasien_NICU_${dateStr}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);
    return true;
  } catch (error) {
    console.error('Gagal mengekspor data ke Excel:', error);
    alert('Terjadi kesalahan saat memproses ekspor spreadsheet: ' + (error as Error).message);
    return false;
  }
}

/**
 * Fallback export to CSV (UTF-8 with BOM for Excel compatibility).
 */
export function exportAllPatientsToCsv(patients: Patient[], options?: ExportSpreadsheetOptions) {
  if (!patients || patients.length === 0) {
    alert('Tidak ada data pasien untuk diekspor.');
    return false;
  }

  try {
    const masterRows = generateMasterPatientRows(patients);
    const ws = XLSX.utils.json_to_sheet(masterRows);
    const csvContent = XLSX.utils.sheet_to_csv(ws);

    // Add UTF-8 BOM so Excel opens indonesian characters cleanly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const filename = options?.filename || `Data_Pasien_NICU_${dateStr}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Gagal mengekspor data ke CSV:', error);
    alert('Terjadi kesalahan saat membuat CSV: ' + (error as Error).message);
    return false;
  }
}
