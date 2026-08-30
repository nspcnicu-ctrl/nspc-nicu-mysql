import React, { useState } from 'react';
import { EducationPdfItem } from '../types';
import {
  isGoogleDriveUrl,
  getPdfEmbedUrl,
  generateFallbackPdfCover,
  processCoverImageUrl,
} from '../services/pdfRender';
import { getPdfDataUrlSync } from '../services/pdfStore';
import {
  Download,
  Eye,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface EducationPdfCardProps {
  pdf: EducationPdfItem;
  coverImage?: string;
  positionNumber?: number;
  onOpenPreview?: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleActive?: () => void;
  // Reorder props (optional for Nakes view)
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  showReorder?: boolean;
  // View mode
  isNakesAdmin?: boolean;
}

export const EducationPdfCard: React.FC<EducationPdfCardProps> = ({
  pdf,
  coverImage,
  positionNumber,
  onOpenPreview,
  onDownload,
  onEdit,
  onDelete,
  onToggleActive,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  showReorder,
  isNakesAdmin = false,
}) => {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const rawUrl = pdf.fileDataUrl || (pdf as any).fileUrl || getPdfDataUrlSync(pdf.id) || '';
  const embedUrl = getPdfEmbedUrl(rawUrl);
  const isDrive = isGoogleDriveUrl(rawUrl);
  const isHttp = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
  const isDataPdf = rawUrl.startsWith('data:application/pdf');
  const isDataImage = rawUrl.startsWith('data:image');

  const customCover = pdf.coverImageUrl
    ? processCoverImageUrl(pdf.coverImageUrl)
    : coverImage
    ? processCoverImageUrl(coverImage)
    : '';

  const fallbackCover = customCover || generateFallbackPdfCover(pdf.title, pdf.category);
  const hasLiveEmbed = !customCover && !!embedUrl && (isDrive || isHttp || isDataPdf);
  const pageCount = pdf.pageCount || 1;

  // Subtitle / Kategori text
  const subCategoryText = pdf.category || 'Materi Edukasi';

  // Short description
  const shortDescription = pdf.nakesNote
    ? pdf.nakesNote
    : 'Panduan klinis dan edukasi perawatan bayi untuk orang tua dan tenaga medis.';

  return (
    <div className="relative bg-white rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-gray-200 overflow-hidden flex flex-col justify-between transition-all duration-300 group select-none">
      {/* 1. CONTAINER PREVIEW GAMBAR (ASPECT 3/4 DENGAN BG-SLATE-100 BERSIH TANPA BAR HITAM) */}
      <div className="relative w-full aspect-[3/4] bg-slate-100 rounded-t-2xl overflow-hidden flex items-center justify-center p-2 group/preview">
        {/* Prioritas: Gambar Sampul / Infografis jika tersedia */}
        {customCover ? (
          <img
            src={customCover}
            alt={pdf.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain mx-auto my-auto block rounded-lg transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = generateFallbackPdfCover(pdf.title, pdf.category);
            }}
          />
        ) : hasLiveEmbed && !iframeError ? (
          <div className="w-full h-full relative overflow-hidden bg-slate-100 flex items-center justify-center">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-gray-400 gap-1.5 z-10">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                <span className="text-[10px] font-medium">Memuat Dokumen...</span>
              </div>
            )}

            {isDataPdf ? (
              <object
                data={`${rawUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                type="application/pdf"
                className="w-full h-full object-contain mx-auto my-auto block rounded-lg border-0 pointer-events-none"
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
              >
                <img
                  src={fallbackCover}
                  alt={pdf.title}
                  className="w-full h-full object-contain mx-auto my-auto block rounded-lg"
                />
              </object>
            ) : isDrive ? (
              <iframe
                src={embedUrl}
                className="w-full h-full object-contain mx-auto my-auto block rounded-lg border-0 pointer-events-none"
                title={pdf.title}
                loading="lazy"
                allow="autoplay"
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
              />
            ) : (
              <iframe
                src={embedUrl}
                className="w-full h-full object-contain mx-auto my-auto block rounded-lg border-0 pointer-events-none"
                title={pdf.title}
                loading="lazy"
                allow="autoplay"
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
              />
            )}
          </div>
        ) : isDataImage ? (
          <img
            src={rawUrl}
            alt={pdf.title}
            className="w-full h-full object-contain mx-auto my-auto block rounded-lg transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <img
            src={fallbackCover}
            alt={pdf.title}
            className="w-full h-full object-contain mx-auto my-auto block rounded-lg transition-transform duration-300 group-hover:scale-105"
          />
        )}

        {/* 2. OVERLAY TOP CONTROLS (Z-20 ABSOLUTE TOP-2 LEFT-2 RIGHT-2 FLEX JUSTIFY-BETWEEN) */}
        <div className="z-20 absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
          {/* Pojok Kiri: Keterangan Posisi */}
          <span className="bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full font-bold shadow-md border border-white/20 flex items-center gap-1.5 pointer-events-auto">
            {positionNumber ? `Posisi #${positionNumber}` : 'NEW'}
          </span>

          {/* Pojok Kanan: Status, Icon Pindah & Icon Mata */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {onToggleActive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleActive();
                }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full shadow-md transition-all cursor-pointer backdrop-blur-md border border-white/20 ${
                  pdf.isActive
                    ? 'bg-emerald-600/90 text-white hover:bg-emerald-700'
                    : 'bg-black/60 text-white/90 hover:bg-black/80'
                }`}
                title="Status tampil di dashboard pasien"
              >
                {pdf.isActive ? '✓ Tampil' : 'Sembunyi'}
              </button>
            )}

            {/* Icon Pindah (Geser Posisi) */}
            {showReorder && (
              <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/20 shadow-md">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onMoveUp) onMoveUp();
                  }}
                  disabled={isFirst}
                  className="p-1 rounded-lg text-white hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Pindah ke Posisi Sebelumnya (Kiri/Atas)"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onMoveDown) onMoveDown();
                  }}
                  disabled={isLast}
                  className="p-1 rounded-lg text-white hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Pindah ke Posisi Berikutnya (Kanan/Bawah)"
                >
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            )}

            {/* Icon Mata (Pratinjau Layar Penuh) */}
            {onOpenPreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPreview();
                }}
                className="w-7 h-7 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-md border border-white/20 transition-transform active:scale-95 cursor-pointer"
                title="Lihat Pratinjau Dokumen / Gambar"
              >
                <Eye className="w-3.5 h-3.5 text-white stroke-[2.2]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. KETERANGAN PDF (JUDUL, KATEGORI, CATATAN, BUTTON UNDUH, TEKS EDIT & TEKS HAPUS) */}
      <div className="p-4 sm:p-4.5 bg-white flex flex-col justify-between gap-2.5 flex-1 border-t border-gray-100">
        <div>
          {/* Judul Dokumen */}
          <h3
            onClick={onOpenPreview}
            className="text-gray-950 font-extrabold text-base leading-snug line-clamp-1 group-hover:text-teal-800 transition-colors cursor-pointer"
            title={pdf.title}
          >
            {pdf.title}
          </h3>

          {/* Kategori */}
          <p className="text-teal-800 font-bold text-xs mt-0.5">
            {subCategoryText}
          </p>

          {/* Catatan Khusus / Deskripsi */}
          <p className="text-gray-600 text-xs line-clamp-2 mt-1 leading-relaxed font-normal">
            {shortDescription}
          </p>
        </div>

        {/* Button Unduh */}
        <div className="pt-2 border-t border-gray-200/50">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onDownload) onDownload();
              else if (onOpenPreview) onOpenPreview();
            }}
            className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>Unduh</span>
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Teks Edit dan Teks Hapus (Untuk Nakes Admin) */}
        {(onEdit || onDelete) && (
          <div className="flex justify-end items-center gap-3 text-xs pt-1.5 border-t border-gray-200/50">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="text-amber-800 hover:text-amber-950 font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            {onEdit && onDelete && <span className="text-gray-300 font-bold">•</span>}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-rose-600 hover:text-rose-800 font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
