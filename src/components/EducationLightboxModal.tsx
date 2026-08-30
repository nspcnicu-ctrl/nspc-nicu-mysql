import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { EducationPdfItem } from '../types';
import {
  processCoverImageUrl,
  generateFallbackPdfCover,
  getPdfEmbedUrl,
  isGoogleDriveUrl,
  formatGoogleDriveEmbedUrl,
} from '../services/pdfRender';
import { getPdfDataUrlSync } from '../services/pdfStore';

interface EducationLightboxModalProps {
  pdf: EducationPdfItem | null;
  onClose: () => void;
  onDownload?: (pdf: EducationPdfItem) => void;
}

export const EducationLightboxModal: React.FC<EducationLightboxModalProps> = ({
  pdf,
  onClose,
  onDownload,
}) => {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [key, setKey] = useState(0);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (pdf) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [pdf, onClose]);

  if (!pdf) return null;

  const rawUrl = pdf.fileDataUrl || (pdf as any).fileUrl || getPdfDataUrlSync(pdf.id) || '';
  const isDrive = isGoogleDriveUrl(rawUrl);
  const isDataImage = rawUrl.startsWith('data:image/') || (pdf.coverImageUrl && pdf.coverImageUrl.startsWith('data:image/'));
  const isHttp = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
  const isDataPdf = rawUrl.startsWith('data:application/pdf') || rawUrl.toLowerCase().endsWith('.pdf') || rawUrl.startsWith('blob:');

  // Custom cover or direct image
  const customCover = pdf.coverImageUrl
    ? processCoverImageUrl(pdf.coverImageUrl)
    : '';

  // Determine if it is a pure image to display directly
  const isPureImage = (customCover && !isDrive && !isDataPdf) || isDataImage || (isHttp && /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(rawUrl));
  const directImageUrl = customCover || (isDataImage ? rawUrl : (isPureImage ? rawUrl : ''));

  const embedUrl = getPdfEmbedUrl(rawUrl);

  const handleOpenInNewTab = () => {
    if (isDrive) {
      window.open(rawUrl, '_blank', 'noopener,noreferrer');
    } else if (rawUrl) {
      if (rawUrl.startsWith('data:')) {
        const win = window.open();
        if (win) {
          win.document.write(
            `<iframe src="${rawUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
          );
        }
      } else {
        window.open(rawUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 sm:bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-5 select-none animate-fade-in"
      onClick={onClose}
    >
      {/* Floating Minimalist Top Control Bar */}
      <div
        className="fixed top-3 sm:top-5 inset-x-3 sm:inset-x-6 z-50 flex items-center justify-between pointer-events-none gap-2 max-w-6xl mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title pill */}
        <div className="pointer-events-auto bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 px-3.5 sm:px-4 py-2 rounded-2xl flex items-center gap-2.5 max-w-[70vw] sm:max-w-md shadow-2xl transition-all">
          <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-extrabold text-white truncate leading-tight">
              {pdf.title}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-teal-300 font-medium truncate">
              {pdf.category || 'Materi Edukasi'} {pdf.publishedAt && `• ${pdf.publishedAt}`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(pdf)}
              className="px-3.5 py-2 rounded-2xl bg-teal-500/90 hover:bg-teal-400 text-teal-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-sm"
              title="Unduh Berkas"
            >
              <Download className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span className="hidden sm:inline">Unduh</span>
            </button>
          )}

          {isDrive && (
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-sm"
              title="Buka Dokumen Asli di Tab Baru"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-2xl bg-white/10 hover:bg-white/25 text-white hover:text-rose-300 border border-white/20 shadow-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-sm"
            title="Tutup Pratinjau (ESC)"
          >
            <X className="w-5 h-5 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Direct Content Display: No Bulky Card Borders, No Giant Nested Headers/Footers */}
      <div
        className="relative z-40 w-full h-full flex items-center justify-center pt-14 pb-4 px-2 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {isPureImage || directImageUrl ? (
          <div className="relative max-w-full max-h-[86vh] sm:max-h-[88vh] flex items-center justify-center">
            <img
              src={directImageUrl || generateFallbackPdfCover(pdf.title, pdf.category)}
              alt={pdf.title}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[86vh] sm:max-h-[88vh] w-auto h-auto object-contain rounded-2xl sm:rounded-3xl shadow-2xl ring-1 ring-white/20 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = generateFallbackPdfCover(pdf.title, pdf.category);
              }}
            />
          </div>
        ) : isDrive ? (
          <div className="w-full max-w-5xl h-[82vh] sm:h-[86vh] bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/15 relative">
            <iframe
              key={`drive-lightbox-${key}`}
              src={embedUrl || formatGoogleDriveEmbedUrl(rawUrl)}
              title={pdf.title}
              className="w-full h-full border-0 bg-white"
              allow="autoplay; encrypted-media; fullscreen"
            />
          </div>
        ) : isDataPdf ? (
          <div className="w-full max-w-5xl h-[82vh] sm:h-[86vh] bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/15 relative">
            <object
              key={`obj-lightbox-${key}`}
              data={`${rawUrl}#toolbar=1&navpanes=0&scrollbar=1&view=Fit`}
              type="application/pdf"
              className="w-full h-full border-0 bg-white"
            >
              <iframe
                src={embedUrl}
                title={pdf.title}
                className="w-full h-full border-0 bg-white"
              >
                <div className="flex flex-col items-center justify-center h-full p-6 text-white text-center gap-3">
                  <p className="text-sm text-slate-300">Pratinjau PDF tidak didukung langsung oleh frame browser.</p>
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="px-4 py-2 bg-teal-500 text-teal-950 font-bold text-xs rounded-xl flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka PDF di Tab Baru</span>
                  </button>
                </div>
              </iframe>
            </object>
          </div>
        ) : (
          <div className="relative max-w-full max-h-[86vh] sm:max-h-[88vh] flex items-center justify-center">
            <img
              src={generateFallbackPdfCover(pdf.title, pdf.category)}
              alt={pdf.title}
              className="max-w-full max-h-[86vh] sm:max-h-[88vh] w-auto h-auto object-contain rounded-2xl sm:rounded-3xl shadow-2xl ring-1 ring-white/20"
            />
          </div>
        )}
      </div>

      {/* Subtle Bottom Note if nakesNote is present */}
      {pdf.nakesNote && (
        <div
          className="fixed bottom-3 inset-x-4 max-w-xl mx-auto z-50 pointer-events-auto bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 px-4 py-2 rounded-2xl text-center shadow-xl text-xs text-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-teal-300 font-bold mr-1.5">Catatan:</span>
          <span className="italic text-slate-300">{pdf.nakesNote}</span>
        </div>
      )}
    </div>
  );
};
