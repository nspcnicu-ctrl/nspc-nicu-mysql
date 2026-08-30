import React, { useState, useEffect } from 'react';
import { NakesUser } from '../types';
import {
  getStoredNakesUsers,
  addNakesUser,
  updateNakesUser,
  deleteNakesUser,
  hasNakesAccessRights,
} from '../services/storage';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Check,
  X,
  Lock,
  User,
  Award,
  AlertCircle,
  CheckCircle2,
  Key,
  Shield,
  Users,
} from 'lucide-react';

interface ManageNakesUsersModalProps {
  isOpen: boolean;
  currentNakesUser: NakesUser | null;
  onClose: () => void;
  onRefreshNakes?: () => void;
}

export const ManageNakesUsersModal: React.FC<ManageNakesUsersModalProps> = ({
  isOpen,
  currentNakesUser,
  onClose,
  onRefreshNakes,
}) => {
  const [users, setUsers] = useState<NakesUser[]>([]);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  // New Account Form State
  const [newName, setNewName] = useState('');
  const [newRoleTitle, setNewRoleTitle] = useState('Anggota');
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newHasAccessRights, setNewHasAccessRights] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canManageAccounts = hasNakesAccessRights(currentNakesUser);

  const loadUsers = () => {
    const list = getStoredNakesUsers();
    setUsers(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!canManageAccounts) {
      setErrorMsg('Anda tidak memiliki Hak Akses untuk membuat akun admin baru.');
      return;
    }

    if (!newName.trim() || !newUsername.trim() || !newPin.trim()) {
      setErrorMsg('Mohon lengkapi Nama, Username, dan PIN.');
      return;
    }

    if (newPin.trim().length < 4) {
      setErrorMsg('PIN Login minimal 4 digit/karakter.');
      return;
    }

    // Check duplicate username
    const exists = users.some(
      (u) => u.username.toLowerCase() === newUsername.trim().toLowerCase()
    );
    if (exists) {
      setErrorMsg(`Username/NIP "${newUsername}" sudah digunakan. Silakan gunakan username lain.`);
      return;
    }

    const created = addNakesUser({
      name: newName.trim(),
      roleTitle: newRoleTitle,
      username: newUsername.trim(),
      pin: newPin.trim(),
      hasAccessRights: newHasAccessRights,
      accountType: newHasAccessRights ? 'Diberi Hak Akses' : 'Tanpa Hak Akses',
    });

    setSuccessMsg(`✓ Akun baru "${created.name}" berhasil dibuat dengan status ${newHasAccessRights ? 'Diberi Hak Akses' : 'Tanpa Hak Akses'}.`);
    
    // Reset form
    setNewName('');
    setNewUsername('');
    setNewPin('');
    setNewHasAccessRights(false);
    setIsAddFormOpen(false);

    loadUsers();
    if (onRefreshNakes) onRefreshNakes();
  };

  const handleToggleAccessRights = (userToUpdate: NakesUser) => {
    if (!canManageAccounts) {
      alert('Hanya Super Admin atau Nakes yang Diberi Hak Akses yang dapat mengubah hak akses.');
      return;
    }

    if (userToUpdate.isSuperAdmin || userToUpdate.username === 'superadmin') {
      alert('Hak akses Super Admin Utama tidak dapat diubah.');
      return;
    }

    const updatedRights = !userToUpdate.hasAccessRights;
    const updated: NakesUser = {
      ...userToUpdate,
      hasAccessRights: updatedRights,
      accountType: updatedRights ? 'Diberi Hak Akses' : 'Tanpa Hak Akses',
    };

    updateNakesUser(updated);
    setSuccessMsg(`Hak akses akun "${userToUpdate.name}" diubah menjadi: ${updatedRights ? 'Diberi Hak Akses' : 'Tanpa Hak Akses'}.`);
    loadUsers();
    if (onRefreshNakes) onRefreshNakes();
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleDeleteUser = (userToDelete: NakesUser) => {
    if (!canManageAccounts) {
      setSuccessMsg('Anda tidak memiliki Hak Akses untuk menghapus akun.');
      setTimeout(() => setSuccessMsg(null), 4000);
      return;
    }

    if (userToDelete.isSuperAdmin || userToDelete.username === 'superadmin') {
      setSuccessMsg('Akun Super Admin Utama tidak dapat dihapus.');
      setTimeout(() => setSuccessMsg(null), 4000);
      return;
    }

    if (currentNakesUser && userToDelete.id === currentNakesUser.id) {
      setSuccessMsg('Anda tidak dapat menghapus akun Anda sendiri saat sedang terhubung.');
      setTimeout(() => setSuccessMsg(null), 4000);
      return;
    }

    deleteNakesUser(userToDelete.id);
    setSuccessMsg(`Akun "${userToDelete.name}" telah dihapus.`);
    loadUsers();
    if (onRefreshNakes) onRefreshNakes();
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 relative my-8 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Pengelolaan Akun Nakes & Hak Akses</span>
              </h3>
              <p className="text-xs text-slate-500">
                Kelola akun admin internal Nakes RSUD Undata & otorisasi hak pembuatan akun baru.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banners */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {!canManageAccounts && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed shrink-0">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Status Akun Anda: Tanpa Hak Akses</span>
              Anda berada dalam mode tampilan. Hanya <strong>Super Admin</strong> atau Nakes yang <strong>Diberi Hak Akses</strong> yang dapat membuat akun baru atau mengubah hak akses Nakes lain.
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          
          {/* Action Header Button: Tambah Akun Baru */}
          {canManageAccounts && (
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-700" />
                <span className="text-xs font-bold text-slate-800">
                  Total Terdaftar: {users.length} Akun Admin Nakes
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFormOpen(!isAddFormOpen)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isAddFormOpen ? 'Tutup Form' : '+ Buat Akun Admin Baru'}</span>
              </button>
            </div>
          )}

          {/* FORM BUAT AKUN BARU (EXPANDABLE) */}
          {canManageAccounts && isAddFormOpen && (
            <form onSubmit={handleAddUserSubmit} className="p-4 bg-teal-50/50 border border-teal-200 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-2 border-b border-teal-200/60">
                <UserPlus className="w-4 h-4 text-teal-700" />
                <h4 className="text-xs font-extrabold text-teal-950 uppercase tracking-wider">
                  Form Tambah Akun Admin Nakes Baru
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Nama Lengkap & Gelar *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Ns. Nurul Hidayah, S.Kep"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Profesi / Jabatan *
                  </label>
                  <select
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-teal-500 outline-none cursor-pointer"
                  >
                    <option value="Kepala Ruangan">Kepala Ruangan</option>
                    <option value="Ketua">Ketua</option>
                    <option value="Anggota">Anggota</option>
                    <option value="Perawat Penanggung Jawab">Perawat Penanggung Jawab</option>
                    <option value="Dokter Spesialis Anak (DPJP)">Dokter Spesialis Anak (DPJP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Username / NIP Login *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Contoh: nurul_nicu"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    PIN Login Akses * (Min 4 digit)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Min 4 angka PIN"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              {/* KOLOM HAK AKSES (1 KOLOM DENGAN 2 PILIHAN) */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  <span>Status Hak Akses Akun Baru (Pilih 1 Opsi):</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    onClick={() => setNewHasAccessRights(true)}
                    className={`p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-start gap-2.5 ${
                      newHasAccessRights
                        ? 'bg-amber-50/90 border-amber-400 text-amber-950 ring-2 ring-amber-400/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="accessChoice"
                      checked={newHasAccessRights === true}
                      onChange={() => setNewHasAccessRights(true)}
                      className="mt-0.5 accent-amber-600"
                    />
                    <div>
                      <span className="font-extrabold block text-slate-900">
                        🛡️ Diberi Hak Akses
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        Memberikan hak untuk membuat & mengelola akun admin baru di sistem.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setNewHasAccessRights(false)}
                    className={`p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-start gap-2.5 ${
                      !newHasAccessRights
                        ? 'bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-slate-400/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="accessChoice"
                      checked={newHasAccessRights === false}
                      onChange={() => setNewHasAccessRights(false)}
                      className="mt-0.5 accent-slate-600"
                    />
                    <div>
                      <span className="font-extrabold block text-slate-900">
                        👤 Tanpa Hak Akses
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        Hanya memiliki hak mengelola data perkembangan pasien NICU.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddFormOpen(false)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan & Aktifkan Akun Baru</span>
                </button>
              </div>
            </form>
          )}

          {/* TABEL DAFTAR AKUN NAKES TERDAFTAR */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 pl-4">Nama & Username</th>
                  <th className="p-3">Jabatan</th>
                  <th className="p-3 text-center">Kolom Hak Akses</th>
                  <th className="p-3 pr-4 text-right">Aksi Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSuper = u.isSuperAdmin || u.username === 'superadmin';
                  const hasRights = isSuper || u.hasAccessRights === true;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 pl-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {u.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          @{u.username} • PIN: <span className="font-bold text-slate-700">{u.pin}</span>
                        </div>
                      </td>

                      <td className="p-3 font-medium text-slate-700">
                        {u.roleTitle}
                      </td>

                      {/* KOLOM HAK AKSES */}
                      <td className="p-3 text-center">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-950 border border-amber-300 rounded-full font-black text-[10px] shadow-2xs">
                            <Shield className="w-3 h-3 text-amber-600 fill-amber-200" />
                            <span>Super Admin</span>
                          </span>
                        ) : hasRights ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 text-teal-900 border border-teal-300 rounded-full font-bold text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-teal-600" />
                            <span>Diberi Hak Akses</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-medium text-[10px]">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>Tanpa Hak Akses</span>
                          </span>
                        )}
                      </td>

                      {/* AKSI */}
                      <td className="p-3 pr-4 text-right">
                        {!isSuper ? (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {canManageAccounts && (
                              <button
                                type="button"
                                onClick={() => handleToggleAccessRights(u)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                  hasRights
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                    : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                                }`}
                                title={hasRights ? 'Cabut Hak Akses' : 'Berikan Hak Akses untuk membuat akun baru'}
                              >
                                {hasRights ? 'Cabut Akses' : 'Ubah ke Diberi Hak Akses'}
                              </button>
                            )}

                            {canManageAccounts && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Hapus Akun Nakes"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-700 font-bold italic">
                            Utama
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-400">
            Akses sistem diamankan dengan otorisasi NSPC RSUD Undata.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
