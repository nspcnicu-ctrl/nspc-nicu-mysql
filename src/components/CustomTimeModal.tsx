import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import {
  formatIndonesianDate,
  getPatientAdmissionDateTime,
  getPatientDischargeDateTime,
  parseFullDateTime,
} from '../utils/dateUtils';
import {
  Clock,
  Calendar,
  Sparkles,
  GraduationCap,
  X,
  Check,
  Baby,
  Info,
  CheckCircle2,
} from 'lucide-react';

export type CustomTimeTab = 'admission' | 'discharge';

interface CustomTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  initialTab?: CustomTimeTab;
  onSave: (updatedPatient: Patient, successMessage: string) => Promise<void> | void;
}

export const CustomTimeModal: React.FC<CustomTimeModalProps> = ({
  isOpen,
  onClose,
  patient,
  initialTab = 'admission',
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<CustomTimeTab>(initialTab);
  const [isSaving, setIsSaving] = useState(false);

  // Admission states
  const [admissionDate, setAdmissionDate] = useState('');
  const [admissionTime, setAdmissionTime] = useState('');

  // Discharge states
  const [dischargeDate, setDischargeDate] = useState('');
  const [dischargeTime, setDischargeTime] = useState('');
  const [dischargeStatusChoice, setDischargeStatusChoice] = useState<'Sudah Pulang' | 'Siap Pulang' | 'keep'>('keep');

  useEffect(() => {
    if (patient && isOpen) {
      const isEligible =
        patient.status === 'Siap Pulang' ||
        patient.status === 'Sudah Pulang' ||
        Boolean(patient.dischargedAt);

      setActiveTab(isEligible ? initialTab : 'admission');

      // Parse current admission info
      const admInfo = getPatientAdmissionDateTime(patient);
      const initialAdmDate =
        patient.admissionDate?.split('T')[0]?.split(' ')[0] ||
        (admInfo ? admInfo.dateIso : undefined) ||
        new Date().toISOString().split('T')[0];
      const initialAdmTime =
        patient.admissionTime ||
        (admInfo ? admInfo.timeOnly : undefined) ||
        '08:00';
      setAdmissionDate(initialAdmDate);
      setAdmissionTime(initialAdmTime);

      // Parse current discharge info
      const disInfo = getPatientDischargeDateTime(patient);
      const isAlreadyDischarged =
        patient.status === 'Sudah Pulang' || Boolean(patient.dischargedAt);
      const initialDisDate =
        patient.dischargeDate?.split('T')[0]?.split(' ')[0] ||
        (disInfo ? disInfo.dateIso : undefined) ||
        patient.readyToDischargeDate?.split('T')[0]?.split(' ')[0] ||
        new Date().toISOString().split('T')[0];
      const initialDisTime =
        patient.dischargeTime ||
        (disInfo ? disInfo.timeOnly : undefined) ||
        patient.readyToDischargeTime ||
        '10:00';
      setDischargeDate(initialDisDate);
      setDischargeTime(initialDisTime);
      setDischargeStatusChoice(isAlreadyDischarged ? 'Sudah Pulang' : patient.status === 'Siap Pulang' ? 'Siap Pulang' : 'keep');
    }
  }, [patient, isOpen, initialTab]);

  if (!isOpen || !patient) return null;

  const isAlreadyDischarged =
    patient.status === 'Sudah Pulang' || Boolean(patient.dischargedAt);
  const isEligibleForDischarge =
    patient.status === 'Siap Pulang' ||
    patient.status === 'Sudah Pulang' ||
    Boolean(patient.dischargedAt);

  // Quick preset helper
  const handleQuickPreset = (
    type: 'admission' | 'discharge',
    preset: 'now' | '08:00' | '10:00' | '12:00' | '14:00' | '16:00' | '20:00'
  ) => {
    if (preset === 'now') {
      const now = new Date();
      const todayIso = now.toISOString().split('T')[0];
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      if (type === 'admission') {
        setAdmissionDate(todayIso);
        setAdmissionTime(timeStr);
      } else {
        setDischargeDate(todayIso);
        setDischargeTime(timeStr);
      }
    } else {
      if (type === 'admission') {
        setAdmissionTime(preset);
      } else {
        setDischargeTime(preset);
      }
    }
  };

  // Preview computations
  const previewAdmInfo = parseFullDateTime(admissionDate, admissionTime, '08:00');
  const previewDisInfo = parseFullDateTime(dischargeDate, dischargeTime, '10:00');

  // Handle Save Admission
  const handleSaveAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setIsSaving(true);
    try {
      const updated: Patient = {
        ...patient,
        admissionDate: admissionDate || patient.admissionDate,
        admissionTime: admissionTime || '08:00',
      };
      const displayStr = previewAdmInfo ? previewAdmInfo.sentenceDisplay : `${admissionDate} pukul ${admissionTime} WITA`;
      await onSave(updated, `✓ Waktu masuk untuk ${patient.babyName} berhasil disesuaikan: ${displayStr}`);
      onClose();
    } catch (err) {
      console.error('Failed to save admission time:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Save Discharge
  const handleSaveDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setIsSaving(true);
    try {
      const sqlDischargedAt =
        dischargeDate && dischargeTime ? `${dischargeDate} ${dischargeTime}:00` : undefined;

      let newStatus = patient.status;
      if (dischargeStatusChoice === 'Sudah Pulang') {
        newStatus = 'Sudah Pulang';
      } else if (dischargeStatusChoice === 'Siap Pulang') {
        newStatus = 'Siap Pulang';
      }

      const isMarkedDischarged = newStatus === 'Sudah Pulang' || isAlreadyDischarged;

      const updated: Patient = {
        ...patient,
        status: newStatus,
        dischargeDate: dischargeDate || undefined,
        dischargeTime: dischargeTime || undefined,
        readyToDischargeDate: dischargeDate || undefined,
        readyToDischargeTime: dischargeTime || undefined,
        dischargedAt: isMarkedDischarged ? (sqlDischargedAt || patient.dischargedAt || new Date().toISOString()) : patient.dischargedAt,
        dischargeSummary: patient.dischargeSummary
          ? {
              ...patient.dischargeSummary,
              dischargeDate: dischargeDate || patient.dischargeSummary.dischargeDate,
              dischargeTime: dischargeTime || patient.dischargeSummary.dischargeTime,
            }
          : undefined,
      };

      const displayStr = previewDisInfo ? previewDisInfo.sentenceDisplay : `${dischargeDate} pukul ${dischargeTime} WITA`;
      const labelType = isMarkedDischarged ? 'Waktu pulang' : 'Waktu siap pulang';
      await onSave(updated, `✓ ${labelType} untuk ${patient.babyName} berhasil disesuaikan: ${displayStr}`);
      onClose();
    } catch (err) {
      console.error('Failed to save discharge time:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Save Both (All)
  const handleSaveBoth = async () => {
    if (!patient) return;
    setIsSaving(true);
    try {
      const sqlDischargedAt =
        dischargeDate && dischargeTime ? `${dischargeDate} ${dischargeTime}:00` : undefined;

      let newStatus = patient.status;
      if (dischargeStatusChoice === 'Sudah Pulang') {
        newStatus = 'Sudah Pulang';
      } else if (dischargeStatusChoice === 'Siap Pulang') {
        newStatus = 'Siap Pulang';
      }
      const isMarkedDischarged = newStatus === 'Sudah Pulang' || isAlreadyDischarged;

      const updated: Patient = {
        ...patient,
        admissionDate: admissionDate || patient.admissionDate,
        admissionTime: admissionTime || '08:00',
        status: newStatus,
        dischargeDate: dischargeDate || undefined,
        dischargeTime: dischargeTime || undefined,
        readyToDischargeDate: dischargeDate || undefined,
        readyToDischargeTime: dischargeTime || undefined,
        dischargedAt: isMarkedDischarged ? (sqlDischargedAt || patient.dischargedAt || new Date().toISOString()) : patient.dischargedAt,
        dischargeSummary: patient.dischargeSummary
          ? {
              ...patient.dischargeSummary,
              dischargeDate: dischargeDate || patient.dischargeSummary.dischargeDate,
              dischargeTime: dischargeTime || patient.dischargeSummary.dischargeTime,
            }
          : undefined,
      };

      await onSave(
        updated,
        `✓ Waktu masuk & kepulangan untuk ${patient.babyName} berhasil disesuaikan secara sinkron.`
      );
      onClose();
    } catch (err) {
      console.error('Failed to save both times:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`text-white p-4 sm:p-5 flex items-center justify-between transition-colors ${
            activeTab === 'admission'
              ? 'bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800'
              : isAlreadyDischarged
              ? 'bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900'
              : 'bg-gradient-to-r from-emerald-800 via-teal-800 to-teal-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl shrink-0 backdrop-blur-xs">
              {activeTab === 'admission' ? (
                <Clock className="w-5 h-5 text-teal-200" />
              ) : isAlreadyDischarged ? (
                <GraduationCap className="w-5 h-5 text-amber-200" />
              ) : (
                <Sparkles className="w-5 h-5 text-emerald-200" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base leading-tight">
                  {activeTab === 'admission'
                    ? 'Custom Waktu Masuk NICU'
                    : isAlreadyDischarged
                    ? 'Custom Waktu Kepulangan (Alumni)'
                    : 'Custom Waktu Siap Pulang'}
                </h3>
                <span className="px-2 py-0.5 bg-white/20 text-white rounded-full text-[10px] font-bold shrink-0">
                  {activeTab === 'admission' ? 'Masuk' : 'Pulang'}
                </span>
              </div>
              <p className="text-xs text-white/90 font-medium truncate mt-0.5">
                {patient.babyName} • {patient.medicalRecordNumber || `RM-${patient.id.padStart(4, '0')}`} • {patient.roomNumber || 'NICU'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer text-white shrink-0 ml-2"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        {isEligibleForDischarge ? (
          <div className="p-2 bg-slate-100 border-b border-slate-200 grid grid-cols-2 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('admission')}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'admission'
                  ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Clock className={`w-4 h-4 ${activeTab === 'admission' ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>🕒 1. Waktu Masuk NICU</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('discharge')}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'discharge'
                  ? 'bg-white text-amber-900 shadow-xs border border-amber-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <GraduationCap className={`w-4 h-4 ${activeTab === 'discharge' ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>🎓 2. Waktu Pulang / Siap Pulang</span>
            </button>
          </div>
        ) : (
          <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-2 font-black text-teal-950">
              <Clock className="w-4 h-4 text-teal-700" />
              <span>Pengaturan Waktu Masuk NICU</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              Status Pasien: <strong className="text-teal-800">{patient.status}</strong>
            </span>
          </div>
        )}

        {/* Tab Content (Scrollable) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800">
          {activeTab === 'admission' ? (
            /* ================= TAB WAKTU MASUK ================= */
            <form onSubmit={handleSaveAdmission} className="space-y-4">
              {/* Guidance Info */}
              <div className="p-3.5 bg-teal-50/90 border border-teal-200 rounded-2xl text-xs space-y-1 text-teal-950">
                <div className="font-black flex items-center gap-1.5 text-teal-900">
                  <Clock className="w-4 h-4 text-teal-700" />
                  <span>Pengaturan Waktu Masuk Perawatan NICU</span>
                </div>
                <p className="text-teal-800/90 text-[11px] leading-relaxed">
                  Sesuaikan tanggal dan jam pasien pertama kali masuk ruang rawat NICU. Waktu ini digunakan untuk kalkulasi akurat Lama Hari Rawat (LOS), Kartu NSPC, rekam medis, dan portal orang tua.
                </p>
              </div>

              {/* Input Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Masuk NICU <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-600 outline-none transition-all shadow-2xs"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jam Pasien Masuk (WITA) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={admissionTime}
                      onChange={(e) => setAdmissionTime(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-600 outline-none transition-all shadow-2xs"
                    />
                    <Clock className="w-4 h-4 text-teal-600 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Quick Time Presets */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <span>Pilih Cepat Jam Masuk:</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('admission', 'now')}
                    className="px-2.5 py-1 bg-teal-100 hover:bg-teal-200 text-teal-900 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    ⏱️ Sekarang
                  </button>
                  {(['08:00', '10:00', '12:00', '14:00', '16:00', '20:00'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleQuickPreset('admission', preset)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        admissionTime === preset
                          ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                <span className="text-teal-800 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Tampilan Waktu Masuk Terpilih:</span>
                </span>
                <span className="font-mono font-extrabold text-teal-950 bg-white px-2.5 py-1 rounded-lg border border-teal-200 shadow-2xs">
                  {previewAdmInfo ? previewAdmInfo.fullDisplay : `${formatIndonesianDate(admissionDate)} • ${admissionTime || '--:--'} WITA`}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {isEligibleForDischarge ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('discharge')}
                    className="px-3 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-amber-700" />
                    <span>Atur Waktu Pulang →</span>
                  </button>
                ) : (
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Atur waktu pulang hanya saat Siap Pulang / Alumni</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Waktu Masuk'}</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* ================= TAB WAKTU PULANG ================= */
            <form onSubmit={handleSaveDischarge} className="space-y-4">
              {/* Guidance Info */}
              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                  isAlreadyDischarged || dischargeStatusChoice === 'Sudah Pulang'
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="font-black flex items-center gap-1.5">
                  {isAlreadyDischarged || dischargeStatusChoice === 'Sudah Pulang' ? (
                    <GraduationCap className="w-4 h-4 text-amber-700" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>
                    {isAlreadyDischarged || dischargeStatusChoice === 'Sudah Pulang'
                      ? 'Pengaturan Waktu Pulang Pasien (Alumni NICU)'
                      : 'Jadwal Pasien Siap Pulang'}
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  {isAlreadyDischarged || dischargeStatusChoice === 'Sudah Pulang'
                    ? 'Sesuaikan tanggal dan jam kepulangan resmi pasien. Waktu ini akan langsung tampil di kartu pasien, portal orang tua, dan dokumen kelulusan Kartu Kenangan.'
                    : 'Sesuaikan tanggal dan jam perkiraan pasien siap pulang. Ayah & Bunda akan melihat jadwal ini di portal monitoring.'}
                </p>
              </div>

              {/* Status Selector Option */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">Status Kepulangan Pasien:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDischargeStatusChoice('Sudah Pulang')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      dischargeStatusChoice === 'Sudah Pulang' || isAlreadyDischarged
                        ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-2xs font-black'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Sudah Pulang (Alumni)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDischargeStatusChoice('Siap Pulang')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      dischargeStatusChoice === 'Siap Pulang' && !isAlreadyDischarged
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-950 shadow-2xs font-black'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Jadwal Siap Pulang</span>
                  </button>
                </div>
              </div>

              {/* Input Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {dischargeStatusChoice === 'Sudah Pulang' || isAlreadyDischarged ? 'Tanggal Pulang' : 'Tanggal Siap Pulang'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dischargeDate}
                      onChange={(e) => setDischargeDate(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-600 outline-none transition-all shadow-2xs"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jam Pulang (WITA) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={dischargeTime}
                      onChange={(e) => setDischargeTime(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-600 outline-none transition-all shadow-2xs"
                    />
                    <Clock className="w-4 h-4 text-amber-600 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Quick Time Presets */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <span>Pilih Cepat Jam Pulang:</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('discharge', 'now')}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    ⏱️ Sekarang
                  </button>
                  {(['08:00', '10:00', '12:00', '14:00', '16:00', '20:00'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleQuickPreset('discharge', preset)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        dischargeTime === preset
                          ? 'bg-amber-700 text-white border-amber-800 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                <span className="text-amber-900 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Tampilan Waktu Pulang Terpilih:</span>
                </span>
                <span className="font-mono font-extrabold text-amber-950 bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs">
                  {previewDisInfo ? previewDisInfo.fullDisplay : `${formatIndonesianDate(dischargeDate)} • ${dischargeTime || '--:--'} WITA`}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('admission')}
                  className="px-3 py-2 text-xs font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-teal-700" />
                  <span>← Atur Waktu Masuk</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Waktu Pulang'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Quick Dual Save Button at bottom */}
          {isEligibleForDischarge && (
            <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 font-medium">
                Ingin menyimpan sekaligus waktu masuk &amp; pulang?
              </span>
              <button
                type="button"
                onClick={handleSaveBoth}
                disabled={isSaving}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                Simpan Kedua Waktu
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
