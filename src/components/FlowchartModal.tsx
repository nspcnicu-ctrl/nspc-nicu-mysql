import React, { useState } from 'react';
import {
  X,
  Workflow,
  UserCheck,
  Stethoscope,
  Heart,
  Key,
  Database,
  PlusCircle,
  Activity,
  Award,
  Trash2,
  RotateCcw,
  LogOut,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  FileText,
  Share2,
  Lock,
  Layers,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface FlowchartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FlowchartModal: React.FC<FlowchartModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'nakes' | 'parent' | 'data'>('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-500/20 border border-teal-400/30 rounded-2xl text-teal-300">
              <Workflow className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <span>Diagram Alur Sistem (System Flowchart)</span>
                <span className="px-2 py-0.5 text-xs font-extrabold bg-teal-500/30 border border-teal-400/40 rounded-full text-teal-200">
                  NSPC NICU
                </span>
              </h2>
              <p className="text-xs text-teal-100/80 mt-0.5">
                Alur kerja komprehensif aplikasi Neo Smart Progress Card dari Login hingga Selesai
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-teal-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 pt-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-2xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white border-slate-200 text-teal-900 shadow-2xs font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4 text-teal-600" />
            <span>Alur Umum (Overview)</span>
          </button>
          <button
            onClick={() => setActiveTab('nakes')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-2xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'nakes'
                ? 'bg-white border-slate-200 text-teal-900 shadow-2xs font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-emerald-600" />
            <span>Alur Nakes (Admin)</span>
          </button>
          <button
            onClick={() => setActiveTab('parent')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-2xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'parent'
                ? 'bg-white border-slate-200 text-teal-900 shadow-2xs font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Alur Orang Tua (Pasien)</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-2xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'data'
                ? 'bg-white border-slate-200 text-teal-900 shadow-2xs font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4 text-amber-600" />
            <span>Manajemen Alumni & Sampah</span>
          </button>
        </div>

        {/* Modal Scrollable Flowchart Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* TAB 1: OVERVIEW GENERAL FLOWCHART */}
          {activeTab === 'all' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-900 leading-relaxed flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-teal-600 shrink-0" />
                <p>
                  Sistem NSPC membagi hak akses ke dalam <strong>2 Peran Utama</strong>: <strong>Tenaga Kesehatan (Nakes)</strong> untuk pengelolaan medis dan input progres harian, serta <strong>Orang Tua</strong> untuk pemantauan medis transparan secara real-time.
                </p>
              </div>

              {/* Step By Step Visual Nodes */}
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Halaman Portal Utama (Landing Page)</h4>
                      <p className="text-xs text-slate-500">Akses awal memilih mode login atau memindai QR Code / Tautan Langsung.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl">Opsi A: Login Nakes</span>
                    <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-xl">Opsi B: Login Orang Tua</span>
                  </div>
                </div>

                <div className="flex justify-center text-slate-400">
                  <ArrowDown className="w-5 h-5" />
                </div>

                {/* Step 2 Decision */}
                <div className="p-5 bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-2xl space-y-3">
                  <h4 className="font-bold text-sm flex items-center gap-2 text-teal-300">
                    <UserCheck className="w-4 h-4" /> Proses Autentikasi & Verifikasi Akun
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-white/10 rounded-xl border border-white/10 space-y-1">
                      <p className="font-bold text-emerald-300">🔑 Jalur Nakes (Admin):</p>
                      <p className="text-slate-200 text-[11px]">Validasi PIN/Password Nakes. Jika valid → Masuk ke Panel Dashboard Nakes Admin.</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-xl border border-white/10 space-y-1">
                      <p className="font-bold text-teal-300">👶 Jalur Orang Tua:</p>
                      <p className="text-slate-200 text-[11px]">Validasi Nickname & Password Bayi atau Akses Tautan Langsung. Jika valid → Masuk ke Kartu Progres Bayi.</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center text-slate-400">
                  <ArrowDown className="w-5 h-5" />
                </div>

                {/* Step 3 Interaction */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-xs">
                    <div className="font-bold text-emerald-950 flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-emerald-700" />
                      <span>Sesi Nakes Admin</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-emerald-900">
                      <li>Tambah data pasien bayi baru + generate akun ortu.</li>
                      <li>Input progres harian (BB, TTV, Alat Aktif, Foto).</li>
                      <li>Update Alat Kesehatan Aktif (Langsung Realtime!).</li>
                      <li>Kelola Status Pasien (Rawat / Siap Pulang / Alumni).</li>
                      <li>Manajemen Sampah Data (Soft-delete & Restore).</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-2 text-xs">
                    <div className="font-bold text-teal-950 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-500" />
                      <span>Sesi Orang Tua (Pasien)</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-teal-900">
                      <li>Pantau Grafik Pertumbuhan BB harian.</li>
                      <li>Cek Tanda-Tanda Vital (Suhu, HR, RR, SpO2).</li>
                      <li>Lihat Alat Kesehatan Aktif yang sedang terpasang.</li>
                      <li>Cetak / Download Kartu Kenangan Kelulusan.</li>
                      <li>Lihat Foto & Catatan Pengenalan dari Nakes.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-center text-slate-400">
                  <ArrowDown className="w-5 h-5" />
                </div>

                {/* Step 4 Logout */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">Selesai / Keluar Sesi (Logout)</p>
                      <p className="text-slate-400">Membersihkan token sesi, mengamankan data, dan kembali ke Portal Utama.</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-bold">
                    Selesai
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NAKES ADMIN FLOWCHART */}
          {activeTab === 'nakes' && (
            <div className="space-y-5 animate-fade-in text-xs">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 font-medium">
                <h3 className="font-bold text-sm text-emerald-900 mb-1 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-emerald-700" /> Alur Lengkap Tenaga Kesehatan (Nakes Admin)
                </h3>
                <p className="text-emerald-800">
                  Nakes memiliki wewenang penuh untuk melakukan pencatatan rekam medis harian, memperbarui alat kesehatan aktif, memulangkan pasien, serta memulihkan data yang terhapus.
                </p>
              </div>

              <div className="relative border-l-2 border-emerald-300 pl-6 space-y-6 ml-3">
                {/* Node N1 */}
                <div className="relative">
                  <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-200" />
                  <h4 className="font-bold text-sm text-slate-900">1. Login Petugas Nakes</h4>
                  <p className="text-slate-600 mt-0.5">Memasukkan kata sandi petugas (contoh: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-emerald-800">123456</code>). Sistem memverifikasi kredensial dan mencatat riwayat login.</p>
                </div>

                {/* Node N2 */}
                <div className="relative">
                  <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-200" />
                  <h4 className="font-bold text-sm text-slate-900">2. Pendaftaran Pasien Baru (Registrasi)</h4>
                  <p className="text-slate-600 mt-0.5">Mengisi data identitas bayi, nama orang tua, tanggal lahir, usia gestasi, BB lahir, dan alat kesehatan awal. Sistem secara otomatis men-generate Nickname & Password unik untuk orang tua.</p>
                </div>

                {/* Node N3 */}
                <div className="relative">
                  <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-200" />
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>3. Input Progres Harian & Alat Kesehatan</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md text-[10px]">Realtime Dashboard Update</span>
                  </h4>
                  <p className="text-slate-600 mt-0.5">
                    Nakes menekan tombol <strong>"Input Progres"</strong> pada card pasien untuk mencatat BB terkini, vital sign, jenis minum, serta mencentang <strong>Alat Kesehatan Aktif</strong> (Infus, OGT, CPAP, Monitor TTV, O2 Mask, dll). Begitu disimpan, data & alat aktif langsung ter-update otomatis pada card dashboard Nakes & Orang Tua.
                  </p>
                </div>

                {/* Node N4 */}
                <div className="relative">
                  <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-200" />
                  <h4 className="font-bold text-sm text-slate-900">4. Penilaian Kriteria Kelulusan (Boleh Pulang)</h4>
                  <p className="text-slate-600 mt-0.5">Mencentang indikator kelulusan medis (refleks hisap, BB stabil, bebas apnea, suhu stabil). Jika kriteria terpenuhi, status otomatis berubah menjadi <strong>"Siap Pulang"</strong>.</p>
                </div>

                {/* Node N5 */}
                <div className="relative">
                  <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-200" />
                  <h4 className="font-bold text-sm text-slate-900">5. Pemulangan Pasien (Sudah Pulang / Alumni)</h4>
                  <p className="text-slate-600 mt-0.5">Menekan tombol <strong>"Set Pulang"</strong>. Pasien ditandai sebagai Alumni NICU dan tersimpan di Direktori Alumni. Data alumni dipisahkan dari filter pasien rawat aktif.</p>
                </div>

                {/* Node N6 */}
                <div className="relative">
                  <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-200" />
                  <h4 className="font-bold text-sm text-slate-900">6. Cetak Kartu Kenangan / Bagikan Link</h4>
                  <p className="text-slate-600 mt-0.5">Nakes dapat mengunduh Kartu Kenangan Kelulusan format PNG atau membagikan Tautan Akses Orang Tua melalui WhatsApp / Clipboard.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PARENT / PATIENT FLOWCHART */}
          {activeTab === 'parent' && (
            <div className="space-y-5 animate-fade-in text-xs">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-950 font-medium">
                <h3 className="font-bold text-sm text-rose-900 mb-1 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-600" /> Alur Orang Tua Bayi (Pasien)
                </h3>
                <p className="text-rose-800">
                  Dirancang dengan tampilan intuitif dan ramah pengguna agar Ayah dan Bunda dapat memantau perkembangan kesehatan buah hati kapan saja dan di mana saja secara aman.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="w-7 h-7 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs">1</div>
                  <h4 className="font-bold text-sm text-slate-900">Menerima Tautan / Kredensial</h4>
                  <p className="text-slate-600">
                    Orang tua menerima Nickname & Password dari petugas Nakes, atau cukup mengklik Tautan Langsung (Shareable Link) yang dikirimkan via WhatsApp.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="w-7 h-7 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs">2</div>
                  <h4 className="font-bold text-sm text-slate-900">Masuk ke Portal & Otentikasi</h4>
                  <p className="text-slate-600">
                    Sistem memverifikasi Nickname dan Password. Setelah cocok, pengguna langsung diarahkan ke Dashboard Pemantauan Buah Hati.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="w-7 h-7 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs">3</div>
                  <h4 className="font-bold text-sm text-slate-900">Melihat Ringkasan Terkini</h4>
                  <p className="text-slate-600">
                    Menampilkan usia bayi, lama perawatan, berat badan terkini, perbandingan BB masuk vs terkini, serta indikator status kelulusan medis.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="w-7 h-7 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs">4</div>
                  <h4 className="font-bold text-sm text-slate-900">Memantau Alat Aktif & Perkembangan</h4>
                  <p className="text-slate-600">
                    Melihat daftar alat kesehatan yang sedang terpasang di tubuh si kecil, grafik kurva pertumbuhan BB, vital sign harian, dan foto momen terbaru.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 md:col-span-2">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-xs">5</div>
                  <h4 className="font-bold text-sm text-slate-900">Mengunduh Souvenir Kartu Kenangan Kelulusan</h4>
                  <p className="text-slate-600">
                    Saat si kecil lulus medis dan siap/sudah pulang, orang tua dapat menekan tombol <strong>"Download Kartu Kenangan"</strong> untuk menyimpan sertifikat kelulusan NICU format gambar PNG kualitas tinggi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATA MANAGEMENT & TRASH / ALUMNI FLOW */}
          {activeTab === 'data' && (
            <div className="space-y-5 animate-fade-in text-xs">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 font-medium">
                <h3 className="font-bold text-sm text-amber-900 mb-1 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-700" /> Alur Pengelolaan Data, Alumni & Sampah
                </h3>
                <p className="text-amber-800">
                  Aplikasi menjaga integritas data pasien secara aman. Data Alumni tersimpan di tab khusus, sedangkan data yang dihapus dipindahkan ke Filter Hapus (Sampah) agar tidak sengaja hilang.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Alumni Flow Box */}
                <div className="p-5 bg-amber-500/10 border border-amber-300 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Award className="w-5 h-5 text-amber-600" />
                    <span>🎓 Alur Data Alumni Pasien</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-700">
                    <li>Pasien yang dinyatakan lulus/pulang diset statusnya menjadi <strong>"Sudah Pulang"</strong>.</li>
                    <li>Sistem otomatis mengeluarkan pasien dari tab <strong>"Semua Pasien Rawat"</strong> agar antrean rawat aktif fokus pada pasien di ruangan.</li>
                    <li>Data dipindahkan ke tab khusus <strong>"🎓 Alumni Pasien"</strong>.</li>
                    <li>Data Alumni tersimpan <strong>permanen</strong> sebagai rekam medis historis dan tidak dihapus otomatis.</li>
                    <li>Jika ada pembatalan kepulangan, Nakes dapat menekan <strong>"Batalkan Pulang"</strong> untuk mengembalikan ke status Rawat NICU.</li>
                  </ol>
                </div>

                {/* Trash Flow Box */}
                <div className="p-5 bg-rose-500/10 border border-rose-300 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <Trash2 className="w-5 h-5 text-rose-600" />
                    <span>🗑️ Alur Filter Hapus (Sampah Data)</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-700">
                    <li>Saat Nakes menekan ikon <strong>Hapus Pasien</strong>, data mengalami <em>Soft Delete</em> (<code className="bg-white px-1 py-0.5 rounded border text-rose-800">isDeleted: true</code>).</li>
                    <li>Data disembunyikan dari tampilan utama dan dipindahkan ke tab <strong>"🗑️ Filter Hapus"</strong>.</li>
                    <li>Nakes dapat meninjau data di Filter Hapus kapan saja.</li>
                    <li><strong>Pulihkan (Restore):</strong> Mengembalikan pasien beserta seluruh log histori medisnya ke daftar rawat aktif.</li>
                    <li><strong>Hapus Permanen:</strong> Mengosongkan sampah atau menghapus selamanya jika diperlukan.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Alur terintegrasi otomatis dengan penyimpanan local storage & Supabase Cloud database.</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Tutup Diagram Flowchart
          </button>
        </div>
      </div>
    </div>
  );
};
