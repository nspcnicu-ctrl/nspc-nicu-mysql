import React, { useEffect, useRef, useState } from 'react';
import { Download, Printer, ZoomIn, ZoomOut, Menu, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { dataUrlToBlob, triggerPdfDownload } from '../services/pdfStore';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface PdfViewerCanvasProps {
  dataUrl?: string;
  title: string;
  fileName: string;
  onDownload?: () => void;
  onPrint?: () => void;
}

export const PdfViewerCanvas: React.FC<PdfViewerCanvasProps> = ({
  dataUrl,
  title,
  fileName,
  onDownload,
  onPrint,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // 1. Initialize PDF.js and load PDF document
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    const initPdfJs = async () => {
      try {
        let arrayBuffer: ArrayBuffer | null = null;

        if (dataUrl && dataUrl.startsWith('data:')) {
          const blob = dataUrlToBlob(dataUrl);
          arrayBuffer = await blob.arrayBuffer();
        } else if (dataUrl && (dataUrl.startsWith('http://') || dataUrl.startsWith('https://') || dataUrl.startsWith('blob:'))) {
          const resp = await fetch(dataUrl);
          arrayBuffer = await resp.arrayBuffer();
        }

        if (!arrayBuffer) {
          throw new Error('No PDF file data URL provided');
        }

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;

        if (!isMounted) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        console.error('[PdfViewerCanvas] Load error:', err);
        if (isMounted) {
          setErrorMsg(err.message || 'Gagal memuat berkas PDF');
          setLoading(false);
        }
      }
    };

    initPdfJs();

    return () => {
      isMounted = false;
    };
  }, [dataUrl]);

  // 2. Render Page to Canvas whenever currentPage or scale changes
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || loading) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
        }

        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform: transform,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('[PdfViewerCanvas] Render page error:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [currentPage, scale, loading]);

  if (loading) {
    return (
      <div className="w-full h-[500px] bg-[#323639] text-white flex flex-col items-center justify-center p-6 space-y-3">
        <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-xs font-semibold text-slate-300">Memproses &amp; Menampilkan Berkas PDF...</div>
      </div>
    );
  }

  if (errorMsg || !pdfDocRef.current) {
    return (
      <div className="w-full h-[500px] bg-[#323639] text-white flex flex-col items-center justify-center p-6 text-center space-y-3">
        <FileText className="w-12 h-12 text-slate-500" />
        <div className="text-sm font-bold text-slate-200">Berkas PDF Belum Tersedia atau Format Tidak Valid</div>
        <div className="text-xs text-slate-400 max-w-sm">
          Silakan unggah ulang berkas PDF melalui menu Edit untuk menampilkan pratinjau dokumen.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[520px] bg-[#323639] text-white flex flex-col overflow-hidden font-sans select-none">
      {/* TOOLBAR TOP (PERSIS SEPERTI ADOBE / CHROME PDF VIEWER) */}
      <div className="bg-[#2a2e31] px-4 py-2 border-b border-slate-700 flex items-center justify-between text-xs text-slate-300 shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSidebar((prev) => !prev)}
            className={`p-1.5 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer ${
              showSidebar ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
            title="Sembunyikan/Tampilkan Halaman"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* PAGE NAVIGATOR */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded-md border border-slate-700">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-0.5 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-xs font-bold px-1 text-white">
              {currentPage} / {numPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= numPages}
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              className="p-0.5 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ZOOM CONTROLS */}
        <div className="flex items-center gap-2 bg-slate-800/90 px-2 py-1 rounded-md border border-slate-700">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            className="p-0.5 hover:text-white cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs font-bold px-1 text-emerald-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
            className="p-0.5 hover:text-white cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title="Unduh Berkas PDF"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline text-xs font-semibold">Unduh</span>
            </button>
          )}

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title="Cetak Berkas PDF"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-xs font-semibold">Cetak</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN BODY: SIDEBAR THUMBNAILS + CANVAS DISPLAY */}
      <div className="flex-1 flex overflow-hidden bg-[#525659]">
        {/* LEFT SIDEBAR THUMBNAILS */}
        {showSidebar && (
          <div className="w-44 bg-[#2a2e31] border-r border-slate-700 overflow-y-auto p-3 space-y-3 shrink-0 scrollbar-thin">
            {Array.from({ length: numPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-full text-left rounded-lg p-2 transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-emerald-950/80 border-emerald-500 text-white ring-2 ring-emerald-500/50'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="w-full aspect-[3/4] bg-white rounded shadow-sm flex items-center justify-center text-slate-800 text-[10px] font-bold">
                    Hal. {pageNum}
                  </div>
                  <div className="text-center font-mono text-[10px] font-bold mt-1.5">
                    {pageNum}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* CANVAS CANVAS DISPLAY */}
        <div className="flex-1 overflow-auto p-6 flex justify-center items-start">
          <div className="bg-white shadow-2xl rounded-sm border border-slate-400 overflow-hidden my-auto">
            <canvas ref={canvasRef} className="block mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
};
