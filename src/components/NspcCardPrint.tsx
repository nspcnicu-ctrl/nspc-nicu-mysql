import React from 'react';
import { Patient, DailyLog } from '../types';
import {
  formatBabyAge,
  formatLengthOfStay,
  formatIndonesianDate,
} from '../utils/dateUtils';
import { Heart, Printer, CheckCircle2, ShieldCheck, XCircle, ArrowLeft } from 'lucide-react';

interface NspcCardPrintProps {
  patient: Patient;
  onClose: () => void;
}

export const NspcCardPrint: React.FC<NspcCardPrintProps> = ({ patient, onClose }) => {
  const progressLogs: DailyLog[] = Array.isArray(patient.progressLogs)
    ? patient.progressLogs
    : Array.isArray(patient.progress_logs)
    ? patient.progress_logs
    : Array.isArray(patient.dailyLogs)
    ? patient.dailyLogs
    : Array.isArray(patient.daily_logs)
    ? patient.daily_logs
    : [];

  const latestLog = progressLogs[0];
  const isAterm = patient.gestationCategory === 'aterm';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 md:p-6 overflow-y-auto flex items-start justify-center print:p-0 print:bg-white print:static print:overflow-visible print-only-container">
      
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-2 sm:my-6 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:my-0 print:w-full">
        
        {/* Top Action Header - Always visible at top of modal */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 px-4 sm:px-6 flex items-center justify-between shrink-0 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-teal-400 shrink-0" />
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-100">Pratinjau Cetak NSPC</h3>
              <p className="text-[10px] text-teal-300 hidden sm:block">RSUD Undata Provinsi Sulawesi Tengah</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali / Tutup</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE CARD CONTENT - Scrollable body */}
        <div className="p-4 sm:p-8 overflow-y-auto print:overflow-visible print:p-0">
        
        {/* Hospital Header */}
        <div className="border-b-2 border-teal-800 pb-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-black text-xl shadow-md">
              NICU
            </div>
            <div>
              <h1 className="text-xl font-black text-teal-950 tracking-tight">
                RSUD UNDATA PROVINSI SULAWESI TENGAH
              </h1>
              <p className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                Instalasi Perawatan Neonatal Intensif (NICU)
              </p>
              <p className="text-[11px] text-slate-500">
                Jl. RE Martadinata No. 1, Tondo, Kec. Mantikulore, Kota Palu, Sulawesi Tengah
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-900 text-xs font-extrabold rounded-full inline-block">
              NSPC CARD
            </span>
            <p className="text-[10px] text-slate-400 mt-1">Neo Smart Progress Card</p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-4">
          <h2 className="text-lg font-extrabold text-slate-900 uppercase tracking-wide">
            KARTU REKAPITULASI PERKEMBANGAN BAYI TERPADU
          </h2>
          <p className="text-xs font-semibold text-teal-700">
            {isAterm ? 'Kategori Aterm (>37 Minggu)' : 'Kategori Preterm (<36 Minggu)'}
          </p>
        </div>

        {/* Patient Identity Grid */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs mb-6">
          <div className="space-y-1.5">
            <p><span className="text-slate-500">Nama Bayi:</span> <strong className="text-slate-900 font-bold">{patient.babyName} ({patient.gender})</strong></p>
            <p><span className="text-slate-500">Nama Bunda:</span> <strong className="text-slate-800">{patient.motherName}</strong></p>
            <p><span className="text-slate-500">Nama Ayah:</span> <strong className="text-slate-800">{patient.fatherName}</strong></p>
            <p><span className="text-slate-500">Lokasi / Ruang:</span> <strong className="text-slate-800">{patient.roomNumber || 'NICU RSUD Undata'}</strong></p>
          </div>
          <div className="space-y-1.5">
            <p><span className="text-slate-500">Tanggal Lahir:</span> <strong className="text-slate-800">{formatIndonesianDate(patient.birthDate)}</strong></p>
            <p><span className="text-slate-500">Tanggal Masuk:</span> <strong className="text-slate-800">{formatIndonesianDate(patient.admissionDate)}</strong></p>
            <p><span className="text-slate-500">Usia Kehamilan:</span> <strong className="text-slate-800">{patient.gestationalAgeWeeks} Minggu</strong></p>
            <p><span className="text-slate-500">Usia & Lama Rawat:</span> <strong className="text-teal-800">{formatBabyAge(patient.birthDate, patient.gestationalAgeWeeks)} ({formatLengthOfStay(patient.admissionDate)})</strong></p>
          </div>
        </div>

        {/* Anthropometry & Latest Metrics */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6 text-center text-xs">
          <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-100">
            <span className="text-slate-500 text-[10px] block">BB Lahir</span>
            <strong className="text-sm text-teal-950 block">{patient.initialAnthropometry.weightGram} g</strong>
          </div>
          <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-100">
            <span className="text-slate-500 text-[10px] block">BB Terkini</span>
            <strong className="text-sm text-teal-900 block">{latestLog?.weightGram || patient.initialAnthropometry.weightGram} g</strong>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[10px] block">Panjang</span>
            <strong className="text-sm text-slate-800 block">{patient.initialAnthropometry.lengthCm} cm</strong>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[10px] block">LK</span>
            <strong className="text-sm text-slate-800 block">{patient.initialAnthropometry.headCircumferenceCm} cm</strong>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[10px] block">L. Perut</span>
            <strong className="text-sm text-slate-800 block">
              {patient.initialAnthropometry.abdominalCircumferenceCm ?? Math.round(patient.initialAnthropometry.chestCircumferenceCm * 0.95)} cm
            </strong>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[10px] block">LILA</span>
            <strong className="text-sm text-slate-800 block">
              {patient.initialAnthropometry.upperArmCircumferenceCm ?? Number((patient.initialAnthropometry.headCircumferenceCm * 0.3).toFixed(1))} cm
            </strong>
          </div>
        </div>

        {/* Milestone Status Grid */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 pb-1 border-b">
            Capaian Indikator Kelulusan & Milestone
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries({
              lepasCPAP: 'Lepas CPAP / Napas Mandiri',
              lepasVentilator: 'Lepas Ventilator',
              lepasInfus: 'Lepas Infus / Nutrisi Full Oral',
              lepasOGT: 'Lepas OGT / Minum Per Oral',
              refleksMenghisapBaik: 'Refleks Menghisap Baik',
              refleksMenelanBaik: 'Refleks Menelan Baik',
              selesaiPMK: 'Selesai Perawatan Metode Kanguru',
              selesaiHBO: 'Selesai Fototerapi (HBO)',
              hb0: 'Imunisasi HB0',
              shk: 'SHK (Skrining Hipotiroid)',
              skriningPJB: 'Skrining PJB (Jantung Bawaan)',
              bolehPulang: 'Dinyatakan SIAP PULANG',
            }).map(([k, label]) => {
              const val = Boolean(patient.milestones[k as keyof typeof patient.milestones]);
              return (
                <div key={k} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${val ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                    {val ? 'TERCAPAI ✓' : 'BELUM'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Latest Doctor / Nurse Note */}
        {latestLog?.nakesNotes && (
          <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200 text-xs mb-6">
            <span className="font-bold text-teal-900 block mb-1">Catatan Nakes Terakhir ({formatIndonesianDate(latestLog.date)}):</span>
            <p className="text-teal-950 italic">"{latestLog.nakesNotes}"</p>
            <span className="text-[10px] text-teal-700 font-semibold block text-right mt-1">— {latestLog.updatedBy}</span>
          </div>
        )}

        {/* Signatures Footer */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 text-center text-xs text-slate-700">
          <div>
            <p className="text-[11px] text-slate-500">Orang Tua / Wali Pasien,</p>
            <div className="h-16" />
            <p className="font-bold border-t border-slate-300 w-48 mx-auto pt-1">
              ( Bunda {patient.motherName} / Ayah {patient.fatherName} )
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Dokter / Perawat NICU RSUD Undata,</p>
            <div className="h-16" />
            <p className="font-bold border-t border-slate-300 w-48 mx-auto pt-1">
              ( Tim Nakes NICU RSUD Undata )
            </p>
          </div>
        </div>

        </div>

      </div>
    </div>
  );
};
