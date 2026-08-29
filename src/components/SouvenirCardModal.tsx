import React from 'react';
import { Patient } from '../types';
import {
  formatLengthOfStay,
  formatIndonesianDate,
} from '../utils/dateUtils';
import {
  Award,
  Printer,
  Sparkles,
  CheckCircle2,
  Baby,
  Scale,
  X,
  Camera,
  ArrowLeft,
} from 'lucide-react';

interface SouvenirCardModalProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
}

export const SouvenirCardModal: React.FC<SouvenirCardModalProps> = ({
  patient,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const initialWeight = patient.initialAnthropometry.weightGram;
  const latestWeight = patient.dailyLogs[0]?.weightGram || initialWeight;
  const weightGain = latestWeight - initialWeight;

  // Collect photos from daily logs
  const dailyPhotos = patient.dailyLogs
    .filter((log) => log.photoUrl)
    .map((log) => ({
      url: log.photoUrl!,
      period: log.periodLabel,
      date: log.date,
      caption: log.photoCaption || log.nakesNotes,
    }));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 md:p-6 bg-slate-900/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible print-only-container">
      
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-2 sm:my-6 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:my-0 print:w-full">
        
        {/* Modal Header Controls (Hidden during print) */}
        <div className="bg-teal-800 text-white p-3.5 sm:p-4 px-4 sm:px-6 flex items-center justify-between shrink-0 print:hidden border-b border-teal-700">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-300 shrink-0" />
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-100">Piagam Kelulusan & Kartu Kenangan NICU</h3>
              <p className="text-[10px] text-teal-200 hidden sm:block">Souvenir Digital Resmi RSUD Undata Palu</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-2 bg-teal-900 hover:bg-teal-950 text-teal-100 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-teal-700/50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali / Tutup</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE / SOUVENIR CARD CONTENT */}
        <div className="p-4 sm:p-8 overflow-y-auto space-y-6 print:overflow-visible print:p-0 print:m-0">
          
          {/* SOUVENIR CARD OUTER CONTAINER */}
          <div className="border-4 border-teal-600/30 p-5 sm:p-8 rounded-3xl bg-gradient-to-b from-teal-50/50 via-white to-amber-50/30 relative space-y-5 print:border-2 print:border-teal-700 print:p-4 print:space-y-3 print:rounded-2xl print:bg-white print:text-slate-900">
            
            {/* Top RSUD Undata Branding Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 sm:pb-6 border-b-2 border-teal-600/20 text-center sm:text-left print:pb-3 print:mb-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0 print:w-10 print:h-10 print:text-base">
                  🏥
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-teal-800 uppercase block print:text-[9px]">
                    RSUD UNDATA PROVINSI SULAWESI TENGAH
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight print:text-lg">
                    PIAGAM KELULUSAN NICU
                  </h1>
                  <p className="text-xs text-slate-600 font-medium print:text-[10px]">
                    Neo Smart Progress Card (NSPC) • Instalasi Perawatan Neonatus
                  </p>
                </div>
              </div>

              <div className="text-center sm:text-right bg-teal-100/80 px-4 py-2 rounded-2xl border border-teal-200 print:px-3 print:py-1">
                <span className="text-[10px] text-teal-800 font-bold block uppercase tracking-wider print:text-[8px]">
                  Status Kelulusan
                </span>
                <span className="text-sm font-extrabold text-teal-950 flex items-center justify-center sm:justify-end gap-1 print:text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  SIAP & SEHAT PULANG
                </span>
              </div>
            </div>

            {/* Baby Main Profile & Cover Photo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center print:grid-cols-3 print:gap-4">
              
              {/* Photo Area */}
              <div className="flex flex-col items-center justify-center space-y-2 print:space-y-1">
                <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-slate-100 print:w-28 print:h-28 print:rounded-2xl print:border-2">
                  {patient.coverPhotoUrl || dailyPhotos[0]?.url ? (
                    <img
                      src={patient.coverPhotoUrl || dailyPhotos[0]?.url}
                      alt={patient.babyName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-teal-700 bg-teal-50 p-4 text-center">
                      <Baby className="w-12 h-12 mb-1 opacity-60 print:w-8 print:h-8" />
                      <span className="text-[10px] font-bold print:text-[8px]">Kenangan Manis NICU</span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-bold text-teal-800 bg-teal-100 px-3 py-1 rounded-full border border-teal-200 print:text-[9px] print:px-2 print:py-0.5">
                  {patient.gender === 'Laki-Laki' ? '👶🏻 Putra Tampan' : '👶🏽 Putri Cantik'}
                </span>
              </div>

              {/* Patient Details */}
              <div className="md:col-span-2 space-y-3 print:space-y-1.5">
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 print:text-xl">
                    {patient.babyName}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium print:text-[11px]">
                    Buah Hati Dari: <strong className="text-slate-900">Bunda {patient.motherName}</strong> & <strong className="text-slate-900">Ayah {patient.fatherName}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 print:gap-1.5 print:text-[10px]">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 print:p-1.5">
                    <span className="text-slate-400 text-[10px] print:text-[8px] block">Tgl Lahir</span>
                    <span className="font-bold text-slate-800">{formatIndonesianDate(patient.birthDate)}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 print:p-1.5">
                    <span className="text-slate-400 text-[10px] print:text-[8px] block">Tgl Masuk NICU</span>
                    <span className="font-bold text-slate-800">{formatIndonesianDate(patient.admissionDate)}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 print:p-1.5">
                    <span className="text-slate-400 text-[10px] print:text-[8px] block">Usia Gestasi</span>
                    <span className="font-bold text-slate-800">{patient.gestationalAgeWeeks} Minggu ({patient.gestationCategory === 'aterm' ? 'Aterm' : 'Preterm'})</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 print:p-1.5">
                    <span className="text-slate-400 text-[10px] print:text-[8px] block">Lama Perawatan</span>
                    <span className="font-bold text-teal-700">{formatLengthOfStay(patient.admissionDate)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* WEIGHT PROGRESS HIGHLIGHT */}
            <div className="bg-teal-800 text-white p-4 sm:p-5 rounded-2xl shadow-md space-y-2 print:p-3 print:space-y-1">
              <h3 className="font-bold text-xs uppercase tracking-wider text-teal-200 flex items-center gap-1.5 print:text-[10px]">
                <Scale className="w-4 h-4 text-amber-300 print:w-3 print:h-3" />
                <span>Pencapaian Perkembangan Berat Badan (BB)</span>
              </h3>

              <div className="grid grid-cols-3 gap-2 text-center pt-1 print:pt-0.5">
                <div className="bg-white/10 p-2 sm:p-2.5 rounded-xl border border-white/10 print:p-1.5">
                  <span className="text-[10px] print:text-[8px] text-teal-200 block">BB Lahir / Masuk</span>
                  <span className="text-sm sm:text-lg font-black text-white print:text-xs">{initialWeight} gram</span>
                </div>
                <div className="bg-white/10 p-2 sm:p-2.5 rounded-xl border border-white/10 print:p-1.5">
                  <span className="text-[10px] print:text-[8px] text-teal-200 block">BB Kepulangan</span>
                  <span className="text-sm sm:text-lg font-black text-amber-300 print:text-xs">{latestWeight} gram</span>
                </div>
                <div className="bg-white/10 p-2 sm:p-2.5 rounded-xl border border-white/10 print:p-1.5">
                  <span className="text-[10px] print:text-[8px] text-teal-200 block">Total Kenaikan BB</span>
                  <span className="text-sm sm:text-lg font-black text-emerald-300 print:text-xs">
                    {weightGain >= 0 ? `+${weightGain} g` : `${weightGain} g`}
                  </span>
                </div>
              </div>
            </div>

            {/* DAILY MEMORY PHOTOS GALLERY (IF AVAILABLE) */}
            {dailyPhotos.length > 0 && (
              <div className="space-y-2 pt-1 print:space-y-1">
                <h3 className="font-bold text-xs uppercase tracking-wider text-teal-900 flex items-center gap-1.5 print:text-[10px]">
                  <Camera className="w-4 h-4 text-teal-600 print:w-3 print:h-3" />
                  <span>Galeri Momen Kenangan Perawatan Harian</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:gap-2">
                  {dailyPhotos.slice(0, 3).map((photo, i) => (
                    <div key={i} className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs space-y-1 print:p-1.5 print:rounded-xl">
                      <div className="h-24 sm:h-28 rounded-xl overflow-hidden bg-slate-100 print:h-20">
                        <img src={photo.url} alt={photo.period} className="w-full h-full object-cover" />
                      </div>
                      <div className="px-1 text-[10px] print:text-[8px]">
                        <span className="font-bold text-teal-900 block truncate">{photo.period}</span>
                        <span className="text-slate-500 line-clamp-1">{photo.caption}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COMPLETED MILESTONES SUMMARY */}
            <div className="space-y-2 print:space-y-1">
              <h3 className="font-bold text-xs uppercase tracking-wider text-teal-900 flex items-center gap-1.5 print:text-[10px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 print:w-3 print:h-3" />
                <span>Ringkasan Kemampuan & Kelulusan Mandiri</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs print:text-[9px] print:gap-1">
                <div className="p-2 print:p-1 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold flex items-center gap-1.5">
                  <span>✓</span> <span>Napas Mandiri (Bebas CPAP/O2)</span>
                </div>
                <div className="p-2 print:p-1 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold flex items-center gap-1.5">
                  <span>✓</span> <span>Nutrisi Oral (Refleks Hisap Baik)</span>
                </div>
                <div className="p-2 print:p-1 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold flex items-center gap-1.5">
                  <span>✓</span> <span>Tanda-Tanda Vital Stabil</span>
                </div>
                <div className="p-2 print:p-1 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold flex items-center gap-1.5">
                  <span>✓</span> <span>Perawatan Kanker / Kanguru</span>
                </div>
                <div className="p-2 print:p-1 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold flex items-center gap-1.5">
                  <span>✓</span> <span>Bebas Infus & Obatan Intravena</span>
                </div>
                <div className="p-2 print:p-1 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold flex items-center gap-1.5">
                  <span>✓</span> <span>Dinyatakan LULUS dari NICU</span>
                </div>
              </div>
            </div>

            {/* Doctor & Nurse Warm Note & Signature */}
            <div className="pt-3 print:pt-2 border-t-2 border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="max-w-md space-y-1">
                <p className="text-xs text-slate-700 italic font-medium leading-relaxed print:text-[9px]">
                  "{patient.dischargeSummary?.dischargeNotes || 'Selamat atas kepulangan si kecil! Semoga tumbuh menjadi anak yang sehat, kuat, dan membawa kebahagiaan bagi Ayah dan Bunda.'}"
                </p>
                <span className="text-[11px] font-bold text-teal-800 block print:text-[9px]">
                  — Tim Dokter & Perawat NICU RSUD Undata Palu
                </span>
              </div>

              <div className="text-center shrink-0 space-y-0.5">
                <div className="w-24 h-10 border-b-2 border-slate-400 mx-auto flex items-end justify-center pb-0.5 print:h-8">
                  <span className="font-serif italic text-teal-900 font-bold text-xs">RSUD Undata</span>
                </div>
                <p className="text-[10px] font-bold text-slate-800 print:text-[8px]">
                  {patient.dischargeSummary?.doctorInCharge || 'Tim DPJP NICU RSUD Undata'}
                </p>
                <p className="text-[9px] text-slate-500 print:text-[7px]">
                  Palu, {patient.dischargeSummary?.dischargeDate || new Date().toISOString().split('T')[0]}
                </p>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

