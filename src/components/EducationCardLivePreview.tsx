import React, { useState } from 'react';
import { EducationPdfItem } from '../types';
import {
  isGoogleDriveUrl,
  formatGoogleDriveEmbedUrl,
  getPdfEmbedUrl,
  getPdfDirectDownloadUrl,
  generateFallbackPdfCover,
  processCoverImageUrl,
} from '../services/pdfRender';
import { getPdfDataUrlSync } from '../services/pdfStore';
import { Eye, Download, Sparkles, ExternalLink, Loader2 } from 'lucide-react';

interface EducationCardLivePreviewProps {
  pdf: EducationPdfItem;
  coverImage?: string;
  onOpenPreview?: () => void;
  onDownload?: () => void;
  heightClass?: string;
  extraTopRightBadge?: React.ReactNode;
}

export const EducationCardLivePreview: React.FC<EducationCardLivePreviewProps> = ({
  pdf,
  coverImage,
  onOpenPreview,
  onDownload,
  heightClass = 'h-48',
  extraTopRightBadge,
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
  const directDownloadUrl = getPdfDirectDownloadUrl(rawUrl);

  return (
    <div className={`relative w-full ${heightClass} bg-slate-100 overflow-hidden rounded-t-2xl sm:rounded-t-3xl flex items-center justify-center group`}>
      {/* Top Left Badge "NEW" */}
      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-emerald-600/95 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-md flex items-center gap-1 z-20 pointer-events-none">
        <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
        <span>NEW</span>
      </span>

      {/* Top Right Source Indicator or Extra Badge */}
      {extraTopRightBadge ? (
        <div className="absolute top-2.5 right-2.5 z-20">
          {extraTopRightBadge}
        </div>
      ) : isDrive ? (
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-slate-900/85 backdrop-blur-xs text-amber-300 text-[10px] font-bold rounded-lg shadow-md z-20 border border-slate-700 pointer-events-none flex items-center gap-1">
          <span>Drive Preview</span>
        </span>
      ) : null}

      {/* PRIORITAS: GAMBAR SAMPUL JIKA ADA */}
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
        <div className="w-full h-full relative bg-slate-100 flex items-center justify-center">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-2 z-10">
              <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
              <span className="text-[10px] font-semibold tracking-wide text-slate-600">Memuat Live Preview...</span>
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
          ) : (
            <iframe
              src={embedUrl}
              className="w-full h-full object-contain mx-auto my-auto block rounded-lg border-0 pointer-events-auto"
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

      {/* HOVER OVERLAY WITH ACTION BUTTONS */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 z-30 pointer-events-auto">
        {onOpenPreview && (
          <button
            type="button"
            onClick={onOpenPreview}
            className="w-11 h-11 bg-white hover:bg-teal-50 text-teal-800 rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="Pratinjau Layar Penuh"
          >
            <Eye className="w-5 h-5 text-teal-700" />
          </button>
        )}

        {isDrive && (
          <a
            href={formatGoogleDriveEmbedUrl(rawUrl).replace(/\/preview$/, '/view')}
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 active:scale-95 transition-all cursor-pointer border border-slate-600"
            title="Buka di Google Drive"
          >
            <ExternalLink className="w-4 h-4 text-emerald-300" />
          </a>
        )}

        <button
          type="button"
          onClick={onDownload}
          className="w-11 h-11 bg-teal-800 hover:bg-teal-900 text-white rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 active:scale-95 transition-all cursor-pointer"
          title="Unduh Berkas PDF"
        >
          <Download className="w-5 h-5 text-amber-300" />
        </button>
      </div>
    </div>
  );
};
