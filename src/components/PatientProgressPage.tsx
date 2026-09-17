import React, { useState, useEffect } from 'react';
import { Patient, MedicalEquipment, Milestones, NakesUser, DailyLog, EquipmentItem, EducationPdfItem, ImmunizationDischargeRecord } from '../types';
import { formatDetailedDuration, formatDateTimeWithTime, formatIndonesianDate, getPatientAdmissionDateTime, getPatientDischargeDateTime } from '../utils/dateUtils';
import { savePdfDataUrl, getPdfDataUrlSync, getPdfDataUrl, triggerPdfDownload, dataUrlToBlob } from '../services/pdfStore';
import { saveGlobalPdf, deleteStoredGlobalPdf, resolvePatientEducationPdfs } from '../services/storage';
import { renderPdfFirstPageToImage, generateFallbackPdfCover, generateSamplePdfDataUrl } from '../services/pdfRender';
import { PdfViewerCanvas } from './PdfViewerCanvas';
import { EducationPdfCard } from './EducationPdfCard';
import { EducationLightboxModal } from './EducationLightboxModal';
import { CustomTimeModal, CustomTimeTab } from './CustomTimeModal';
import { downloadEducationPdf } from '../utils/pdfDownload';
import {
  normalizeMilestones,
  isMilestoneChecked,
  toggleMilestone,
  MILESTONE_CHECKLIST_DEFINITIONS,
  BOLEH_PULANG_DEFINITION,
} from '../utils/milestones';

const EQUIPMENT_PRESETS: {
  name: string;
  defaultClinical: string;
  defaultExplanation: string;
}[] = [
  {
    name: 'Bedside Monitor TTV',
    defaultClinical: 'Monitored 24/7, SpO2 & HR stabil',
    defaultExplanation: 'Layar monitor pintar yang memantau detak jantung, pernapasan, dan saturasi oksigen dedek secara langsung 24 jam.',
  },
  {
    name: 'Kanul Oksigen / O2 Mask',
    defaultClinical: '0.5 Liter/menit',
    defaultExplanation: 'Oksigen hidung ringan untuk membantu kenyamanan bernapas.',
  },
  {
    name: 'Bubble CPAP',
    defaultClinical: 'PEEP 5 cmH2O, FiO2 21%',
    defaultExplanation: 'Alat bantu napas lembut dengan tekanan positif untuk menjaga paru-paru dedek tetap mengembang.',
  },
  {
    name: 'Ventilator Mekanis',
    defaultClinical: 'Mode SIMV/PC, FiO2 30%',
    defaultExplanation: 'Mesin bantu napas khusus yang menyokong pernapasan dedek secara presisi di ruang perawatan.',
  },
  {
    name: 'Inkubator / Infant Warmer',
    defaultClinical: 'Suhu mode skin/air 36.5°C',
    defaultExplanation: 'Kotak hangat steril pembawa kenyamanan seperti di dalam kandungan Ibu.',
  },
  {
    name: 'Syringe Pump / Infusion Pump',
    defaultClinical: 'Laju tetes 2.5 ml/jam',
    defaultExplanation: 'Pompa pengatur cairan dan nutrisi khusus yang diberikan secara bertahap dan tepat dosis.',
  },
  {
    name: 'Fototerapi (Lampu Biru)',
    defaultClinical: 'Kadar Bilirubin normal (6.5 mg/dL)',
    defaultExplanation: 'Lampu sinar biru penurun kadar kuning.',
  },
  {
    name: 'OGT / NGT (Selang Makanan)',
    defaultClinical: 'Sudah dilepas, bayinya bisa menetek langsung',
    defaultExplanation: 'Selang makanan lunak yang saat ini sudah berhasil dilepas!',
  },
  {
    name: '+ Input Nama Alat Medis Lainnya (Kustom)',
    defaultClinical: 'Pengawasan rutin nakes',
    defaultExplanation: 'Alat penunjang kesehatan medis untuk menjaga kondisi dedek tetap stabil.',
  },
];

