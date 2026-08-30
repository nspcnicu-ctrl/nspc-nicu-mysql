import React, { useState, useEffect } from 'react';
import { Patient, EducationPdfItem, NakesUser } from '../types';
import {
  savePdfDataUrl,
  getPdfDataUrlSync,
  getPdfDataUrl,
  triggerPdfDownload,
  dataUrlToBlob,
} from '../services/pdfStore';
import {
  getStoredGlobalPdfs,
  setMemoryGlobalPdfs,
  saveGlobalPdf,
  deleteStoredGlobalPdf,
  saveReorderedGlobalPdfs,
  syncGlobalPdfsFromBackend,
} from '../services/storage';
import {
  renderPdfFirstPageToImage,
  generateSamplePdfDataUrl,
  generateFallbackPdfCover,
  formatGoogleDriveEmbedUrl,
  formatGoogleDriveImageUrl,
  processCoverImageUrl,
  processPdfDocumentUrl,
  processEducationUrls,
  isGoogleDriveUrl,
  getPdfEmbedUrl,
  getPdfDirectDownloadUrl,
} from '../services/pdfRender';
import { downloadEducationPdf } from '../utils/pdfDownload';
import { PdfViewerCanvas } from './PdfViewerCanvas';
import { EducationPdfCard } from './EducationPdfCard';
import { getEducationApiStatus, EducationApiStatus, updateEducationPdfApi } from '../services/api';
import {
  ArrowLeft,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Folder,
  Search,
  Upload,
  Trash2,
  Eye,
  Download,
  Plus,
  X,
  Sparkles,
  Pencil,
  Printer,
  FileCheck,
  AlertCircle,
  Grid,
  List,
  Maximize2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Move,
  ArrowUpDown,
  ArrowLeftRight,
  Loader2,
  RefreshCw,
  Link2,
  Globe,
} from 'lucide-react';

interface GlobalEducationPageProps {
  patients: Patient[];
  onBack: () => void;
  onSavePatients: (updatedPatients: Patient[]) => void;
  onRefreshData: () => void;
  currentNakesUser?: NakesUser | null;
}

