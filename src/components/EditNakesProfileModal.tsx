import React, { useState, useEffect } from 'react';
import { NakesUser } from '../types';
import { Stethoscope, Award, User, Key, Check, X, ShieldCheck, Users } from 'lucide-react';
import { updateNakesUser, hasNakesAccessRights } from '../services/storage';
import { ManageNakesUsersModal } from './ManageNakesUsersModal';

interface EditNakesProfileModalProps {
  isOpen: boolean;
  currentNakesUser: NakesUser | null;
  onClose: () => void;
  onSaveSuccess: (updatedUser: NakesUser) => void;
  onRefreshNakes?: () => void;
}

export const EditNakesProfileModal: React.FC<EditNakesProfileModalProps> = ({
  isOpen,
  currentNakesUser,
  onClose,
  onSaveSuccess,
  onRefreshNakes,
}) => {
  const [name, setName] = useState(currentNakesUser?.name || 'Ns. Perawat NICU');
  const [roleTitle, setRoleTitle] = useState(currentNakesUser?.roleTitle || 'Perawat Penanggung Jawab');
  const [username, setUsername] = useState(currentNakesUser?.username || 'admin_nicu');
  const [pin, setPin] = useState(currentNakesUser?.pin || '123456');
  const [successMsg, setSuccessMsg] = useState(false);
  const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);

  const canManageUsers = hasNakesAccessRights(currentNakesUser);

  useEffect(() => {
    if (currentNakesUser) {
      setName(currentNakesUser.name);
      setRoleTitle(currentNakesUser.roleTitle);
      setUsername(currentNakesUser.username);
      setPin(currentNakesUser.pin);
    }
  }, [currentNakesUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !pin.trim()) {
      alert('Mohon lengkapi Nama, Username, dan PIN Login Admin.');
      return;
    }

    const updatedUser: NakesUser = {
      id: currentNakesUser?.id || 'nakes_admin_' + Date.now(),
      name: name.trim(),
      roleTitle: roleTitle.trim() || 'Tim Medis NICU',
      username: username.trim(),
      pin: pin.trim(),
      createdAt: currentNakesUser?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    updateNakesUser(updatedUser);
    onSaveSuccess(updatedUser);
    setSuccessMsg(true);
    setTimeout(() => {
      setSuccessMsg(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 pr-8">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Edit Profile Admin Nakes
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Perbarui nama, posisi profesi, serta akun login admin medis NICU.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>✓ Profile Admin berhasil diperbarui!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Nama Lengkap & Gelar */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Nama Lengkap & Gelar Admin Nakes <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Ns. Rahmawati, S.Kep"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none transition-all"
              />
              <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Jabatan / Role Title */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Profesi / Jabatan Medis
            </label>
            <div className="relative">
              <select
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                required
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none transition-all cursor-pointer"
              >
                <option value="Kepala Ruangan">Kepala Ruangan</option>
                <option value="Perawat Penanggung Jawab">Perawat Penanggung Jawab</option>
                <option value="Perawat Pelaksana">Perawat Pelaksana</option>
                <option value="Dokter Spesialis Anak (DPJP)">Dokter Spesialis Anak (DPJP)</option>
                <option value="Ketua">Ketua</option>
                <option value="Anggota">Anggota</option>
                {!['Kepala Ruangan', 'Perawat Penanggung Jawab', 'Perawat Pelaksana', 'Dokter Spesialis Anak (DPJP)', 'Ketua', 'Anggota'].includes(roleTitle) && roleTitle && (
                  <option value={roleTitle}>{roleTitle}</option>
                )}
              </select>
              <Award className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Username Login */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Username Login Admin <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username untuk login"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none transition-all"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* PIN / Password Login */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              PIN / Password Login Admin <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN / Kata Sandi login"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none transition-all"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Status Kolom Hak Akses */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Kolom Hak Akses Akun Saat Ini:
            </span>
            <div className="flex items-center gap-2 pt-0.5">
              {currentNakesUser?.isSuperAdmin || currentNakesUser?.username === 'superadmin' ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-extrabold text-xs inline-flex items-center gap-1">
                  🛡️ Super Admin (Hak Akses Penuh)
                </span>
              ) : currentNakesUser?.hasAccessRights ? (
                <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-900 border border-teal-300 font-bold text-xs inline-flex items-center gap-1">
                  🛡️ Diberi Hak Akses (Membuat Akun Admin)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs inline-flex items-center gap-1">
                  👤 Tanpa Hak Akses (Petugas Medis Only)
                </span>
              )}
            </div>
          </div>

          {/* Tombol Kelola Akun Nakes & Hak Akses (Hanya Tampil Jika Memiliki Hak Akses) */}
          {canManageUsers && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsManageUsersOpen(true)}
                className="w-full py-2.5 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/90 font-extrabold text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Kelola Akun Nakes & Hak Akses</span>
              </button>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>

        {/* MODAL KELOLA AKUN NAKES & HAK AKSES */}
        <ManageNakesUsersModal
          isOpen={isManageUsersOpen}
          currentNakesUser={currentNakesUser}
          onClose={() => setIsManageUsersOpen(false)}
          onRefreshNakes={onRefreshNakes}
        />
      </div>
    </div>
  );
};
