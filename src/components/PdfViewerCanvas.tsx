import React, { useState } from 'react';
import { Download, ExternalLink, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import { formatGoogleDriveEmbedUrl, isGoogleDriveUrl } from '../services/pdfRender';

interface PdfViewerCanvasProps {
  dataUrl?: string;
  title: string;
  fileName?: string;
  nakesNote?: string;
  onDownload?: () => void;
  onPrint?: () => void;
}

export const PdfViewerCanvas: React.FC<PdfViewerCanvasProps> = ({
  dataUrl = '',
  title,
  fileName = 'dokumen.pdf',
  nakesNote,
  onDownload,
}) => {
  const [iframeError, setIframeError] = useState<boolean>(false);
  const [key, setKey] = useState<number>(0);

  const isGdrive = isGoogleDriveUrl(dataUrl);
  const embedUrl = isGdrive ? formatGoogleDriveEmbedUrl(dataUrl) : dataUrl;
  const isDirectPdf = dataUrl.startsWith('data:application/pdf') || dataUrl.toLowerCase().endsWith('.pdf') || dataUrl.startsWith('blob:');

  const handleOpenInNewTab = () => {
    if (isGdrive) {
      window.open(dataUrl, '_blank', 'noopener,noreferrer');
    } else if (dataUrl) {
      if (dataUrl.startsWith('data:')) {
        const win = window.open();
        if (win) {
          win.document.write(
            `<iframe src="${dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
          );
        }
      } else {
        window.open(dataUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleReload = () => {
    setIframeError(false);
    setKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 font-sans">
      {/* Top Toolbar */}
      <div className="bg-slate-950/90 px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {fileName} {isGdrive && '• Google Drive Document'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
            title="Muat Ulang Tampilan"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Buka PDF di Tab Baru"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buka di Tab Baru</span>
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Unduh Berkas PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Nakes Note */}
      {nakesNote && (
        <div className="bg-teal-950/60 border-b border-teal-800/40 px-4 py-2 text-xs text-teal-200 flex items-start gap-2">
          <span className="font-bold shrink-0 text-emerald-300">Catatan Nakes:</span>
          <span className="italic">{nakesNote}</span>
        </div>
      )}

      {/* Main Native Viewer Area */}
      <div className="relative w-full h-[520px] sm:h-[600px] bg-slate-900 flex items-center justify-center overflow-hidden">
        {iframeError || !embedUrl ? (
          <div className="p-8 text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-white mb-1">Pratinjau Dalam Aplikasi Terbatas</h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                Berkas PDF atau Dokumen Google Drive ini memerlukan izin akses langsung dari browser Anda.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka PDF di Tab Baru</span>
              </button>
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File</span>
                </button>
              )}
            </div>
          </div>
        ) : isGdrive ? (
          <iframe
            key={`gdrive-${key}`}
            src={embedUrl}
            title={title}
            className="w-full h-full border-0 bg-white"
            allow="autoplay; encrypted-media; fullscreen"
            onError={() => setIframeError(true)}
          />
        ) : isDirectPdf ? (
          <object
            key={`obj-${key}`}
            data={embedUrl}
            type="application/pdf"
            className="w-full h-full border-0 bg-white"
          >
            <iframe
              src={embedUrl}
              title={title}
              className="w-full h-full border-0 bg-white"
            >
              <div className="p-6 text-center text-white space-y-3">
                <p className="text-xs text-slate-300">Browser Anda tidak mendukung pratinjau PDF langsung di dalam frame.</p>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka di Tab Baru</span>
                </button>
              </div>
            </iframe>
          </object>
        ) : (
          <iframe
            key={`iframe-${key}`}
            src={embedUrl}
            title={title}
            className="w-full h-full border-0 bg-white"
            onError={() => setIframeError(true)}
          />
        )}
      </div>

      {/* Bottom Footer Helper */}
      <div className="bg-slate-950 px-4 py-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>
          {isGdrive ? 'Pratinjau langsung Google Drive Embed' : 'Pratinjau Dokumen PDF Native Browser'}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Buka di Tab Baru jika pratinjau tidak muncul</span>
          </button>
        </div>
      </div>
    </div>
  );
};
