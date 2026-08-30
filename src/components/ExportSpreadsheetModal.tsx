import React, { useState } from 'react';
import { Patient } from '../types';
import {
  exportAllPatientsToExcel,
  exportAllPatientsToCsv,
} from '../utils/spreadsheetExport';
import {
  X,
  FileSpreadsheet,
  Download,
  FileText,
  CheckCircle2,
  Users,
  Activity,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface ExportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  filteredPatients?: Patient[];
}

export const ExportSpreadsheetModal: React.FC<ExportSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  patients,
  filteredPatients,
}) => {
  const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'rawat' | 'siap_pulang' | 'alumni'>('all');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  // Active / non-deleted patients
  const activePatients = patients.filter((p) => !p.isDeleted);
  const rawatPatients = activePatients.filter((p) => (p.status || 'Rawat NICU') === 'Rawat NICU');
  const siapPulangPatients = activePatients.filter((p) => p.status === 'Siap Pulang');
  const alumniPatients = activePatients.filter((p) => p.status === 'Sudah Pulang' || Boolean(p.dischargedAt));

  // Determine target patients based on scope
  const getTargetPatients = (): Patient[] => {
    switch (exportScope) {
      case 'filtered':
        return filteredPatients && filteredPatients.length > 0 ? filteredPatients : activePatients;
      case 'rawat':
        return rawatPatients;
      case 'siap_pulang':
        return siapPulangPatients;
      case 'alumni':
        return alumniPatients;
      case 'all':
      default:
        return activePatients;
    }
  };

  const targetList = getTargetPatients();

  // Total daily logs counted in target list
  const totalLogsCount = targetList.reduce((acc, p) => {
    const logs = p.dailyLogs || (p as any).progressLogs || (p as any).daily_logs || [];
    return acc + (Array.isArray(logs) ? logs.length : 0);
  }, 0);

  const handleExecuteExport = () => {
    if (targetList.length === 0) {
      alert('Tidak ada data pasien pada kategori yang dipilih.');
      return;
    }

    setIsExporting(true);
    setSuccessToast(null);

    setTimeout(() => {
      let success = false;
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const scopeSuffix = exportScope === 'all' ? 'Semua' : exportScope.toUpperCase();

      if (exportFormat === 'xlsx') {
        const filename = `Data_Lengkap_Pasien_NICU_${scopeSuffix}_${dateStr}.xlsx`;
        success = exportAllPatientsToExcel(targetList, { filename });
      } else {
        const filename = `Data_Pasien_NICU_${scopeSuffix}_${dateStr}.csv`;
        success = exportAllPatientsToCsv(targetList, { filename });
      }

      setIsExporting(false);
      if (success) {
        setSuccessToast(`Berhasil mengekspor ${targetList.length} data pasien ke spreadsheet!`);
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
        }, 1800);
      }
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-teal-900 p-5 sm:p-6 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
            <FileSpreadsheet className="w-48 h-48 text-white" />
          </div>

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <span>Ekspor Data Pasien NICU</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-300/40 text-[11px] font-bold uppercase tracking-wider text-emerald-200">
                  Spreadsheet
                </span>
              </h3>
              <p className="text-xs text-teal-100/90 font-normal mt-0.5">
                Download seluruh data rekam medis, antropometri, dan log harian
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-teal-200 hover:text-white hover:bg-white/15 transition-all cursor-pointer relative z-10"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Modal */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Summary Box */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 bg-emerald-50/60 border border-emerald-200/70 p-3.5 rounded-2xl">
            <div className="text-center p-2 bg-white rounded-xl border border-emerald-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">Total Pasien</div>
              <div className="text-xl font-black text-slate-800 mt-0.5">{targetList.length}</div>
            </div>
            <div className="text-center p-2 bg-white rounded-xl border border-emerald-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">Total Log Harian</div>
              <div className="text-xl font-black text-teal-700 mt-0.5">{totalLogsCount}</div>
            </div>
            <div className="text-center p-2 bg-white rounded-xl border border-emerald-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">Format File</div>
              <div className="text-xl font-black text-emerald-700 mt-0.5 uppercase">.{exportFormat}</div>
            </div>
          </div>

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>1. Pilih Kategori / Cakupan Pasien</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  exportScope === 'all'
                    ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/20 text-teal-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div>
                  <div className="text-xs">Seluruh Pasien Aktif</div>
                  <div className="text-[11px] text-slate-500 font-normal">Semua rawat, siap pulang & alumni</div>
                </div>
                <span className="px-2 py-0.5 bg-slate-200/80 rounded-full text-[11px] font-bold text-slate-800">
                  {activePatients.length}
                </span>
              </button>

              {filteredPatients && (
                <button
                  type="button"
                  onClick={() => setExportScope('filtered')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    exportScope === 'filtered'
                      ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/20 text-teal-950 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                  }`}
                >
                  <div>
                    <div className="text-xs">Pasien Sesuai Filter</div>
                    <div className="text-[11px] text-slate-500 font-normal">Sesuai pencarian/kategori aktif</div>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-200/80 rounded-full text-[11px] font-bold text-slate-800">
                    {filteredPatients.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setExportScope('rawat')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  exportScope === 'rawat'
                    ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/20 text-teal-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div>
                  <div className="text-xs">Pasien Sedang Rawat</div>
                  <div className="text-[11px] text-slate-500 font-normal">Pasien perawatan aktif di NICU</div>
                </div>
                <span className="px-2 py-0.5 bg-sky-100 rounded-full text-[11px] font-bold text-sky-800">
                  {rawatPatients.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('alumni')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  exportScope === 'alumni'
                    ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/20 text-teal-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div>
                  <div className="text-xs">Pasien Alumni / Pulang</div>
                  <div className="text-[11px] text-slate-500 font-normal">Pasien yang telah selesai rawat</div>
                </div>
                <span className="px-2 py-0.5 bg-purple-100 rounded-full text-[11px] font-bold text-purple-800">
                  {alumniPatients.length}
                </span>
              </button>
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              <span>2. Pilih Format File Spreadsheet</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                onClick={() => setExportFormat('xlsx')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  exportFormat === 'xlsx'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs shadow-xs">
                  XLSX
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Microsoft Excel (.xlsx)</span>
                    <span className="px-1.5 py-0.2 bg-emerald-200/80 text-emerald-950 text-[10px] rounded-md font-bold">
                      Rekomendasi
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Memuat 3 Sheet terpisah: Data Master, Riwayat Log Harian, & Rekap Skrining.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setExportFormat('csv')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  exportFormat === 'csv'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 font-black text-xs shadow-xs">
                  CSV
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Comma Separated (.csv)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Format tabel standar universal dengan encoding UTF-8 untuk Google Sheets/SPSS.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Included Fields Overview */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Cakupan Data yang Diekspor:</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              • <strong>Identitas Pasien & Ortu:</strong> No. RM, Nama Bayi, Ayah, Ibu, No. HP, Password Akses, JK, Tgl Lahir, Usia Gestasi, Tgl Masuk, Lama Rawat.
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              • <strong>Antropometri & TTV:</strong> BB Lahir, PB, LK, LD, LP, LiLA, BB Terkini, Suhu, HR, RR, SpO2, Metode & Volume Minum.
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              • <strong>Kepulangan & Skrining:</strong> Tanggal Pulang, BB Pulang, DPJP, Resume Medis, Imunisasi HB0, SHK, ROP, OAE, Skrining PJB Kritis, & Milestone.
            </p>
          </div>

          {successToast && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting || targetList.length === 0}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Memproses Ekspor...' : `Unduh Spreadsheet (${targetList.length} Pasien)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
