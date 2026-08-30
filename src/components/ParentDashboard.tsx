import React, { useState, useEffect } from 'react';
import { Patient, MedicalEquipment, DailyLog, EquipmentItem, EducationPdfItem } from '../types';
import { updatePatient, resolvePatientEducationPdfs, setMemoryGlobalPdfs, syncGlobalPdfsFromBackend, getStoredGlobalPdfs } from '../services/storage';
import {
  getPdfDataUrlSync,
  getPdfDataUrl,
  triggerPdfDownload,
  dataUrlToBlob,
} from '../services/pdfStore';
import {
  formatBabyAge,
  formatLengthOfStay,
  formatIndonesianDate,
  formatShortDate,
} from '../utils/dateUtils';
import { isMilestoneChecked } from '../utils/milestones';
import { SouvenirCardModal } from './SouvenirCardModal';
import { SelectPhotoModal } from './SelectPhotoModal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import confetti from 'canvas-confetti';
import {
  Heart,
  Calendar,
  Clock,
  Baby,
  Scale,
  Activity,
  Milk,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Stethoscope,
  Sparkles,
  Printer,
  Share2,
  TrendingUp,
  ShieldAlert,
  Info,
  ChevronRight,
  Droplet,
  Thermometer,
  Zap,
  Camera,
  Download,
  ArrowLeft,
  Check,
  FileText,
  ShieldCheck,
  BookOpen,
  Folder,
  Search,
  Eye,
  X,
  Grid,
  List,
} from 'lucide-react';
import { downloadEducationPdf } from '../utils/pdfDownload';
import { generateSamplePdfDataUrl, renderPdfFirstPageToImage, generateFallbackPdfCover } from '../services/pdfRender';
import { EducationPdfCard } from './EducationPdfCard';
import { PdfViewerCanvas } from './PdfViewerCanvas';

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

