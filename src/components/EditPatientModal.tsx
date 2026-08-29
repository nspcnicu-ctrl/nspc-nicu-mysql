import React, { useState, useEffect, useRef } from 'react';
import { Patient, Gender } from '../types';
import { updatePatient } from '../services/storage';
import {
  X,
  Camera,
  User,
  Baby,
  Key,
  KeyRound,
  RefreshCw,
  Save,
  CheckCircle2,
  Calendar,
  Scale,
  Hash,
  Home,
  Upload,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';

interface EditPatientModalProps {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
  onSaveSuccess: (updatedPatient: Patient) => void;
}

const PRESET_BABY_PHOTOS = [
  'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544126592-807ade215a0b?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&auto=format&fit=crop&q=80',
];

export const EditPatientModal: React.FC<EditPatientModalProps> = ({
  isOpen,
  patient,
  onClose,
  onSaveSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [babyName, setBabyName] = useState(patient.babyName || '');
  const [gender, setGender] = useState<Gender>(patient.gender || 'Laki-Laki');
  const [birthDate, setBirthDate] = useState(patient.birthDate || '');
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(patient.gestationalAgeWeeks || 36);
  const [initialWeight, setInitialWeight] = useState<number>(patient.initialAnthropometry?.weightGram || 2500);
  const [initialLength, setInitialLength] = useState<number>(patient.initialAnthropometry?.lengthCm || 46);
  const [headCircumference, setHeadCircumference] = useState<number>(patient.initialAnthropometry?.headCircumferenceCm || 32);
  const [chestCircumference, setChestCircumference] = useState<number>(patient.initialAnthropometry?.chestCircumferenceCm || 30);
  const [abdominalCircumference, setAbdominalCircumference] = useState<number>(patient.initialAnthropometry?.abdominalCircumferenceCm || 28);
  const [upperArmCircumference, setUpperArmCircumference] = useState<number>(patient.initialAnthropometry?.upperArmCircumferenceCm || 10);
  const [medicalRecordNumber, setMedicalRecordNumber] = useState(patient.medicalRecordNumber || '');
  const [roomNumber, setRoomNumber] = useState(patient.roomNumber || 'Ruang NICU RSUD Undata');

  const [motherName, setMotherName] = useState(patient.motherName || '');
  const [fatherName, setFatherName] = useState(patient.fatherName || '');

  const [nickname, setNickname] = useState(patient.nickname || '');
  const [accessPassword, setAccessPassword] = useState(patient.accessPassword || '');

  const [coverPhotoUrl, setCoverPhotoUrl] = useState(patient.coverPhotoUrl || '');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Sync state when patient changes or modal opens
  useEffect(() => {
    if (patient && isOpen) {
      setBabyName(patient.babyName || '');
      setGender(patient.gender || 'Laki-Laki');
      setBirthDate(patient.birthDate || '');
      setGestationalAgeWeeks(patient.gestationalAgeWeeks || 36);
      setInitialWeight(patient.initialAnthropometry?.weightGram || 2500);
      setInitialLength(patient.initialAnthropometry?.lengthCm || 46);
      setHeadCircumference(patient.initialAnthropometry?.headCircumferenceCm || 32);
      setChestCircumference(patient.initialAnthropometry?.chestCircumferenceCm || 30);
      setAbdominalCircumference(patient.initialAnthropometry?.abdominalCircumferenceCm || 28);
      setUpperArmCircumference(patient.initialAnthropometry?.upperArmCircumferenceCm || 10);
      setMedicalRecordNumber(patient.medicalRecordNumber || '');
      setRoomNumber(patient.roomNumber || 'Ruang NICU RSUD Undata');
      setMotherName(patient.motherName || '');
      setFatherName(patient.fatherName || '');
      setNickname(patient.nickname || '');
      setAccessPassword(patient.accessPassword || '');
      setCoverPhotoUrl(patient.coverPhotoUrl || '');
      setSuccessMessage('');
    }
  }, [patient, isOpen]);

  if (!isOpen) return null;

  const handleGeneratePassword = () => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setAccessPassword(`Undata#${randomDigits}`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran foto terlalu besar. Maksimal 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setCoverPhotoUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!babyName.trim()) {
      alert('Nama bayi wajib diisi.');
      return;
    }
    if (!nickname.trim()) {
      alert('Nickname login orang tua wajib diisi.');
      return;
    }
    if (!accessPassword.trim()) {
      alert('Password login wajib diisi.');
      return;
    }

    const updated: Patient = {
      ...patient,
      babyName: babyName.trim(),
      gender,
      birthDate,
      gestationalAgeWeeks: Number(gestationalAgeWeeks) || 36,
      gestationCategory: Number(gestationalAgeWeeks) >= 37 ? 'aterm' : 'preterm',
      initialAnthropometry: {
        ...patient.initialAnthropometry,
        weightGram: Number(initialWeight) || 2500,
        lengthCm: Number(initialLength) || 46,
        headCircumferenceCm: Number(headCircumference) || 32,
        chestCircumferenceCm: Number(chestCircumference) || 30,
        abdominalCircumferenceCm: Number(abdominalCircumference) || 28,
        upperArmCircumferenceCm: Number(upperArmCircumference) || 10,
      },
      medicalRecordNumber: medicalRecordNumber.trim(),
      roomNumber: roomNumber.trim(),
      motherName: motherName.trim(),
      fatherName: fatherName.trim(),
      nickname: nickname.trim(),
      accessPassword: accessPassword.trim(),
      coverPhotoUrl: coverPhotoUrl || undefined,
    };

    updatePatient(updated);
    setSuccessMessage('Identitas Bayi & Orang Tua berhasil diperbarui!');

    setTimeout(() => {
      onSaveSuccess(updated);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-emerald-800 text-white p-4 sm:p-5 px-5 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-2xl border border-white/15">
              <Baby className="w-6 h-6 text-teal-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                Edit Identitas Bayi & Orang Tua
              </h3>
              <p className="text-xs text-teal-100/90 mt-0.5">
                Ubah foto profil bayi, data identitas, serta nickname & password login
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 text-teal-100 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SECTION 1: FOTO BAYI */}
          <div className="p-4 bg-gradient-to-br from-teal-50/80 to-emerald-50/50 rounded-2xl border border-teal-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-700" />
                <span>Foto Profil / Sampul Bayi</span>
              </label>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
              >
                {showUrlInput ? 'Sembunyikan Input URL' : 'Gunakan URL Foto'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Photo Preview Container */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-teal-300 shadow-md bg-white flex items-center justify-center">
                  {coverPhotoUrl ? (
                    <img
                      src={coverPhotoUrl}
                      alt="Foto profil bayi"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-teal-600 p-2 text-center">
                      <Baby className="w-10 h-10 opacity-60 mb-1" />
                      <span className="text-[10px] font-semibold">Belum Ada Foto</span>
                    </div>
                  )}
                </div>

                {/* Upload Action Overlay Badge */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 bg-teal-700 hover:bg-teal-800 text-white p-2 rounded-xl shadow-lg border-2 border-white transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                  title="Klik untuk ganti foto dari galeri HP / komputer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ganti</span>
                </button>
              </div>

              {/* Upload & Preset Options */}
              <div className="space-y-2.5 w-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih Foto dari Perangkat</span>
                  </button>

                  {coverPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverPhotoUrl('')}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>

                {/* Optional Presets */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">
                    Atau pilih sampel foto bayi:
                  </p>
                  <div className="flex gap-2">
                    {PRESET_BABY_PHOTOS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCoverPhotoUrl(preset)}
                        className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          coverPhotoUrl === preset ? 'border-teal-600 scale-105 shadow-md' : 'border-slate-200 hover:border-teal-400 opacity-80'
                        }`}
                      >
                        <img src={preset} alt={`Sample ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                {showUrlInput && (
                  <div className="pt-1">
                    <input
                      type="url"
                      value={coverPhotoUrl}
                      onChange={(e) => setCoverPhotoUrl(e.target.value)}
                      placeholder="https://domain.com/foto-bayi.jpg"
                      className="w-full px-3 py-2 text-xs bg-white border border-teal-200 rounded-xl outline-none focus:border-teal-600"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: IDENTITAS BAYI */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-1">
              <Baby className="w-4 h-4 text-teal-700" />
              <span>1. Data Identitas Bayi</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Baby Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap / Panggilan Bayi <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={babyName}
                    onChange={(e) => setBabyName(e.target.value)}
                    placeholder="Contoh: By. Ny. Fatimah"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Baby className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Kelamin
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all cursor-pointer"
                >
                  <option value="Laki-Laki">Laki-Laki 👶🏻</option>
                  <option value="Perempuan">Perempuan 👶🏽</option>
                </select>
              </div>

              {/* Birth Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Lahir
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Gestational Age */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Usia Kehamilan (Gestasi - Minggu)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="22"
                    max="44"
                    value={gestationalAgeWeeks}
                    onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Initial Weight */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Berat Lahir (Gram)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="50"
                    value={initialWeight}
                    onChange={(e) => setInitialWeight(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Scale className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Initial Length */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Panjang Badan (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={initialLength}
                    onChange={(e) => setInitialLength(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Head Circumference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lingkar Kepala (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={headCircumference}
                    onChange={(e) => setHeadCircumference(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Chest Circumference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lingkar Dada (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={chestCircumference}
                    onChange={(e) => setChestCircumference(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Abdominal Circumference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lingkar Perut (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={abdominalCircumference}
                    onChange={(e) => setAbdominalCircumference(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Upper Arm Circumference (LILA) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lingkar Lengan Atas / LILA (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={upperArmCircumference}
                    onChange={(e) => setUpperArmCircumference(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Medical Record Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. Rekam Medis (RM)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={medicalRecordNumber}
                    onChange={(e) => setMedicalRecordNumber(e.target.value)}
                    placeholder="Contoh: RM-99821"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Room Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ruangan / Bed NICU
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="Contoh: Bed 02 (Isolasi)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                  />
                  <Home className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: IDENTITAS ORANG TUA */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-1">
              <User className="w-4 h-4 text-teal-700" />
              <span>2. Identitas Orang Tua</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Mother Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Ibu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="Nama lengkap ibu"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                />
              </div>

              {/* Father Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Ayah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Nama lengkap ayah"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:border-teal-600 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: KREDENSIAL AKSES LOGIN ORANG TUA */}
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-3">
            <h4 className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-700" />
              <span>3. Kredensial Akses Login Orang Tua (Nickname & Password)</span>
            </h4>
            <p className="text-[11px] text-amber-900/80">
              Kredensial ini digunakan oleh Ayah/Ibu untuk login ke NSPC Portal melihat perkembangan si kecil.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Nickname */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nickname Login <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Contoh: fatimah123"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-900 font-extrabold focus:border-amber-600 outline-none transition-all"
                  />
                  <User className="w-4 h-4 text-amber-600 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Password Akses <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[10px] font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1 bg-teal-100 hover:bg-teal-200 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Acak Password</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    placeholder="Contoh: Undata#8821"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-900 font-extrabold focus:border-amber-600 outline-none transition-all"
                  />
                  <Key className="w-4 h-4 text-amber-600 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan Identitas</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
