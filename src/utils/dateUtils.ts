/**
 * Utilities for calculating baby age, length of stay, and Indonesian date formatting
 */

export function calculateDaysBetween(startDateStr: string, endDateStr?: string): number {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  
  // Clear hours to calculate full calendar days
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function formatBabyAge(birthDateStr: string, gestationalAgeWeeks: number): string {
  if (!birthDateStr) return '-';
  const totalDays = calculateDaysBetween(birthDateStr);
  
  const weeks = Math.floor(totalDays / 7);
  const remainingDays = totalDays % 7;

  if (totalDays === 0) {
    return 'Baru Lahir (Hari ke-0)';
  }

  if (gestationalAgeWeeks >= 37) {
    // Aterm: emphasize age in days or weeks
    if (weeks === 0) {
      return `${totalDays} Hari`;
    }
    return `${weeks} Minggu ${remainingDays > 0 ? `${remainingDays} Hari` : ''} (${totalDays} Hari)`;
  } else {
    // Preterm: emphasize weeks & days + gestational progression
    const currentGestationalWeeks = gestationalAgeWeeks + weeks;
    return `${weeks} Minggu ${remainingDays} Hari (Koreksi Gestasi ~${currentGestationalWeeks}m)`;
  }
}

export function formatLengthOfStay(admissionDateStr: string): string {
  if (!admissionDateStr) return '-';
  const days = calculateDaysBetween(admissionDateStr);
  if (days === 0) {
    return 'Hari ke-1 (Hari Masuk)';
  }
  return `${days + 1} Hari Perawatan`;
}

export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTimeWithTime(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${dateFormatted} pukul ${hours}.${mins}`;
  } catch {
    return dateStr;
  }
}

export function formatDetailedDuration(startDateStr: string, endDateStr?: string): {
  totalDays: number;
  weeks: number;
  remainingDays: number;
  hours: number;
  minutes: number;
  displayString: string;
} {
  if (!startDateStr) {
    return { totalDays: 0, weeks: 0, remainingDays: 0, hours: 0, minutes: 0, displayString: '0 Hari' };
  }
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remainingMs = diffMs % (1000 * 60 * 60 * 24);
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMs2 = remainingMs % (1000 * 60 * 60);
  const minutes = Math.floor(remainingMs2 / (1000 * 60));

  const weeks = Math.floor(totalDays / 7);
  const remainingDays = totalDays % 7;

  let detailPart = '';
  if (weeks > 0) {
    detailPart += `${weeks} minggu `;
  }
  detailPart += `${remainingDays} hari`;
  if (hours > 0) detailPart += `, ${hours} jam`;
  if (minutes > 0) detailPart += `, ${minutes} menit`;

  const displayString = `${totalDays} Hari (${detailPart})`;

  return {
    totalDays,
    weeks,
    remainingDays,
    hours,
    minutes,
    displayString
  };
}

export interface FullDateTimeInfo {
  dayName: string; // e.g. "Jumat"
  dateNum: number; // e.g. 11
  monthName: string; // e.g. "September"
  year: number; // e.g. 2026
  timeOnly: string; // e.g. "08:30"
  timeStr: string; // e.g. "08:30 WITA"
  dateFormatted: string; // e.g. "11 September 2026"
  fullDate: string; // e.g. "Jumat, 11 September 2026"
  dateIso: string; // e.g. "2026-09-11"
  dateStr: string; // alias for dateIso (YYYY-MM-DD)
  fullDisplay: string; // e.g. "Jumat, 11 September 2026 • 08:30 WITA"
  sentenceDisplay: string; // e.g. "Jumat, 11 September 2026 pukul 08:30 WITA"
}

export function parseFullDateTime(
  dateStr?: string,
  timeStr?: string,
  defaultTime: string = '08:00'
): FullDateTimeInfo | null {
  if (!dateStr) return null;
  const cleanStr = String(dateStr).trim();
  if (!cleanStr) return null;

  let year = 2026;
  let month = 9;
  let day = 1;
  let hour = 8;
  let min = 0;

  let datePart = cleanStr;
  let timePartFromDate = '';

  if (cleanStr.includes('T')) {
    const parts = cleanStr.split('T');
    datePart = parts[0];
    timePartFromDate = parts[1] || '';
  } else if (cleanStr.includes(' ')) {
    const parts = cleanStr.split(' ');
    datePart = parts[0];
    timePartFromDate = parts[1] || '';
  }

  const dMatch = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dMatch) {
    year = Number(dMatch[1]);
    month = Number(dMatch[2]);
    day = Number(dMatch[3]);
  } else {
    const dObj = new Date(cleanStr);
    if (!isNaN(dObj.getTime())) {
      year = dObj.getFullYear();
      month = dObj.getMonth() + 1;
      day = dObj.getDate();
      hour = dObj.getHours();
      min = dObj.getMinutes();
    } else {
      return null;
    }
  }

  const resolvedTime = timeStr?.trim() || timePartFromDate?.trim() || defaultTime;
  const tMatch = resolvedTime.match(/^(\d{1,2}):(\d{1,2})/);
  if (tMatch) {
    hour = Number(tMatch[1]);
    min = Number(tMatch[2]);
  }

  const d = new Date(year, month - 1, day, hour, min);
  const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
  const monthName = d.toLocaleDateString('id-ID', { month: 'long' });
  const dateFormatted = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const fullDate = `${dayName}, ${dateFormatted}`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const timeOnly = `${pad(hour)}:${pad(min)}`;
  const timeStrWita = `${timeOnly} WITA`;
  const dateIso = `${year}-${pad(month)}-${pad(day)}`;

  return {
    dayName,
    dateNum: day,
    monthName,
    year,
    timeOnly,
    timeStr: timeStrWita,
    dateFormatted,
    fullDate,
    dateIso,
    dateStr: dateIso,
    fullDisplay: `${fullDate} • ${timeStrWita}`,
    sentenceDisplay: `${fullDate} pukul ${timeOnly} WITA`,
  };
}

export function getPatientAdmissionDateTime(patient: {
  admissionDate?: string;
  admissionTime?: string;
  birthTime?: string;
}): FullDateTimeInfo | null {
  if (!patient || !patient.admissionDate) return null;
  const preferredTime =
    patient.admissionTime?.trim() ||
    (patient.admissionDate.includes('T')
      ? undefined
      : patient.admissionDate.includes(' ')
      ? undefined
      : patient.birthTime && patient.birthTime !== '00:00'
      ? patient.birthTime
      : '08:00');
  return parseFullDateTime(patient.admissionDate, preferredTime, '08:00');
}

export function getPatientDischargeDateTime(patient: {
  status?: string;
  dischargeDate?: string;
  dischargeTime?: string;
  dischargedAt?: string;
  dischargeSummary?: { dischargeDate?: string };
}): FullDateTimeInfo | null {
  if (!patient) return null;
  const isAlumni =
    patient.status === 'Sudah Pulang' ||
    Boolean(patient.dischargedAt) ||
    Boolean(patient.dischargeDate);
  if (!isAlumni && patient.status !== 'Sudah Pulang') return null;

  const dateStr =
    patient.dischargeDate ||
    patient.dischargedAt ||
    patient.dischargeSummary?.dischargeDate;

  if (!dateStr) return null;

  let timeStr = patient.dischargeTime?.trim();
  if (!timeStr && patient.dischargedAt) {
    if (patient.dischargedAt.includes('T')) {
      timeStr = patient.dischargedAt.split('T')[1]?.slice(0, 5);
    } else if (patient.dischargedAt.includes(' ')) {
      timeStr = patient.dischargedAt.split(' ')[1]?.slice(0, 5);
    }
  }

  return parseFullDateTime(dateStr, timeStr || '10:00', '10:00');
}

