import React, { useState, useEffect } from 'react';
import { UserRole, Patient, NakesUser } from '../types';
import {
  findPatientByCredentials,
  getAdminPin,
  getStoredNakesUsers,
  addNakesUser,
  findNakesUserByCredentials,
  syncFromBackend,
  syncNakesFromBackend,
} from '../services/storage';
import {
  Lock,
  Heart,
  Key,
  User,
  Stethoscope,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  BadgeCheck,
  Loader2,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  initialRole: UserRole;
  initialNickname?: string;
  initialPassword?: string;
  onClose: () => void;
  onSuccessParentLogin: (patient: Patient) => void;
  onSuccessNakesLogin: (nakesUser?: NakesUser) => void;
  allPatients: Patient[];
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  initialRole,
  initialNickname = '',
  initialPassword = '',
  onClose,
  onSuccessParentLogin,
  onSuccessNakesLogin,
  allPatients,
}) => {
  const [activeTab, setActiveTab] = useState<'parent' | 'nakes'>(initialRole === 'nakes' ? 'nakes' : 'parent');
  
  // Nakes Sub-mode: 'login' | 'register'
  const [nakesSubTab, setNakesSubTab] = useState<'login' | 'register'>('login');

  // Loading states
  const [isVerifying, setIsVerifying] = useState(false);

  // Parent state
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [parentError, setParentError] = useState('');

  // Nakes Login state
  const [nakesUsername, setNakesUsername] = useState('');
  const [adminPin, setAdminPinInput] = useState('');
  const [nakesError, setNakesError] = useState('');

  // Nakes Register state
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('Anggota');
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Nakes list
  const [nakesList, setNakesList] = useState<NakesUser[]>([]);

  useEffect(() => {
    if (isOpen) {
      setNakesList(getStoredNakesUsers());
      setActiveTab(initialRole === 'nakes' ? 'nakes' : 'parent');
      if (initialNickname) setNickname(initialNickname);
      if (initialPassword) setPassword(initialPassword);
    }
  }, [isOpen, initialRole, initialNickname, initialPassword]);

  if (!isOpen) return null;

  const handleParentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentError('');
    if (!nickname.trim() || !password.trim()) {
      setParentError('Silakan isi Nickname Pasien dan Password.');
      return;
    }

    // 1. First check local memory
    let patient = findPatientByCredentials(nickname, password);
    if (patient) {
      onSuccessParentLogin(patient);
      onClose();
      return;
    }

    // 2. If not found locally, fetch latest from MySQL Database
    setIsVerifying(true);
    try {
      const refreshed = await syncFromBackend();
      const cleanNick = nickname.trim().toLowerCase();
      const cleanPass = password.trim();
      const match = refreshed.find(
        (p) => p.nickname.toLowerCase() === cleanNick && p.accessPassword === cleanPass
      );
      if (match) {
        onSuccessParentLogin(match);
        onClose();
        setIsVerifying(false);
        return;
      }
    } catch (err) {
      console.warn('Sync on login error:', err);
    }
    setIsVerifying(false);
    setParentError('Nickname atau Password tidak ditemukan. Pastikan huruf besar & kecil sesuai.');
  };

  const handleNakesLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNakesError('');
    const cleanPin = adminPin.trim();
    const cleanUser = nakesUsername.trim();

    if (!cleanPin) {
      setNakesError('Masukkan PIN Akses Nakes Anda.');
      return;
    }

    // Check against registered Nakes accounts
    let match = findNakesUserByCredentials(cleanUser, cleanPin);
    if (match) {
      onSuccessNakesLogin(match);
      onClose();
      return;
    }

    // Check master admin pin
    const validMasterPin = getAdminPin();
    if (cleanPin === validMasterPin || cleanPin === 'adminnicu' || cleanPin === 'admin') {
      const fallbackMaster: NakesUser = {
        id: 'master_admin',
        name: 'Admin Utama NICU',
        roleTitle: 'Petugas Administrator NICU',
        username: 'admin',
        pin: cleanPin,
        createdAt: new Date().toISOString(),
      };
      onSuccessNakesLogin(fallbackMaster);
      onClose();
      return;
    }

    // If not found, try refreshing from MySQL Database
    setIsVerifying(true);
    try {
      const remoteUsers = await syncNakesFromBackend();
      const cleanUserLower = cleanUser.toLowerCase();
      const remoteMatch = remoteUsers.find(
        (u) => (cleanUserLower ? u.username.toLowerCase() === cleanUserLower : true) && u.pin === cleanPin
      );
      if (remoteMatch) {
        onSuccessNakesLogin(remoteMatch);
        onClose();
        setIsVerifying(false);
        return;
      }
    } catch (err) {
      console.warn('Sync nakes on login error:', err);
    }
    setIsVerifying(false);

    setNakesError('PIN atau Username Nakes tidak valid. Silakan periksa kembali atau daftar akun baru.');
  };

  const handleNakesRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regName.trim()) {
      setRegError('Nama Lengkap & Gelar wajib diisi.');
      return;
    }
    if (!regUsername.trim()) {
      setRegError('Username / NIP wajib diisi.');
      return;
    }
    if (!regPin.trim() || regPin.length < 4) {
      setRegError('PIN Akses minimal 4 karakter/angka.');
      return;
    }
    if (regPin !== regConfirmPin) {
      setRegError('Konfirmasi PIN tidak cocok dengan PIN yang dibuat.');
      return;
    }

    // Check duplicate username
    const currentUsers = getStoredNakesUsers();
    if (currentUsers.some((u) => u.username.toLowerCase() === regUsername.trim().toLowerCase())) {
      setRegError(`Username/NIP "${regUsername}" sudah terdaftar. Gunakan username lain.`);
      return;
    }

    const created = addNakesUser({
      name: regName.trim(),
      roleTitle: regRole,
      username: regUsername.trim(),
      pin: regPin.trim(),
    });

    setRegSuccess(`Pendaftaran Berhasil! Akun ${created.name} telah aktif.`);
    setTimeout(() => {
      onSuccessNakesLogin(created);
      onClose();
    }, 1200);
  };

  const handleQuickPrefillParent = (patient: Patient) => {
    setNickname(patient.nickname);
    setPassword(patient.accessPassword);
    setParentError('');
  };

  const handleSelectNakesUser = (nakes: NakesUser) => {
    setNakesUsername(nakes.username);
    setAdminPinInput(nakes.pin);
    setNakesError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header Main Tabs */}
        <div className="grid grid-cols-2 bg-slate-100/80 p-1.5 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('parent'); setParentError(''); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all ${
              activeTab === 'parent'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Heart className={`w-4 h-4 ${activeTab === 'parent' ? 'text-teal-600 fill-teal-100' : ''}`} />
            <span>Orang Tua Bayi</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('nakes'); setNakesError(''); setRegError(''); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all ${
              activeTab === 'nakes'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-teal-600" />
            <span>Nakes / Admin</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'parent' ? (
            /* PARENT LOGIN FORM */
            <form onSubmit={handleParentSubmit} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-teal-100">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Kartu Perkembangan Bayi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masukkan Nickname & Password yang diberikan oleh petugas NICU RSUD Undata
                </p>
              </div>

              {parentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parentError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nickname Pasien
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Contoh: bayi_fitriani"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password Akses
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password dari Petugas"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Cloud...</span>
                  </>
                ) : (
                  <>
                    <span>Buka Kartu Perkembangan</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* DEMO QUICK PREFILL FOR PARENTS - TAMPILKAN 1 CONTOH PASIEN TERDAFTAR */}
              {allPatients.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Coba Akses Contoh Pasien:
                  </p>
                  <div className="space-y-1.5">
                    {allPatients.slice(0, 1).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleQuickPrefillParent(p)}
                        className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200/60 transition-all flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            {p.babyName} ({p.gestationCategory === 'aterm' ? 'Aterm' : 'Preterm'})
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Nick: <code className="bg-slate-200/80 px-1 rounded text-slate-700">{p.nickname}</code> • Pass: <code className="bg-slate-200/80 px-1 rounded text-slate-700">{p.accessPassword}</code>
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-teal-600 underline shrink-0 ml-2">Pilih</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            /* NAKES ADMIN SECTION WITH SUB-TABS */
            <div className="space-y-4">
              
              {/* SUB-VIEW: LOGIN NAKES (Pendaftaran Publik Ditiadakan demi Keamanan) */}
              <form onSubmit={handleNakesLoginSubmit} className="space-y-3.5">
                <div className="text-center mb-2">
                  <div className="w-10 h-10 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-1.5 border border-teal-100">
                    <ShieldCheck className="w-5 h-5 text-teal-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Login Nakes / Admin NICU
                  </h3>
                  <p className="text-xs text-slate-500">
                    Masukkan Username/NIP & PIN Akses Nakes Anda
                  </p>
                </div>

                {nakesError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{nakesError}</span>
                  </div>
                )}

                {/* INFO BANNER REGISTRATION NOT PUBLIC */}
                <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2 leading-relaxed">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-950 mb-0.5">Pendaftaran Publik Ditiadakan:</span>
                    Pembuatan akun Nakes baru dikelola internal oleh <strong>Super Admin</strong> atau Nakes yang <strong>Diberi Hak Akses</strong> melalui Dashboard Admin.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username / NIP Nakes (Opsional)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={nakesUsername}
                      onChange={(e) => setNakesUsername(e.target.value)}
                      placeholder="Contoh: superadmin atau hasni"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PIN Akses Nakes (Required)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={adminPin}
                      onChange={(e) => setAdminPinInput(e.target.value)}
                      placeholder="Masukkan PIN Akses Nakes Anda"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-3 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-teal-700/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi Cloud...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk Dashboard Nakes</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* LIST REGISTERED NAKES USERS - HANYA TAMPILKAN 1 AKUN ADMIN */}
                {(() => {
                  const adminAccounts = nakesList.filter(
                    (u) => u.isSuperAdmin || u.username === 'superadmin' || u.accountType === 'Super Admin' || u.name.toLowerCase().includes('admin')
                  );
                  const displayAdminList = adminAccounts.length > 0 ? adminAccounts.slice(0, 1) : nakesList.slice(0, 1);

                  if (displayAdminList.length === 0) return null;

                  return (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Daftar Akun Nakes Terdaftar:
                        </span>
                        <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                          1 Akun Admin
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {displayAdminList.map((u) => {
                          const isSuper = u.isSuperAdmin || u.username === 'superadmin';
                          return (
                            <div
                              key={u.id}
                              onClick={() => handleSelectNakesUser(u)}
                              className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/80 border border-slate-200/70 hover:border-teal-300 cursor-pointer transition-all flex items-center justify-between group"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 text-xs truncate group-hover:text-teal-900">
                                    {u.name}
                                  </span>
                                  {isSuper && (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-extrabold">
                                      Super Admin
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {u.roleTitle} • Username: <code className="bg-slate-200 px-1 rounded font-bold text-slate-800">{u.username}</code> • PIN: <code className="bg-slate-200 px-1 rounded font-bold text-slate-800">{u.pin}</code>
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-teal-700 bg-white border border-teal-200 px-2 py-1 rounded-lg shrink-0 group-hover:bg-teal-700 group-hover:text-white transition-all">
                                Pilih
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                </form>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
            >
              Tutup Dialog
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
