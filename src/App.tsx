/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, UserRole, NakesUser } from './types';
import {
  getStoredPatients,
  findPatientByCredentials,
  findPatientById,
  getShareableLink,
  syncFromBackend,
  syncNakesFromBackend,
  syncGlobalPdfsFromBackend,
  recordNakesLoginSession,
  updateNakesUser,
  updatePatient,
} from './services/storage';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { ParentDashboard } from './components/ParentDashboard';
import { NakesAdminDashboard } from './components/NakesAdminDashboard';
import { NspcCardPrint } from './components/NspcCardPrint';
import { EditNakesProfileModal } from './components/EditNakesProfileModal';
import { isPatientEligibleForPrint } from './utils/milestones';
import {
  Heart,
  Stethoscope,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Baby,
  Calendar,
  Share2,
  Copy,
  Check,
  UserCheck,
  ChevronRight,
  Activity,
  Award,
  BookOpen,
  Milk,
  AlertTriangle,
  Droplets,
  HeartHandshake,
  Info,
} from 'lucide-react';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentNakesUser, setCurrentNakesUser] = useState<NakesUser | null>(null);

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalInitialRole, setLoginModalInitialRole] = useState<UserRole>('parent');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isQuickShareOpen, setIsQuickShareOpen] = useState(false);
  const [quickCopied, setQuickCopied] = useState(false);
  const [isNakesProfileOpen, setIsNakesProfileOpen] = useState(false);

  const handleUpdateNakesUser = (updatedUser: NakesUser) => {
    setCurrentNakesUser(updatedUser);
    updateNakesUser(updatedUser);
  };

  // Prefill credentials state from URL link (if opened via share link)
  const [urlPrefillNickname, setUrlPrefillNickname] = useState<string>('');
  const [urlPrefillPassword, setUrlPrefillPassword] = useState<string>('');

  // Load patient data & check URL params on mount
  const refreshPatients = () => {
    const data = getStoredPatients();
    setPatients([...data]);
    return data;
  };

  useEffect(() => {
    const loadedPatients = refreshPatients();

    // 1. Initial 1-time fetch on component mount
    syncFromBackend()
      .then(() => {
        refreshPatients();
      })
      .catch((e) => console.warn('[App] Initial patient sync note:', e));

    syncNakesFromBackend().catch((e) => console.warn('[App] Initial nakes sync note:', e));

    syncGlobalPdfsFromBackend()
      .then(() => {
        refreshPatients();
      })
      .catch((e) => console.warn('[App] Initial PDF sync note:', e));

    // 2. Parse URL Query parameters for direct parent link access (e.g. ?nickname=...&pass=...)
    const params = new URLSearchParams(window.location.search);
    const urlNick = params.get('nickname') || params.get('nick');
    const urlPass = params.get('pass') || params.get('password');
    const urlPatientId = params.get('patientId') || params.get('id');

    if (urlNick && urlPass) {
      setUrlPrefillNickname(urlNick);
      setUrlPrefillPassword(urlPass);
      setLoginModalInitialRole('parent');
      setIsLoginModalOpen(true);
    } else if (urlPatientId) {
      const match = findPatientById(urlPatientId) || loadedPatients.find((p) => p.id === urlPatientId);
      if (match) {
        setUrlPrefillNickname(match.nickname);
        setUrlPrefillPassword(match.accessPassword);
        setLoginModalInitialRole('parent');
        setIsLoginModalOpen(true);
      }
    }

    // Always start at portal landing page on fresh link / tab open (mandatory login)
    setCurrentRole(null);

    // 3. Listen for local state changes triggered by user actions (Add, Edit, Delete, Restore)
    const handleStorageEvent = () => {
      refreshPatients();
    };
    window.addEventListener('nspc_data_changed', handleStorageEvent);

    return () => {
      window.removeEventListener('nspc_data_changed', handleStorageEvent);
    };
  }, []); // Empty dependency array ensures this runs exactly ONCE on mount

  // Sync current patient when patient list updates
  useEffect(() => {
    if (currentPatient) {
      const updated = patients.find((p) => p.id === currentPatient.id);
      if (updated) {
        setCurrentPatient(updated);
      }
    }
  }, [patients]);

  // Save session state to localStorage whenever login role/patient/nakesUser changes
  useEffect(() => {
    if (currentRole === 'nakes') {
      localStorage.setItem(
        'nspc_session',
        JSON.stringify({ role: 'nakes', nakesUser: currentNakesUser })
      );
    } else if (currentRole === 'parent' && currentPatient) {
      localStorage.setItem(
        'nspc_session',
        JSON.stringify({
          role: 'parent',
          patientId: currentPatient.id,
          nakesUser: currentNakesUser,
        })
      );
    } else if (currentRole === null) {
      localStorage.removeItem('nspc_session');
    }
  }, [currentRole, currentPatient, currentNakesUser]);

  const handleOpenLogin = (role: UserRole) => {
    setLoginModalInitialRole(role);
    setIsLoginModalOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('nspc_session');
    setCurrentRole(null);
    setCurrentPatient(null);
    setCurrentNakesUser(null);
    // Clear URL query parameters cleanly
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  };

  const handleSuccessParentLogin = (patient: Patient) => {
    setCurrentPatient(patient);
    setCurrentRole('parent');
  };

  const handleSuccessNakesLogin = (nakesUser?: NakesUser) => {
    if (nakesUser) {
      setCurrentNakesUser(nakesUser);
      recordNakesLoginSession(nakesUser);
    }
    setCurrentRole('nakes');
  };

  const handleSelectPatientFromAdmin = (patient: Patient) => {
    setCurrentPatient(patient);
    setCurrentRole('parent');
  };

  const handleCopyQuickShare = () => {
    if (!currentPatient) return;
    const link = getShareableLink(currentPatient);
    navigator.clipboard.writeText(link);
    setQuickCopied(true);
    setTimeout(() => setQuickCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 font-sans antialiased flex flex-col">
      
      {/* Top Navbar */}
      <Navbar
        currentRole={currentRole}
        currentPatient={currentPatient}
        currentNakesUser={currentNakesUser}
        onOpenLogin={handleOpenLogin}
        onLogout={handleLogout}
        onShareLink={() => setIsQuickShareOpen(true)}
        onOpenNakesProfile={() => setIsNakesProfileOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* VIEW 1: PARENT DASHBOARD */}
        {currentRole === 'parent' && currentPatient && (
          <ParentDashboard
            patient={currentPatient}
            onOpenPrintModal={() => {
              if (isPatientEligibleForPrint(currentPatient)) {
                setIsPrintModalOpen(true);
              }
            }}
            onShareLink={() => setIsQuickShareOpen(true)}
            onBackToNakes={currentNakesUser ? () => { setCurrentRole('nakes'); setCurrentPatient(null); } : undefined}
            onBackToHome={handleLogout}
            onPatientUpdated={(updated) => {
              setCurrentPatient(updated);
              updatePatient(updated);
              refreshPatients();
            }}
          />
        )}

        {/* VIEW 2: NAKES ADMIN DASHBOARD */}
        {currentRole === 'nakes' && (
          <NakesAdminDashboard
            patients={patients}
            currentNakesUser={currentNakesUser}
            onRefreshData={refreshPatients}
            onSelectPatientView={handleSelectPatientFromAdmin}
            onBackToHome={handleLogout}
            isProfileOpen={isNakesProfileOpen}
            onCloseProfile={() => setIsNakesProfileOpen(false)}
            onOpenProfile={() => setIsNakesProfileOpen(true)}
            onUpdateNakesUser={handleUpdateNakesUser}
          />
        )}

        {/* VIEW 3: LANDING / PORTAL (When not logged in) */}
        {!currentRole && (
          <div className="space-y-8 py-6 max-w-5xl mx-auto">
            
            {/* HERO PORTAL CARD */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-900 to-emerald-950 text-white p-6 sm:p-8 md:p-12 shadow-2xl">
              <div className="absolute right-0 top-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-teal-200 text-xs font-semibold border border-white/15">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 shrink-0" />
                  <span className="truncate">RSUD Undata Provinsi Sulawesi Tengah</span>
                </div>

                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                  NSPC <span className="text-teal-300">NICU</span> RSUD Undata
                </h1>

                <p className="text-teal-100/90 text-xs sm:text-sm md:text-base leading-relaxed font-normal">
                  <strong>Neo Smart Progress Card</strong> — Aplikasi pemantau perkembangan harian & mingguan bayi di ruang NICU RSUD Undata Palu. Dirancang khusus untuk memfasilitasi keterbukaan informasi perkembangan kesehatan buah hati kepada Ayah dan Bunda.
                </p>

                <div className="pt-2 sm:pt-4 grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
                  <button
                    onClick={() => handleOpenLogin('parent')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl bg-teal-400 hover:bg-teal-300 text-teal-950 font-extrabold text-xs sm:text-sm shadow-md shadow-teal-400/20 transition-all transform hover:-translate-y-0.5 cursor-pointer w-full sm:w-auto"
                  >
                    <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-900 fill-teal-900 shrink-0" />
                    <span className="whitespace-nowrap">Masuk Akses Orang Tua</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  </button>

                  <button
                    onClick={() => handleOpenLogin('nakes')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all cursor-pointer w-full sm:w-auto backdrop-blur-xs"
                  >
                    <Stethoscope className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-300 shrink-0" />
                    <span className="whitespace-nowrap">Portal Tenaga Kesehatan (Nakes)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ATERM VS PRETERM CLARIFICATION CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    👶🏻
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Bayi Cukup Bulan (Aterm)</h3>
                    <p className="text-xs text-emerald-700 font-semibold">Usia Kehamilan &gt; 37 Minggu</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pemantauan perkembangan berat badan, tanda-tanda vital, dan asupan minum <strong>diperbarui setiap hari (Perhari)</strong> oleh tim Nakes RSUD Undata.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    👶🏽
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Bayi Prematur (Preterm)</h3>
                    <p className="text-xs text-amber-700 font-semibold">Usia Kehamilan &lt; 36 Minggu</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pemantauan perkembangan berat badan dan usia koreksi gestasi <strong>diperbarui secara berkala perminggu</strong> atau sampai bayi dinyatakan aman & boleh pulang.
                </p>
              </div>

            </div>

            {/* EDUKASI NEONATUS & PERAWATAN BAYI NICU RSUD UNDATA */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-100">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Pojok Edukasi & Informasi NICU</span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                    Panduan Perawatan & Tumbuh Kembang Buah Hati
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
                    Informasi klinis penting yang disusun oleh tim dokter spesialis anak & perawat NICU RSUD Undata untuk mendampingi Ayah dan Bunda selama masa perawatan.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenLogin('parent')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <span>Masuk Pantau Bayi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 4 CARDS EDUKASI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Edukasi 1: Metode Kanguru (KMC) */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-rose-50/60 to-rose-50/20 border border-rose-100/80 space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Metode Kanguru (KMC)</h4>
                    <span className="text-[11px] font-semibold text-rose-700">Kontak Kulit ke Kulit</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Menstabilkan suhu tubuh bayi (mencegah hipotermia), mempercepat kenaikan berat badan, dan mempererat ikatan batin (bonding) antara orang tua dan buah hati.
                  </p>
                </div>

                {/* Edukasi 2: Nutrisi ASI Eksklusif */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-teal-50/60 to-teal-50/20 border border-teal-100/80 space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    <Milk className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">ASI & Kolostrum Emas</h4>
                    <span className="text-[11px] font-semibold text-teal-700">Nutrisi & Imun Alami</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tetesan kolostrum pertama kaya akan antibodi (IgA sekretori) yang melindungi saluran cerna bayi prematur dari infeksi berat seperti NEC.
                  </p>
                </div>

                {/* Edukasi 3: Pencegahan Infeksi */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-blue-50/60 to-blue-50/20 border border-blue-100/80 space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Kebersihan & Cuci Tangan</h4>
                    <span className="text-[11px] font-semibold text-blue-700">Protokol Pencegahan Infeksi</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Lakukan 6 langkah cuci tangan dengan sabun/antiseptik sebelum dan sesudah menyentuh bayi di inkubator untuk memutus rantai kuman patogen.
                  </p>
                </div>

                {/* Edukasi 4: Deteksi Tanda Bahaya */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-50/60 to-amber-50/20 border border-amber-100/80 space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Kenali Tanda Bahaya</h4>
                    <span className="text-[11px] font-semibold text-amber-700">Deteksi Dini Neonatus</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Segera laporkan bila bayi bernapas cepat/sesak (retraksi dinding dada), merintih, suhu tubuh di bawah 36.5°C, atau malas menyusu.
                  </p>
                </div>

              </div>

              {/* Edukasi Banner Bawah */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <p>
                    <strong>Akses Khusus Pasien:</strong> Akun kartu perkembangan anak dibuatkan langsung oleh petugas Nakes NICU saat proses rawat inap untuk menjamin kerahasiaan rekam medis.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenLogin('nakes')}
                  className="text-teal-700 hover:text-teal-900 font-bold whitespace-nowrap inline-flex items-center gap-1 cursor-pointer"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Portal Petugas NICU</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-12 bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-slate-600">
            NSPC (Neo Smart Progress Card) • Instalasi NICU RSUD Undata Provinsi Sulawesi Tengah
          </p>
          <p className="text-[11px] text-slate-400">
            © 2026 RSUD Undata Palu • Untuk Kesehatan Buah Hati Terpercaya
          </p>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      <LoginModal
        isOpen={isLoginModalOpen}
        initialRole={loginModalInitialRole}
        initialNickname={urlPrefillNickname}
        initialPassword={urlPrefillPassword}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccessParentLogin={handleSuccessParentLogin}
        onSuccessNakesLogin={handleSuccessNakesLogin}
        allPatients={patients}
      />

      {/* PRINT MODAL */}
      {isPrintModalOpen && currentPatient && (
        <NspcCardPrint
          patient={currentPatient}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* QUICK SHARE MODAL */}
      {isQuickShareOpen && currentPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Share2 className="w-4 h-4 text-teal-600" />
                <span>Bagikan Tautan Orang Tua</span>
              </h3>
              <button onClick={() => setIsQuickShareOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="p-3 bg-teal-50 rounded-2xl border border-teal-100 text-xs space-y-1 text-teal-950">
              <p><strong>Nama Bayi:</strong> {currentPatient.babyName}</p>
              <p><strong>Nickname:</strong> <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold">{currentPatient.nickname}</code></p>
              <p><strong>Password:</strong> <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold">{currentPatient.accessPassword}</code></p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link Akses Tautan Langsung:
              </label>
              <input
                type="text"
                readOnly
                value={getShareableLink(currentPatient)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-mono overflow-hidden truncate"
              />
            </div>

            <button
              onClick={handleCopyQuickShare}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              {quickCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{quickCopied ? 'Link Berhasil Tersalin!' : 'Salin Tautan Akses'}</span>
            </button>
          </div>
        </div>
      )}

      {/* EDIT NAKES PROFILE MODAL */}
      <EditNakesProfileModal
        isOpen={isNakesProfileOpen}
        currentNakesUser={currentNakesUser}
        onClose={() => setIsNakesProfileOpen(false)}
        onSaveSuccess={(updatedUser) => {
          handleUpdateNakesUser(updatedUser);
          setIsNakesProfileOpen(false);
        }}
        onRefreshNakes={refreshPatients}
      />

    </div>
  );
}
