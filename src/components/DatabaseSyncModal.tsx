import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Server,
  FileText,
  Users,
  ShieldCheck,
  Globe,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  Link,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { syncFromBackend, syncGlobalPdfsFromBackend, syncNakesFromBackend, getStoredPatients, getStoredGlobalPdfs, getStoredNakesUsers } from '../services/storage';
import { fetchPatientsApi, fetchEducationPdfsApi, fetchNakesUsersApi, PHP_API_BASE } from '../services/api';

interface DatabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const DatabaseSyncModal: React.FC<DatabaseSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Stats
  const [patientCount, setPatientCount] = useState<number>(0);
  const [pdfCount, setPdfCount] = useState<number>(0);
  const [nakesCount, setNakesCount] = useState<number>(0);

  // Custom API endpoint configuration
  const [apiUrl, setApiUrl] = useState<string>(() => {
    return localStorage.getItem('nspc_custom_api_url') || PHP_API_BASE;
  });
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [connectionTestStatus, setConnectionTestStatus] = useState<'none' | 'testing' | 'ok' | 'fail'>('none');
  const [testResultDetail, setTestResultDetail] = useState<string>('');

  const refreshLocalStats = () => {
    const patients = getStoredPatients();
    const pdfs = getStoredGlobalPdfs();
    const nakes = getStoredNakesUsers();
    setPatientCount(patients.length);
    setPdfCount(pdfs.length);
    setNakesCount(nakes.length);
  };

  useEffect(() => {
    if (isOpen) {
      refreshLocalStats();
      const savedTime = localStorage.getItem('nspc_last_sync_time');
      if (savedTime) setLastSyncTime(savedTime);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setConnectionTestStatus('testing');
    setTestResultDetail('Menguji koneksi ke endpoint...');
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/patients.php?include_deleted=1`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const count = data?.data?.patients?.length ?? data?.data?.length ?? data?.items?.length ?? 0;
        setConnectionTestStatus('ok');
        setTestResultDetail(`Koneksi Berhasil! Ditemukan data dari server (HTTP ${res.status}).`);
      } else {
        setConnectionTestStatus('fail');
        setTestResultDetail(`Endpoint merespon dengan status HTTP ${res.status}`);
      }
    } catch (err: any) {
      // Try fallback to /api/health
      try {
        const healthRes = await fetch('/api/health');
        if (healthRes.ok) {
          setConnectionTestStatus('ok');
          setTestResultDetail('Terhubung ke backend lokal Express MySQL.');
          return;
        }
      } catch (e) {}
      setConnectionTestStatus('fail');
      setTestResultDetail(`Gagal terhubung: ${err?.message || 'Server tidak merespon'}`);
    }
  };

  const handleSaveApiUrl = () => {
    setIsSavingUrl(true);
    const cleanUrl = apiUrl.trim().replace(/\/$/, '');
    localStorage.setItem('nspc_custom_api_url', cleanUrl);
    setTimeout(() => {
      setIsSavingUrl(false);
      setStatusMessage('URL Endpoint berhasil diperbarui!');
    }, 400);
  };

  const handlePerformFullSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setStatusMessage('Menghubungkan ke database dan mengunduh data real...');

    try {
      // 1. Sync Patients & Daily Logs
      setStatusMessage('Mengunduh data rekam medis & perkembangan pasien...');
      const syncedPatients = await syncFromBackend();

      // 2. Sync Global Education PDFs
      setStatusMessage('Mengunduh folder modul edukasi PDF...');
      const syncedPdfs = await syncGlobalPdfsFromBackend(true);

      // 3. Sync Nakes Users
      setStatusMessage('Mengunduh data petugas Nakes...');
      const syncedNakes = await syncNakesFromBackend(true);

      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA';
      localStorage.setItem('nspc_last_sync_time', now);
      setLastSyncTime(now);

      refreshLocalStats();
      setSyncStatus('success');
      setStatusMessage(
        `Sinkronisasi Selesai! Berhasil memuat ${syncedPatients.length} pasien, ${syncedPdfs.length} materi edukasi PDF, dan ${syncedNakes.length} akun nakes.`
      );

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error: any) {
      console.error('Error during full sync:', error);
      setSyncStatus('error');
      setStatusMessage(`Gagal melakukan sinkronisasi: ${error?.message || 'Terjadi kesalahan jaringan'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn font-sans">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto transform transition-all">
        
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                Sinkronisasi Database MySQL Real
              </h3>
              <p className="text-xs text-teal-100 font-medium mt-0.5">
                Integrasi Data Pasien, Rekam Medis, & Modul Edukasi PDF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all cursor-pointer font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 text-slate-800">
          
          {/* Status Message Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 ${
                syncStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : syncStatus === 'error'
                  ? 'bg-rose-50 text-rose-900 border-rose-200'
                  : 'bg-teal-50 text-teal-900 border-teal-200'
              }`}
            >
              {syncStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : syncStatus === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 text-teal-600 animate-spin shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage}</span>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <div className="flex items-center justify-center gap-1.5 text-teal-700 text-xs font-bold mb-1">
                <Users className="w-4 h-4" />
                <span>Pasien</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{patientCount}</div>
              <div className="text-[10px] text-slate-500 font-medium">Tersimpan di Sistem</div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <div className="flex items-center justify-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
                <FileText className="w-4 h-4" />
                <span>Modul PDF</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{pdfCount}</div>
              <div className="text-[10px] text-slate-500 font-medium">File Edukasi</div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <div className="flex items-center justify-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Petugas</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{nakesCount}</div>
              <div className="text-[10px] text-slate-500 font-medium">Akun Nakes</div>
            </div>
          </div>

          {/* Primary Action Button: Sinkronkan Sekarang */}
          <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border border-teal-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Sinkronisasi Data Real Database</span>
                </h4>
                <p className="text-[11px] text-teal-800 mt-0.5">
                  Tarik seluruh data pasien dan file PDF terbaru langsung dari database backend.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSyncing}
              onClick={handlePerformFullSync}
              className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-teal-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sedang Menyinkronkan Database...' : 'Tarik & Sinkronkan Data Sekarang'}</span>
            </button>

            {lastSyncTime && (
              <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Terakhir disinkronkan: <strong>{lastSyncTime}</strong></span>
              </div>
            )}
          </div>

          {/* API Endpoint Configuration & Testing */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>URL Endpoint Backend / Database:</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setApiUrl('/api');
                  localStorage.removeItem('nspc_custom_api_url');
                }}
                className="text-[10px] text-teal-700 hover:underline font-semibold"
              >
                Reset Default (/api)
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="Contoh: https://chagrin.id/api atau /api"
                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-teal-500 outline-none"
              />
              <button
                type="button"
                onClick={handleSaveApiUrl}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-200/80 transition-all shrink-0 cursor-pointer"
              >
                {isSavingUrl ? 'Tersimpan' : 'Simpan'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={connectionTestStatus === 'testing'}
                onClick={handleTestConnection}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Server className="w-3 h-3 text-slate-600" />
                <span>{connectionTestStatus === 'testing' ? 'Menguji...' : 'Uji Koneksi Endpoint'}</span>
              </button>

              {testResultDetail && (
                <span
                  className={`text-[11px] font-medium truncate ${
                    connectionTestStatus === 'ok'
                      ? 'text-emerald-700'
                      : connectionTestStatus === 'fail'
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}
                >
                  {testResultDetail}
                </span>
              )}
            </div>
          </div>

          {/* Helper info */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Petunjuk Sinkronisasi:</span>
            </p>
            <p className="leading-relaxed">
              Sistem akan memuat data asli yang tersimpan di tabel <code className="bg-white px-1 py-0.5 rounded border text-[10px]">patients</code>, <code className="bg-white px-1 py-0.5 rounded border text-[10px]">daily_logs</code>, dan <code className="bg-white px-1 py-0.5 rounded border text-[10px]">education_pdfs</code>. Perubahan yang dilakukan di web juga akan otomatis dikirimkan ke server.
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
