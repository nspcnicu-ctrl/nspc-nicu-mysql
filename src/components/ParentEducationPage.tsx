import React, { useState, useEffect } from 'react';
import { Patient, EducationPdfItem } from '../types';
import { downloadEducationPdf } from '../utils/pdfDownload';
import { getPdfDataUrlSync, savePdfDataUrl } from '../services/pdfStore';
import { saveGlobalPdf, resolvePatientEducationPdfs, setMemoryGlobalPdfs, syncGlobalPdfsFromBackend, getStoredGlobalPdfs } from '../services/storage';
import { generateSamplePdfDataUrl, renderPdfFirstPageToImage, generateFallbackPdfCover } from '../services/pdfRender';
import { getEducationApiStatus, EducationApiStatus } from '../services/api';
import {
  ArrowLeft,
  BookOpen,
  Folder,
  Search,
  Eye,
  Download,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Info,
  Calendar,
  Sparkles,
  Baby,
  X,
  Upload,
  Plus,
  Trash2,
  Grid,
  List,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ParentEducationPageProps {
  patient: Patient;
  onBackToDashboard: () => void;
  onUpdatePatient?: (updatedPatient: Patient) => void;
}

export const ParentEducationPage: React.FC<ParentEducationPageProps> = ({
  patient,
  onBackToDashboard,
  onUpdatePatient,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewPdfModal, setPreviewPdfModal] = useState<EducationPdfItem | null>(null);
  const [renderedCovers, setRenderedCovers] = useState<Record<string, string>>({});
  const [liveGlobalPdfs, setLiveGlobalPdfs] = useState<EducationPdfItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dynamic Custom PDFs uploaded during session
  const [customPdfs, setCustomPdfs] = useState<EducationPdfItem[]>([]);

  // Modal Upload State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadCategory, setUploadCategory] = useState<string>('Bayi BBLR & Prematur');
  const [uploadNakesNote, setUploadNakesNote] = useState<string>('');
  const [uploadFileDataUrl, setUploadFileDataUrl] = useState<string>('');
  const [uploadCoverUrl, setUploadCoverUrl] = useState<string>('');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadFileSize, setUploadFileSize] = useState<string>('');
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isSavingCustom, setIsSavingCustom] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<EducationApiStatus>(() => getEducationApiStatus());
  const [isDismissedApiAlert, setIsDismissedApiAlert] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 1. Fetch education items from MySQL Database on mount and subscribe to realtime updates
  useEffect(() => {
    let isMounted = true;

    const loadLivePdfs = async () => {
      setIsLoading(true);
      try {
        const remote = await syncGlobalPdfsFromBackend();
        if (remote && isMounted) {
          setLiveGlobalPdfs(remote);
        }
      } catch (err) {
        console.warn('[ParentEducation] Fetch error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setApiStatus(getEducationApiStatus());
        }
      }
    };

    loadLivePdfs();

    const handleDataChanged = () => {
      if (isMounted) {
        setLiveGlobalPdfs(getStoredGlobalPdfs());
      }
    };
    const handleStatusChanged = (e: any) => {
      if (isMounted && e.detail) {
        setApiStatus(e.detail);
      }
    };

    window.addEventListener('nspc_data_changed', handleDataChanged);
    window.addEventListener('nspc_education_api_status_change', handleStatusChanged);

    return () => {
      isMounted = false;
      window.removeEventListener('nspc_data_changed', handleDataChanged);
      window.removeEventListener('nspc_education_api_status_change', handleStatusChanged);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const remote = await syncGlobalPdfsFromBackend();
      if (remote) {
        setLiveGlobalPdfs(remote);
      }
    } catch (err) {
      console.warn('[Refresh error]:', err);
    } finally {
      setIsRefreshing(false);
      setApiStatus(getEducationApiStatus());
    }
  };

  const DUMMY_PDF_IDS = new Set(['edu_pmk_01', 'edu_asi_02', 'edu_tanda_bahaya_03', 'edu_perawatan_04']);

  const basePdfs = resolvePatientEducationPdfs(patient.educationPdfs);
  const combinedMap = new Map<string, EducationPdfItem>();
  liveGlobalPdfs.forEach((p) => {
    if (p && !DUMMY_PDF_IDS.has(p.id)) combinedMap.set(p.id, p);
  });
  basePdfs.forEach((p) => {
    if (p && !DUMMY_PDF_IDS.has(p.id)) combinedMap.set(p.id, p);
  });
  customPdfs.forEach((p) => {
    if (p && !DUMMY_PDF_IDS.has(p.id)) combinedMap.set(p.id, p);
  });

  const allPdfs = Array.from(combinedMap.values());
  const activePdfs = allPdfs.filter((pdf) => pdf.isActive !== false && !DUMMY_PDF_IDS.has(pdf.id));

  // Generate Page 1 visual canvas thumbnails or use image covers
  useEffect(() => {
    let isMounted = true;
    async function prepareThumbnails() {
      const covers: Record<string, string> = {};
      for (const pdf of activePdfs) {
        let dataUrl = pdf.fileDataUrl || getPdfDataUrlSync(pdf.id);
        if (!dataUrl || dataUrl === '#') {
          dataUrl = generateSamplePdfDataUrl(pdf.title, pdf.category, pdf.nakesNote || (pdf as any).nakesNotes);
        }
        if (pdf.coverImageUrl) {
          covers[pdf.id] = pdf.coverImageUrl;
        } else if (dataUrl) {
          const { coverUrl } = await renderPdfFirstPageToImage(dataUrl);
          if (coverUrl) {
            covers[pdf.id] = coverUrl;
          } else {
            covers[pdf.id] = generateFallbackPdfCover(pdf.title, pdf.category);
          }
        }
      }
      if (isMounted) {
        setRenderedCovers(covers);
      }
    }
    prepareThumbnails();
    return () => {
      isMounted = false;
    };
  }, [patient.id, activePdfs.length]);

  // Handle PDF/Image File Upload & Conversion
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileObj(file);
    setIsProcessingFile(true);
    const kb = Math.round(file.size / 1024);
    const sizeStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
    setUploadFileName(file.name);
    setUploadFileSize(sizeStr);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const imgUrl = evt.target.result as string;
          setUploadFileDataUrl(imgUrl);
          setUploadCoverUrl(imgUrl);
          setIsProcessingFile(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      // PDF File
      const reader = new FileReader();
      reader.onload = async (evt) => {
        if (evt.target?.result) {
          const dataUrl = evt.target.result as string;
          setUploadFileDataUrl(dataUrl);

          // Convert page 1 of PDF to visual image canvas
          try {
            const { coverUrl } = await renderPdfFirstPageToImage(dataUrl);
            if (coverUrl) {
              setUploadCoverUrl(coverUrl);
            } else {
              // Fallback
              const objectUrl = URL.createObjectURL(file);
              setUploadCoverUrl(objectUrl);
            }
          } catch {
            const objectUrl = URL.createObjectURL(file);
            setUploadCoverUrl(objectUrl);
          }
          setIsProcessingFile(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      alert('Judul materi edukasi wajib diisi.');
      return;
    }
    if (!uploadFileDataUrl && !uploadFileObj) {
      alert('Silakan pilih berkas PDF atau gambar infografis terlebih dahulu.');
      return;
    }

    setIsSavingCustom(true);
    const newPdfId = 'pdf_custom_' + Date.now();

    try {
      const finalCover = uploadCoverUrl || generateFallbackPdfCover(uploadTitle.trim(), uploadCategory);
      const finalFileUrl = uploadFileDataUrl;

      const newPdfItem: EducationPdfItem = {
        id: newPdfId,
        title: uploadTitle.trim(),
        category: uploadCategory,
        fileName: uploadFileName || `${uploadTitle.replace(/\s+/g, '_')}.pdf`,
        fileSizeText: uploadFileSize || '1.2 MB',
        fileDataUrl: finalFileUrl || undefined,
        coverImageUrl: finalCover || undefined,
        pageCount: 1,
        nakesNote: uploadNakesNote.trim() || undefined,
        publishedAt: new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        isActive: true,
      };

      if (finalFileUrl) {
        savePdfDataUrl(newPdfId, finalFileUrl);
      }
      saveGlobalPdf(newPdfItem);
      setCustomPdfs((prev) => [...prev, newPdfItem]);
      if (finalCover) {
        setRenderedCovers((prev) => ({ ...prev, [newPdfId]: finalCover }));
      }

      if (onUpdatePatient && patient) {
        const existing = patient.educationPdfs || [];
        onUpdatePatient({
          ...patient,
          educationPdfs: [...existing, newPdfItem],
        });
      }

      // Reset Form
      setUploadTitle('');
      setUploadNakesNote('');
      setUploadFileDataUrl('');
      setUploadCoverUrl('');
      setUploadFileName('');
      setUploadFileSize('');
      setUploadFileObj(null);
      setShowUploadModal(false);
    } catch (err: any) {
      console.error('[Upload Exception]', err);
      alert('Error: ' + (err?.message || 'Terjadi kendala saat menyimpan modul edukasi.'));
    } finally {
      setIsSavingCustom(false);
    }
  };

  // Extract unique folders/categories from active PDFs
  const availableFolders = [
    'Semua',
    'Bayi BBLR & Prematur',
    'Metode Kanguru',
    'Higienitas & Manajemen ASI',
    'Perawatan Rutin & Skrining Bayi',
    ...Array.from(new Set(activePdfs.map((p) => p.category || 'Lainnya'))),
  ].filter((v, i, a) => a.indexOf(v) === i);

  // Filter PDFs by folder and search term
  const filteredPdfs = activePdfs.filter((pdf) => {
    const categoryName = pdf.category || 'Lainnya';
    const matchesFolder =
      selectedFolder === 'Semua' ||
      categoryName === selectedFolder ||
      (selectedFolder === 'Metode Kanguru' && (pdf.title.includes('Kanguru') || categoryName.includes('Kanguru')));

    const matchesSearch =
      !searchQuery.trim() ||
      pdf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((pdf.nakesNote || (pdf as any).nakesNotes) &&
        (pdf.nakesNote || (pdf as any).nakesNotes).toLowerCase().includes(searchQuery.toLowerCase())) ||
      (pdf.fileName &&
        pdf.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* TOP NAVIGATION HEADER WITH BACK BUTTON & UPLOAD BUTTON */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200/80 transition-all cursor-pointer group shrink-0"
            title="Kembali ke Dashboard Utama"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-teal-700 uppercase tracking-wider bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
                Akses Orang Tua
              </span>
              <span className="text-xs text-slate-400 font-medium">•</span>
              <span className="text-xs text-slate-500 font-medium">
                Bayi {patient.babyName} ({patient.nickname})
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
              Folder & Materi Edukasi Orang Tua
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Unggah Materi Baru</span>
          </button>

          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Laporan</span>
          </button>
        </div>
      </div>

      {/* BANNER INFORMASI DEDICATED PAGE */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 p-6 sm:p-7 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <BookOpen className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-teal-100 text-xs font-bold backdrop-blur-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>Dokumen Edukasi Resmi NICU RSUD Undata</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            Pusat Panduan & Modul Perawatan Buah Hati
          </h2>

          <p className="text-teal-100/90 text-xs sm:text-sm leading-relaxed font-normal">
            Halaman khusus tempat Ayah dan Bunda dapat melihat, mempelajari, dan mengunduh berkas rekomendasi edukasi medis (berformat .PDF) yang diterbitkan langsung oleh Tim Nakes NICU untuk persiapan perawatan di rumah.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-4 text-xs font-medium text-teal-100">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Terenkripsi & Akses Khusus Pasien
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-300" /> Format PDF Siap Cetak & Unduh
            </span>
          </div>
        </div>
      </div>

      {/* API STATUS / FALLBACK NOTIFICATION BANNER */}
      {apiStatus.isError && !isDismissedApiAlert && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-amber-900 flex items-center gap-2">
                <span>Pemberitahuan Status Endpoint API</span>
                <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded text-[10px] font-black uppercase">
                  {apiStatus.status === 404 ? 'HTTP 404 - Not Found' : `HTTP ${apiStatus.status || 'Offline'}`}
                </span>
              </div>
              <p className="mt-0.5 text-amber-900/90 text-xs leading-relaxed">
                {apiStatus.message} Seluruh panduan dan materi perawatan tetap dapat diakses dengan lancar dari memori aman lokal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sinkron Ulang</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissedApiAlert(true)}
              className="px-2.5 py-1.5 text-amber-800 hover:text-amber-950 font-bold hover:bg-amber-200/50 rounded-xl transition-colors cursor-pointer text-xs"
            >
              ✕ Tutup
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER: FOLDERS & LIST PDF */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-100 shadow-xs space-y-6">
        {/* FOLDER FILTER & SEARCH BAR */}
        <div className="bg-slate-50 p-4 sm:p-5 rounded-3xl border border-slate-200/80 space-y-4">
          {/* CATEGORY FOLDER PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-slate-800 text-xs font-black flex items-center gap-1.5 shrink-0 mr-1 pl-1">
              <Folder className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              Kategori:
            </span>
            {availableFolders.map((folder) => {
              const count = folder === 'Semua' ? activePdfs.length : activePdfs.filter((p) => p.category === folder).length;
              const isActive = selectedFolder === folder;
              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setSelectedFolder(folder)}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 text-xs font-extrabold flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{folder}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-teal-700 text-emerald-200' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* SEARCH BOX & VIEW TOGGLE */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul / catatan edukasi..."
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-600 outline-none shadow-2xs"
              />
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-bold text-slate-500">Tampilan:</span>
              <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-teal-800 text-white shadow-2xs font-extrabold'
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
                      ? 'bg-teal-800 text-white shadow-2xs font-extrabold'
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

        {/* GALLERY OF EDUCATION DOCUMENTS */}
        {activePdfs.length === 0 ? (
          <div className="p-10 text-center space-y-3 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-sm">Belum Ada Materi Edukasi PDF</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tim Nakes NICU belum menerbitkan berkas PDF edukasi untuk pasien ini. Silakan berkonsultasi langsung dengan tim perawat di ruangan.
              </p>
            </div>
          </div>
        ) : filteredPdfs.length === 0 ? (
          <div className="p-10 text-center space-y-3 bg-slate-50/80 rounded-3xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500 font-medium">
              Tidak ada dokumen edukasi yang cocok dengan pencarian atau folder terpilih.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedFolder('Semua');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-teal-50 text-teal-800 font-bold text-xs rounded-xl border border-teal-200 hover:bg-teal-100 transition-all cursor-pointer"
            >
              Reset Filter Folder & Pencarian
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPdfs.map((pdf) => {
              const coverImage = renderedCovers[pdf.id] || pdf.coverImageUrl || generateFallbackPdfCover(pdf.title, pdf.category);
              const noteText = pdf.nakesNote || (pdf as any).nakesNotes;
              return (
                <div
                  key={pdf.id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between group relative"
                >
                  {/* Image Section: Visual Thumbnail with Hover Overlay & Bright Green NEW Badge */}
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden flex items-center justify-center">
                    <img
                      src={coverImage}
                      alt={pdf.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Top Left Badge "NEW" (Bright Green) */}
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-md z-10 flex items-center gap-1">
                      NEW
                    </span>

                    {/* HOVER ACTION OVERLAY WITH 2 ROUND BUTTONS */}
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3.5 z-20">
                      <button
                        type="button"
                        onClick={() => setPreviewPdfModal(pdf)}
                        className="w-11 h-11 bg-white hover:bg-teal-50 text-teal-800 rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 transition-all cursor-pointer"
                        title="Pratinjau Isi Materi (Modal)"
                      >
                        <Eye className="w-5 h-5 text-teal-700" />
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadEducationPdf(pdf)}
                        className="w-11 h-11 bg-teal-800 hover:bg-teal-900 text-white rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 transition-all cursor-pointer"
                        title="Unduh Berkas PDF Asli"
                      >
                        <Download className="w-5 h-5 text-amber-300" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content Below Thumbnail */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-white">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 truncate max-w-[150px]">
                          {pdf.category || 'Umum'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {pdf.publishedAt || (pdf as any).createdAt || '12 Agt 2026'}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-slate-900 text-sm line-clamp-2 leading-snug group-hover:text-teal-800 transition-colors">
                        {pdf.title}
                      </h4>

                      <div className="text-[11px] text-slate-500 font-semibold flex items-center justify-between pt-0.5">
                        <span className="flex items-center gap-1 text-slate-600 font-bold">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>{pdf.pageCount || 1} Halaman</span>
                        </span>
                        <span className="text-slate-400 font-bold">{pdf.fileSizeText || (pdf as any).fileSize || '1.2 MB'}</span>
                      </div>

                      {noteText && (
                        <div className="p-2.5 bg-emerald-50/80 border border-emerald-100 rounded-2xl text-[11px] text-slate-700 italic font-medium max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-300 select-text mt-1">
                          "{noteText}"
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPreviewPdfModal(pdf)}
                        className="py-2 px-2.5 bg-slate-50 hover:bg-teal-50 text-teal-800 border border-slate-200 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-700" />
                        <span>Pratinjau</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadEducationPdf(pdf)}
                        className="py-2 px-2.5 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-300" />
                        <span>Unduh PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
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
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-800 text-white font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                    {index + 1}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-emerald-100/90 text-emerald-800 text-[11px] font-black rounded-lg flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-emerald-700 fill-emerald-700 shrink-0" />
                        <span>{pdf.category}</span>
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        {pdf.publishedAt || '12 Agt 2026'}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-snug">
                      {pdf.title}
                    </h3>

                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{pdf.fileName}</span>
                      <span className="shrink-0 font-bold text-slate-400">({pdf.fileSizeText || '1.2 MB'})</span>
                    </div>

                    {(pdf.nakesNote || (pdf as any).nakesNotes) && (
                      <div className="mt-2 bg-emerald-50/80 border border-emerald-100 rounded-xl p-3 space-y-0.5">
                        <div className="text-[10px] font-black tracking-wider text-teal-800 uppercase">
                          CATATAN KHUSUS NAKES:
                        </div>
                        <div className="text-xs text-slate-700 font-medium italic leading-relaxed max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-300 select-text">
                          "{pdf.nakesNote || (pdf as any).nakesNotes}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPreviewPdfModal(pdf)}
                    className="flex-1 md:flex-none py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-4 h-4 text-teal-600" />
                    <span>Pratinjau</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadEducationPdf(pdf)}
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
      </div>

      {/* MODAL PRATINJAU (PREVIEW MODAL MAX-W-4XL WITH BACKDROP-BLUR) */}
      {previewPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-white w-full max-w-4xl rounded-[28px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] relative">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-[#005c4b] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/15 text-white flex items-center justify-center shrink-0 shadow-inner">
                  <FileText className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white line-clamp-1">
                    {previewPdfModal.title}
                  </h3>
                  <p className="text-xs text-emerald-100 font-medium">
                    Kategori: {previewPdfModal.category || 'Umum'} • {previewPdfModal.publishedAt || previewPdfModal.createdAt || '12 Agt 2026'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewPdfModal(null)}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="Tutup Pratinjau"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-header: File Info & Nakes Notes */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-3 text-slate-600 font-mono text-xs">
                <span>Nama Berkas: <strong className="text-slate-900 font-bold">{previewPdfModal.fileName}</strong></span>
                <span>•</span>
                <span>Ukuran: <strong className="text-slate-900 font-bold">{previewPdfModal.fileSizeText || previewPdfModal.fileSize || '1.2 MB'}</strong></span>
              </div>

              {(previewPdfModal.nakesNote || (previewPdfModal as any).nakesNotes) && (
                <div className="text-xs text-teal-900 font-medium bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100 italic">
                  <strong className="not-italic font-bold text-teal-800">Catatan Nakes:</strong> "{previewPdfModal.nakesNote || (previewPdfModal as any).nakesNotes}"
                </div>
              )}
            </div>

            {/* Modal Main Body: High Resolution Large Visual Preview */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-900/95 flex items-center justify-center min-h-[400px]">
              {(() => {
                const displayImg =
                  renderedCovers[previewPdfModal.id] ||
                  previewPdfModal.coverImageUrl ||
                  (previewPdfModal.fileDataUrl && previewPdfModal.fileDataUrl.startsWith('data:image') ? previewPdfModal.fileDataUrl : null) ||
                  generateFallbackPdfCover(previewPdfModal.title, previewPdfModal.category || 'EDUKASI');

                return (
                  <div className="w-full flex justify-center items-center py-2">
                    <img
                      src={displayImg}
                      alt={previewPdfModal.title}
                      className="max-h-[580px] w-auto mx-auto object-contain rounded-2xl shadow-2xl border border-slate-700/50"
                    />
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <span className="text-xs font-medium text-slate-500">
                Sistem Informasi Rekam Medis NSPC • RSUD Undata Palu
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewPdfModal(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-2xl transition-all cursor-pointer border border-slate-200"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadEducationPdf(previewPdfModal);
                  }}
                  className="px-6 py-2.5 bg-[#005c4b] hover:bg-[#004a3c] text-white font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4 text-emerald-300" />
                  <span>Unduh PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UNGGAH MATERI EDUKASI BARU (CONVERT & UPLOAD) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-5 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-emerald-300" />
                <h3 className="font-extrabold text-base text-white">Unggah Materi Edukasi Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 text-xs font-medium text-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Judul Materi Edukasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Contoh: Panduan PMK & Perawatan Tali Pusat"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Kategori / Folder</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="Bayi BBLR & Prematur">Bayi BBLR & Prematur</option>
                  <option value="Metode Kanguru">Metode Kanguru</option>
                  <option value="Higienitas & Manajemen ASI">Higienitas & Manajemen ASI</option>
                  <option value="Perawatan Rutin & Skrining Bayi">Perawatan Rutin & Skrining Bayi</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Pilih Berkas (PDF / Gambar Infografis PNG/JPG) <span className="text-rose-500">*</span>
                </label>
                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="modal-file-upload-input"
                  />
                  <label
                    htmlFor="modal-file-upload-input"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-xs"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadFileName ? 'Ganti Berkas' : 'Pilih Berkas PDF / Gambar'}</span>
                  </label>
                  <p className="text-[11px] text-slate-500 italic">
                    {uploadFileName
                      ? `Terpilih: ${uploadFileName} (${uploadFileSize})`
                      : 'Otomatis dikonversi menjadi URL Gambar visual untuk pratinjau instant.'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Khusus Nakes <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <textarea
                  rows={2}
                  value={uploadNakesNote}
                  onChange={(e) => setUploadNakesNote(e.target.value)}
                  placeholder="Contoh: Bawa buku KIA saat kontrol ulang di Poliklinik Anak..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessingFile || isSavingCustom}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2"
                >
                  {isSavingCustom ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : isProcessingFile ? (
                    'Memproses Berkas...'
                  ) : (
                    'Simpan & Terbitkan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


