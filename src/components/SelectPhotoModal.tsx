import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { updatePatient } from '../services/storage';
import {
  X,
  Camera,
  Check,
  Image as ImageIcon,
  Sparkles,
  Save,
  CheckCircle2,
} from 'lucide-react';

interface SelectPhotoModalProps {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
  onSaveSuccess: (updatedPatient: Patient) => void;
}

const PRESET_BABY_PHOTOS = [
  {
    id: 'preset-1',
    url: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=400&auto=format&fit=crop&q=80',
    label: 'Preset Bayi 1',
  },
  {
    id: 'preset-2',
    url: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400&auto=format&fit=crop&q=80',
    label: 'Preset Bayi 2',
  },
  {
    id: 'preset-3',
    url: 'https://images.unsplash.com/photo-1544126592-807ade215a0b?w=400&auto=format&fit=crop&q=80',
    label: 'Preset Bayi 3',
  },
  {
    id: 'preset-4',
    url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&auto=format&fit=crop&q=80',
    label: 'Preset Bayi 4',
  },
];

export const SelectPhotoModal: React.FC<SelectPhotoModalProps> = ({
  isOpen,
  patient,
  onClose,
  onSaveSuccess,
}) => {
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>(
    patient.coverPhotoUrl || ''
  );
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedPhotoUrl(patient.coverPhotoUrl || '');
      setSuccessBanner(null);
    }
  }, [isOpen, patient.coverPhotoUrl]);

  if (!isOpen) return null;

  // Extract photos uploaded by Nakes in daily logs
  const progressPhotos = patient.dailyLogs
    .filter((log) => Boolean(log.photoUrl))
    .map((log) => ({
      id: log.id,
      url: log.photoUrl as string,
      periodLabel: log.periodLabel,
      date: log.date,
      caption: log.photoCaption || log.nakesNotes,
      updatedBy: log.updatedBy,
    }));

  const handleSave = () => {
    const updated: Patient = {
      ...patient,
      coverPhotoUrl: selectedPhotoUrl || undefined,
    };

    updatePatient(updated);
    setSuccessBanner('✓ Foto profil bayi berhasil diperbarui!');

    setTimeout(() => {
      onSaveSuccess(updated);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto font-sans">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-emerald-800 text-white p-4 sm:p-5 px-5 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-2xl border border-white/15">
              <Camera className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Ganti Foto Profil Bayi
              </h2>
              <p className="text-xs text-teal-100/90 font-medium">
                Pilih foto dari perkembangan yang diunggah Perawat/Nakes atau galeri preset
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="p-3 bg-emerald-500 text-white text-xs font-bold text-center flex items-center justify-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successBanner}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* SECTION 1: FOTO PERKEMBANGAN DARi NAKES/ADMIN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
                <ImageIcon className="w-4 h-4 text-teal-600" />
                <span>Foto Perkembangan dari Nakes / Admin NICU ({progressPhotos.length})</span>
              </div>
              <span className="text-[11px] text-slate-400">Diunggah saat pemantauan harian</span>
            </div>

            {progressPhotos.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-slate-500 font-medium">
                Belum ada foto perkembangan yang diunggah oleh Nakes/Admin pada riwayat harian. Anda dapat memilih foto dari preset di bawah ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {progressPhotos.map((photo) => {
                  const isSelected = selectedPhotoUrl === photo.url;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedPhotoUrl(photo.url)}
                      className={`relative rounded-2xl overflow-hidden border-2 text-left transition-all cursor-pointer group bg-slate-900 ${
                        isSelected
                          ? 'border-teal-600 ring-4 ring-teal-100 shadow-md scale-[1.02]'
                          : 'border-slate-200 hover:border-teal-400'
                      }`}
                    >
                      <div className="aspect-square w-full overflow-hidden relative">
                        <img
                          src={photo.url}
                          alt={photo.periodLabel}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-teal-900/30 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="p-2 bg-teal-600 text-white rounded-full shadow-lg">
                              <Check className="w-5 h-5 stroke-[3]" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 bg-white border-t border-slate-100 space-y-0.5">
                        <div className="font-extrabold text-slate-900 text-xs truncate">
                          {photo.periodLabel}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {photo.date}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: FOTO PRESET PILIHAN */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Foto Preset Ilustrasi Pilihan</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRESET_BABY_PHOTOS.map((preset) => {
                const isSelected = selectedPhotoUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPhotoUrl(preset.url)}
                    className={`relative rounded-2xl overflow-hidden border-2 text-left transition-all cursor-pointer group bg-slate-900 ${
                      isSelected
                        ? 'border-teal-600 ring-4 ring-teal-100 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-teal-400'
                    }`}
                  >
                    <div className="aspect-square w-full overflow-hidden relative">
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-teal-900/30 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="p-2 bg-teal-600 text-white rounded-full shadow-lg">
                            <Check className="w-5 h-5 stroke-[3]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 px-6 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Gunakan Foto Ini</span>
          </button>
        </div>
      </div>
    </div>
  );
};