const INITIAL_DEFAULT_EQUIPMENT: EquipmentItem[] = [
  {
    id: 'eq-1',
    name: 'Infus IV',
    clinicalNotes: 'Cairan Ringer Lactat 12 ml/jam',
    parentExplanation: 'Infus penunjang cairan dan medikasi.',
    isActive: true,
  },
  {
    id: 'eq-2',
    name: 'O2 Nasal Kanul',
    clinicalNotes: '0.5 Liter/menit',
    parentExplanation: 'Oksigen hidung ringan untuk membantu kenyamanan bernapas.',
    isActive: true,
  },
  {
    id: 'eq-3',
    name: 'OGT (Oral Gastric Tube)',
    clinicalNotes: 'Sudah dilepas, bayinya bisa menetek langsung',
    parentExplanation: 'Selang makanan lunak yang saat ini sudah berhasil dilepas!',
    isActive: false,
  },
  {
    id: 'eq-4',
    name: 'Fototerapi',
    clinicalNotes: 'Kadar Bilirubin normal (6.5 mg/dL)',
    parentExplanation: 'Lampu sinar biru penurun kadar kuning.',
    isActive: false,
  },
];
import {
  ArrowLeft,
  Baby,
  Calendar,
  Clock,
  Activity,
  Award,
  Scale,
  Key,
  FileText,
  Plus,
  Check,
  Trash2,
  LogOut,
  Camera,
  Sparkles,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Thermometer,
  Droplets,
  GraduationCap,
  Info,
  Pencil,
  Save,
  TrendingUp,
  Share2,
  Edit3,
  Heart,
  CheckCheck,
  User,
  X,
  Upload,
  Download,
  UserCog,
  CheckCircle2,
  AlertCircle,
  Folder,
  BookOpen,
  ChevronRight,
  Eye,
  Grid,
  List,
  Search,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { EditPatientModal } from './EditPatientModal';
import { SouvenirCardModal } from './SouvenirCardModal';

const PRESET_MILESTONES = [
  'Toleransi ASI OGT baik (8x8 ml)',
  'Refleks hisap mulai tampak',
  'Ekstremitas aktif bergerak',
  'Responsif terhadap sentuhan Mama',
  'Minum ASI OGT lancar 8x15 ml',
  'Belajar menetek langsung (Oral motor membaik)',
  'Buka mata lebih lama',
  'Tangisan lebih kuat',
  'CPAP diturunkan perlahan',
  'Kontak kulit ke kulit (Metode Kanguru) disarankan 1-2 jam/hari',
  'TTV stabil dalam rentang normal',
];

const getLogMilestones = (log: DailyLog): string[] => {
  if (log.milestonesList && log.milestonesList.length > 0) {
    return log.milestonesList;
  }
  const list: string[] = [];
  if (log.drinkingAbility?.notes && log.drinkingAbility.notes !== 'Toleransi minum baik.') {
    list.push(log.drinkingAbility.notes);
  } else if (log.drinkingAbility) {
    list.push(`Toleransi ${log.drinkingAbility.method || 'ASI'} baik (${log.drinkingAbility.frequencyPerDay || 8}x${log.drinkingAbility.volumeCcPerFeeding || 15} ml)`);
  } else {
    list.push('Toleransi ASI OGT baik (8x8 ml)');
  }
  list.push('Refleks hisap mulai tampak');
  list.push('Ekstremitas aktif bergerak');
  list.push('Responsif terhadap sentuhan Mama');
  return list;
};

interface PatientProgressPageProps {
  patient: Patient;
  onBack: () => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
  onOpenCredentials: (patient: Patient) => void;
  onOpenSouvenirCard: (patient: Patient) => void;
  onDischargePatient: (patient: Patient) => void;
  onCancelDischargePatient?: (patient: Patient) => void;
  currentNakesUser: NakesUser | null;
}

export const PatientProgressPage: React.FC<PatientProgressPageProps> = ({
  patient,
  onBack,
  onUpdatePatient,
  onOpenCredentials,
  onOpenSouvenirCard,
  onDischargePatient,
  onCancelDischargePatient,
  currentNakesUser,
}) => {
  const [activeTab, setActiveTab] = useState<'antropometri' | 'progres' | 'alat' | 'edukasi' | 'imunisasi'>('progres');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState<boolean>(false);
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState<boolean>(false);
  const [isSouvenirModalOpen, setIsSouvenirModalOpen] = useState<boolean>(false);

  // Default initial PDFs if none exist
  const DEFAULT_PATIENT_PDFS: EducationPdfItem[] = [];

  // EDUCATION PDF TAB STATES
  const [pdfTitle, setPdfTitle] = useState<string>('');
  const [pdfCategory, setPdfCategory] = useState<string>('Metode Kanguru (PMK)');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfFileDataUrl, setPdfFileDataUrl] = useState<string>('');
  const [pdfFileSizeText, setPdfFileSizeText] = useState<string>('1.2 MB');
  const [pdfNakesNote, setPdfNakesNote] = useState<string>('');
  const [pdfFilter, setPdfFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [pdfSelectedCategory, setPdfSelectedCategory] = useState<string>('Semua');
  const [pdfSearchQuery, setPdfSearchQuery] = useState<string>('');
  const [pdfViewMode, setPdfViewMode] = useState<'grid' | 'list'>('grid');
  const [previewPdfItem, setPreviewPdfItem] = useState<EducationPdfItem | null>(null);
  const [pdfRenderedCovers, setPdfRenderedCovers] = useState<Record<string, string>>({});

  // IMMUNIZATION & DISCHARGE TAB STATES
  const [hb0Given, setHb0Given] = useState<boolean>(patient.immunizationDischarge?.hb0VaccineGiven ?? true);
  const [hb0Date, setHb0Date] = useState<string>(patient.immunizationDischarge?.hb0VaccineDate || '2026-07-24');
  const [shkStatus, setShkStatus] = useState<string>(patient.immunizationDischarge?.shkScreening || 'Sampel Darah Tumit Diberikan');
  const [ropStatus, setRopStatus] = useState<string>(patient.immunizationDischarge?.ropScreening || 'Sudah Diperiksa Dokter Spesialis Mata');
  const [oaeStatus, setOaeStatus] = useState<string>(patient.immunizationDischarge?.oaeScreening || 'Bilateral PASS (Normal)');
  const [pjbStatus, setPjbStatus] = useState<string>(patient.immunizationDischarge?.pjbScreeningResult || 'PASS (Lolos Skrining Oksimetri PJB)');
  const [pjbNote, setPjbNote] = useState<string>(patient.immunizationDischarge?.pjbScreeningNote || 'SpO2 tangan kanan 99%, kaki 99% (Lolos Skrining Oksimetri PJB)');
  const [dischargeSummaryText, setDischargeSummaryText] = useState<string>(
    patient.immunizationDischarge?.dischargeSummaryNote || 'Kondisi bayi menunjukkan kemajuan pesat. Target berat badan pulang: 2000 gram.'
  );

  // 1. PARSING PROGRESS LOGS SAAT FETCH / SAVE DENGAN FALLBACK AMAN
  const progressLogs: DailyLog[] = Array.isArray(patient.progressLogs)
    ? patient.progressLogs
    : Array.isArray(patient.progress_logs)
    ? patient.progress_logs
    : Array.isArray(patient.dailyLogs)
    ? patient.dailyLogs
    : Array.isArray(patient.daily_logs)
    ? patient.daily_logs
    : [];

  // Form states for adding new log
  const lastLog = progressLogs[0];
  const logCount = progressLogs.length + 1;
  const isAterm = patient.gestationCategory === 'aterm';
  const admissionInfo = getPatientAdmissionDateTime(patient);
  const dischargeInfo = getPatientDischargeDateTime(patient);

  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodLabel, setPeriodLabel] = useState(isAterm ? `Hari ke-${logCount}` : `Minggu ke-${logCount}`);
  const [logWeight, setLogWeight] = useState<number | string>(
    lastLog ? (lastLog.weightGram ?? (lastLog as any).weight ?? patient.initialAnthropometry.weightGram) : patient.initialAnthropometry.weightGram
  );
  const [temp, setTemp] = useState<number | string>(lastLog?.vitalSigns?.temperature || (lastLog as any)?.temp || 36.7);
  const [hr, setHr] = useState<number | string>(lastLog?.vitalSigns?.heartRate || (lastLog as any)?.hr || 138);
  const [rr, setRr] = useState<number | string>(lastLog?.vitalSigns?.respiratoryRate || (lastLog as any)?.rr || 42);
  const [spo2, setSpo2] = useState<number | string>(lastLog?.vitalSigns?.spo2 || 98);

  const [drinkMethod, setDrinkMethod] = useState(lastLog?.drinkingAbility?.method || (lastLog as any)?.drinkMethod || 'OGT/Sonde');
  const [drinkCc, setDrinkCc] = useState<number | string>(lastLog?.drinkingAbility?.volumeCcPerFeeding || (lastLog as any)?.drinkCc || 15);
  const [drinkFreq, setDrinkFreq] = useState<number | string>(lastLog?.drinkingAbility?.frequencyPerDay || (lastLog as any)?.drinkFreq || 8);
  const [drinkNotes, setDrinkNotes] = useState(lastLog?.drinkingAbility?.notes || (lastLog as any)?.drinkNotes || 'Toleransi minum baik.');

  const [logEquipment, setLogEquipment] = useState<MedicalEquipment[]>(
    lastLog?.activeEquipment ? [...lastLog.activeEquipment] : [...patient.currentEquipment]
  );
  const [logMilestones, setLogMilestones] = useState<string[]>(() => normalizeMilestones(patient.milestones));
  const [logMilestonesChips, setLogMilestonesChips] = useState<string[]>([
    'Toleransi ASI OGT baik (8x8 ml)',
    'Refleks hisap mulai tampak',
    'Ekstremitas aktif bergerak',
    'Responsif terhadap sentuhan Mama',
  ]);
  const [customMilestoneInput, setCustomMilestoneInput] = useState<string>('');
  const [nakesNotes, setNakesNotes] = useState('Si kecil sehat dan dalam pemantauan rutin NICU RSUD Undata.');
  const [logPhotoUrl, setLogPhotoUrl] = useState<string>('');
  const [logPhotoFile, setLogPhotoFile] = useState<File | null>(null);
  const [logPhotoCaption, setLogPhotoCaption] = useState<string>('');

  // EDIT LOG MODAL STATES
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [editLogDate, setEditLogDate] = useState<string>('');
  const [editPeriodLabel, setEditPeriodLabel] = useState<string>('');
  const [editLogWeight, setEditLogWeight] = useState<number | string>('');
  const [editTemp, setEditTemp] = useState<number | string>('');
  const [editHr, setEditHr] = useState<number | string>('');
  const [editRr, setEditRr] = useState<number | string>('');
  const [editSpo2, setEditSpo2] = useState<number | string>('');
  const [editNakesNotes, setEditNakesNotes] = useState<string>('');
  const [editMilestonesChips, setEditMilestonesChips] = useState<string[]>([]);
  const [editCustomMilestoneInput, setEditCustomMilestoneInput] = useState<string>('');

  // REGISTERED EQUIPMENT STATES (Matching uploaded image 1 & image 2)
  const [registeredEquipment, setRegisteredEquipment] = useState<EquipmentItem[]>(
    patient.registeredEquipment && patient.registeredEquipment.length > 0
      ? patient.registeredEquipment
      : INITIAL_DEFAULT_EQUIPMENT
  );

  const [selectedEqPreset, setSelectedEqPreset] = useState<string>(EQUIPMENT_PRESETS[0].name);
  const [customEqName, setCustomEqName] = useState<string>('');
  const [eqClinicalNotes, setEqClinicalNotes] = useState<string>(EQUIPMENT_PRESETS[0].defaultClinical);
  const [eqParentExplanation, setEqParentExplanation] = useState<string>(EQUIPMENT_PRESETS[0].defaultExplanation);
  const [isNewEqActive, setIsNewEqActive] = useState<boolean>(true);

  // Sync state when patient changes
  useEffect(() => {
    setLogMilestones(normalizeMilestones(patient.milestones));
    const currentActiveEq = progressLogs[0]?.activeEquipment
      ? [...progressLogs[0].activeEquipment]
      : [...patient.currentEquipment];
    setLogEquipment(currentActiveEq);
    if (patient.registeredEquipment && patient.registeredEquipment.length > 0) {
      setRegisteredEquipment(patient.registeredEquipment);
    }
  }, [patient]);

  // CUSTOM WAKTU MASUK & PULANG STATES
  const [isCustomTimeModalOpen, setIsCustomTimeModalOpen] = useState(false);
  const [customTimeModalTab, setCustomTimeModalTab] = useState<CustomTimeTab>('discharge');

  const handleEqPresetChange = (presetName: string) => {
    setSelectedEqPreset(presetName);
    const found = EQUIPMENT_PRESETS.find((p) => p.name === presetName);
    if (found) {
      setEqClinicalNotes(found.defaultClinical);
      setEqParentExplanation(found.defaultExplanation);
    } else {
      setEqClinicalNotes('Pengawasan rutin nakes');
      setEqParentExplanation('Alat penunjang kesehatan medis untuk menjaga kondisi dedek tetap stabil.');
    }
  };

  const handleAddEquipmentItem = () => {
    let finalName = selectedEqPreset;
    if (selectedEqPreset === '+ Input Nama Alat Medis Lainnya (Kustom)') {
      finalName = customEqName.trim() || 'Alat Medis Kustom';
    }

    const newItem: EquipmentItem = {
      id: 'eq-' + Date.now(),
      name: finalName,
      clinicalNotes: eqClinicalNotes || 'Pengawasan rutin nakes',
      parentExplanation: eqParentExplanation || 'Alat penunjang kesehatan medis untuk menjaga kondisi dedek.',
      isActive: isNewEqActive,
      createdAt: new Date().toISOString(),
    };

    const updatedList = [newItem, ...registeredEquipment];
    setRegisteredEquipment(updatedList);

    const activeNames = updatedList
      .filter((e) => e.isActive)
      .map((e) => e.name as MedicalEquipment);

    const updatedPatient: Patient = {
      ...patient,
      registeredEquipment: updatedList,
      currentEquipment: activeNames,
    };

    onUpdatePatient(updatedPatient);
    setSuccessBanner(`✓ Alat "${finalName}" berhasil ditambahkan!`);
    setTimeout(() => setSuccessBanner(null), 3000);

    setCustomEqName('');
  };

  const toggleEquipmentStatus = (id: string) => {
    const updatedList = registeredEquipment.map((item) => {
      if (item.id === id) {
        return { ...item, isActive: !item.isActive };
      }
      return item;
    });

    setRegisteredEquipment(updatedList);

    const activeNames = updatedList
      .filter((e) => e.isActive)
      .map((e) => e.name as MedicalEquipment);

    const updatedPatient: Patient = {
      ...patient,
      registeredEquipment: updatedList,
      currentEquipment: activeNames,
    };

    onUpdatePatient(updatedPatient);
  };

  const deleteEquipmentItem = (id: string) => {
    const updatedList = registeredEquipment.filter((item) => item.id !== id);
    setRegisteredEquipment(updatedList);

    const activeNames = updatedList
      .filter((e) => e.isActive)
      .map((e) => e.name as MedicalEquipment);

    const updatedPatient: Patient = {
      ...patient,
      registeredEquipment: updatedList,
      currentEquipment: activeNames,
    };

    onUpdatePatient(updatedPatient);
  };

  // EDUCATION PDF HANDLERS
  const patientEducationPdfs = resolvePatientEducationPdfs(patient.educationPdfs);

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setPdfFileName(file.name);
      const kb = Math.round(file.size / 1024);
      setPdfFileSizeText(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setPdfFileDataUrl(evt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEducationPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfTitle.trim()) {
      alert('Judul materi edukasi wajib diisi.');
      return;
    }

    const newPdfId = 'pdf_' + Date.now();
    let finalPdfUrl = pdfFileDataUrl;

    if (pdfFileDataUrl) {
      savePdfDataUrl(newPdfId, pdfFileDataUrl);
    }

    let generatedCover: string | undefined;
    if (pdfFileDataUrl) {
      try {
        const { coverUrl } = await renderPdfFirstPageToImage(pdfFileDataUrl);
        if (coverUrl) generatedCover = coverUrl;
      } catch (e) {
        console.warn('Cover generation fallback:', e);
      }
    }
    if (!generatedCover) {
      generatedCover = generateFallbackPdfCover(pdfTitle.trim(), pdfCategory);
    }

    const newPdf: EducationPdfItem = {
      id: newPdfId,
      title: pdfTitle.trim(),
      category: pdfCategory,
      fileName: pdfFileName || `${pdfTitle.replace(/\s+/g, '_')}.pdf`,
      fileSizeText: pdfFileSizeText || '1.2 MB',
      fileDataUrl: finalPdfUrl || pdfFileDataUrl || undefined,
      coverImageUrl: generatedCover,
      nakesNote: pdfNakesNote.trim() || undefined,
      publishedAt: new Date().toISOString().split('T')[0],
      isActive: true,
    };

    saveGlobalPdf(newPdf);

    if (generatedCover) {
      setPdfRenderedCovers((prev) => ({ ...prev, [newPdfId]: generatedCover! }));
    }

    const updatedPdfs = [...patientEducationPdfs, newPdf];
    const updatedPatient: Patient = {
      ...patient,
      educationPdfs: updatedPdfs,
    };

    onUpdatePatient(updatedPatient);
    setSuccessBanner(`✓ PDF Edukasi "${newPdf.title}" berhasil diterbitkan!`);
    setTimeout(() => setSuccessBanner(null), 3500);

    setPdfTitle('');
    setPdfFileName('');
    setPdfFileDataUrl('');
    setPdfFile(null);
    setPdfNakesNote('');
  };

  const togglePdfActive = (pdfId: string) => {
    const updatedPdfs = patientEducationPdfs.map((pdf) =>
      pdf.id === pdfId ? { ...pdf, isActive: !pdf.isActive } : pdf
    );
    onUpdatePatient({ ...patient, educationPdfs: updatedPdfs });
  };

  const [deletePdfModal, setDeletePdfModal] = useState<{
    isOpen: boolean;
    pdfId: string;
    title: string;
  }>({
    isOpen: false,
    pdfId: '',
    title: '',
  });

  const promptDeletePdfItem = (pdfId: string, title: string) => {
    setDeletePdfModal({
      isOpen: true,
      pdfId,
      title,
    });
  };

  const confirmDeletePdfItem = async () => {
    if (deletePdfModal.pdfId) {
      deleteStoredGlobalPdf(deletePdfModal.pdfId);
      const updatedPdfs = patientEducationPdfs.filter((p) => p.id !== deletePdfModal.pdfId);
      onUpdatePatient({ ...patient, educationPdfs: updatedPdfs });
    }
    setDeletePdfModal({ isOpen: false, pdfId: '', title: '' });
  };

  const handleDownloadPdf = async (pdf: EducationPdfItem) => {
    await downloadEducationPdf(pdf);
  };

  // Pre-render PDF covers for Nakes input view
  useEffect(() => {
    let isMounted = true;
    const loadCovers = async () => {
      const covers: Record<string, string> = {};
      for (const pdf of patientEducationPdfs) {
        if (pdf.coverImageUrl) {
          covers[pdf.id] = pdf.coverImageUrl;
          continue;
        }
        let dataUrl = pdf.fileDataUrl || getPdfDataUrlSync(pdf.id);
        if (!dataUrl) {
          dataUrl = await getPdfDataUrl(pdf.id);
        }
        if (dataUrl) {
          const { coverUrl } = await renderPdfFirstPageToImage(dataUrl);
          if (coverUrl) {
            covers[pdf.id] = coverUrl;
          } else {
            covers[pdf.id] = generateFallbackPdfCover(pdf.title, pdf.category);
          }
        } else {
          covers[pdf.id] = generateFallbackPdfCover(pdf.title, pdf.category);
        }
      }
      if (isMounted) {
        setPdfRenderedCovers((prev) => ({ ...prev, ...covers }));
      }
    };
    loadCovers();
    return () => {
      isMounted = false;
    };
  }, [patient.id, patientEducationPdfs.length, patientEducationPdfs.map((p) => p.id).join(',')]);

  const activePdfsCount = patientEducationPdfs.filter((p) => p.isActive).length;
  const inactivePdfsCount = patientEducationPdfs.filter((p) => !p.isActive).length;

  const pdfCategories = [
    'Semua',
    ...Array.from(new Set(patientEducationPdfs.map((p) => p.category || 'Umum'))),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const filteredPdfs = patientEducationPdfs.filter((pdf) => {
    if (pdfFilter === 'active' && !pdf.isActive) return false;
    if (pdfFilter === 'inactive' && pdf.isActive) return false;
    if (pdfSelectedCategory !== 'Semua' && pdf.category !== pdfSelectedCategory) return false;
    if (pdfSearchQuery.trim() !== '') {
      const q = pdfSearchQuery.toLowerCase();
      const matchTitle = pdf.title.toLowerCase().includes(q);
      const matchNote = (pdf.nakesNote || '').toLowerCase().includes(q);
      const matchCategory = (pdf.category || '').toLowerCase().includes(q);
      if (!matchTitle && !matchNote && !matchCategory) return false;
    }
    return true;
  });

  // IMMUNIZATION & DISCHARGE HANDLERS
  const handleSaveImmunizationDischarge = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedRec: ImmunizationDischargeRecord = {
      hb0VaccineGiven: hb0Given,
      hb0VaccineDate: hb0Date,
      shkScreening: shkStatus,
      ropScreening: ropStatus,
      oaeScreening: oaeStatus,
      pjbScreeningResult: pjbStatus,
      pjbScreeningNote: pjbNote,
      dischargeSummaryNote: dischargeSummaryText,
      updatedAt: new Date().toISOString(),
    };

    let updatedMilestones = normalizeMilestones(patient.milestones);
    if (hb0Given) {
      if (!updatedMilestones.includes('HB0 (Imunisasi Hepatitis B0)')) {
        updatedMilestones.push('HB0 (Imunisasi Hepatitis B0)');
      }
    } else {
      updatedMilestones = updatedMilestones.filter((m) => m !== 'HB0 (Imunisasi Hepatitis B0)' && m !== 'hb0');
    }

    if (shkStatus.includes('Sampel') || shkStatus.includes('Normal')) {
      if (!updatedMilestones.includes('SHK (Skrining Hipotiroid Kongenital)')) {
        updatedMilestones.push('SHK (Skrining Hipotiroid Kongenital)');
      }
    } else {
      updatedMilestones = updatedMilestones.filter((m) => m !== 'SHK (Skrining Hipotiroid Kongenital)' && m !== 'shk');
    }

    if (pjbStatus.includes('PASS')) {
      if (!updatedMilestones.includes('Skrining PJB (Penyakit Jantung Bawaan)')) {
        updatedMilestones.push('Skrining PJB (Penyakit Jantung Bawaan)');
      }
    } else {
      updatedMilestones = updatedMilestones.filter((m) => m !== 'Skrining PJB (Penyakit Jantung Bawaan)' && m !== 'skriningPJB');
    }

    const updatedPatient: Patient = {
      ...patient,
      immunizationDischarge: updatedRec,
      milestones: updatedMilestones,
    };

    onUpdatePatient(updatedPatient);
    setSuccessBanner('✓ Catatan Imunisasi & Status Kepulangan Medis berhasil disimpan!');
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  // Milestone Toggle Handler - Instant local state update & immediate patient persistence
  const handleMilestoneToggle = (itemTitle: string, itemId?: string) => {
    const current = normalizeMilestones(patient.milestones);
    const isChecked = isMilestoneChecked(current, itemTitle, itemId);
    const updatedMilestones = toggleMilestone(current, itemTitle, itemId, !isChecked);

    // 1. Update form local state immediately
    setLogMilestones(updatedMilestones);

    // 2. Determine new status if SIAP & BOLEH PULANG is toggled
    const isBolehPulang = isMilestoneChecked(updatedMilestones, BOLEH_PULANG_DEFINITION.title, BOLEH_PULANG_DEFINITION.id);
    let newStatus = patient.status;
    if (isBolehPulang && patient.status !== 'Sudah Pulang') {
      newStatus = 'Siap Pulang';
    } else if (!isBolehPulang && patient.status === 'Siap Pulang') {
      newStatus = 'Rawat NICU';
    }

    // 3. Update patient object immediately and sync to backend in background
    const updatedPatient: Patient = {
      ...patient,
      milestones: updatedMilestones,
      status: newStatus,
      readyToDischargeDate: isBolehPulang
        ? (patient.readyToDischargeDate || new Date().toISOString().split('T')[0])
        : patient.readyToDischargeDate,
      readyToDischargeTime: isBolehPulang
        ? (patient.readyToDischargeTime || '10:00')
        : patient.readyToDischargeTime,
    };

    onUpdatePatient(updatedPatient);
  };

  // Open Edit Modal
  const handleOpenEditModal = (log: DailyLog) => {
    setEditingLog(log);
    setEditLogDate(log.date);
    setEditPeriodLabel(log.periodLabel);
    setEditLogWeight(log.weightGram);
    setEditTemp(log.vitalSigns.temperature);
    setEditHr(log.vitalSigns.heartRate);
    setEditRr(log.vitalSigns.respiratoryRate);
    setEditSpo2(log.vitalSigns.spo2);
    setEditNakesNotes(log.nakesNotes);
    setEditMilestonesChips(getLogMilestones(log));
    setEditCustomMilestoneInput('');
  };

  // Save Edit Log
  const handleSaveEditLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    const weightNum = Number(editLogWeight);

    const updatedDailyLogs = progressLogs.map((item) => {
      if (item.id === editingLog.id) {
        return {
          ...item,
          date: editLogDate,
          periodLabel: editPeriodLabel,
          label: editPeriodLabel,
          weightGram: weightNum,
          weight: weightNum,
          vitalSigns: {
            temperature: Number(editTemp),
            heartRate: Number(editHr),
            respiratoryRate: Number(editRr),
            spo2: Number(editSpo2),
          },
          milestonesList: [...editMilestonesChips],
          nakesNotes: editNakesNotes,
        };
      }
      return item;
    });

    // Recalculate weight change grams relative to adjacent logs
    for (let i = 0; i < updatedDailyLogs.length; i++) {
      const nextLog = updatedDailyLogs[i + 1];
      const prevWeight = nextLog ? Number(nextLog.weightGram ?? (nextLog as any).weight ?? 0) : patient.initialAnthropometry.weightGram;
      updatedDailyLogs[i].weightChangeGram = Number(updatedDailyLogs[i].weightGram ?? (updatedDailyLogs[i] as any).weight ?? 0) - prevWeight;
    }

    const updatedPatient: Patient = {
      ...patient,
      dailyLogs: updatedDailyLogs,
      progressLogs: updatedDailyLogs,
      progress_logs: updatedDailyLogs,
      daily_logs: updatedDailyLogs,
    };

    onUpdatePatient(updatedPatient);
    setEditingLog(null);
    setSuccessBanner(`✓ Log ${editPeriodLabel} berhasil diperbarui!`);
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  // Delete Log (Direct execution without window.confirm to avoid iframe sandbox errors)
  const handleDeleteLog = (logId: string) => {
    const updatedDailyLogs = progressLogs.filter((l) => l.id !== logId);
    for (let i = 0; i < updatedDailyLogs.length; i++) {
      const nextLog = updatedDailyLogs[i + 1];
      const prevWeight = nextLog ? Number(nextLog.weightGram ?? (nextLog as any).weight ?? 0) : patient.initialAnthropometry.weightGram;
      updatedDailyLogs[i].weightChangeGram = Number(updatedDailyLogs[i].weightGram ?? (updatedDailyLogs[i] as any).weight ?? 0) - prevWeight;
    }
    const updatedPatient: Patient = {
      ...patient,
      dailyLogs: updatedDailyLogs,
      progressLogs: updatedDailyLogs,
      progress_logs: updatedDailyLogs,
      daily_logs: updatedDailyLogs,
    };
    onUpdatePatient(updatedPatient);
    setEditingLog(null);
    setSuccessBanner('✓ Catatan progres berhasil dihapus.');
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  // Handle Photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setLogPhotoUrl(evt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Toggle Equipment
  const toggleEquipment = (eq: MedicalEquipment) => {
    setLogEquipment((prev) =>
      prev.includes(eq) ? prev.filter((item) => item !== eq) : [...prev, eq]
    );
  };

  // Submit new log
  const handleSaveNewLog = async (e: React.FormEvent) => {
    e.preventDefault();

    const weightNum = Number(logWeight);
    const prevWeight = lastLog ? Number(lastLog.weightGram ?? (lastLog as any).weight ?? patient.initialAnthropometry.weightGram) : patient.initialAnthropometry.weightGram;
    const weightChangeGram = weightNum - prevWeight;
    const newLogId = 'log_' + Date.now();

    const finalPhotoUrl = logPhotoUrl || undefined;

    const newLogItem: DailyLog = {
      id: newLogId,
      date: logDate,
      periodLabel,
      label: periodLabel,
      weightGram: weightNum,
      weight: weightNum,
      weightChangeGram,
      vitalSigns: {
        temperature: Number(temp),
        heartRate: Number(hr),
        respiratoryRate: Number(rr),
        spo2: Number(spo2),
      },
      drinkingAbility: {
        method: drinkMethod as any,
        volumeCcPerFeeding: Number(drinkCc),
        frequencyPerDay: Number(drinkFreq),
        notes: drinkNotes,
      },
      activeEquipment: [...logEquipment],
      milestonesList: logMilestonesChips.length > 0 ? [...logMilestonesChips] : undefined,
      nakesNotes,
      updatedBy: currentNakesUser ? `${currentNakesUser.name} (${currentNakesUser.roleTitle})` : 'Ns. Perawat NICU',
      createdAt: new Date().toISOString(),
      photoUrl: finalPhotoUrl,
      photoCaption: logPhotoCaption || undefined,
    };

    // 2. PEMBARUAN STATE LOKAL INSTAN: Gabungkan log baru secara langsung
    const updatedLogs = [newLogItem, ...progressLogs];

    // Determine status based on milestones bolehPulang check
    const isBolehPulang = isMilestoneChecked(logMilestones, BOLEH_PULANG_DEFINITION.title, BOLEH_PULANG_DEFINITION.id);
    let newStatus = patient.status;
    if (isBolehPulang && patient.status !== 'Sudah Pulang') {
      newStatus = 'Siap Pulang';
    } else if (!isBolehPulang && patient.status !== 'Sudah Pulang') {
      newStatus = 'Rawat NICU';
    }

    const updatedPatient: Patient = {
      ...patient,
      dailyLogs: updatedLogs,
      progressLogs: updatedLogs,
      progress_logs: updatedLogs,
      daily_logs: updatedLogs,
      currentEquipment: [...logEquipment],
      milestones: [...logMilestones],
      status: newStatus,
      readyToDischargeDate: isBolehPulang
        ? (patient.readyToDischargeDate || new Date().toISOString().split('T')[0])
        : patient.readyToDischargeDate,
      readyToDischargeTime: isBolehPulang
        ? (patient.readyToDischargeTime || '10:00')
        : patient.readyToDischargeTime,
      coverPhotoUrl: logPhotoUrl || patient.coverPhotoUrl,
    };

    onUpdatePatient(updatedPatient);

    setSuccessBanner(`✓ Progres ${periodLabel} untuk ${patient.babyName} berhasil disimpan dan langsung diperbarui!`);
    setTimeout(() => setSuccessBanner(null), 4000);

    // Reset photo for next input
    setLogPhotoUrl('');
    setLogPhotoCaption('');
  };

  // Calculate Real-time metrics
  const ageDuration = formatDetailedDuration(patient.birthDate);
  const stayDuration = formatDetailedDuration(patient.admissionDate);

  const initialWeight = patient.initialAnthropometry.weightGram;
  const latestWeight = lastLog ? Number(lastLog.weightGram ?? (lastLog as any).weight ?? initialWeight) : initialWeight;
  const weightGainTotal = latestWeight - initialWeight;

  // 3. FORMAT DATA GRAFIK (Membaca log.weightGram maupun log.weight)
  const chartData = [
    {
      label: 'Saat Masuk',
      weight: initialWeight,
      date: formatIndonesianDate(patient.admissionDate),
    },
    ...[...progressLogs].reverse().map((l) => ({
      label: l.periodLabel || (l as any).label || 'Log',
      weight: Number(l.weightGram ?? (l as any).weight ?? 0),
      date: formatIndonesianDate(l.date || l.createdAt),
    })),
  ];

  const medicalRecordNo = patient.medicalRecordNumber || `RM-2026-${patient.id.slice(-4)}`;
  const roomInfo = patient.roomNumber || 'Inkubator / Bed NICU RSUD Undata';

  return (
    <div className="min-h-screen bg-slate-100/70 p-3 sm:p-6 text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
        
        {/* SUCCESS BANNER NOTIFICATION */}
        {successBanner && (
          <div className="p-4 bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-slideDown">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-200" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-white/80 hover:text-white font-black text-xs px-2 py-1 bg-white/10 rounded-lg"
            >
              Tutup
            </button>
          </div>
        )}

        {/* 1. TOP HEADER BAR */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <button
                onClick={onBack}
                className="p-2 sm:p-2.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 rounded-2xl transition-all cursor-pointer shrink-0"
                title="Kembali ke Daftar Pasien"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Baby Avatar */}
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 p-0.5 shadow-sm shrink-0 overflow-hidden">
                {patient.coverPhotoUrl ? (
                  <img src={patient.coverPhotoUrl} alt={patient.babyName} className="w-full h-full object-cover rounded-[14px]" />
                ) : (
                  <div className="w-full h-full bg-teal-50 rounded-[14px] flex items-center justify-center">
                    <Baby className="w-6 h-6 sm:w-8 sm:h-8 text-teal-600" />
                  </div>
                )}
              </div>

              {/* Small screen Baby Name & RM */}
              <div className="sm:hidden min-w-0 flex-1">
                <h1 className="text-base font-black text-slate-900 leading-tight truncate">{patient.babyName}</h1>
                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold rounded-md font-mono mt-0.5">
                  {medicalRecordNo}
                </span>
              </div>
            </div>

            {/* Baby Details */}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">{patient.babyName}</h1>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[11px] sm:text-xs font-bold rounded-lg font-mono shrink-0">
                  {medicalRecordNo}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium flex-wrap">
                <span>Orang Tua: <strong className="text-slate-800 font-semibold">{patient.motherName} & {patient.fatherName}</strong></span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="text-teal-700 font-medium whitespace-nowrap">📍 {roomInfo}</span>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] sm:text-[11px] font-bold rounded-full flex items-center gap-1 shrink-0">
                  <Check className="w-3 h-3" /> Status Portal Ortu: STABIL
                </span>
                {patient.milestones.bayiSementaraPemantauanKetat && (
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] sm:text-[11px] font-bold rounded-full shrink-0">
                    ⚠️ PEMANTAUAN KETAT
                  </span>
                )}
                {patient.milestones.bolehPulang && patient.status !== 'Sudah Pulang' && (
                  <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-extrabold text-[10px] sm:text-[11px] rounded-full shadow-xs animate-pulse shrink-0">
                    🎉 SIAP & BOLEH PULANG
                  </span>
                )}
                {patient.status === 'Sudah Pulang' && (
                  <span className="px-2.5 py-0.5 bg-amber-600 text-white font-extrabold text-[10px] sm:text-[11px] rounded-full shrink-0">
                    🎓 ALUMNI NICU
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Right */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => onOpenCredentials(patient)}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
            >
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
              <span className="whitespace-nowrap">Link Ortu & Pass</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSouvenirModalOpen(true)}
              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" />
              <span className="whitespace-nowrap">Neo Smart Progress Card</span>
            </button>

            {patient.status === 'Sudah Pulang' ? (
              onCancelDischargePatient && (
                <button
                  type="button"
                  onClick={() => onCancelDischargePatient(patient)}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                >
                  <RotateCcwIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="whitespace-nowrap">Batalkan Pulang</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setIsDischargeModalOpen(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 shrink-0" />
                <span className="whitespace-nowrap">Set Pulang (Alumni)</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. TOP METRIC CARDS ROW (3 Dark Theme Styled Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Umur Bayi Real-time */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800 flex items-start gap-3.5">
            <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                Umur Bayi Real-Time
              </div>
              <div className="text-sm sm:text-base font-black text-white leading-tight truncate">
                {ageDuration.displayString}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Lahir: {formatDateTimeWithTime(patient.birthDate)}
              </div>
            </div>
          </div>

          {/* Card 2: Lama Perawatan NICU */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800 flex items-start gap-3.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                Lama Perawatan NICU
              </div>
              <div className="text-sm sm:text-base font-black text-white leading-tight truncate">
                {stayDuration.displayString}
              </div>
              {/* Waktu Masuk - BISA DIKLIK & DICUSTOM */}
              <div
                onClick={() => {
                  setCustomTimeModalTab('admission');
                  setIsCustomTimeModalOpen(true);
                }}
                className="mt-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] text-slate-200 hover:text-white font-medium flex items-center justify-between gap-1.5 cursor-pointer transition-all border border-white/10 hover:border-white/30 group/adm"
                title="Klik untuk Sesuaikan / Custom Waktu Masuk"
              >
                <span className="truncate">
                  Masuk: {admissionInfo ? admissionInfo.fullDisplay : formatDateTimeWithTime(patient.admissionDate)}
                </span>
                <span className="shrink-0 flex items-center gap-1 text-[10px] text-teal-300 group-hover/adm:underline font-bold">
                  <span>Edit Waktu</span>
                  <Pencil className="w-2.5 h-2.5" />
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Aturan Jadwal Progress */}
          <div className="p-4 bg-teal-950 text-white rounded-2xl shadow-sm border border-teal-850 flex items-start gap-3.5">
            <div className="p-2.5 bg-teal-500/20 text-teal-300 rounded-xl shrink-0 mt-0.5">
              <Activity className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-teal-300">
                Aturan Jadwal Progress (NSPC)
              </div>
              <div className="text-sm sm:text-base font-black text-white leading-tight truncate">
                {isAterm ? 'Aterm (≥37 Mgg) • Input Harian' : 'Preterm (<36 Mgg) • Input Mingguan'}
              </div>
              <div className="text-[11px] text-teal-200/80 font-medium">
                Gestasi saat lahir: {patient.gestationalAgeWeeks} minggu
              </div>
            </div>
          </div>
        </div>

        {/* BANNER WAKTU SIAP PULANG (DAPAT DI-CUSTOM) */}
        {(patient.status === 'Siap Pulang' || isMilestoneChecked(patient.milestones, 'SIAP & BOLEH PULANG', 'bolehPulang')) && patient.status !== 'Sudah Pulang' && (
          <div
            onClick={() => {
              setCustomTimeModalTab('discharge');
              setIsCustomTimeModalOpen(true);
            }}
            className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 rounded-2xl text-white border border-emerald-500/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 animate-fadeIn cursor-pointer hover:border-emerald-400 transition-all group"
            title="Klik untuk Sesuaikan / Custom Waktu Pulang"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-amber-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                    Status Pasien: Siap Pulang
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-200 rounded-full text-[10px] font-extrabold border border-emerald-400/30">
                    ✓ Medis Memenuhi Syarat
                  </span>
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                  Waktu Siap Pulang:{' '}
                  <span className="text-amber-300 underline font-black">
                    {patient.readyToDischargeDate ? formatDateTimeWithTime(patient.readyToDischargeDate) : formatDateTimeWithTime(new Date().toISOString().split('T')[0])}{' '}
                    {patient.readyToDischargeTime ? `• Pukul ${patient.readyToDischargeTime} WITA` : '• Pukul 10:00 WITA'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  Waktu kepulangan ini dapat disesuaikan (custom) dan tampil secara sinkron di portal monitoring orang tua.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCustomTimeModalTab('discharge');
                setIsCustomTimeModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Clock className="w-4 h-4" />
              <span>Sesuaikan / Custom Waktu</span>
            </button>
          </div>
        )}

        {/* BANNER ALUMNI SUDAH PULANG */}
        {patient.status === 'Sudah Pulang' && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-xs text-amber-950 shadow-2xs">
            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-amber-950">Alumni NICU RSUD Undata (Sudah Pulang)</span>
                <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 rounded-full text-[9px] font-black">LULUS</span>
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5 font-medium">
                Telah menyelesaikan seluruh masa perawatan NICU dan lulus medis secara sehat.
              </p>
            </div>
          </div>
        )}

        {/* MODAL CUSTOM WAKTU (MASUK MAUPUN PULANG) */}
        <CustomTimeModal
          isOpen={isCustomTimeModalOpen}
          onClose={() => setIsCustomTimeModalOpen(false)}
          patient={patient}
          initialTab={customTimeModalTab}
          onSave={async (updated, msg) => {
            onUpdatePatient(updated);
            setSuccessBanner(msg);
            setTimeout(() => setSuccessBanner(null), 4500);
          }}
        />

        {/* 3. HORIZONTAL NAVIGATION TABS */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-2xs flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('antropometri')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'antropometri'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Profil & Antropometri Awal</span>
          </button>

          <button
            onClick={() => setActiveTab('progres')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'progres'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Data Perkembangan & Input Progres ({progressLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('alat')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'alat'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Alat Kesehatan ({patient.currentEquipment.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('edukasi')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'edukasi'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Rekomendasi Edukasi PDF ({patientEducationPdfs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('imunisasi')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'imunisasi'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Imunisasi & Status Pulang</span>
          </button>
        </div>

        {/* 4. TAB CONTENTS */}
        {/* TAB 1: PROFIL & ANTROPOMETRI AWAL */}
        {activeTab === 'antropometri' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Box Left: Antropometri Masuk */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-teal-800 font-bold border-b border-slate-100 pb-3">
                <Scale className="w-5 h-5 text-teal-600" />
                <h3 className="text-base">Ukuran Antropometri Saat Masuk NICU</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[11px] text-slate-500 font-semibold">Berat Badan Masuk:</div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {patient.initialAnthropometry.weightGram} g <span className="text-xs text-slate-500 font-medium">({(patient.initialAnthropometry.weightGram/1000).toFixed(2)} kg)</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[11px] text-slate-500 font-semibold">Panjang Badan Masuk:</div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {patient.initialAnthropometry.lengthCm} cm
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[11px] text-slate-500 font-semibold">Lingkar Kepala:</div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {patient.initialAnthropometry.headCircumferenceCm} cm
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[11px] text-slate-500 font-semibold">Lingkar Dada:</div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {patient.initialAnthropometry.chestCircumferenceCm} cm
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[11px] text-slate-500 font-semibold">Lingkar Perut:</div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {patient.initialAnthropometry.abdominalCircumferenceCm ?? Math.round(patient.initialAnthropometry.chestCircumferenceCm * 0.95)} cm
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[11px] text-slate-500 font-semibold">LILA (Lingkar Lengan Atas):</div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {patient.initialAnthropometry.upperArmCircumferenceCm ?? (patient.initialAnthropometry.headCircumferenceCm * 0.3).toFixed(1)} cm
                  </div>
                </div>
              </div>
            </div>

            {/* Box Right: Ringkasan Perkembangan Terkini */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-teal-800 font-bold border-b border-slate-100 pb-3">
                <Sparkles className="w-5 h-5 text-teal-600" />
                <h3 className="text-base">Ringkasan Perkembangan Terkini</h3>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-800 font-semibold">Berat Badan Terkini:</div>
                  <div className="text-2xl font-black text-emerald-950 mt-0.5">
                    {latestWeight} g <span className="text-sm font-medium">({(latestWeight/1000).toFixed(2)} kg)</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Perubahan Total:</div>
                  <div className={`text-base font-black ${weightGainTotal >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {weightGainTotal >= 0 ? `+${weightGainTotal}` : weightGainTotal} g
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                <div className="font-bold text-slate-800">Aturan Penginputan NSPC:</div>
                <p className="text-slate-600 leading-relaxed">
                  Pasien {isAterm ? 'Aterm (≥37 minggu) -> Evaluasi & Input perkembangan dilakukan setiap HARI.' : 'Preterm (<36 minggu) -> Evaluasi & Input perkembangan dilakukan setiap MINGGU.'}
                </p>
              </div>

              <div className="p-3.5 bg-teal-50/60 rounded-2xl border border-teal-100 space-y-1 text-xs">
                <div className="font-bold text-teal-900">Akses Private Orang Tua:</div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-600 font-medium">Nickname & Pass:</span>
                  <span className="font-mono font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200">
                    {patient.nickname} / {patient.accessPassword}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DATA PERKEMBANGAN & FORM INPUT PROGRES */}
        {activeTab === 'progres' && (
          <div className="space-y-6">
            
            {/* FORM INPUT PROGRES BARU */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-teal-200/80 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2 text-teal-800 font-black">
                  <Plus className="w-5 h-5 text-teal-600" />
                  <h3 className="text-lg">Form Input Progres {isAterm ? 'Harian' : 'Mingguan'} Baru</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-teal-50 text-teal-700 font-bold px-3 py-1 rounded-full border border-teal-200">
                    {periodLabel}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveNewLog} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tanggal Evaluasi</label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Label Periode</label>
                    <input
                      type="text"
                      value={periodLabel}
                      onChange={(e) => setPeriodLabel(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                      placeholder="e.g. Hari ke-5 / Minggu ke-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Berat Badan Terkini (Gram)</label>
                    <input
                      type="number"
                      value={logWeight}
                      onChange={(e) => setLogWeight(e.target.value)}
                      className="w-full p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl font-black text-emerald-900"
                      placeholder="1850"
                      required
                    />
                  </div>
                </div>

                {/* VITAL SIGNS GRID */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-teal-600" />
                    <span>Tanda-Tanda Vital (Vitals Signs)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Suhu (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={temp}
                        onChange={(e) => setTemp(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Heart Rate (bpm)</label>
                      <input
                        type="number"
                        value={hr}
                        onChange={(e) => setHr(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Laju Napas (x/mnt)</label>
                      <input
                        type="number"
                        value={rr}
                        onChange={(e) => setRr(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">SpO2 (%)</label>
                      <input
                        type="number"
                        value={spo2}
                        onChange={(e) => setSpo2(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* DRINKING ABILITY */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-teal-600" />
                    <span>Asupan & Metode Minum</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Metode Minum</label>
                      <select
                        value={drinkMethod}
                        onChange={(e) => setDrinkMethod(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold"
                      >
                        <option value="OGT/Sonde">OGT/Sonde</option>
                        <option value="Sendok/Cup Feeder">Sendok/Cup Feeder</option>
                        <option value="Menyusu Langsung (DBF)">Menyusu Langsung (DBF)</option>
                        <option value="Kombinasi">Kombinasi</option>
                        <option value="NPO / Puasa sementara">NPO / Puasa sementara</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Volume (cc / minum)</label>
                      <input
                        type="number"
                        value={drinkCc}
                        onChange={(e) => setDrinkCc(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Frekuensi (x / hari)</label>
                      <input
                        type="number"
                        value={drinkFreq}
                        onChange={(e) => setDrinkFreq(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* MILESTONE & STATUS PULANG CHECKLIST */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                  <div className="font-bold text-slate-800 flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-1.5 text-teal-800">
                      <ShieldCheck className="w-4 h-4 text-teal-600" />
                      <span className="font-extrabold text-sm">Checklist Milestone Perkembangan & Status Pulang</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MILESTONE_CHECKLIST_DEFINITIONS.map((def) => {
                      const isChecked = isMilestoneChecked(logMilestones, def.title, def.id);
                      return (
                        <label
                          key={def.id}
                          className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-100/80 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleMilestoneToggle(def.title, def.id)}
                            className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                          />
                          <span className={`font-semibold ${def.isWarning ? 'text-amber-800' : 'text-slate-800'}`}>
                            {def.title}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* DEDICATED HIGHLIGHTED BOX FOR SIAP & BOLEH PULANG */}
                  <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 border-2 border-emerald-300/80 rounded-2xl shadow-xs">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isMilestoneChecked(logMilestones, BOLEH_PULANG_DEFINITION.title, BOLEH_PULANG_DEFINITION.id)}
                        onChange={() => handleMilestoneToggle(BOLEH_PULANG_DEFINITION.title, BOLEH_PULANG_DEFINITION.id)}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-5 h-5 cursor-pointer accent-emerald-600 shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-emerald-950 text-sm">🎉 SIAP & BOLEH PULANG</span>
                          <span className="px-2.5 py-0.5 bg-emerald-600 text-white text-[10px] font-extrabold rounded-full">
                            Syarat Utama Filter Boleh Pulang
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 font-medium mt-1 leading-relaxed">
                          Centang indikator ini untuk memindahkan pasien ke status/filter <strong>"Siap Pulang"</strong>.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* MILESTONE CHIPS SELECTOR FOR THIS LOG */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
                  <div className="font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-teal-800">
                      <Award className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="font-extrabold text-xs sm:text-sm">Tag Milestone Log Perkembangan Ini</span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-normal">Tampil sebagai Badge di Riwayat Log</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {logMilestonesChips.map((m, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-teal-100 text-teal-900 border border-teal-300 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs">
                        <Check className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        <span>{m}</span>
                        <button
                          type="button"
                          onClick={() => setLogMilestonesChips(logMilestonesChips.filter((_, i) => i !== idx))}
                          className="hover:bg-teal-200 p-0.5 rounded-full cursor-pointer transition-colors"
                        >
                          <X className="w-3 h-3 text-teal-800" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Preset recommendations */}
                  <div className="pt-1">
                    <p className="text-[11px] text-slate-500 font-semibold mb-1">Pilih Rekomendasi Milestone:</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PRESET_MILESTONES.filter(preset => !logMilestonesChips.includes(preset)).map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLogMilestonesChips([...logMilestonesChips, preset])}
                          className="px-2 py-0.5 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 text-teal-600 shrink-0" />
                          <span>{preset}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom milestone input */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customMilestoneInput}
                      onChange={(e) => setCustomMilestoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customMilestoneInput.trim()) {
                            setLogMilestonesChips([...logMilestonesChips, customMilestoneInput.trim()]);
                            setCustomMilestoneInput('');
                          }
                        }
                      }}
                      placeholder="Tambah milestone kustom..."
                      className="w-full sm:flex-1 p-2 bg-white border border-slate-200 rounded-xl font-medium text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customMilestoneInput.trim()) {
                          setLogMilestonesChips([...logMilestonesChips, customMilestoneInput.trim()]);
                          setCustomMilestoneInput('');
                        }
                      }}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all shrink-0 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Tag</span>
                    </button>
                  </div>
                </div>

                {/* NAKES NOTES & PHOTO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Catatan Nakes / Perawat</label>
                    <textarea
                      value={nakesNotes}
                      onChange={(e) => setNakesNotes(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      placeholder="Catatan kondisi harian si kecil untuk orang tua..."
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Foto Perkembangan (Opsional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="w-full p-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                    {logPhotoUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={logPhotoUrl} alt="Preview" className="w-12 h-12 object-cover rounded-xl border" />
                        <span className="text-[11px] text-emerald-700 font-bold">✓ Foto siap diunggah</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Update Progres Pasien</span>
                  </button>
                </div>
              </form>
            </div>

            {/* GRAFIK PERTUMBUHAN BERAT BADAN */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-teal-800 font-extrabold">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                  <h3 className="text-base">Grafik Pertumbuhan Berat Badan</h3>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  Awal: {initialWeight}g ➔ Terkini: {latestWeight}g
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={['dataMin - 100', 'dataMax + 100']} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs shadow-lg font-sans">
                              <div className="font-bold">{data.label}</div>
                              <div className="text-teal-300 font-extrabold">{data.weight} Gram</div>
                              <div className="text-[10px] text-slate-400">{data.date}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="weight" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#weightGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* HISTORI RIWAYAT LOG LOGGED (MATCHING EXACT UPLOADED DESIGN) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-teal-800 font-extrabold text-base sm:text-lg border-b border-slate-100 pb-3">
                <Activity className="w-5 h-5 text-teal-600" />
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Riwayat Log Perkembangan (NSPC)
                </h3>
              </div>

              {progressLogs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-medium">
                  Belum ada catatan progres harian/mingguan. Gunakan form di atas untuk menambah catatan progres.
                </div>
              ) : (
                <div className="space-y-3">
                  {progressLogs.map((log) => {
                    const milestoneChips = getLogMilestones(log);
                    const logWeightVal = Number(log.weightGram ?? (log as any).weight ?? 0);
                    const logPeriodLabel = log.periodLabel || (log as any).label || (log as any).dayLabel || 'Log Perkembangan';
                    const logDateVal = log.date || (log as any).createdAt || '';
                    const logNotes = log.nakesNotes || (log as any).notes || (log as any).note || '';
                    const logAuthor = log.updatedBy || (log as any).author || 'Ns. Perawat NICU';
                    const logVital = {
                      heartRate: log.vitalSigns?.heartRate ?? (log as any).hr ?? (log as any).heartRate ?? 138,
                      respiratoryRate: log.vitalSigns?.respiratoryRate ?? (log as any).rr ?? (log as any).respiratoryRate ?? 42,
                      spo2: log.vitalSigns?.spo2 ?? (log as any).spo2 ?? 98,
                      temperature: log.vitalSigns?.temperature ?? (log as any).temp ?? (log as any).temperature ?? 36.7,
                    };

                    return (
                      <div
                        key={log.id || String(Math.random())}
                        className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-l-[4px] border-l-teal-600 shadow-2xs space-y-2.5 font-sans relative transition-all hover:shadow-xs"
                      >
                        {/* ROW 1: Period Label (Left) & Date + Edit (Top Right) */}
                        <div className="flex items-center justify-between">
                          <h4 className="text-teal-900 font-extrabold text-sm sm:text-base">
                            {logPeriodLabel}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] sm:text-xs font-mono text-slate-400 font-semibold">
                              {logDateVal}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(log)}
                              className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[11px] font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </div>

                        {/* ROW 2: Berat Badan & Perubahan */}
                        <div className="text-xs text-slate-600 font-medium flex items-center gap-2 flex-wrap">
                          <div>
                            Berat Badan:{' '}
                            <strong className="text-slate-900 font-extrabold">
                              {logWeightVal} g ({(logWeightVal / 1000).toFixed(2)} kg)
                            </strong>
                          </div>
                          <span className="text-slate-300">•</span>
                          <div>
                            Perubahan:{' '}
                            <strong
                              className={
                                log.weightChangeGram && log.weightChangeGram > 0
                                  ? 'text-emerald-600 font-extrabold'
                                  : log.weightChangeGram && log.weightChangeGram < 0
                                  ? 'text-rose-600 font-extrabold'
                                  : 'text-rose-600 font-extrabold'
                              }
                            >
                              {log.weightChangeGram && log.weightChangeGram > 0
                                ? `+${log.weightChangeGram}g`
                                : `${log.weightChangeGram || 0}g`}
                            </strong>
                          </div>
                        </div>

                        {/* ROW 3: Vital Signs Box */}
                        <div className="p-2 sm:px-4 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs font-medium text-slate-600">
                          <div>
                            HR: <strong className="text-slate-900 font-bold">{logVital.heartRate} bpm</strong>
                          </div>
                          <div>
                            RR: <strong className="text-slate-900 font-bold">{logVital.respiratoryRate} x/m</strong>
                          </div>
                          <div>
                            SpO2: <strong className="text-slate-900 font-bold">{logVital.spo2}%</strong>
                          </div>
                          <div>
                            Suhu: <strong className="text-slate-900 font-bold">{logVital.temperature}°C</strong>
                          </div>
                        </div>

                        {/* ROW 4: Milestone Section */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-700">Milestone:</div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {milestoneChips.map((m, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-teal-50/90 text-teal-900 border border-teal-200/80 rounded-lg text-[11px] font-medium flex items-center gap-1 shadow-2xs"
                              >
                                <Check className="w-3 h-3 text-teal-600 shrink-0" />
                                <span>{m}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* ROW 5: Nakes Notes in Quotes */}
                        {logNotes && (
                          <div className="text-xs text-slate-600 italic font-medium leading-relaxed">
                            "{logNotes}"
                          </div>
                        )}

                        {/* ROW 6: Author at Bottom Right */}
                        <div className="text-right text-[11px] text-slate-400 font-medium italic">
                          Dicatat oleh: {logAuthor}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ALAT KESEHATAN */}
        {activeTab === 'alat' && (
          <div className="space-y-6 font-sans">
            {/* CARD 1: TAMBAH / PASANG JENIS ALAT KESEHATAN BARU */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-start gap-2.5 text-teal-800 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Tambah / Pasang Jenis Alat Kesehatan Baru
                  </h3>
                  <p className="text-xs text-slate-500 font-normal">
                    Nakes dapat menambahkan jenis alat kesehatan medis (Monitor TTV, CPAP, O2 Mask, Ventilator, Inkubator, dll) atau menginput nama alat kustom.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* ROW 1: SELECT JENIS ALAT MEDIS & CATATAN KLINIS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Pilih Jenis Alat Medis <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedEqPreset}
                      onChange={(e) => handleEqPresetChange(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                    >
                      {EQUIPMENT_PRESETS.map((preset) => (
                        <option key={preset.name} value={preset.name}>
                          {preset.name}
                        </option>
                      ))}
                    </select>

                    {selectedEqPreset === '+ Input Nama Alat Medis Lainnya (Kustom)' && (
                      <input
                        type="text"
                        placeholder="Ketikan nama alat medis kustom..."
                        value={customEqName}
                        onChange={(e) => setCustomEqName(e.target.value)}
                        className="w-full mt-2 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Catatan Klinis Medis Nakes
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Flow 4 L/menit, FiO2 25%, SpO2 stabil"
                      value={eqClinicalNotes}
                      onChange={(e) => setEqClinicalNotes(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                </div>

                {/* ROW 2: PENJELASAN RAMAH UNTUK ORANG TUA */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Penjelasan Ramah untuk Orang Tua (Akan tampil di Portal Orang Tua)
                  </label>
                  <textarea
                    rows={2}
                    value={eqParentExplanation}
                    onChange={(e) => setEqParentExplanation(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none leading-relaxed"
                  />
                </div>

                {/* ROW 3: CHECKBOX & BUTTON */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
                    <input
                      type="checkbox"
                      checked={isNewEqActive}
                      onChange={(e) => setIsNewEqActive(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                    />
                    <span>Langsung Aktifkan Alat pada Pasien Ini</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAddEquipmentItem}
                    className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Tambahkan Alat Medis</span>
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 2: DAFTAR ALAT KESEHATAN TERDAFTAR */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-start gap-2.5 text-teal-800">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Stethoscope className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      Daftar Alat Kesehatan Terdaftar ({registeredEquipment.length})
                    </h3>
                    <p className="text-xs text-slate-500 font-normal">
                      Perawat dapat mengaktifkan / menonaktifkan atau menghapus alat medis yang terpasang pada bayi. Penjelasan ramah akan ditampilkan otomatis pada portal orang tua.
                    </p>
                  </div>
                </div>
              </div>

              {registeredEquipment.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Belum ada alat kesehatan terdaftar untuk pasien ini. Tambahkan alat medis menggunakan form di atas.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {registeredEquipment.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl p-4 space-y-2.5 relative transition-all border ${
                        item.isActive
                          ? 'bg-emerald-50/20 border-2 border-teal-400/90 shadow-2xs'
                          : 'bg-slate-50/60 border-slate-200 opacity-90'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-black text-slate-900 text-sm sm:text-base">
                            {item.name}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">
                            {item.clinicalNotes || 'Pengawasan medis'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleEquipmentStatus(item.id)}
                            className={`px-3 py-1 text-[11px] font-black rounded-full transition-all cursor-pointer shadow-2xs ${
                              item.isActive
                                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                            }`}
                          >
                            {item.isActive ? '✓ AKTIF' : 'NON-AKTIF'}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteEquipmentItem(item.id)}
                            className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Hapus Alat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600 font-medium leading-relaxed">
                        <strong className="text-teal-700 font-bold">Penjelasan untuk Ortu:</strong>{' '}
                        <span className="italic">"{item.parentExplanation}"</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: REKOMENDASI EDUKASI PDF */}
        {activeTab === 'edukasi' && (
          <div className="space-y-6 font-sans">
            {/* INFORMATION BANNER: SELEKSI EDUKASI PASIEN */}
            <div className="p-4 bg-teal-50/80 border border-teal-200/90 rounded-3xl flex items-start gap-3.5 shadow-2xs">
              <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Pengaturan Rekomendasi Edukasi Pasien Ini
                </h4>
                <p className="text-slate-600 leading-relaxed font-medium mt-0.5">
                  Di bawah ini adalah modul & panduan PDF edukasi untuk <strong>{patient.babyName}</strong>. Anda dapat mengaktifkan/menonaktifkan modul mana yang tampil di Dashboard Orang Tua, melihat pratinjau, atau mengunduh berkas.
                </p>
              </div>
            </div>

            {/* FILTER & SEARCH CARD (MATCHING EXACT DESIGN) */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-xs font-black text-slate-800 shrink-0 mr-1 flex items-center gap-1.5">
                  <Folder className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                  <span>Kategori:</span>
                </span>

                {pdfCategories.map((cat) => {
                  const count =
                    cat === 'Semua'
                      ? patientEducationPdfs.length
                      : patientEducationPdfs.filter((p) => p.category === cat).length;
                  const isActive = pdfSelectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPdfSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-teal-800 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                          isActive ? 'bg-teal-700 text-emerald-200' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search, Filter Status, and View Toggle */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                {/* Search Input */}
                <div className="relative w-full lg:max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari modul / catatan edukasi..."
                    value={pdfSearchQuery}
                    onChange={(e) => setPdfSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 justify-between lg:justify-end w-full lg:w-auto">
                  {/* Status Filter (Semua, Tampil di Ortu, Sembunyi) */}
                  <div className="flex items-center justify-between sm:justify-start gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-bold overflow-x-auto no-scrollbar scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setPdfFilter('all')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap text-[11px] sm:text-xs shrink-0 ${
                        pdfFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua ({patientEducationPdfs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfFilter('active')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:text-xs shrink-0 ${
                        pdfFilter === 'active'
                          ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span>Tampil ({activePdfsCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfFilter('inactive')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:text-xs shrink-0 ${
                        pdfFilter === 'inactive'
                          ? 'bg-white text-rose-800 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                      <span>Sembunyi ({inactivePdfsCount})</span>
                    </button>
                  </div>

                  {/* View Mode Toggle: Galeri Grid vs Daftar Nomor */}
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-xs font-bold text-slate-500">Tampilan:</span>
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPdfViewMode('grid')}
                        className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                          pdfViewMode === 'grid'
                            ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Tampilan Galeri Grid"
                      >
                        <Grid className="w-3.5 h-3.5 shrink-0" />
                        <span>Galeri Grid</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPdfViewMode('list')}
                        className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                          pdfViewMode === 'list'
                            ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Tampilan Daftar Nomor"
                      >
                        <List className="w-3.5 h-3.5 shrink-0" />
                        <span>Daftar Nomor</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARDS DISPLAY: GRID OR LIST */}
            {filteredPdfs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                Tidak ada dokumen PDF edukasi yang cocok dengan pencarian atau filter ini.
              </div>
            ) : pdfViewMode === 'grid' ? (
              /* GRID GALLERY VIEW (5 COLUMNS ON DESKTOP) */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4.5 sm:gap-5">
                {filteredPdfs.map((pdf, index) => {
                  const coverImg =
                    pdfRenderedCovers[pdf.id] ||
                    pdf.coverImageUrl ||
                    generateFallbackPdfCover(pdf.title, pdf.category);
                  return (
                    <EducationPdfCard
                      key={pdf.id}
                      pdf={pdf}
                      coverImage={coverImg}
                      positionNumber={index + 1}
                      onOpenPreview={() => setPreviewPdfItem(pdf)}
                      onDownload={() => handleDownloadPdf(pdf)}
                      onToggleActive={() => togglePdfActive(pdf.id)}
                      onDelete={() => promptDeletePdfItem(pdf.id, pdf.title)}
                      isNakesAdmin={true}
                    />
                  );
                })}
              </div>
            ) : (
              /* LIST LAYOUT (HORIZONTAL RECTANGULAR CARDS WITH SEQUENTIAL NUMBERING) */
              <div className="space-y-4">
                {filteredPdfs.map((pdf, index) => (
                  <div
                    key={pdf.id}
                    className={`p-4 sm:p-5 rounded-2xl border-2 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-all ${
                      pdf.isActive ? 'bg-white border-emerald-400/80' : 'bg-slate-50 border-slate-200 opacity-85'
                    }`}
                  >
                    {/* Left Section: Number + Content */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Sequential Numbering Badge */}
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-800 text-white font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                        {index + 1}
                      </div>

                      {/* Main Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Header Meta: Category Badge & Date & Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 bg-emerald-100/90 text-emerald-800 text-[11px] font-black rounded-lg flex items-center gap-1.5">
                            <Folder className="w-3.5 h-3.5 text-emerald-700 fill-emerald-700 shrink-0" />
                            <span>{pdf.category}</span>
                          </span>
                          <span className="text-xs text-slate-400 font-bold">
                            {pdf.publishedAt}
                          </span>

                          <button
                            type="button"
                            onClick={() => togglePdfActive(pdf.id)}
                            className={`px-2.5 py-0.5 text-[11px] font-extrabold rounded-full transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ml-auto md:ml-0 ${
                              pdf.isActive
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                            }`}
                            title="Klik untuk memilih apakah PDF ini tampil di Dashboard Orang Tua"
                          >
                            {pdf.isActive ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                <span>✓ TAMPIL DI ORTU</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                <span>SEMBUNYI</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* PDF Title */}
                        <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-snug">
                          {pdf.title}
                        </h3>

                        {/* File Metadata */}
                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate">{pdf.fileName}</span>
                          <span className="shrink-0 font-bold text-slate-400">({pdf.fileSizeText})</span>
                        </div>

                        {/* Nakes Note Box */}
                        {pdf.nakesNote && (
                          <div className="mt-2 bg-emerald-50/80 border border-emerald-100 rounded-xl p-3 space-y-0.5">
                            <div className="text-[10px] font-black tracking-wider text-teal-800 uppercase">
                              CATATAN KHUSUS NAKES:
                            </div>
                            <div className="text-xs text-slate-700 font-medium italic leading-relaxed max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-300 select-text">
                              "{pdf.nakesNote}"
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Section: Action Buttons */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPreviewPdfItem(pdf)}
                        className="flex-1 md:flex-none py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-4 h-4 text-teal-600" />
                        <span>Pratinjau</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(pdf)}
                        className="flex-1 md:flex-none py-2.5 px-4 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Download className="w-4 h-4 text-emerald-300" />
                        <span>Unduh PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => promptDeletePdfItem(pdf.id, pdf.title)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                        title="Hapus PDF"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PREVIEW MODAL FOR NAKES PROGRESS VIEW (DIRECT LIGHTBOX) */}
            <EducationLightboxModal
              pdf={previewPdfItem}
              onClose={() => setPreviewPdfItem(null)}
              onDownload={(pdf) => handleDownloadPdf(pdf)}
            />
          </div>
        )}

        {/* TAB 5: IMUNISASI & STATUS PULANG */}
        {activeTab === 'imunisasi' && (
          <div className="space-y-6 font-sans">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-5">
              {/* Header */}
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Catatan Perkembangan Akhir & Status Kepulangan
                  </h3>
                  <p className="text-xs text-slate-500 font-normal">
                    Rekap histori imunisasi dasar, hasil skrining neonatus lengkap (HB0, SHK, ROP, OAE, PJB), dan ringkasan pemulangan medis.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveImmunizationDischarge} className="space-y-5 text-xs">
                {/* ROW 1: HB0 & SHK */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: HB0 */}
                  <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                    <label className="block font-bold text-slate-800 text-xs">
                      Vaksin Imunisasi HB 0
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hb0Given}
                          onChange={(e) => setHb0Given(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span>Sudah Diberikan</span>
                      </label>

                      <input
                        type="date"
                        value={hb0Date}
                        onChange={(e) => setHb0Date(e.target.value)}
                        className="p-2 bg-white border border-slate-300 rounded-xl font-semibold text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Card 2: SHK */}
                  <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                    <label className="block font-bold text-slate-800 text-xs">
                      Skrining Hipotiroid Kongenital (SHK)
                    </label>
                    <select
                      value={shkStatus}
                      onChange={(e) => setShkStatus(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                    >
                      <option value="Belum Diperiksa">Belum Diperiksa</option>
                      <option value="Sampel Darah Tumit Diberikan">Sampel Darah Tumit Diberikan</option>
                      <option value="Hasil Normal">Hasil Normal</option>
                      <option value="Perlu Evaluasi Lanjutan">Perlu Evaluasi Lanjutan</option>
                    </select>
                  </div>
                </div>

                {/* ROW 2: ROP & OAE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 3: ROP */}
                  <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                    <label className="block font-bold text-slate-800 text-xs">
                      Skrining Mata (ROP)
                    </label>
                    <select
                      value={ropStatus}
                      onChange={(e) => setRopStatus(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                    >
                      <option value="Belum Diperiksa">Belum Diperiksa</option>
                      <option value="Sudah Diperiksa Dokter Spesialis Mata">Sudah Diperiksa Dokter Spesialis Mata</option>
                      <option value="Stage 0 / Normal">Stage 0 / Normal</option>
                      <option value="Perlu Pengawasan Dokter Mata">Perlu Pengawasan Dokter Mata</option>
                    </select>
                  </div>

                  {/* Card 4: OAE */}
                  <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                    <label className="block font-bold text-slate-800 text-xs">
                      Skrining Pendengaran (OAE)
                    </label>
                    <select
                      value={oaeStatus}
                      onChange={(e) => setOaeStatus(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                    >
                      <option value="Belum Diperiksa">Belum Diperiksa</option>
                      <option value="Bilateral PASS (Normal)">Bilateral PASS (Normal)</option>
                      <option value="REFER (Perlu Pemeriksaan Ulang)">REFER (Perlu Pemeriksaan Ulang)</option>
                    </select>
                  </div>
                </div>

                {/* ROW 3: PJB */}
                <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                  <label className="block font-bold text-slate-800 text-xs">
                    Skrining PJB (Penyakit Jantung Bawaan)
                  </label>
                  <div className="space-y-2">
                    <select
                      value={pjbStatus}
                      onChange={(e) => setPjbStatus(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                    >
                      <option value="PASS (Lolos Skrining Oksimetri PJB)">PASS (Lolos Skrining Oksimetri PJB)</option>
                      <option value="REFER (Perlu Konsul Spesialis Jantung)">REFER (Perlu Konsul Spesialis Jantung)</option>
                      <option value="Belum Diperiksa">Belum Diperiksa</option>
                    </select>

                    <input
                      type="text"
                      value={pjbNote}
                      onChange={(e) => setPjbNote(e.target.value)}
                      placeholder="SpO2 tangan kanan 99%, kaki 99% (Lolos Skrining Oksimetri PJB)"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                </div>

                {/* ROW 4: DISCHARGE SUMMARY NOTE */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800 text-xs">
                    Catatan Ringkasan Pulang (Discharge Summary)
                  </label>
                  <textarea
                    rows={3}
                    value={dischargeSummaryText}
                    onChange={(e) => setDischargeSummaryText(e.target.value)}
                    placeholder="Kondisi bayi menunjukkan kemajuan pesat. Target berat badan pulang: 2000 gram."
                    className="w-full p-3 bg-slate-50/60 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* SAVE BUTTON */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-emerald-400" />
                    <span>Simpan Catatan Medis</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT LOG MODAL */}
        {editingLog && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-teal-800 font-extrabold">
                  <Edit3 className="w-5 h-5 text-teal-600" />
                  <h3 className="text-base font-bold text-slate-900">Edit Log Progres ({editPeriodLabel})</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditLog} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tanggal</label>
                    <input
                      type="date"
                      value={editLogDate}
                      onChange={(e) => setEditLogDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Label Periode</label>
                    <input
                      type="text"
                      value={editPeriodLabel}
                      onChange={(e) => setEditPeriodLabel(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Berat Badan (Gram)</label>
                    <input
                      type="number"
                      value={editLogWeight}
                      onChange={(e) => setEditLogWeight(e.target.value)}
                      className="w-full p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl font-bold text-emerald-900"
                      required
                    />
                  </div>
                </div>

                {/* Vitals Grid */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-800">Tanda-Tanda Vital (Vitals Signs)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">Suhu (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editTemp}
                        onChange={(e) => setEditTemp(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">HR (bpm)</label>
                      <input
                        type="number"
                        value={editHr}
                        onChange={(e) => setEditHr(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">RR (x/mnt)</label>
                      <input
                        type="number"
                        value={editRr}
                        onChange={(e) => setEditRr(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">SpO2 (%)</label>
                      <input
                        type="number"
                        value={editSpo2}
                        onChange={(e) => setEditSpo2(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Milestone Chips for Edit */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-800">Tag Milestone Log Ini</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {editMilestonesChips.map((m, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-teal-100 text-teal-900 border border-teal-300 rounded-lg font-bold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-teal-700" />
                        <span>{m}</span>
                        <button
                          type="button"
                          onClick={() => setEditMilestonesChips(editMilestonesChips.filter((_, i) => i !== idx))}
                          className="hover:bg-teal-200 p-0.5 rounded-full cursor-pointer transition-colors"
                        >
                          <X className="w-3 h-3 text-teal-800" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Preset recommendation buttons */}
                  <div className="pt-1">
                    <p className="text-[11px] text-slate-500 font-semibold mb-1">Rekomendasi Presets:</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PRESET_MILESTONES.filter(preset => !editMilestonesChips.includes(preset)).map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditMilestonesChips([...editMilestonesChips, preset])}
                          className="px-2 py-0.5 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 text-teal-600" />
                          <span>{preset}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={editCustomMilestoneInput}
                      onChange={(e) => setEditCustomMilestoneInput(e.target.value)}
                      placeholder="Tambah milestone kustom..."
                      className="flex-1 p-2 bg-white border border-slate-200 rounded-xl font-medium text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editCustomMilestoneInput.trim()) {
                          setEditMilestonesChips([...editMilestonesChips, editCustomMilestoneInput.trim()]);
                          setEditCustomMilestoneInput('');
                        }
                      }}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </div>

                {/* Catatan Nakes */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan Nakes / Perawat</label>
                  <textarea
                    value={editNakesNotes}
                    onChange={(e) => setEditNakesNotes(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleDeleteLog(editingLog.id)}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Log</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingLog(null)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT PATIENT MODAL (POPUP EDIT PROFILE ADMIN) */}
        {isEditPatientModalOpen && (
          <EditPatientModal
            patient={patient}
            isOpen={isEditPatientModalOpen}
            onClose={() => setIsEditPatientModalOpen(false)}
            onSaveSuccess={(updated) => {
              onUpdatePatient(updated);
              setIsEditPatientModalOpen(false);
              setSuccessBanner(`✓ Profil pasien ${updated.babyName} & data orang tua berhasil diperbarui!`);
              setTimeout(() => setSuccessBanner(null), 3500);
            }}
          />
        )}

        {/* SOUVENIR CARD MODAL (POPUP NEO SMART PROGRESS CARD) */}
        {isSouvenirModalOpen && (
          <SouvenirCardModal
            patient={patient}
            isOpen={isSouvenirModalOpen}
            onClose={() => setIsSouvenirModalOpen(false)}
          />
        )}

        {/* DISCHARGE MODAL (POPUP SET PULANG ALUMNI) */}
        {isDischargeModalOpen && (
          <DischargeModal
            patient={patient}
            isOpen={isDischargeModalOpen}
            onClose={() => setIsDischargeModalOpen(false)}
            onConfirmDischarge={(patientToDischarge) => {
              onUpdatePatient(patientToDischarge);
              if (onDischargePatient) {
                onDischargePatient(patientToDischarge);
              }
              setIsDischargeModalOpen(false);
              setSuccessBanner(`🎉 Status ${patient.babyName} berhasil diperbarui menjadi Alumni (Sudah Pulang)!`);
              setTimeout(() => setSuccessBanner(null), 4000);
            }}
          />
        )}

        {/* POP UP CONFIRMATION MODAL HAPUS PDF */}
        {deletePdfModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[10000] animate-fadeIn font-sans">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 relative">
              <button
                type="button"
                onClick={() => setDeletePdfModal({ isOpen: false, pdfId: '', title: '' })}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-inner">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    Hapus File PDF Edukasi Pasien?
                  </h3>
                  <p className="text-xs text-rose-600 font-bold mt-0.5">Konfirmasi Hapus Berkas</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 leading-relaxed font-medium space-y-2">
                <p>Apakah Anda yakin ingin menghapus dokumen PDF edukasi ini dari rekam medis pasien ini?</p>
                {deletePdfModal.title && (
                  <div className="pt-2 border-t border-slate-200/80 text-[11px] font-mono text-slate-800 font-bold truncate">
                    Judul Modul: <span className="text-rose-700">{deletePdfModal.title}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletePdfModal({ isOpen: false, pdfId: '', title: '' })}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePdfItem}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus File</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const LOCAL_DISCHARGE_TEMPLATES = [
  {
    title: '🎓 Ucapan Kelulusan & Apresiasi',
    badge: 'Populer',
    text: 'Selamat Bunda & Ayah! Si kecil telah berjuang dengan sangat luar biasa di ruang NICU. Hari ini si kecil resmi lulus medis dan siap tumbuh berkembang dengan sehat dan ceria bersama keluarga tercinta di rumah.'
  },
  {
    title: '🍼 Edukasi Nutrisi & Perawatan',
    badge: 'Medis',
    text: 'Alhamdulillah, kondisi si kecil sudah sangat stabil, refleks hisap membaik, dan toleransi minum lancar. Tetap jaga kebersihan lingkungan rumah, berikan ASI eksklusif, dan lakukan kontrol rutin sesuai jadwal.'
  },
  {
    title: '💖 Metode Kanguru (PMK) & Bonding',
    badge: 'Perawatan',
    text: 'Si kecil telah siap membawa kehangatan ke rumah. Lanjutkan Perawatan Metode Kanguru (PMK) serta balutan kasih sayang Ayah & Bunda untuk mendukung tumbuh kembang optimal si kecil.'
  },
  {
    title: '🌟 Doa & Harapan Tim Medis',
    badge: 'Harapan',
    text: 'Terima kasih atas kerja sama dan kepercayaan Ayah & Bunda kepada Tim Medis NICU RSUD Undata. Semoga si kecil senantiasa sehat, tumbuh menjadi anak yang kuat, cerdas, dan selalu membawa kebahagiaan.'
  }
];

interface DischargeModalProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDischarge: (patientToDischarge: Patient) => void;
}

export const DischargeModal: React.FC<DischargeModalProps> = ({
  patient,
  isOpen,
  onClose,
  onConfirmDischarge,
}) => {
  const [dischargeDate, setDischargeDate] = useState<string>(
    patient.dischargeDate || new Date().toISOString().split('T')[0]
  );
  const [dischargeTime, setDischargeTime] = useState<string>(
    patient.dischargeTime || new Date().toTimeString().slice(0, 5)
  );
  const [doctorDpjp, setDoctorDpjp] = useState<string>(
    patient.dpjpDoctor || 'DPJP: Hasni Hilipito. S. Kep,. Ns'
  );
  const [note, setNote] = useState<string>(
    patient.immunizationDischarge?.dischargeSummaryNote ||
    'Selamat! Si kecil telah memenuhi syarat indikator medis dan dinyatakan LULUS dari NICU RSUD Undata.'
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Patient = {
      ...patient,
      status: 'Sudah Pulang',
      dischargeDate,
      dischargeTime,
      dpjpDoctor: doctorDpjp,
      immunizationDischarge: {
        ...(patient.immunizationDischarge || {
          hb0VaccineGiven: false,
          shkScreening: 'Belum Diperiksa',
          ropScreening: 'Belum Diperiksa',
          oaeScreening: 'Belum Diperiksa',
          pjbScreeningResult: 'Belum Diperiksa',
        }),
        dischargeSummaryNote: note,
      },
    };
    onConfirmDischarge(updated);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all my-auto">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-teal-600 to-teal-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/30 border border-amber-300/40 backdrop-blur-xs flex items-center justify-center text-amber-100 shrink-0 shadow-xs">
              <GraduationCap className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight text-white">
                Konfirmasi Set Pulang Pasien
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                Proses Kelulusan NICU &amp; Kepulangan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white font-bold p-1.5 rounded-full hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Patient Summary Card */}
          <div className="p-3.5 bg-teal-50/70 rounded-2xl border border-teal-100/90 flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-xl border border-teal-200 overflow-hidden shrink-0 bg-white shadow-2xs flex items-center justify-center">
              <img
                src={
                  patient.coverPhotoUrl ||
                  patient.dailyLogs.find((l) => l.photoUrl)?.photoUrl ||
                  'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&auto=format&fit=crop&q=80'
                }
                alt={patient.babyName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <h4 className="font-extrabold text-slate-900 text-sm truncate">
                  {patient.babyName.startsWith('By.') ? patient.babyName : `By. Ny. ${patient.motherName}`}
                </h4>
                <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-md shrink-0">
                  {patient.medicalRecordNumber || `RM-${patient.id.padStart(4, '0')}`}
                </span>
              </div>
              <p className="text-slate-600 font-medium truncate">
                Orang Tua: <strong className="text-slate-800">{patient.motherName} &amp; {patient.fatherName}</strong>
              </p>
              <p className="text-teal-700 font-semibold mt-0.5 flex items-center gap-1 text-[11px]">
                <span>📍 {patient.roomNumber || 'Inkubator 01 - NICU RSUD Undata'}</span>
              </p>
            </div>
          </div>

          {/* Informasi Kebijakan Sistem Alert */}
          <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Informasi Kebijakan Sistem:</span>
            </div>
            <p className="leading-relaxed text-slate-700 text-[11px]">
              Status pasien akan diubah menjadi <strong className="text-slate-900">SUDAH PULANG (Alumni NICU)</strong>. Data rekam medis pasien ini akan tersimpan <strong className="text-emerald-800 font-bold">permanen di Data Alumni</strong>.
            </p>
          </div>

          {/* Tanggal & Waktu Pasien Keluar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Pasien Keluar
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:border-teal-500 outline-none"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Waktu Pasien Keluar (Jam:Menit)
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={dischargeTime}
                  onChange={(e) => setDischargeTime(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:border-teal-500 outline-none"
                />
                <Clock className="w-4 h-4 text-teal-600 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* DPJP Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dokter Penanggung Jawab (DPJP)
            </label>
            <input
              type="text"
              value={doctorDpjp}
              onChange={(e) => setDoctorDpjp(e.target.value)}
              placeholder="DPJP: Hasni Hilipito. S. Kep,. Ns"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:border-teal-500 outline-none"
            />
          </div>

          {/* Catatan Kelulusan / Pesan Dokter untuk Orang Tua */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Catatan Kelulusan / Pesan Dokter untuk Orang Tua
              </label>
              <span className="text-[10px] text-teal-700 font-extrabold bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
                4 Template Pesan
              </span>
            </div>

            {/* 4 Template Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2.5">
              {LOCAL_DISCHARGE_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNote(tmpl.text)}
                  className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    note === tmpl.text
                      ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                      : 'bg-slate-50 hover:bg-teal-50/70 border-slate-200 hover:border-teal-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`font-bold text-xs ${note === tmpl.text ? 'text-white' : 'text-teal-900'}`}>
                      {tmpl.title}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                      note === tmpl.text ? 'bg-teal-600 text-teal-100' : 'bg-teal-100 text-teal-800'
                    }`}>
                      {tmpl.badge}
                    </span>
                  </div>
                  <p className={`text-[10px] line-clamp-2 leading-tight ${
                    note === tmpl.text ? 'text-teal-100' : 'text-slate-500'
                  }`}>
                    {tmpl.text}
                  </p>
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Selamat! Si kecil telah memenuhi syarat indikator medis dan dinyatakan LULUS dari NICU RSUD Undata."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Ya, Set Pulang Sekarang</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Simple RotateCcw icon fallback if missing
function RotateCcwIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