export const GlobalEducationPage: React.FC<GlobalEducationPageProps> = ({
  patients,
  onBack,
  onSavePatients,
  onRefreshData,
  currentNakesUser,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUploadFormOpen, setIsUploadFormOpen] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoadingPdfs, setIsLoadingPdfs] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Form State for NEW PDF (100% URL-Based)
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfCategory, setPdfCategory] = useState('Bayi BBLR & Prematur');
  const [pdfDocUrl, setPdfDocUrl] = useState('');
  const [pdfCoverUrl, setPdfCoverUrl] = useState('');
  const [pdfNakesNote, setPdfNakesNote] = useState('');

  // EDIT PDF State & Form (100% URL-Based)
  const [editingPdf, setEditingPdf] = useState<EducationPdfItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Bayi BBLR & Prematur');
  const [editDocUrl, setEditDocUrl] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editNakesNote, setEditNakesNote] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Preview Modal
  const [previewPdf, setPreviewPdf] = useState<EducationPdfItem | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(100);

  // Success Notification
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<EducationApiStatus>(() => getEducationApiStatus());
  const [isDismissedApiAlert, setIsDismissedApiAlert] = useState<boolean>(false);

  // Pop Up Confirmation Modal for Trash Icons (File Input & Uploaded Results)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    fileName?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const [renderedCovers, setRenderedCovers] = useState<Record<string, string>>({});
  const [storedPdfs, setStoredPdfs] = useState<EducationPdfItem[]>(() => getStoredGlobalPdfs());
  const [draggedPdfId, setDraggedPdfId] = useState<string | null>(null);
  const [dragOverPdfId, setDragOverPdfId] = useState<string | null>(null);

  // 1. Fetch live from MySQL Database on Mount & Subscribe to Realtime Updates
  useEffect(() => {
    let isMounted = true;

    const loadLiveEducationPdfs = async () => {
      setIsLoadingPdfs(true);
      try {
        const livePdfs = await syncGlobalPdfsFromBackend();
        if (livePdfs && isMounted) {
          setStoredPdfs(livePdfs);
        }
      } catch (err) {
        console.warn('[GlobalEducation] Initial fetch error:', err);
      } finally {
        if (isMounted) {
          setIsLoadingPdfs(false);
          setApiStatus(getEducationApiStatus());
        }
      }
    };

    loadLiveEducationPdfs();

    const handleDataChanged = () => {
      if (isMounted) {
        setStoredPdfs(getStoredGlobalPdfs());
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
      const livePdfs = await syncGlobalPdfsFromBackend();
      if (livePdfs) {
        setStoredPdfs(livePdfs);
        setSuccessBanner('🔄 Berhasil memperbarui daftar edukasi dari MySQL Database!');
        setTimeout(() => setSuccessBanner(null), 3000);
      }
    } catch (err) {
      console.warn('[Refresh error]:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const DUMMY_PDF_IDS = new Set(['edu_pmk_01', 'edu_asi_02', 'edu_tanda_bahaya_03', 'edu_perawatan_04']);
  const allPdfs = storedPdfs.filter((p) => p && !DUMMY_PDF_IDS.has(p.id));

  // Reorder and persist layout placement
  const handleReorderPdfs = (newOrderedList: EducationPdfItem[]) => {
    const listWithIndex = newOrderedList.map((item, idx) => ({
      ...item,
      orderIndex: idx,
    }));
    setStoredPdfs(listWithIndex);
    saveReorderedGlobalPdfs(listWithIndex);

    // Update patients educationPdfs
    const updatedPatients = patients.map((p) => {
      return {
        ...p,
        educationPdfs: listWithIndex.map((pdfItem) => {
          const prev = (p.educationPdfs || []).find((old) => old.id === pdfItem.id);
          return {
            ...pdfItem,
            isActive: prev ? prev.isActive : pdfItem.isActive,
          };
        }),
      };
    });
    onSavePatients(updatedPatients);

    setSuccessBanner('Tata letak posisi kartu PDF berhasil dipindahkan & langsung tersinkronisasi ke Dashboard Orang Tua!');
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  const handleMovePdf = (pdfId: string, direction: 'left' | 'right' | 'first' | 'last') => {
    const currentList = [...allPdfs];
    const currentIndex = currentList.findIndex((p) => p.id === pdfId);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (direction === 'left' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'right' && currentIndex < currentList.length - 1) {
      targetIndex = currentIndex + 1;
    } else if (direction === 'first') {
      targetIndex = 0;
    } else if (direction === 'last') {
      targetIndex = currentList.length - 1;
    }

    if (targetIndex === currentIndex) return;

    const [movedItem] = currentList.splice(currentIndex, 1);
    currentList.splice(targetIndex, 0, movedItem);
    handleReorderPdfs(currentList);
  };

  const handleMoveToPosition = (pdfId: string, newPos1Based: number) => {
    const currentList = [...allPdfs];
    const currentIndex = currentList.findIndex((p) => p.id === pdfId);
    if (currentIndex === -1) return;

    const targetIndex = Math.max(0, Math.min(currentList.length - 1, newPos1Based - 1));
    if (targetIndex === currentIndex) return;

    const [movedItem] = currentList.splice(currentIndex, 1);
    currentList.splice(targetIndex, 0, movedItem);
    handleReorderPdfs(currentList);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedPdfId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPdfId !== targetId) {
      setDragOverPdfId(targetId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedPdfId || e.dataTransfer.getData('text/plain');
    setDraggedPdfId(null);
    setDragOverPdfId(null);

    if (!sourceId || sourceId === targetId) return;

    const currentList = [...allPdfs];
    const sourceIndex = currentList.findIndex((p) => p.id === sourceId);
    const targetIndex = currentList.findIndex((p) => p.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedItem] = currentList.splice(sourceIndex, 1);
    currentList.splice(targetIndex, 0, movedItem);
    handleReorderPdfs(currentList);
  };

  const handleDragEnd = () => {
    setDraggedPdfId(null);
    setDragOverPdfId(null);
  };

  // Automatic PDF to PNG Thumbnail Generation Effect
  useEffect(() => {
    let isMounted = true;
    async function prepareThumbnails() {
      const covers: Record<string, string> = {};
      for (const pdf of allPdfs) {
        let dataUrl = pdf.fileDataUrl || getPdfDataUrlSync(pdf.id);
        if (!dataUrl || dataUrl === '#') {
          dataUrl = generateSamplePdfDataUrl(pdf.title, pdf.category, pdf.nakesNote);
          savePdfDataUrl(pdf.id, dataUrl);
        }
        if (pdf.coverImageUrl && pdf.coverImageUrl.startsWith('data:image')) {
          covers[pdf.id] = pdf.coverImageUrl;
        } else if (dataUrl) {
          try {
            const { coverUrl } = await renderPdfFirstPageToImage(dataUrl);
            if (coverUrl) {
              covers[pdf.id] = coverUrl;
            } else {
              covers[pdf.id] = generateFallbackPdfCover(pdf.title, pdf.category);
            }
          } catch {
            covers[pdf.id] = generateFallbackPdfCover(pdf.title, pdf.category);
          }
        }
      }
      if (isMounted) {
        setRenderedCovers((prev) => ({ ...covers, ...prev }));
      }
    }
    prepareThumbnails();
    return () => {
      isMounted = false;
    };
  }, [allPdfs.length]);

  // Extract categories dynamically
  const categoriesList = ['Semua', ...Array.from(new Set(allPdfs.map((p) => p.category)))];

  // Filtered PDFs
  const filteredPdfs = allPdfs.filter((pdf) => {
    const matchCat = selectedCategory === 'Semua' || pdf.category === selectedCategory;
    const matchSearch =
      searchQuery.trim() === '' ||
      pdf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pdf.nakesNote && pdf.nakesNote.toLowerCase().includes(searchQuery.toLowerCase())) ||
      pdf.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfTitle.trim()) {
      alert('Judul materi edukasi wajib diisi.');
      return;
    }

    if (!pdfDocUrl.trim()) {
      alert('URL Berkas / Link PDF (Google Drive atau Direct Link) wajib diisi.');
      return;
    }

    setIsUploading(true);
    const newPdfId = 'pdf_' + Date.now();

    try {
      // Automatic Google Drive and Link URL Processing
      const { finalPdfUrl, finalCoverUrl } = processEducationUrls(
        pdfDocUrl.trim(),
        pdfCoverUrl.trim()
      );

      const resolvedCoverUrl =
        finalCoverUrl || generateFallbackPdfCover(pdfTitle.trim(), pdfCategory);

      // Cache locally
      if (finalPdfUrl) {
        savePdfDataUrl(newPdfId, finalPdfUrl);
      }
      if (resolvedCoverUrl) {
        savePdfDataUrl(`cover_${newPdfId}`, resolvedCoverUrl);
      }

      const isDrive = isGoogleDriveUrl(pdfDocUrl.trim());
      const fileName = `${pdfTitle.trim().replace(/\s+/g, '_')}.pdf`;
      const fileSizeText = isDrive ? 'Google Drive' : 'Direct Link';

      const newPdf: EducationPdfItem = {
        id: newPdfId,
        title: pdfTitle.trim(),
        category: pdfCategory,
        fileName: fileName,
        fileSizeText: fileSizeText,
        fileDataUrl: finalPdfUrl,
        coverImageUrl: resolvedCoverUrl,
        pageCount: 1,
        nakesNote: pdfNakesNote.trim() || undefined,
        publishedAt: new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        isActive: true,
      };

      // Save to MySQL & Memory
      saveGlobalPdf(newPdf);
      setStoredPdfs((prev) => [newPdf, ...prev.filter((p) => p.id !== newPdfId)]);

      if (resolvedCoverUrl) {
        setRenderedCovers((prev) => ({ ...prev, [newPdfId]: resolvedCoverUrl }));
      }

      // Auto attach to existing patient records
      if (patients && patients.length > 0) {
        const updatedPatients = patients.map((p) => {
          const existing = p.educationPdfs || [];
          return {
            ...p,
            educationPdfs: [newPdf, ...existing.filter((item) => item.id !== newPdfId)],
          };
        });
        onSavePatients(updatedPatients);
      }

      onRefreshData();

      setSuccessBanner(
        `🎉 Berhasil! Modul "${newPdf.title}" telah tersimpan ke Database MySQL dan tersinkronisasi!`
      );

      // Reset Form
      setPdfTitle('');
      setPdfDocUrl('');
      setPdfCoverUrl('');
      setPdfNakesNote('');
    } catch (err: any) {
      console.error('Upload Education Error:', err);
      alert('Error: ' + (err?.message || 'Terjadi kendala saat menyimpan modul edukasi.'));
    } finally {
      setIsUploading(false);
    }
  };

  // OPEN EDIT MODAL
  const handleOpenEdit = (pdf: EducationPdfItem) => {
    const existingDataUrl = pdf.fileDataUrl || getPdfDataUrlSync(pdf.id) || '';
    setEditingPdf(pdf);
    setEditTitle(pdf.title);
    setEditCategory(pdf.category);
    setEditDocUrl(existingDataUrl);
    setEditCoverUrl(pdf.coverImageUrl || '');
    setEditNakesNote(pdf.nakesNote || '');
  };

  // SAVE EDITED PDF
  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPdf) return;
    if (!editTitle.trim()) {
      alert('Judul materi edukasi tidak boleh kosong.');
      return;
    }
    if (!editDocUrl.trim()) {
      alert('URL Berkas / Link PDF tidak boleh kosong.');
      return;
    }

    setIsSavingEdit(true);

    try {
      const { finalPdfUrl, finalCoverUrl } = processEducationUrls(
        editDocUrl.trim(),
        editCoverUrl.trim()
      );

      const resolvedCoverUrl =
        finalCoverUrl || editingPdf.coverImageUrl || generateFallbackPdfCover(editTitle.trim(), editCategory);

      if (finalPdfUrl) {
        savePdfDataUrl(editingPdf.id, finalPdfUrl);
      }
      if (resolvedCoverUrl) {
        savePdfDataUrl(`cover_${editingPdf.id}`, resolvedCoverUrl);
      }

      const isDrive = isGoogleDriveUrl(editDocUrl.trim());
      const fileName = `${editTitle.trim().replace(/\s+/g, '_')}.pdf`;
      const fileSizeText = isDrive ? 'Google Drive' : 'Direct Link';

      const updatedPdfItem: EducationPdfItem = {
        ...editingPdf,
        title: editTitle.trim(),
        category: editCategory,
        nakesNote: editNakesNote.trim() || undefined,
        fileName: fileName,
        fileSizeText: fileSizeText,
        fileDataUrl: finalPdfUrl,
        coverImageUrl: resolvedCoverUrl,
      };

      // Explicitly send PUT request to API and update local store
      await updateEducationPdfApi(updatedPdfItem);
      saveGlobalPdf(updatedPdfItem);
      setStoredPdfs((prev) => prev.map((item) => (item.id === editingPdf.id ? updatedPdfItem : item)));

      if (resolvedCoverUrl) {
        setRenderedCovers((prev) => ({ ...prev, [editingPdf.id]: resolvedCoverUrl }));
      }

      // Update across all patient records
      const updatedPatients = patients.map((p) => {
        const existing = p.educationPdfs || [];
        const hasIt = existing.some((item) => item.id === editingPdf.id);
        if (hasIt) {
          return {
            ...p,
            educationPdfs: existing.map((item) =>
              item.id === editingPdf.id ? updatedPdfItem : item
            ),
          };
        } else {
          return {
            ...p,
            educationPdfs: [updatedPdfItem, ...existing],
          };
        }
      });

      onSavePatients(updatedPatients);
      const freshPdfs = await syncGlobalPdfsFromBackend();
      if (freshPdfs && freshPdfs.length > 0) {
        setStoredPdfs(freshPdfs);
      }
      onRefreshData();
      setSuccessBanner(`✏️ Berhasil memperbarui data materi PDF "${updatedPdfItem.title}" di Database.`);
      setEditingPdf(null);
    } catch (err: any) {
      console.error('Error updating PDF:', err);
      alert('Error: ' + (err?.message || 'Silakan coba lagi.'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // PROMPT TRASH ICON FOR UPLOADED RESULTS CARD
  const handleDeleteGlobalPdf = (pdfId: string, pdfTitle: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Hapus PDF Edukasi dari Sistem?',
      description: `Apakah Anda yakin ingin menghapus file PDF "${pdfTitle}" dari seluruh data pasien? Dokumen ini tidak akan tampil lagi di folder edukasi.`,
      onConfirm: async () => {
        deleteStoredGlobalPdf(pdfId);
        setStoredPdfs((prev) => prev.filter((p) => p.id !== pdfId));

        const updatedPatients = patients.map((p) => {
          const existing = p.educationPdfs || [];
          return {
            ...p,
            educationPdfs: existing.filter((item) => item.id !== pdfId),
          };
        });

        onSavePatients(updatedPatients);
        onRefreshData();
        setSuccessBanner(`🗑️ Berhasil menghapus PDF "${pdfTitle}" dari sistem.`);
      },
    });
  };

  const handleDownloadPdf = async (pdf: EducationPdfItem) => {
    downloadEducationPdf(pdf);
  };

  const handlePrintPdf = async (pdf: EducationPdfItem) => {
    let dataUrl = pdf.fileDataUrl || getPdfDataUrlSync(pdf.id);
    if (!dataUrl || dataUrl === '#') {
      dataUrl = await getPdfDataUrl(pdf.id);
    }
    if (!dataUrl || dataUrl === '#') {
      dataUrl = generateSamplePdfDataUrl(pdf.title, pdf.category, pdf.nakesNote);
      savePdfDataUrl(pdf.id, dataUrl);
    }

    if (dataUrl) {
      const blob = dataUrlToBlob(dataUrl);
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
        setTimeout(() => printWindow.print(), 800);
      }
    } else {
      alert('Berkas PDF asli belum diunggah untuk modul edukasi ini.');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans animate-fadeIn">
      {/* TOP BAR / HEADER NAVIGATION */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Kembali ke Dashboard Nakes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-[11px] font-extrabold text-teal-700 tracking-wider flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-md font-extrabold text-[10px]">
                AKSES NAKES / ADMIN
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">
                {currentNakesUser ? `Petugas: ${currentNakesUser.name}` : 'Kelola Materi Edukasi Global'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              Folder &amp; Materi Edukasi Orang Tua
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-amber-300" />
          <span>Kembali ke Dashboard Nakes</span>
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
            Pusat Panduan &amp; Modul Perawatan Buah Hati
          </h1>

          <p className="text-xs sm:text-sm text-teal-100 max-w-2xl leading-relaxed">
            Halaman khusus tempat Ayah dan Bunda dapat melihat, mempelajari, dan mengunduh berkas rekomendasi edukasi medis (berformat .PDF) yang diterbitkan langsung oleh Tim Nakes NICU untuk persiapan perawatan di rumah.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-bold text-emerald-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Terenkripsi &amp; Akses Khusus Pasien</span>
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Format PDF Siap Cetak</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Otomatis Terhubung ke Seluruh Pasien</span>
            </span>
          </div>
        </div>
      </div>

      {/* SUCCESS BANNER */}
      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 font-extrabold text-xs px-2 py-1 rounded-lg hover:bg-emerald-100 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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
                {apiStatus.message} Seluruh modul dan materi tetap dapat diakses, dibaca, dan dikelola secara aman dari penyimpanan lokal (IndexedDB &amp; LocalStorage).
              </p>
              <div className="mt-1 text-[11px] text-amber-800/80 font-mono">
                Endpoint: <span className="underline">{apiStatus.endpoint}</span>
              </div>
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
              <span>Coba Hubungkan Ulang</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissedApiAlert(true)}
              className="px-2.5 py-1.5 text-amber-800 hover:text-amber-950 font-bold hover:bg-amber-200/50 rounded-xl transition-colors cursor-pointer text-xs"
              title="Tutup pemberitahuan"
            >
              ✕ Tutup
            </button>
          </div>
        </div>
      )}

      {/* FORM: INPUT URL MATERI EDUKASI (PDF & GAMBAR SAMPUL) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5 stroke-[2.5] text-teal-700" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Input URL Materi Edukasi (PDF &amp; Gambar Sampul)
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Gunakan URL link Google Drive atau direct link agar materi edukasi langsung tersimpan dan otomatis tampil utuh pada kartu pasien.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsUploadFormOpen(!isUploadFormOpen)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>{isUploadFormOpen ? 'Sembunyikan Form' : 'Buka Form URL'}</span>
          </button>
        </div>

        {isUploadFormOpen && (
          <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Judul Materi Edukasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Panduan PMK & Perawatan Bayi Prematur di Rumah"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Kategori Edukasi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={pdfCategory}
                  onChange={(e) => setPdfCategory(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                >
                  <option value="Bayi BBLR & Prematur">Bayi BBLR & Prematur</option>
                  <option value="Perawatan Rutin & Skrining Bayi">Perawatan Rutin & Skrining Bayi</option>
                  <option value="Perawatan Medis Khusus & Pasca-Operasi">Perawatan Medis Khusus & Pasca-Operasi</option>
                  <option value="Higienitas & Manajemen ASI">Higienitas & Manajemen ASI</option>
                  <option value="Kegawatdaruratan & Dukungan Duka">Kegawatdaruratan & Dukungan Duka</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Input 1: URL Berkas / Link PDF */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  URL Berkas / Link PDF (Google Drive / Direct URL) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/file/d/.../view atau https://domain.com/file.pdf"
                    value={pdfDocUrl}
                    onChange={(e) => setPdfDocUrl(e.target.value)}
                    className="w-full p-2.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-500 outline-none font-mono"
                  />
                  <Globe className="w-4 h-4 text-teal-600 absolute left-2.5 top-3" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 Mendukung link Google Drive, Dropbox, atau direct link PDF.
                </p>
              </div>

              {/* Input 2: URL Gambar Sampul / Infografis */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  URL Gambar Sampul / Infografis <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/.../view atau https://domain.com/poster.png"
                    value={pdfCoverUrl}
                    onChange={(e) => setPdfCoverUrl(e.target.value)}
                    className="w-full p-2.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-500 outline-none font-mono"
                  />
                  <Link2 className="w-4 h-4 text-amber-500 absolute left-2.5 top-3" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  🖼️ Link Google Drive gambar PNG/JPG atau direct image URL untuk tampilan poster penuh yang jernih.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Catatan Khusus Nakes untuk Orang Tua <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Ibu disarankan membaca panduan PMK sebelum melakukan dekapan hangat kontak kulit-ke-kulit di NICU..."
                value={pdfNakesNote}
                onChange={(e) => setPdfNakesNote(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-teal-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 disabled:bg-teal-600 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                  <span>Menyimpan ke Database...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-amber-300" />
                  <span>Simpan &amp; Terbitkan Ke Seluruh Pasien</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* FILTER, SEARCH BAR & VIEW TOGGLE */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
        {/* Top: Pill Rounded Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-black text-slate-800 shrink-0 mr-1 flex items-center gap-1.5">
            <Folder className="w-4 h-4 text-emerald-600 fill-emerald-600" />
            <span>Kategori:</span>
          </span>

          {categoriesList.map((cat) => {
            const count =
              cat === 'Semua'
                ? allPdfs.length
                : allPdfs.filter((p) => p.category === cat).length;
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs ${
                  isActive
                    ? 'bg-teal-800 text-white shadow-xs scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-teal-700 text-emerald-200' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom Search & View Switcher */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
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

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Sinkronkan ulang data dari MySQL Database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Menyinkronkan...' : 'Sinkron Database'}</span>
            </button>

            <span className="text-xs font-bold text-slate-500">Tampilan:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Galeri Grid (4-5 Kolom)"
              >
                <Grid className="w-4 h-4" />
                <span className="hidden md:inline">Galeri Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Daftar Horizontal dengan Nomor"
              >
                <List className="w-4 h-4" />
                <span className="hidden md:inline">Daftar Nomor</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF GALLERY CARDS */}
      {filteredPdfs.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          Tidak ada dokumen PDF edukasi yang cocok dengan pencarian / kategori ini.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Custom Layout Position Info Bar */}
          <div className="p-3.5 bg-gradient-to-r from-teal-50 via-emerald-50 to-amber-50 border border-teal-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-semibold text-slate-800 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-800 text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-slate-900 block sm:inline mr-1">
                  Kustomisasi Tata Letak &amp; Urutan Grid Aktif:
                </span>
                <span className="text-slate-600">
                  Pindahkan letak posisi kartu (seret / drag &amp; drop atau klik panah ‹ ›) untuk mengatur urutan penempatan. Urutan ini langsung otomatis diterapkan ke Dashboard Orang Tua.
                </span>
              </div>
            </div>
            <div className="px-2.5 py-1 bg-white/90 border border-teal-300/80 rounded-xl text-[11px] font-black text-teal-800 shrink-0 shadow-2xs flex items-center gap-1.5 self-end sm:self-auto">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Sinkron ke Dashboard Orang Tua</span>
            </div>
          </div>

          {viewMode === 'grid' ? (
            /* RESPONSIVE GRID GALLERY LAYOUT (4-5 KOLOM DESKTOP, 2-3 TABLET, 1 MOBILE) */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {filteredPdfs.map((pdf) => {
                const coverImage = renderedCovers[pdf.id] || pdf.coverImageUrl || generateFallbackPdfCover(pdf.title, pdf.category);
                const globalIndex = allPdfs.findIndex((p) => p.id === pdf.id);
                const isFirst = globalIndex === 0;
                const isLast = globalIndex === allPdfs.length - 1;

                return (
                  <div
                    key={pdf.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, pdf.id)}
                    onDragOver={(e) => handleDragOver(e, pdf.id)}
                    onDrop={(e) => handleDrop(e, pdf.id)}
                    onDragEnd={handleDragEnd}
                    className={`transition-all duration-200 rounded-3xl ${
                      draggedPdfId === pdf.id
                        ? 'opacity-40 scale-95 border-dashed border-teal-500 shadow-none'
                        : dragOverPdfId === pdf.id
                        ? 'ring-4 ring-teal-400 ring-offset-2 scale-[1.02] shadow-2xl'
                        : ''
                    }`}
                  >
                    <EducationPdfCard
                      pdf={pdf}
                      coverImage={coverImage}
                      positionNumber={globalIndex + 1}
                      onOpenPreview={() => {
                        setPreviewPdf(pdf);
                        setZoomScale(100);
                      }}
                      onDownload={() => handleDownloadPdf(pdf)}
                      onEdit={() => handleOpenEdit(pdf)}
                      onDelete={() => handleDeleteGlobalPdf(pdf.id, pdf.title)}
                      showReorder={true}
                      isFirst={isFirst}
                      isLast={isLast}
                      onMoveUp={() => handleMovePdf(pdf.id, 'left')}
                      onMoveDown={() => handleMovePdf(pdf.id, 'right')}
                      isNakesAdmin={true}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            /* HORIZONTAL RECTANGULAR CARDS WITH SEQUENTIAL NUMBERING */
            <div className="space-y-4">
              {filteredPdfs.map((pdf) => {
                const globalIndex = allPdfs.findIndex((p) => p.id === pdf.id);
                const isFirst = globalIndex === 0;
                const isLast = globalIndex === allPdfs.length - 1;

                return (
                  <div
                    key={pdf.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, pdf.id)}
                    onDragOver={(e) => handleDragOver(e, pdf.id)}
                    onDrop={(e) => handleDrop(e, pdf.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      draggedPdfId === pdf.id
                        ? 'opacity-40 border-dashed border-teal-500 shadow-none'
                        : dragOverPdfId === pdf.id
                        ? 'ring-4 ring-teal-400 ring-offset-2 border-teal-500 shadow-xl'
                        : 'border-emerald-400/80 shadow-2xs hover:shadow-md'
                    }`}
                  >
                    {/* Left Section: Numbering Badge + Position Mover + Main Content */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Numbering + Move Controls */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-800 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-xs cursor-grab active:cursor-grabbing"
                          title="Tahan dan geser (drag & drop) untuk mengatur urutan"
                        >
                          {globalIndex + 1}
                        </div>

                        {/* List Quick Move Buttons */}
                        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMovePdf(pdf.id, 'left')}
                            className={`p-1 rounded transition-all cursor-pointer ${
                              isFirst
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-700 hover:bg-white hover:text-teal-800 shadow-2xs'
                            }`}
                            title="Geser ke Posisi Sebelumnya"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMovePdf(pdf.id, 'right')}
                            className={`p-1 rounded transition-all cursor-pointer ${
                              isLast
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-700 hover:bg-white hover:text-teal-800 shadow-2xs'
                            }`}
                            title="Geser ke Posisi Berikutnya"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Main Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Top Header Row: Category Badge & Date */}
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

                        {/* Green Box: Catatan Khusus Nakes */}
                        {pdf.nakesNote && (
                          <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl space-y-0.5 mt-2">
                            <div className="text-[10px] font-black text-teal-800 tracking-wider uppercase">
                              CATATAN KHUSUS NAKES:
                            </div>
                            <div className="text-xs text-slate-700 italic font-medium leading-relaxed max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-300 select-text">
                              "{pdf.nakesNote}"
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Row: Pratinjau, Edit, Unduh PDF, Hapus */}
                    <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {/* BUTTON PRATINJAU */}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPdf(pdf);
                            setZoomScale(100);
                          }}
                          className="px-3 py-2 bg-slate-50 hover:bg-teal-50 text-teal-800 border border-slate-200 hover:border-teal-300 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          title="Lihat isi dalam PDF"
                        >
                          <Eye className="w-3.5 h-3.5 text-teal-700" />
                          <span>Pratinjau</span>
                        </button>

                        {/* BUTTON EDIT */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(pdf)}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          title="Edit judul, kategori, atau catatan PDF ini"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-800" />
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* BUTTON UNDUH PDF */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(pdf)}
                          className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-300" />
                          <span>Unduh PDF</span>
                        </button>

                        {/* BUTTON HAPUS */}
                        <button
                          type="button"
                          onClick={() => handleDeleteGlobalPdf(pdf.id, pdf.title)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Hapus PDF Edukasi dari Seluruh Pasien"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL EDIT PDF */}
      {editingPdf && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingPdf(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                <Pencil className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-extrabold rounded-md">
                  EDIT MODUL EDUKASI
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  Edit PDF Edukasi
                </h3>
              </div>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Judul Materi Edukasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Kategori Edukasi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                >
                  <option value="Bayi BBLR & Prematur">Bayi BBLR & Prematur</option>
                  <option value="Perawatan Rutin & Skrining Bayi">Perawatan Rutin & Skrining Bayi</option>
                  <option value="Perawatan Medis Khusus & Pasca-Operasi">Perawatan Medis Khusus & Pasca-Operasi</option>
                  <option value="Higienitas & Manajemen ASI">Higienitas & Manajemen ASI</option>
                  <option value="Kegawatdaruratan & Dukungan Duka">Kegawatdaruratan & Dukungan Duka</option>
                </select>
              </div>

              <div className="space-y-4">
                {/* Input 1: URL Berkas / Link PDF */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    URL Berkas / Link PDF (Google Drive / Direct URL) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      required
                      placeholder="https://drive.google.com/file/d/.../view atau https://domain.com/file.pdf"
                      value={editDocUrl}
                      onChange={(e) => setEditDocUrl(e.target.value)}
                      className="w-full p-2.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-500 outline-none font-mono"
                    />
                    <Globe className="w-4 h-4 text-teal-600 absolute left-2.5 top-3" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    💡 Mendukung link Google Drive, Dropbox, atau direct link PDF.
                  </p>
                </div>

                {/* Input 2: URL Gambar Sampul / Infografis */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    URL Gambar Sampul / Infografis <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/.../view atau https://domain.com/poster.png"
                      value={editCoverUrl}
                      onChange={(e) => setEditCoverUrl(e.target.value)}
                      className="w-full p-2.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-500 outline-none font-mono"
                    />
                    <Link2 className="w-4 h-4 text-amber-500 absolute left-2.5 top-3" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    🖼️ Link Google Drive gambar PNG/JPG atau direct image URL untuk tampilan cover poster jernih.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Khusus Nakes untuk Orang Tua <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <textarea
                  rows={3}
                  value={editNakesNote}
                  onChange={(e) => setEditNakesNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 outline-none"
                  placeholder="Tuliskan catatan atau pesan khusus nakes di sini..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPdf(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU PDF (PERSIS LAYOUT SCREENSHOT SANGAT PRESISI) */}
      {previewPdf && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-[9999] animate-fadeIn font-sans">
          <div className="bg-white rounded-[24px] max-w-3xl w-full flex flex-col shadow-2xl overflow-hidden relative max-h-[95vh] border border-slate-100">
            {/* 1. DARK TEAL HEADER BANNER */}
            <div className="bg-[#005c4b] px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 text-white flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    {previewPdf.title}
                  </h3>
                  <div className="text-xs text-emerald-100 font-medium mt-0.5">
                    Kategori: {previewPdf.category} &bull; {previewPdf.publishedAt}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewPdf(null)}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="Tutup Pratinjau"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2. MODAL BODY (CARD INFO + PDF VIEWER) */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-white">
              {/* TOP LIGHT GRAY INFO BOX */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-500 font-mono">
                  <span>Nama Berkas: <strong className="text-slate-700">{previewPdf.fileName}</strong></span>
                  <span>Ukuran: <strong className="text-slate-700">{previewPdf.fileSizeText}</strong></span>
                </div>

                <div className="border-t border-slate-200/80 my-2 pt-2">
                  <div className="text-xs font-black text-teal-800">
                    Catatan Khusus Nakes:
                  </div>
                  <div className="text-xs italic text-slate-700 font-medium mt-0.5">
                    "{previewPdf.nakesNote || 'Harap pelajari petunjuk dalam modul ini dengan seksama.'}"
                  </div>
                </div>
              </div>

              {/* Native PDF / Google Drive Iframe Viewer */}
              <PdfViewerCanvas
                dataUrl={previewPdf.fileDataUrl || getPdfDataUrlSync(previewPdf.id)}
                title={previewPdf.title}
                fileName={previewPdf.fileName}
                nakesNote={previewPdf.nakesNote}
                onDownload={() => handleDownloadPdf(previewPdf)}
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
                  onClick={() => setPreviewPdf(null)}
                  className="px-5 py-2.5 bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPdf(previewPdf)}
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

      {/* POP UP CONFIRMATION MODAL UNTUK IKON SAMPAH */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[10000] animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
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
                  {deleteModal.title}
                </h3>
                <p className="text-xs text-rose-600 font-bold mt-0.5">Konfirmasi Tindakan Hapus</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 leading-relaxed font-medium space-y-2">
              <p>{deleteModal.description}</p>
              {deleteModal.fileName && (
                <div className="pt-2 border-t border-slate-200/80 text-[11px] font-mono text-slate-800 font-bold truncate">
                  Nama Berkas: <span className="text-rose-700">{deleteModal.fileName}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteModal.onConfirm();
                  setDeleteModal((prev) => ({ ...prev, isOpen: false }));
                }}
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
  );
};
