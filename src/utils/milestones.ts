export interface MilestoneDefinition {
  id: string;
  title: string;
  category: string;
  isWarning?: boolean;
  isSpecial?: boolean;
}

export const MILESTONE_CHECKLIST_DEFINITIONS: MilestoneDefinition[] = [
  { id: 'lepasCPAP', title: 'Lepas CPAP', category: 'Pernapasan' },
  { id: 'lepasVentilator', title: 'Lepas Ventilator', category: 'Pernapasan' },
  { id: 'lepasInfus', title: 'Lepas Infus', category: 'Cairan' },
  { id: 'lepasOGT', title: 'Lepas OGT / Sonde', category: 'Nutrisi' },
  { id: 'lepasO2Nasal', title: 'Lepas O2 Nasal Kanul', category: 'Pernapasan' },
  { id: 'refleksMenghisapBaik', title: 'Refleks Menghisap Baik', category: 'Kemampuan' },
  { id: 'refleksMenelanBaik', title: 'Refleks Menelan Baik', category: 'Kemampuan' },
  { id: 'selesaiPMK', title: 'Edukasi PMK (Perawatan Metode Kanguru)', category: 'Perawatan' },
  { id: 'selesaiHBO', title: 'Edukasi Mandi & Perawatan Tali Pusat', category: 'Terapi' },
  { id: 'hb0', title: 'Imunisasi HB0 Selesai', category: 'Skrining & Imunisasi' },
  { id: 'shk', title: 'SHK (Skrining Hipotiroid Kongenital)', category: 'Skrining & Imunisasi' },
  { id: 'skriningPJB', title: 'Skrining PJB (Penyakit Jantung Bawaan)', category: 'Skrining & Imunisasi' },
  { id: 'bayiSementaraPemantauanKetat', title: 'Bayi Dalam Pemantauan Ketat', category: 'Observasi', isWarning: true },
];

export const BOLEH_PULANG_DEFINITION: MilestoneDefinition = {
  id: 'bolehPulang',
  title: 'SIAP & BOLEH PULANG',
  category: 'Kelulusan',
  isSpecial: true,
};

/**
 * Normalizes any milestones representation (array of strings, object with boolean flags, or JSON string)
 * into a pure, clean array of string titles.
 */
export function normalizeMilestones(raw: unknown): string[] {
  if (!raw) return [];
  
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return normalizeMilestones(parsed);
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }

  if (typeof raw === 'object' && raw !== null) {
    const list: string[] = [];
    for (const [key, value] of Object.entries(raw)) {
      if (Boolean(value)) {
        // Check if there is a matching title definition
        const matched = MILESTONE_CHECKLIST_DEFINITIONS.find((d) => d.id === key);
        if (matched) {
          list.push(matched.title);
        } else if (key === 'bolehPulang') {
          list.push(BOLEH_PULANG_DEFINITION.title);
        } else {
          list.push(key);
        }
      }
    }
    return list;
  }

  return [];
}

/**
 * Checks if a milestone indicator is currently active/checked.
 * Supports checking by title (e.g. "Lepas CPAP") or by id (e.g. "lepasCPAP").
 */
export function isMilestoneChecked(milestones: unknown, itemTitle: string, itemId?: string): boolean {
  if (!milestones) return false;

  if (Array.isArray(milestones)) {
    if (milestones.includes(itemTitle)) return true;
    if (itemId && milestones.includes(itemId)) return true;

    const lowerTitle = itemTitle.toLowerCase();
    const lowerId = itemId ? itemId.toLowerCase() : '';

    return milestones.some((m) => {
      if (typeof m !== 'string') return false;
      const lowerM = m.toLowerCase();
      return (
        lowerM === lowerTitle ||
        (lowerId && lowerM === lowerId) ||
        (lowerTitle === 'siap & boleh pulang' && (lowerM.includes('boleh pulang') || lowerM.includes('siap pulang')))
      );
    });
  }

  if (typeof milestones === 'object' && milestones !== null) {
    const obj = milestones as Record<string, unknown>;
    if (itemId && Boolean(obj[itemId])) return true;
    if (Boolean(obj[itemTitle])) return true;
  }

  return false;
}

/**
 * Toggles a milestone item in the array without converting it into an object or null.
 * Returns a new clean array of strings.
 */
export function toggleMilestone(
  milestones: unknown,
  itemTitle: string,
  itemId?: string,
  checked?: boolean
): string[] {
  const current = normalizeMilestones(milestones);
  const isCurrentlyActive = isMilestoneChecked(current, itemTitle, itemId);
  const willBeChecked = checked !== undefined ? checked : !isCurrentlyActive;

  if (willBeChecked) {
    if (!current.includes(itemTitle)) {
      return [...current, itemTitle];
    }
    return current;
  } else {
    const lowerTitle = itemTitle.toLowerCase();
    const lowerId = itemId ? itemId.toLowerCase() : '';

    return current.filter((m) => {
      const lowerM = m.toLowerCase();
      if (lowerM === lowerTitle) return false;
      if (lowerId && lowerM === lowerId) return false;
      if (
        (lowerTitle.includes('boleh pulang') || lowerId === 'bolehpulang') &&
        (lowerM.includes('boleh pulang') || lowerM.includes('siap pulang'))
      ) {
        return false;
      }
      return true;
    });
  }
}
