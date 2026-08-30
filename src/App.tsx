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
            onOpenPrintModal={() => setIsPrintModalOpen(true)}
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
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-900 to-emerald-950 text-white p-8 sm:p-12 shadow-2xl">
              <div className="absolute right-0 top-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-teal-200 text-xs font-semibold border border-white/15">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>RSUD Undata Provinsi Sulawesi Tengah</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                  NSPC <span className="text-teal-300">NICU</span> RSUD Undata
                </h1>

                <p className="text-teal-100/90 text-sm sm:text-base leading-relaxed font-normal">
                  <strong>Neo Smart Progress Card</strong> — Aplikasi pemantau perkembangan harian & mingguan bayi di ruang NICU RSUD Undata Palu. Dirancang khusus untuk memfasilitasi keterbukaan informasi perkembangan kesehatan buah hati kepada Ayah dan Bunda.
                </p>

                <div className="pt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleOpenLogin('parent')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-teal-400 hover:bg-teal-300 text-teal-950 font-extrabold text-sm shadow-lg shadow-teal-400/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    <Heart className="w-4 h-4 text-teal-900 fill-teal-900" />
                    <span>Masuk Akses Orang Tua</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenLogin('nakes')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all cursor-pointer"
                  >
                    <Stethoscope className="w-4 h-4 text-teal-300" />
                    <span>Portal Tenaga Kesehatan (Nakes)</span>
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

            {/* DEMO PATIENTS QUICK ACCESS SECTION */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Coba Langsung Contoh Pasien
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pilih contoh pasien di bawah untuk langsung mencoba tampilan kartu orang tua
                  </p>
                </div>
                <span className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full border border-teal-100">
                  Contoh Pasien
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {patients.slice(0, 1).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSuccessParentLogin(p)}
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-teal-50/80 border border-slate-200/80 hover:border-teal-200 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm group-hover:text-teal-900">
                          {p.babyName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.gestationCategory === 'aterm' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.gestationCategory === 'aterm' ? 'Aterm (>37m)' : 'Preterm (<36m)'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Bunda {p.motherName} • Nick: <code className="bg-slate-200/80 px-1 rounded text-slate-800 font-bold">{p.nickname}</code> • Pass: <code className="bg-slate-200/80 px-1 rounded text-slate-800 font-bold">{p.accessPassword}</code>
                      </p>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
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