interface ParentDashboardProps {
  patient: Patient;
  onOpenPrintModal: () => void;
  onShareLink: () => void;
  onBackToNakes?: () => void;
  onBackToHome?: () => void;
  onPatientUpdated?: (updatedPatient: Patient) => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  patient,
  onOpenPrintModal,
  onShareLink,
  onBackToNakes,
  onBackToHome,
  onPatientUpdated,
}) => {
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(0);
  const [isSouvenirOpen, setIsSouvenirOpen] = useState<boolean>(false);
  const [isSelectPhotoModalOpen, setIsSelectPhotoModalOpen] = useState<boolean>(false);
  const [showEducationFolder, setShowEducationFolder] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewPdfItem, setPreviewPdfItem] = useState<EducationPdfItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [renderedCovers, setRenderedCovers] = useState<Record<string, string>>({});
  const [, setTick] = useState<number>(0);

  React.useEffect(() => {
    if (patient.status === 'Sudah Pulang') {
      const timer = setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [patient.status]);

  // 1. Parsing progress logs with robust fallback array
  const progressLogs: DailyLog[] = Array.isArray(patient.progressLogs)
    ? patient.progressLogs
    : Array.isArray(patient.progress_logs)
    ? patient.progress_logs
    : Array.isArray(patient.dailyLogs)
    ? patient.dailyLogs
    : Array.isArray(patient.daily_logs)
    ? patient.daily_logs
    : [];

  const currentLog = progressLogs[selectedLogIndex] || progressLogs[0];
  const isAterm = patient.gestationCategory === 'aterm';

  // Trigger celebration if Boleh Pulang is unlocked
  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0d9488', '#10b981', '#f59e0b', '#3b82f6'],
    });
  };

  // Prepare chart data (reverse to chronological order for line graph)
  const chartData = [...progressLogs]
    .reverse()
    .map((log) => ({
      dateLabel: formatShortDate(log.date || (log as any).createdAt),
      fullDate: formatIndonesianDate(log.date || (log as any).createdAt),
      weight: Number(log.weightGram ?? (log as any).weight ?? (log as any).weight_gram ?? 0),
      periodLabel: log.periodLabel || (log as any).label || (log as any).dayLabel || 'Log',
      notes: log.nakesNotes || (log as any).notes || '',
    }));

  const initialWeight = patient.initialAnthropometry.weightGram;
  const latestWeight = progressLogs[0] ? Number(progressLogs[0].weightGram ?? (progressLogs[0] as any).weight ?? initialWeight) : initialWeight;
  const weightGain = latestWeight - initialWeight;

  const ALL_EQUIPMENT_LIST: { name: MedicalEquipment; label: string; icon: string }[] = [
    { name: 'Infus', label: 'Infus Cairan/Nutrisi', icon: '💧' },
    { name: 'OGT', label: 'Selang Minum (OGT)', icon: '🍼' },
    { name: 'CPAP', label: 'Bantuan Napas CPAP', icon: '💨' },
    { name: 'Ventilator', label: 'Ventilator Napas', icon: '🫁' },
    { name: 'Monitor TTV', label: 'Monitor Tanda Vital', icon: '📊' },
    { name: 'Nasal Kanul', label: 'Oksigen Nasal Kanul', icon: '🌬️' },
    { name: 'O2 Mask', label: 'Masker Oksigen', icon: '🎭' },
  ];

  const MILESTONE_DEFINITIONS = [
    { key: 'lepasCPAP', label: 'Lepas CPAP (Bisa Napas Mandiri)', category: 'Pernapasan' },
    { key: 'lepasVentilator', label: 'Lepas Ventilator', category: 'Pernapasan' },
    { key: 'lepasInfus', label: 'Lepas Infus (Full Nutrisi Oral)', category: 'Cairan' },
    { key: 'lepasOGT', label: 'Lepas OGT (Bisa Minum Mulut)', category: 'Nutrisi' },
    { key: 'lepasO2Nasal', label: 'Lepas Oksigen Nasal Kanul', category: 'Pernapasan' },
    { key: 'refleksMenghisapBaik', label: 'Refleks Menghisap Baik & Kuat', category: 'Kemampuan' },
    { key: 'refleksMenelanBaik', label: 'Refleks Menelan Baik', category: 'Kemampuan' },
    { key: 'selesaiPMK', label: 'Selesai Perawatan Metode Kanguru (PMK)', category: 'Perawatan' },
    { key: 'selesaiHBO', label: 'Selesai Fototerapi (HBO / Kuning)', category: 'Terapi' },
    { key: 'hb0', label: 'Imunisasi HB0 (Hepatitis B0)', category: 'Skrining & Imunisasi' },
    { key: 'shk', label: 'SHK (Skrining Hipotiroid Kongenital)', category: 'Skrining & Imunisasi' },
    { key: 'skriningPJB', label: 'Skrining PJB (Penyakit Jantung Bawaan)', category: 'Skrining & Imunisasi' },
    { key: 'bayiSementaraPemantauanKetat', label: 'Dalam Pemantauan Ketat NICU', category: 'Observasi', isWarning: true },
    { key: 'bolehPulang', label: 'SIAP & BOLEH PULANG KE RUMAH!', category: 'Kelulusan', isSpecial: true },
  ];

  const [liveEducationPdfs, setLiveEducationPdfs] = useState<EducationPdfItem[]>(getStoredGlobalPdfs());

  // Fetch live education list from MySQL Backend and subscribe to realtime updates
  useEffect(() => {
    let isMounted = true;
    const fetchLivePdfs = async () => {
      try {
        const live = await syncGlobalPdfsFromBackend();
        if (live && isMounted) {
          setLiveEducationPdfs(live);
        }
      } catch (err) {
        console.warn('[ParentDashboard] Live Education Fetch error:', err);
      }
    };
    fetchLivePdfs();

    const handleDataChanged = () => {
      if (isMounted) {
        setLiveEducationPdfs(getStoredGlobalPdfs());
      }
    };

    window.addEventListener('nspc_data_changed', handleDataChanged);

    return () => {
      isMounted = false;
      window.removeEventListener('nspc_data_changed', handleDataChanged);
    };
  }, []);

  const activeEquipment = currentLog?.activeEquipment || patient.currentEquipment;

  const basePdfsList: EducationPdfItem[] = resolvePatientEducationPdfs(patient.educationPdfs);
  const educationMap = new Map<string, EducationPdfItem>();
  liveEducationPdfs.forEach((p) => educationMap.set(p.id, p));
  basePdfsList.forEach((p) => educationMap.set(p.id, p));

  const pdfsList = Array.from(educationMap.values());
  const activePdfs = pdfsList.filter((p) => p.isActive !== false);

  // Pre-render PDF covers when activePdfs change
  React.useEffect(() => {
    let isMounted = true;
    const loadCovers = async () => {
      const newCovers: Record<string, string> = {};
      for (const pdf of activePdfs) {
        if (pdf.coverImageUrl) {
          newCovers[pdf.id] = pdf.coverImageUrl;
          continue;
        }
        let dataUrl = pdf.fileDataUrl || getPdfDataUrlSync(pdf.id);
        if (!dataUrl) {
          dataUrl = await getPdfDataUrl(pdf.id);
        }
        if (dataUrl) {
          const { coverUrl } = await renderPdfFirstPageToImage(dataUrl);
          if (coverUrl) {
            newCovers[pdf.id] = coverUrl;
          } else {
            newCovers[pdf.id] = generateFallbackPdfCover(pdf.title, pdf.category);
          }
        } else {
          newCovers[pdf.id] = generateFallbackPdfCover(pdf.title, pdf.category);
        }
      }
      if (isMounted) {
        setRenderedCovers((prev) => ({ ...prev, ...newCovers }));
      }
    };
    loadCovers();
    return () => {
      isMounted = false;
    };
  }, [patient.id, activePdfs.length, activePdfs.map((p) => p.id).join(',')]);

  const handleDownloadPdf = async (pdf: EducationPdfItem) => {
    await downloadEducationPdf(pdf);
  };

  if (showEducationFolder) {
    const categories = [
      'Semua',
      ...Array.from(new Set(activePdfs.map((p) => p.category || 'Umum'))),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const filteredPdfs = activePdfs.filter((pdf) => {
      const matchCat = selectedCategory === 'Semua' || pdf.category === selectedCategory;
      const matchSearch =
        searchQuery.trim() === '' ||
        pdf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pdf.nakesNote && pdf.nakesNote.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pdf.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    return (
      <div className="space-y-6 pb-12 font-sans">
        {/* TOP BAR / HEADER */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setShowEducationFolder(false)}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="text-[11px] font-extrabold text-teal-700 tracking-wider flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-extrabold text-[10px]">
                  AKSES ORANG TUA
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">
                  Bayi {patient.nickname} ({patient.medicalRecordNumber || `bayi_${patient.nickname.toLowerCase()}`})
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                Folder & Materi Edukasi Orang Tua
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowEducationFolder(false)}
            className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-300" />
            <span>Kembali ke Laporan Perkembangan</span>
          </button>
        </div>

        {/* HERO DARK TEAL BANNER CARD */}
        <div className="relative overflow-hidden bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg">
          <div className="absolute -right-8 -bottom-8 opacity-10 text-white pointer-events-none select-none">
            <BookOpen className="w-64 h-64 text-white" />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-emerald-200 border border-white/20">
              <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>Dokumen Edukasi Resmi NICU RSUD Undata</span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-snug">
              Pusat Panduan & Modul Perawatan Buah Hati
            </h1>

            <p className="text-xs sm:text-sm text-teal-100 max-w-2xl leading-relaxed">
              Halaman khusus tempat Ayah dan Bunda dapat melihat, mempelajari, dan mengunduh berkas rekomendasi edukasi medis (berformat .PDF) yang diterbitkan langsung oleh Tim Nakes NICU untuk persiapan perawatan di rumah.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-bold text-emerald-200">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Terenkripsi & Akses Khusus Pasien</span>
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Format PDF Siap Cetak</span>
              </span>
            </div>
          </div>
        </div>

        {/* FILTER & SEARCH CARD (EXACT LAYOUT AS UPLOADED IMAGE) */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          {/* Top Row: Category Pills with Count Badges */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-black text-slate-800 shrink-0 mr-1 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              <span>Kategori:</span>
            </span>

            {categories.map((cat) => {
              const count =
                cat === 'Semua'
                  ? activePdfs.length
                  : activePdfs.filter((p) => p.category === cat).length;
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
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

          {/* Bottom Row: Search Input on Left, View Switcher on Right */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari modul / catatan edukasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            {/* View Mode Toggle: Galeri Grid vs Daftar Nomor */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-bold text-slate-500">Tampilan:</span>
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Galeri Grid"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Galeri Grid</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Daftar Nomor"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Daftar Nomor</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CARDS DISPLAY: GRID OR LIST */}
        {filteredPdfs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            Tidak ada dokumen PDF edukasi yang cocok dengan pencarian / kategori ini.
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID GALLERY LAYOUT (MATCHING IMAGE SCREENSHOT) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredPdfs.map((pdf, index) => {
              const coverImg =
                renderedCovers[pdf.id] ||
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
                className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-400/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-all"
              >
                {/* Left Section: Number + Content */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Sequential Numbering Badge */}
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-800 text-white font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                    {index + 1}
                  </div>

                  {/* Main Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Header Meta: Category Badge & Date */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-emerald-100/90 text-emerald-800 text-[11px] font-black rounded-lg flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-emerald-700 fill-emerald-700 shrink-0" />
                        <span>{pdf.category}</span>
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        {pdf.publishedAt}
                      </span>
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
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PREVIEW MODAL (DESAIN SAMA PERSIS SESUAI SCREENSHOT) */}
        {/* PRATINJAU MODAL EDUKASI SESUAI GAMBAR TAMPILAN ADMIN NAKES */}
        {previewPdfItem && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-[9999] animate-fadeIn font-sans">
            <div className="bg-white rounded-[28px] max-w-3xl w-full flex flex-col shadow-2xl overflow-hidden relative max-h-[94vh] border border-slate-100">
              {/* 1. DARK TEAL HEADER BANNER */}
              <div className="bg-[#005c4b] px-6 py-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-emerald-200 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                      {previewPdfItem.title}
                    </h3>
                    <div className="text-xs text-emerald-100 font-medium mt-0.5">
                      Kategori: {previewPdfItem.category} &bull; {previewPdfItem.publishedAt}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewPdfItem(null)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Tutup Pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2. MODAL BODY (CATATAN NAKES + HIGH-RES IMAGE DISPLAY) */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-white">
                {/* CATATAN KHUSUS NAKES */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-1">
                  <div className="text-xs font-black text-[#005c4b]">
                    Catatan Khusus Nakes:
                  </div>
                  <div className="text-xs italic text-slate-700 font-medium">
                    "{previewPdfItem.nakesNote || 'Harap pelajari petunjuk dalam modul ini dengan seksama.'}"
                  </div>
                </div>

                {/* Native PDF / Google Drive Iframe Viewer */}
                <PdfViewerCanvas
                  dataUrl={previewPdfItem.fileDataUrl || getPdfDataUrlSync(previewPdfItem.id)}
                  title={previewPdfItem.title}
                  fileName={previewPdfItem.fileName}
                  nakesNote={previewPdfItem.nakesNote}
                  onDownload={() => handleDownloadPdf(previewPdfItem)}
                />
              </div>

              {/* 3. MODAL FOOTER */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs font-medium text-slate-500">
                  Sistem Informasi Rekam Medis NSPC &bull; RSUD Undata
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPreviewPdfItem(null)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
                  >
                    Tutup
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleDownloadPdf(previewPdfItem);
                    }}
                    className="px-5 py-2.5 bg-[#005c4b] hover:bg-[#004a3c] text-white font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4 text-emerald-300" />
                    <span>Unduh PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* HERO BANNER CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-12 top-6 opacity-10 text-9xl pointer-events-none select-none font-extrabold">
          NICU
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. KEMBALI KE PORTAL / DASHBOARD NAKES BUTTON */}
              {onBackToNakes ? (
                <button
                  onClick={onBackToNakes}
                  className="px-3.5 py-1 bg-amber-400 hover:bg-amber-300 text-amber-950 font-extrabold text-xs rounded-full flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                  title="Kembali ke Dashboard Nakes"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Dashboard Nakes</span>
                </button>
              ) : onBackToHome ? (
                <button
                  onClick={onBackToHome}
                  className="px-3.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-full border border-white/30 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs backdrop-blur-md"
                  title="Kembali ke Halaman Utama / Portal"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-teal-100 shrink-0" />
                  <span className="whitespace-nowrap">Kembali Ke Portal</span>
                </button>
              ) : null}

              {/* 2. NSPC BADGE */}
              <span className="px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold tracking-wide text-teal-100 border border-white/20 flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                NSPC • Neo Smart Progress Card
              </span>

              {/* 3. RAWAT NICU / STATUS BADGE */}
              <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                patient.status === 'Siap Pulang' || patient.milestones.bolehPulang
                  ? 'bg-emerald-400 text-emerald-950 animate-bounce'
                  : 'bg-amber-400/90 text-amber-950'
              }`}>
                {patient.milestones.bolehPulang ? '🎉 SIAP PULANG' : patient.status}
              </span>

              {/* 4. INKUBATOR / RUANG BADGE */}
              <span className="px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-medium text-teal-100 border border-white/20 shrink-0">
                {patient.roomNumber || 'Inkubator 01 - NICU RSUD Undata'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Clickable Baby Photo Avatar */}
              <button
                type="button"
                onClick={() => setIsSelectPhotoModalOpen(true)}
                className="relative group shrink-0 cursor-pointer text-left self-start sm:self-center"
                title="Klik untuk Ganti Foto Profil Bayi"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-white/40 group-hover:border-amber-300 shadow-lg bg-teal-950/60 transition-all transform group-hover:scale-105 flex items-center justify-center">
                  {patient.coverPhotoUrl || currentLog?.photoUrl ? (
                    <img
                      src={patient.coverPhotoUrl || currentLog?.photoUrl}
                      alt={patient.babyName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">{patient.gender === 'Laki-Laki' ? '👶🏻' : '👶🏽'}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-amber-400 group-hover:bg-amber-300 text-amber-950 p-1.5 rounded-xl shadow-md border border-white text-[10px] font-extrabold flex items-center gap-1 transition-all">
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ganti Foto</span>
                </div>
              </button>

              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span>{patient.babyName}</span>
                </h1>
                <p className="text-teal-100/90 text-sm sm:text-base mt-1 font-medium">
                  Putra/Putri tercinta dari <strong className="text-white">Bunda {patient.motherName}</strong> & <strong className="text-white">Ayah {patient.fatherName}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setIsSelectPhotoModalOpen(true)}
                  className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 hover:bg-white/25 text-amber-300 rounded-lg text-xs font-bold border border-white/20 transition-all cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Ganti Foto Profil Bayi</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsSouvenirOpen(true)}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-extrabold text-sm shadow-md transition-all transform hover:-translate-y-0.5"
            >
              <Award className="w-4 h-4 text-amber-900" />
              <span>Kartu Kenangan & Kelulusan</span>
            </button>

            <button
              onClick={onOpenPrintModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-teal-900 font-bold text-sm shadow-md hover:bg-teal-50 transition-all transform hover:-translate-y-0.5"
            >
              <Printer className="w-4 h-4 text-teal-700" />
              <span>Cetak Kartu NSPC</span>
            </button>

            <button
              onClick={onShareLink}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan Link</span>
            </button>
          </div>
        </div>

        {/* DISCHARGED ALUMNI CELEBRATION BANNER */}
        {patient.status === 'Sudah Pulang' && (
          <div className="mt-5 p-4 bg-amber-400 text-amber-950 rounded-2xl shadow-md border border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-950 text-amber-300 rounded-xl font-bold shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-amber-950">
                  🎉 Selamat Atas Kepulangan Si Kecil!
                </h4>
                <p className="text-amber-900 text-xs mt-0.5">
                  Si kecil telah lulus medis dari NICU RSUD Undata. Rekam medis perkembangan tersimpan aman sebagai data Alumni NICU. Silakan unduh Kartu Kenangan sebagai apresiasi kelulusan.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsSouvenirOpen(true)}
              className="px-4 py-2 bg-amber-950 hover:bg-amber-900 text-amber-100 font-bold rounded-xl shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>Download Kartu Kenangan (PNG)</span>
            </button>
          </div>
        )}

        {/* AUTOMATIC AGE & STAY DURATION METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/15">
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 text-teal-200 text-xs font-medium mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Usia Bayi Saat Ini</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-white">
              {formatBabyAge(patient.birthDate, patient.gestationalAgeWeeks)}
            </p>
            <p className="text-[11px] text-teal-200/80 mt-0.5">
              Otomatis dihitung dari tgl lahir
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 text-teal-200 text-xs font-medium mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Lama Perawatan</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-white">
              {formatLengthOfStay(patient.admissionDate)}
            </p>
            <p className="text-[11px] text-teal-200/80 mt-0.5">
              Otomatis dihitung dari tgl masuk
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 text-teal-200 text-xs font-medium mb-1">
              <Baby className="w-3.5 h-3.5" />
              <span>Usia Kehamilan (Gestasi)</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-white">
              {patient.gestationalAgeWeeks} Minggu
            </p>
            <p className="text-[11px] text-teal-200/80 mt-0.5 font-semibold">
              {isAterm ? 'Aterm (>37m - Pemantauan Hari)' : 'Preterm (<36m - Pemantauan Minggu)'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 text-teal-200 text-xs font-medium mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-300" />
              <span>Berat Badan Terkini</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-amber-200">
              {latestWeight} gram
            </p>
            <p className="text-[11px] text-teal-100/90 mt-0.5">
              {weightGain >= 0 ? `+${weightGain} gram dari lahir` : `${weightGain} gram dari lahir`}
            </p>
          </div>
        </div>
      </div>

      {/* BANNER BUTTON MATERI & FOLDER EDUKASI ORANG TUA */}
      <div className="bg-teal-50/70 border border-teal-200/90 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs font-sans">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-xs">
            <BookOpen className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Materi & Folder Edukasi Orang Tua
              </h3>
              <span className="px-2.5 py-0.5 bg-emerald-200/80 text-teal-900 text-xs font-extrabold rounded-full border border-emerald-300/60">
                {activePdfs.length} Dokumen PDF
              </span>
            </div>
            <p className="text-xs text-slate-600 font-normal mt-0.5 leading-relaxed">
              Panduan medis resmi, modul PMK, dan rekomendasi perawatan kesehatan bayi di rumah dari Nakes NICU.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowEducationFolder(true)}
          className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 self-stretch sm:self-auto justify-center"
        >
          <Folder className="w-4 h-4 text-amber-300 fill-amber-300" />
          <span>Lihat Materi & Folder Edukasi</span>
          <ChevronRight className="w-4 h-4 text-teal-200" />
        </button>
      </div>

      {/* GENERAL DATA & INITIAL ANTHROPOMETRY ROW (2 COLUMNS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Patient Identity & Dates */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Data Diri & Orang Tua</h3>
              <p className="text-xs text-slate-500">Identitas resmi pasien NICU</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Nama Ayah</span>
              <span className="font-extrabold text-slate-800">{patient.fatherName}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Nama Bunda</span>
              <span className="font-extrabold text-slate-800">{patient.motherName}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Jenis Kelamin</span>
              <span className="font-extrabold text-slate-800">{patient.gender}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Tanggal Lahir</span>
              <span className="font-extrabold text-slate-800">{formatIndonesianDate(patient.birthDate)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 font-medium">Tanggal Masuk NICU</span>
              <span className="font-extrabold text-teal-700">{formatIndonesianDate(patient.admissionDate)}</span>
            </div>
          </div>
        </div>

        {/* Initial Anthropometry at Admission */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Antropometri Lahir / Masuk</h3>
              <p className="text-xs text-slate-500">Ukuran fisik saat pertama kali dirawat</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 text-xs">
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-slate-500 block text-[11px] font-medium">Berat Lahir (BB)</span>
              <span className="text-lg font-extrabold text-teal-900 block mt-1">{patient.initialAnthropometry.weightGram} gram</span>
            </div>
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-slate-500 block text-[11px] font-medium">Panjang Badan (PB)</span>
              <span className="text-lg font-extrabold text-teal-900 block mt-1">{patient.initialAnthropometry.lengthCm} cm</span>
            </div>
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-slate-500 block text-[11px] font-medium">Lingkar Kepala (LK)</span>
              <span className="text-lg font-extrabold text-teal-900 block mt-1">{patient.initialAnthropometry.headCircumferenceCm} cm</span>
            </div>
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-slate-500 block text-[11px] font-medium">Lingkar Dada (LD)</span>
              <span className="text-lg font-extrabold text-teal-900 block mt-1">{patient.initialAnthropometry.chestCircumferenceCm} cm</span>
            </div>
          </div>
        </div>

      </div>

      {/* FULL-WIDTH USED MEDICAL EQUIPMENT SECTION */}
      {(() => {
        const defaultRegistered: EquipmentItem[] = [
          {
            id: 'eq-1',
            name: 'Infus IV',
            clinicalNotes: 'Cairan Ringer Lactat 12 ml/jam',
            parentExplanation: 'Infus penunjang cairan dan medikasi.',
            isActive: activeEquipment.includes('Infus'),
          },
          {
            id: 'eq-2',
            name: 'O2 Nasal Kanul',
            clinicalNotes: '0.5 Liter/menit',
            parentExplanation: 'Oksigen hidung ringan untuk membantu kenyamanan bernapas.',
            isActive: activeEquipment.includes('Nasal Kanul') || activeEquipment.includes('O2 Mask'),
          },
          {
            id: 'eq-3',
            name: 'OGT (Oral Gastric Tube)',
            clinicalNotes: 'Sudah dilepas, bayinya bisa menetek langsung',
            parentExplanation: 'Selang makanan lunak yang saat ini sudah berhasil dilepas!',
            isActive: activeEquipment.includes('OGT'),
          },
          {
            id: 'eq-4',
            name: 'Fototerapi',
            clinicalNotes: 'Kadar Bilirubin normal (6.5 mg/dL)',
            parentExplanation: 'Lampu sinar biru penurun kadar kuning.',
            isActive: false,
          },
        ];

        const parentEquipmentList =
          patient.registeredEquipment && patient.registeredEquipment.length > 0
            ? patient.registeredEquipment
            : defaultRegistered;

        const activeCount = parentEquipmentList.filter((e) => e.isActive).length;

        return (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Alat Kesehatan Digunakan</h3>
                  <p className="text-xs text-slate-500">Penjelasan ramah tentang alat medis yang terpasang pada si kecil</p>
                </div>
              </div>
              <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-100 px-3 py-1 rounded-full">
                {activeCount} Alat Aktif
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {parentEquipmentList.map((eq) => (
                <div
                  key={eq.id || eq.name}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    eq.isActive
                      ? 'bg-emerald-50/20 border-2 border-teal-400/90 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200/80 opacity-80'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base">{eq.name}</h4>
                        <p className="text-xs text-slate-500 font-medium">{eq.clinicalNotes || 'Pengawasan medis'}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black shrink-0 ${
                          eq.isActive
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {eq.isActive ? '✓ AKTIF' : 'NON-AKTIF'}
                      </span>
                    </div>

                    {eq.parentExplanation && (
                      <div className="mt-3 p-2.5 bg-white rounded-xl border border-slate-100 text-xs text-slate-600 font-medium leading-relaxed">
                        <strong className="text-teal-700 font-bold">Penjelasan untuk Ortu:</strong>{' '}
                        <span className="italic">"{eq.parentExplanation}"</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {activeCount === 0 && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                <span>Bebas dari seluruh alat kesehatan pendukung! Si kecil berkembang makin kuat.</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* WEIGHT PROGRESS CHART SECTION */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Grafik Perkembangan Berat Badan (BB)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isAterm
                ? 'Diperbarui setiap hari (Bayi Cukup Bulan >37 Minggu)'
                : 'Diperbarui setiap minggu (Bayi Prematur <36 Minggu)'}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Status Kenaikan BB</span>
              <span className="text-xs font-bold text-teal-700">
                {weightGain >= 0 ? `+${weightGain} Gram (Progres Positif)` : `${weightGain} Gram`}
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Weight Line Chart */}
        <div className="h-64 sm:h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                domain={['dataMin - 100', 'dataMax + 100']}
                tick={{ fontSize: 12, fill: '#64748b' }}
                unit="g"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1">
                        <p className="font-bold text-teal-300">{data.periodLabel} ({data.fullDate})</p>
                        <p className="text-white text-sm font-extrabold">
                          Berat Badan: {data.weight} gram
                        </p>
                        {data.notes && (
                          <p className="text-slate-300 text-[11px] italic border-t border-slate-700 pt-1 mt-1">
                            "{data.notes}"
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={initialWeight} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: 'BB Lahir', fill: '#94a3b8', fontSize: 10, position: 'insideTopLeft' }} />
              <Line
                type="monotone"
                dataKey="weight"
                name="Berat Badan (gram)"
                stroke="#0d9488"
                strokeWidth={3.5}
                dot={{ r: 5, fill: '#0d9488', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 8, fill: '#059669' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Log History Selector Pills */}
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-600 mb-2">
            Pilih Tanggal Laporan Perkembangan:
          </p>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {progressLogs.map((log, idx) => (
              <button
                key={log.id}
                onClick={() => setSelectedLogIndex(idx)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-semibold shrink-0 transition-all ${
                  selectedLogIndex === idx
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{log.periodLabel}</span>
                <span className="block text-[10px] opacity-80">{formatShortDate(log.date)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SELECTED LOG DETAIL DASHBOARD (VITAL SIGNS, DRINKING, NOTES) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Vital Signs Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Tanda-Tanda Vital (TTV)</h3>
                <p className="text-xs text-slate-500">{currentLog?.periodLabel}</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
              Stabil
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Thermometer className="w-3 h-3 text-rose-500" /> Suhu Tubuh
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {currentLog?.vitalSigns.temperature || 36.7} °C
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Normal (36.5-37.5°C)</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Heart className="w-3 h-3 text-rose-500" /> Detak Jantung (HR)
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {currentLog?.vitalSigns.heartRate || 138} x/m
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Normal (120-160)</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Activity className="w-3 h-3 text-teal-500" /> Laju Napas (RR)
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {currentLog?.vitalSigns.respiratoryRate || 42} x/m
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Teratur (40-60)</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Zap className="w-3 h-3 text-cyan-500" /> Saturasi Oksigen
              </span>
              <span className="text-lg font-extrabold text-teal-800">
                {currentLog?.vitalSigns.spo2 || 98}%
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Bagus (&gt;95%)</span>
            </div>
          </div>
        </div>

        {/* Drinking Ability & Feeding Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Milk className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Kemampuan Minum & Nutrisi</h3>
              <p className="text-xs text-slate-500">Asupan ASI & metode pemberian</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-100">
              <span className="text-teal-700 text-[11px] font-semibold block">Metode Minum Saat Ini</span>
              <span className="text-sm font-extrabold text-teal-950 block mt-0.5">
                {currentLog?.drinkingAbility.method || 'OGT/Sonde'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px]">Jumlah per Minum</span>
                <span className="text-sm font-extrabold text-slate-800 block">
                  {currentLog?.drinkingAbility.volumeCcPerFeeding || 0} cc
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px]">Frekuensi Pemberian</span>
                <span className="text-sm font-extrabold text-slate-800 block">
                  {currentLog?.drinkingAbility.frequencyPerDay || 8}x / 24 Jam
                </span>
              </div>
            </div>

            {currentLog?.drinkingAbility.notes && (
              <div className="p-3 bg-slate-50 rounded-xl text-slate-600 italic text-[11px]">
                "{currentLog.drinkingAbility.notes}"
              </div>
            )}
          </div>
        </div>

        {/* Doctors & Nurses Daily Love Notes */}
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50/60 p-5 rounded-3xl border border-teal-100 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 pb-3 border-b border-teal-100">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <Heart className="w-4 h-4 fill-white/20" />
              </div>
              <div>
                <h3 className="font-bold text-teal-950 text-sm">Pesan Kasih Sayang Nakes</h3>
                <p className="text-xs text-teal-700">Catatan dari Dokter & Perawat</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-xs sm:text-sm text-teal-900 leading-relaxed font-medium bg-white/80 p-3.5 rounded-2xl border border-teal-100 shadow-2xs">
                "{currentLog?.nakesNotes || 'Si kecil dalam perawatan penuh kasih sayang oleh tim RSUD Undata.'}"
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-teal-100/60 text-right">
            <span className="text-[11px] text-teal-700 font-semibold block">
              Diperbarui oleh:
            </span>
            <span className="text-xs font-bold text-teal-950">
              {currentLog?.updatedBy || 'Tim NICU RSUD Undata'}
            </span>
          </div>
        </div>

        {/* Daily Photo Card if uploaded by Nakes */}
        {currentLog?.photoUrl && (
          <div className="bg-white p-5 rounded-3xl border border-teal-100 shadow-xs space-y-3 sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Foto Perkembangan Hari Ini</h3>
                <p className="text-xs text-slate-500">{currentLog.periodLabel} ({formatIndonesianDate(currentLog.date)})</p>
              </div>
            </div>

            <div className="h-56 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs relative">
              <img src={currentLog.photoUrl} alt="Foto perkembangan bayi" className="w-full h-full object-cover" />
            </div>

            {currentLog.photoCaption && (
              <p className="text-xs text-teal-900 italic font-medium bg-teal-50/80 p-2.5 rounded-xl border border-teal-100">
                "{currentLog.photoCaption}"
              </p>
            )}
          </div>
        )}

      </div>

      {/* HISTORI RIWAYAT LOG PERKEMBANGAN (NSPC) - READ ONLY FOR PARENTS */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 text-teal-800 font-extrabold text-base sm:text-lg">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Riwayat Log Perkembangan (NSPC)
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Daftar catatan harian/mingguan yang diunggah oleh Tenaga Kesehatan / Admin NICU
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 self-start sm:self-auto">
            {patient.dailyLogs.length} Catatan Terekam
          </span>
        </div>

        {patient.dailyLogs.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Belum ada catatan progres harian/mingguan. Catatan perkembangan diinput secara berkala oleh Tenaga Kesehatan / Admin NICU.
          </div>
        ) : (
          <div className="space-y-3">
            {patient.dailyLogs.map((log) => {
              const milestoneChips = getLogMilestones(log);
              return (
                <div
                  key={log.id}
                  className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-l-[4px] border-l-teal-600 shadow-2xs space-y-2.5 font-sans relative transition-all hover:shadow-xs"
                >
                  {/* ROW 1: Period Label & Date */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-teal-900 font-extrabold text-sm sm:text-base">
                      {log.periodLabel}
                    </h4>
                    <span className="text-[11px] sm:text-xs font-mono text-slate-400 font-semibold">
                      {formatIndonesianDate(log.date)}
                    </span>
                  </div>

                  {/* ROW 2: Berat Badan & Perubahan */}
                  <div className="text-xs text-slate-600 font-medium flex items-center gap-2 flex-wrap">
                    <div>
                      Berat Badan:{' '}
                      <strong className="text-slate-900 font-extrabold">
                        {log.weightGram} g ({(log.weightGram / 1000).toFixed(2)} kg)
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
                  <div className="p-2.5 sm:px-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs font-medium text-slate-600">
                    <div>
                      HR: <strong className="text-slate-900 font-bold">{log.vitalSigns.heartRate} bpm</strong>
                    </div>
                    <div>
                      RR: <strong className="text-slate-900 font-bold">{log.vitalSigns.respiratoryRate} x/m</strong>
                    </div>
                    <div>
                      SpO2: <strong className="text-slate-900 font-bold">{log.vitalSigns.spo2}%</strong>
                    </div>
                    <div>
                      Suhu: <strong className="text-slate-900 font-bold">{log.vitalSigns.temperature}°C</strong>
                    </div>
                  </div>

                  {/* ROW 4: Milestone Section */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-700">Milestone & Catatan:</div>
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
                  {log.nakesNotes && (
                    <div className="text-xs text-slate-600 italic font-medium leading-relaxed bg-teal-50/40 p-2.5 rounded-xl border border-teal-100/60">
                      "{log.nakesNotes}"
                    </div>
                  )}

                  {/* ROW 6: Author at Bottom Right */}
                  <div className="text-right text-[11px] text-slate-400 font-medium italic">
                    Dicatat oleh: {log.updatedBy}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CATATAN IMUNISASI & SKRINING KEPULANGAN MEDIS */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 text-teal-800 font-extrabold text-base sm:text-lg">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Imunisasi & Skrining Kepulangan Medis
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Rekap pemberian vaksinasi awal HB0 dan hasil skrining organ vital neonatus menjelang pemulangan
              </p>
            </div>
          </div>
        </div>

        {(() => {
          const rec = patient.immunizationDischarge || {
            hb0VaccineGiven: true,
            hb0VaccineDate: '2026-07-24',
            shkScreening: 'Sampel Darah Tumit Diberikan',
            ropScreening: 'Sudah Diperiksa Dokter Spesialis Mata',
            oaeScreening: 'Bilateral PASS (Normal)',
            pjbScreeningResult: 'PASS (Lolos Skrining Oksimetri PJB)',
            pjbScreeningNote: 'SpO2 tangan kanan 99%, kaki 99% (Lolos Skrining Oksimetri PJB)',
            dischargeSummaryNote: 'Kondisi bayi menunjukkan kemajuan pesat. Target berat badan pulang: 2000 gram.',
          };

          return (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {/* HB0 */}
                <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    Vaksin Hepatitis B (HB0)
                  </span>
                  <div className="flex items-center gap-1.5 font-extrabold text-teal-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{rec.hb0VaccineGiven ? 'Sudah Diberikan' : 'Belum Diberikan'}</span>
                  </div>
                  {rec.hb0VaccineDate && (
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Tanggal: {rec.hb0VaccineDate}
                    </span>
                  )}
                </div>

                {/* SHK */}
                <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    Skrining Hipotiroid (SHK)
                  </span>
                  <div className="font-extrabold text-slate-800 text-xs">
                    {rec.shkScreening || 'Belum Diperiksa'}
                  </div>
                </div>

                {/* ROP */}
                <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    Skrining Mata (ROP)
                  </span>
                  <div className="font-extrabold text-slate-800 text-xs">
                    {rec.ropScreening || 'Belum Diperiksa'}
                  </div>
                </div>

                {/* OAE */}
                <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    Skrining Pendengaran (OAE)
                  </span>
                  <div className="font-extrabold text-slate-800 text-xs">
                    {rec.oaeScreening || 'Belum Diperiksa'}
                  </div>
                </div>

                {/* PJB */}
                <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 space-y-1 sm:col-span-2 md:col-span-2">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    Skrining Jantung Bawaan (PJB)
                  </span>
                  <div className="font-extrabold text-emerald-700 text-xs">
                    {rec.pjbScreeningResult || 'Belum Diperiksa'}
                  </div>
                  {rec.pjbScreeningNote && (
                    <div className="text-[11px] text-slate-600 font-medium italic mt-0.5">
                      {rec.pjbScreeningNote}
                    </div>
                  )}
                </div>
              </div>

              {/* Discharge Summary Note */}
              {rec.dischargeSummaryNote && (
                <div className="p-3.5 bg-teal-50/60 border border-teal-100 rounded-2xl space-y-1">
                  <span className="text-[11px] font-extrabold text-teal-900 block">
                    Ringkasan Kepulangan & Catatan Dokter:
                  </span>
                  <p className="text-xs text-teal-950 font-medium italic leading-relaxed">
                    "{rec.dischargeSummaryNote}"
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* MILESTONE DEVELOPMENT CHECKLIST SECTION */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 flex items-center justify-center font-bold shadow-md shadow-amber-400/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Milestone & Pencapaian Kemajuan Bayi
              </h2>
              <p className="text-xs text-slate-500">
                Indikator kesehatan yang dicentang oleh Tenaga Kesehatan menuju kepulangan
              </p>
            </div>
          </div>

          {isMilestoneChecked(patient.milestones, 'SIAP & BOLEH PULANG', 'bolehPulang') && (
            <button
              onClick={triggerCelebration}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all animate-bounce"
            >
              <Sparkles className="w-4 h-4" />
              <span>Rayakan Kelulusan NICU!</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MILESTONE_DEFINITIONS.map((def) => {
            const isAchieved = isMilestoneChecked(patient.milestones, def.label, def.key);
            
            if (def.isWarning) {
              return (
                <div
                  key={def.key}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    isAchieved
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50/80 border-slate-200/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className={`w-5 h-5 ${isAchieved ? 'text-amber-600' : 'text-slate-300'}`} />
                    <div>
                      <span className="text-xs font-bold block">{def.label}</span>
                      <span className="text-[10px] opacity-80">{def.category}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAchieved ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-600'}`}>
                    {isAchieved ? 'Aktif' : 'Tidak'}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={def.key}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  def.isSpecial && isAchieved
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-400 shadow-md col-span-1 sm:col-span-2 lg:col-span-3'
                    : isAchieved
                    ? 'bg-teal-50/80 border-teal-200 text-teal-950 shadow-2xs'
                    : 'bg-slate-50/60 border-slate-200/50 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isAchieved ? (
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${def.isSpecial ? 'text-amber-300 animate-pulse' : 'text-teal-600'}`} />
                  ) : (
                    <XCircle className="w-5 h-5 text-slate-300 shrink-0" />
                  )}
                  <div>
                    <span className={`text-xs font-bold block ${def.isSpecial && isAchieved ? 'text-white text-sm' : ''}`}>
                      {def.label}
                    </span>
                    <span className={`text-[10px] ${def.isSpecial && isAchieved ? 'text-teal-100' : 'text-slate-500'}`}>
                      {def.category}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    isAchieved
                      ? def.isSpecial
                        ? 'bg-white text-emerald-900 font-extrabold shadow-xs'
                        : 'bg-teal-200/70 text-teal-900'
                      : 'bg-slate-200/80 text-slate-500'
                  }`}
                >
                  {isAchieved ? 'Tercapai ✓' : 'Belum'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SOUVENIR KELULUSAN / KARTU KENANGAN MODAL */}
      <SouvenirCardModal
        patient={patient}
        isOpen={isSouvenirOpen}
        onClose={() => setIsSouvenirOpen(false)}
      />

      {/* SELECT PHOTO MODAL FOR PARENTS */}
      <SelectPhotoModal
        isOpen={isSelectPhotoModalOpen}
        patient={patient}
        onClose={() => setIsSelectPhotoModalOpen(false)}
        onSaveSuccess={(updated) => {
          if (onPatientUpdated) {
            onPatientUpdated(updated);
          }
        }}
      />

    </div>
  );
};
