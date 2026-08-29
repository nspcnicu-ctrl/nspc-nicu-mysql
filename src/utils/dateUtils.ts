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

