import React, { useState, useEffect, useMemo } from 'react';
import {
  Patient,
  DailyLog,
  GestationCategory,
  MedicalEquipment,
  Milestones,
  Gender,
  NakesUser,
  EducationPdfItem,
} from '../types';
import {
  formatBabyAge,
  formatLengthOfStay,
  formatIndonesianDate,
  formatShortDate,
} from '../utils/dateUtils';
import {
  getShareableLink,
  getStoredPatients,
  addPatient,
  updatePatient,
  savePatients,
  addDailyLog,
  deletePatient,
  softDeletePatient,
  restorePatient,
  permanentlyDeletePatient,
  emptyTrash,
  markPatientDischarged,
  cancelPatientDischarge,
  saveGlobalPdf,
  seed25DummyPatients,
  clearAllPatientsData,
  getStoredNakesUsers,
  updateNakesUser,
  hasNakesAccessRights,
  syncFromBackend,
  syncNakesFromBackend,
  syncGlobalPdfsFromBackend,
} from '../services/storage';
import { forceSyncAllLocalToRemote } from '../services/api';
import { SouvenirCardModal } from './SouvenirCardModal';
import { EditPatientModal } from './EditPatientModal';
import { PatientProgressPage } from './PatientProgressPage';
import { GlobalEducationPage } from './GlobalEducationPage';
import { ManageNakesUsersModal } from './ManageNakesUsersModal';
import {
  Plus,
  Search,
  Filter,
  Share2,
  Edit,
  Trash2,
  Calendar,
  Clock,
  User,
  Heart,
  Key,
  Copy,
  Check,
  Stethoscope,
  Activity,
  Scale,
  Milk,
  Award,
  Sparkles,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Camera,
  Database,
  Code,
  Upload,
  Download,
  CheckCircle2,
  LogOut,
  RotateCcw,
  ArrowLeft,
  Building2,
  GraduationCap,
  Users,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';

interface NakesAdminDashboardProps {
  patients: Patient[];
  currentNakesUser?: NakesUser | null;
  onRefreshData: () => void;
  onSelectPatientView: (patient: Patient) => void;
  onBackToHome?: () => void;
  isProfileOpen?: boolean;
  onCloseProfile?: () => void;
  onOpenProfile?: () => void;
  onUpdateNakesUser?: (updated: NakesUser) => void;
}

const DISCHARGE_TEMPLATES = [
  {
    title: '🎓 Ucapan Kelulusan & Apresiasi',
    badge: 'Populer',
    text: 'Selamat Bunda & Ayah! Si kecil telah berjuang dengan sangat luar biasa di ruang NICU. Hari ini si kecil resmi lulus medis dan siap tumbuh berkembang dengan sehat dan ceria bersama keluarga tercinta di rumah.'
  },
  {
    title: '🍼 Edukasi Nutrisi & Perawatan',
    badge: 'Medis',
    text: 'Alhamdulillah, kondisi si kecil sudah sangat stabil, refleks hisap membaik, dan toleransi minum lancar. Tetap jaga kebersihan lingkungan rumah, berikan ASI eksklusif, dan lakukan kontrol rutin sesuai jadwal.'
  },
  {
    title: '💖 Metode Kanguru (PMK) & Bonding',
    badge: 'Perawatan',
    text: 'Si kecil telah siap membawa kehangatan ke rumah. Lanjutkan Perawatan Metode Kanguru (PMK) serta balutan kasih sayang Ayah & Bunda untuk mendukung tumbuh kembang optimal si kecil.'
  },
  {
    title: '🌟 Doa & Harapan Tim Medis',
    badge: 'Harapan',
    text: 'Terima kasih atas kerja sama dan kepercayaan Ayah & Bunda kepada Tim Medis NICU RSUD Undata. Semoga si kecil senantiasa sehat, tumbuh menjadi anak yang kuat, cerdas, dan selalu membawa kebahagiaan.'
  }
];

export const NakesAdminDashboard: React.FC<NakesAdminDashboardProps> = ({
  patients,
  currentNakesUser,
  onRefreshData,
  onSelectPatientView,
  onBackToHome,
  isProfileOpen,
  onCloseProfile,
  onOpenProfile,
  onUpdateNakesUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'rawat' | 'siap_pulang' | 'alumni' | 'trash'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'aterm' | 'preterm'>('all');
  const [displayLimit, setDisplayLimit] = useState<number | 'all'>(6);
  const [isMobileDisplayFilterOpen, setIsMobileDisplayFilterOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    const handleToast = (e: any) => {
      if (e.detail?.message) {
        setSuccessBanner(e.detail.message);
        setTimeout(() => setSuccessBanner(null), 4000);
      }
    };
    window.addEventListener('nspc_toast', handleToast);
    return () => window.removeEventListener('nspc_toast', handleToast);
  }, []);

  // Profile Edit Modal State
  const [internalIsProfileOpen, setInternalIsProfileOpen] = useState(false);
  const isProfileModalOpen = isProfileOpen !== undefined ? isProfileOpen : internalIsProfileOpen;

  const handleOpenProfileModal = () => {
    if (onOpenProfile) onOpenProfile();
    setInternalIsProfileOpen(true);
  };

  const handleCloseProfileModal = () => {
    if (onCloseProfile) onCloseProfile();
    setInternalIsProfileOpen(false);
  };

  const [profileName, setProfileName] = useState(currentNakesUser?.name || 'Ns. Perawat NICU');
  const [profileRoleTitle, setProfileRoleTitle] = useState(currentNakesUser?.roleTitle || 'Perawat Penanggung Jawab');
  const [profileUsername, setProfileUsername] = useState(currentNakesUser?.username || 'admin_nicu');
  const [profilePin, setProfilePin] = useState(currentNakesUser?.pin || '123456');
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    if (currentNakesUser) {
      setProfileName(currentNakesUser.name);
      setProfileRoleTitle(currentNakesUser.roleTitle);
      setProfileUsername(currentNakesUser.username);
      setProfilePin(currentNakesUser.pin);
    }
  }, [currentNakesUser]);

  const handleSaveNakesProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim() || !profileUsername.trim() || !profilePin.trim()) {
      alert('Mohon lengkapi Nama, Username, dan PIN Login Admin.');
      return;
    }

    const updatedUser: NakesUser = {
      id: currentNakesUser?.id || 'nakes_admin_' + Date.now(),
      name: profileName.trim(),
      roleTitle: profileRoleTitle.trim() || 'Tim Medis NICU',
      username: profileUsername.trim(),
      pin: profilePin.trim(),
      createdAt: currentNakesUser?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    updateNakesUser(updatedUser);
    if (onUpdateNakesUser) {
      onUpdateNakesUser(updatedUser);
    }

    setProfileSuccess(true);
    setTimeout(() => {
      setProfileSuccess(false);
      handleCloseProfileModal();
    }, 1200);
  };

  // Modals state
  const [activeProgressPagePatient, setActiveProgressPagePatient] = useState<Patient | null>(null);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSouvenirOpen, setIsSouvenirOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Set Pulang Confirmation Modal state
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [patientToDischarge, setPatientToDischarge] = useState<Patient | null>(null);
  const [dischargeNotes, setDischargeNotes] = useState(
    'Selamat! Si kecil telah memenuhi syarat indikator medis dan dinyatakan LULUS dari NICU RSUD Undata.'
  );
  const [dischargeDoctor, setDischargeDoctor] = useState('Tim Dokter DPJP NICU RSUD Undata');

  // Other Action Confirmation Modals states
  const [cancelDischargePatientTarget, setCancelDischargePatientTarget] = useState<Patient | null>(null);
  const [deletePatientTarget, setDeletePatientTarget] = useState<Patient | null>(null);
  const [restorePatientTarget, setRestorePatientTarget] = useState<Patient | null>(null);
  const [permanentDeletePatientTarget, setPermanentDeletePatientTarget] = useState<Patient | null>(null);
  const [isEmptyTrashModalOpen, setIsEmptyTrashModalOpen] = useState(false);

  // Quick Edit Patient Modal (Foto, Identitas & Kredensial)
  const [editingPatientForModal, setEditingPatientForModal] = useState<Patient | null>(null);

  // Manage Nakes Users & Access Rights Modal State
  const [isManageUsersModalOpen, setIsManageUsersModalOpen] = useState(false);

  // Global Education Page Navigation State
  const [showGlobalEducationPage, setShowGlobalEducationPage] = useState<boolean>(false);

  // Global Education PDF Upload Modal State
  const [isGlobalPdfModalOpen, setIsGlobalPdfModalOpen] = useState(false);
  const [globalPdfTitle, setGlobalPdfTitle] = useState('');
  const [globalPdfCategory, setGlobalPdfCategory] = useState('Metode Kanguru (PMK)');
  const [globalPdfFileName, setGlobalPdfFileName] = useState('');
  const [globalPdfFileSizeText, setGlobalPdfFileSizeText] = useState('1.2 MB');
  const [globalPdfFileDataUrl, setGlobalPdfFileDataUrl] = useState('');
  const [globalPdfNakesNote, setGlobalPdfNakesNote] = useState('');

  const handleGlobalPdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGlobalPdfFileName(file.name);
      const kb = Math.round(file.size / 1024);
      setGlobalPdfFileSizeText(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setGlobalPdfFileDataUrl(evt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveGlobalEducationPdf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalPdfTitle.trim()) {
      alert('Judul materi edukasi wajib diisi.');
      return;
    }

    const newPdf: EducationPdfItem = {
      id: 'pdf_' + Date.now(),
      title: globalPdfTitle.trim(),
      category: globalPdfCategory,
      fileName: globalPdfFileName || `${globalPdfTitle.replace(/\s+/g, '_')}.pdf`,
      fileSizeText: globalPdfFileSizeText || '1.2 MB',
      fileDataUrl: globalPdfFileDataUrl || undefined,
      nakesNote: globalPdfNakesNote.trim() || undefined,
      publishedAt: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      isActive: true,
    };

    saveGlobalPdf(newPdf);

    // Automatically append to all patients in system
    const updatedPatients = patients.map((p) => {
      const existing = p.educationPdfs || [];
      return {
        ...p,
        educationPdfs: [...existing, newPdf],
      };
    });

    savePatients(updatedPatients);
    onRefreshData();
    setSuccessBanner(`🎉 PDF Edukasi "${newPdf.title}" berhasil diunggah dan otomatis ditambahkan ke SELURUH data pasien!`);
    setIsGlobalPdfModalOpen(false);

    setGlobalPdfTitle('');
    setGlobalPdfFileName('');
    setGlobalPdfFileDataUrl('');
    setGlobalPdfNakesNote('');
  };

  // Quick Edit Credentials Modal state
  const [isEditCredentialsOpen, setIsEditCredentialsOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [credentialsSuccess, setCredentialsSuccess] = useState(false);

  const handleOpenEditCredentials = (patient: Patient) => {
    setSelectedPatient(patient);
    setEditNickname(patient.nickname || '');
    setEditPassword(patient.accessPassword || '');
    setCredentialsSuccess(false);
    setIsEditCredentialsOpen(true);
  };

  const handleGenerateRandomPassword = () => {
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setEditPassword(`Undata#${randNum}`);
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!editNickname.trim() || !editPassword.trim()) {
      alert('Mohon isi Nickname dan Password akses orang tua.');
      return;
    }

    const updatedPat: Patient = {
      ...selectedPatient,
      nickname: editNickname.trim(),
      accessPassword: editPassword.trim(),
    };

    updatePatient(updatedPat);
    setSelectedPatient(updatedPat);
    onRefreshData();

    setCredentialsSuccess(true);
    setTimeout(() => {
      setCredentialsSuccess(false);
      setIsEditCredentialsOpen(false);
    }, 1200);
  };

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Sheets & MySQL Database status state
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [forceSyncStatus, setForceSyncStatus] = useState<{ text: string; isError: boolean } | null>(null);

  const handleForceSyncNow = async () => {
    setIsForceSyncing(true);
    setForceSyncStatus(null);
    try {
      const stored = getStoredPatients();
      const allPatients = stored.length > 0 ? stored : patients;
      const allNakes = getStoredNakesUsers();
      const res = await forceSyncAllLocalToRemote(allPatients, allNakes);
      setForceSyncStatus({ text: res.message, isError: !res.success });
      if (res.success) {
        onRefreshData();
      }
    } catch (err: any) {
      setForceSyncStatus({
        text: `Gagal sinkronisasi: ${err.message || 'Koneksi ke cPanel API gagal'}`,
        isError: true,
      });
    } finally {
      setIsForceSyncing(false);
    }
  };

  // Add Patient Form State
  const [medicalRecordNumber, setMedicalRecordNumber] = useState('');
  const [babyName, setBabyName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [gender, setGender] = useState<Gender>('Laki-Laki');
  const [birthDate, setBirthDate] = useState(new Date().toISOString().split('T')[0]);
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(38);
  const [weightGram, setWeightGram] = useState(2500);
  const [lengthCm, setLengthCm] = useState(46);
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState(32);
  const [chestCircumferenceCm, setChestCircumferenceCm] = useState(30);
  const [abdominalCircumferenceCm, setAbdominalCircumferenceCm] = useState(28);
  const [upperArmCircumferenceCm, setUpperArmCircumferenceCm] = useState(10);
  const [roomNumber, setRoomNumber] = useState('Inkubator 01 - NICU RSUD Undata');
  const [nickname, setNickname] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<MedicalEquipment[]>(['Infus', 'Monitor TTV']);

  // Add Log Form State
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [logWeight, setLogWeight] = useState(2500);
  const [temp, setTemp] = useState(36.7);
  const [hr, setHr] = useState(138);
  const [rr, setRr] = useState(44);
  const [spo2, setSpo2] = useState(98);
  const [drinkMethod, setDrinkMethod] = useState<'OGT/Sonde' | 'Sendok/Cup Feeder' | 'Menyusu Langsung (DBF)' | 'Kombinasi' | 'NPO / Puasa sementara'>('OGT/Sonde');
  const [drinkCc, setDrinkCc] = useState(15);
  const [drinkFreq, setDrinkFreq] = useState(8);
  const [drinkNotes, setDrinkNotes] = useState('Toleransi minum baik.');
  const [logEquipment, setLogEquipment] = useState<MedicalEquipment[]>([]);
  const [logMilestones, setLogMilestones] = useState<Milestones>({
    lepasCPAP: false,
    lepasVentilator: false,
    lepasInfus: false,
    lepasOGT: false,
    lepasO2Nasal: false,
    refleksMenghisapBaik: false,
    refleksMenelanBaik: false,
    bayiSementaraPemantauanKetat: false,
    selesaiPMK: false,
    selesaiHBO: false,
    hb0: false,
    shk: false,
    skriningPJB: false,
    bolehPulang: false,
  });
  const [nakesNotes, setNakesNotes] = useState('');
  const [updatedBy, setUpdatedBy] = useState(
    currentNakesUser ? `${currentNakesUser.name} (${currentNakesUser.roleTitle})` : 'Ns. Perawat NICU'
  );
  const [logPhotoUrl, setLogPhotoUrl] = useState('');
  const [logPhotoCaption, setLogPhotoCaption] = useState('');

  const ALL_EQUIPMENT: MedicalEquipment[] = [
    'Infus',
    'OGT',
    'CPAP',
    'Ventilator',
    'Monitor TTV',
    'Nasal Kanul',
    'O2 Mask',
  ];

  // Separate active vs soft-deleted patients
  const activePatients = useMemo(() => patients.filter((p) => !p.isDeleted), [patients]);
  const trashPatients = useMemo(() => patients.filter((p) => p.isDeleted), [patients]);

  // Overall Summary Stats for active patients + trash count
  const overallStats = useMemo(() => {
    const total = activePatients.length;
    const activeCare = activePatients.filter((p) => p.status !== 'Sudah Pulang').length;
    const rawat = activePatients.filter((p) => p.status !== 'Sudah Pulang' && p.status !== 'Siap Pulang' && !p.milestones?.bolehPulang).length;
    const siapPulang = activePatients.filter((p) => p.status !== 'Sudah Pulang' && (p.status === 'Siap Pulang' || Boolean(p.milestones?.bolehPulang))).length;
    const alumni = activePatients.filter((p) => p.status === 'Sudah Pulang').length;
    const aterm = activePatients.filter((p) => p.gestationCategory === 'aterm').length;
    const preterm = activePatients.filter((p) => p.gestationCategory === 'preterm').length;
    const trash = trashPatients.length;

    return { total, activeCare, rawat, siapPulang, alumni, aterm, preterm, trash };
  }, [activePatients, trashPatients]);

  // Filter patients based on tab selection
  const filteredPatients = useMemo(() => {
    const source = statusFilter === 'trash' ? trashPatients : activePatients;

    return source.filter((p) => {
      const matchesSearch =
        p.babyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.motherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.fatherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.medicalRecordNumber && p.medicalRecordNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.roomNumber && p.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        categoryFilter === 'all' || p.gestationCategory === categoryFilter;

      let matchesStatus = true;
      if (statusFilter === 'all') {
        // Exclude Alumni (Sudah Pulang) from 'Semua' tab - Alumni has its own tab
        matchesStatus = p.status !== 'Sudah Pulang';
      } else if (statusFilter === 'rawat') {
        matchesStatus = p.status !== 'Sudah Pulang' && p.status !== 'Siap Pulang' && !p.milestones?.bolehPulang;
      } else if (statusFilter === 'siap_pulang') {
        matchesStatus = p.status !== 'Sudah Pulang' && (p.status === 'Siap Pulang' || Boolean(p.milestones?.bolehPulang));
      } else if (statusFilter === 'alumni') {
        matchesStatus = p.status === 'Sudah Pulang';
      } else if (statusFilter === 'trash') {
        matchesStatus = true; // all items in source are deleted
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [activePatients, trashPatients, searchTerm, categoryFilter, statusFilter]);

  // Paginated/Limited Patients array based on selected displayLimit
  const displayedPatients = useMemo(() => {
    if (displayLimit === 'all') return filteredPatients;
    return filteredPatients.slice(0, displayLimit);
  }, [filteredPatients, displayLimit]);

  // Filtered List Stats
  const filteredStats = useMemo(() => {
    return {
      total: filteredPatients.length,
      rawat: filteredPatients.filter((p) => p.status !== 'Sudah Pulang' && p.status !== 'Siap Pulang' && !p.milestones?.bolehPulang).length,
      siapPulang: filteredPatients.filter((p) => p.status !== 'Sudah Pulang' && (p.status === 'Siap Pulang' || Boolean(p.milestones?.bolehPulang))).length,
      alumni: filteredPatients.filter((p) => p.status === 'Sudah Pulang').length,
      aterm: filteredPatients.filter((p) => p.gestationCategory === 'aterm').length,
      preterm: filteredPatients.filter((p) => p.gestationCategory === 'preterm').length,
      trash: trashPatients.length,
    };
  }, [filteredPatients, trashPatients]);

  // Handlers for auto-formatting No. Rekam Medis (RM) & syncing Nama Bayi with Nama Bunda
  const handleRMChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    val = val.replace(/[^A-Z0-9-]/g, '');
    if (!val.startsWith('RM-')) {
      const stripped = val.replace(/^RM-?/g, '');
      val = 'RM-' + stripped;
    }
    const afterPrefix = val.slice(3);
    const digitsOnly = afterPrefix.replace(/[^0-9]/g, '');
    if (afterPrefix === digitsOnly && digitsOnly.length > 0) {
      if (digitsOnly.length <= 4) {
        val = `RM-${digitsOnly}`;
      } else if (digitsOnly.length <= 8) {
        val = `RM-${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`;
      } else {
        val = `RM-${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 8)}-${digitsOnly.slice(8, 12)}`;
      }
    }
    setMedicalRecordNumber(val);
  };

  const handleMotherNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMotherName(val);
    if (!babyName || babyName === 'Bayi Ny. ' || babyName.startsWith('Bayi Ny. ')) {
      setBabyName(val.trim() ? `Bayi Ny. ${val}` : 'Bayi Ny. ');
    }
  };

  const handleBabyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBabyName(e.target.value);
  };

  // Open Add Patient Modal & generate default credentials
  const handleOpenAddPatient = () => {
    setMedicalRecordNumber('RM-');
    setBabyName('Bayi Ny. ');
    setFatherName('');
    setMotherName('');
    setGender('Laki-Laki');
    setBirthDate(new Date().toISOString().split('T')[0]);
    setAdmissionDate(new Date().toISOString().split('T')[0]);
    setGestationalAgeWeeks(38);
    setWeightGram(2800);
    setLengthCm(46);
    setHeadCircumferenceCm(32);
    setChestCircumferenceCm(30);
    setAbdominalCircumferenceCm(28);
    setUpperArmCircumferenceCm(10);
    setCoverPhotoUrl('');
    const randNum = Math.floor(100 + Math.random() * 900);
    setNickname(`bayi_${randNum}`);
    setAccessPassword(`Undata#${randNum}`);
    setSelectedEquipment(['Infus', 'Monitor TTV']);
    setIsAddPatientOpen(true);
  };

  const handleSaveNewPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyName || !babyName.trim() || !motherName || !nickname || !accessPassword) {
      alert('Mohon lengkapi Nama Bayi, Nama Bunda, Nickname, dan Password.');
      return;
    }

    const gestationCategory: GestationCategory = gestationalAgeWeeks >= 37 ? 'aterm' : 'preterm';

    const newPat = addPatient({
      medicalRecordNumber: medicalRecordNumber.trim() === 'RM-' ? undefined : medicalRecordNumber.trim(),
      babyName,
      fatherName,
      motherName,
      gender,
      birthDate,
      admissionDate,
      gestationalAgeWeeks,
      gestationCategory,
      initialAnthropometry: {
        weightGram: Number(weightGram),
        lengthCm: Number(lengthCm),
        headCircumferenceCm: Number(headCircumferenceCm),
        chestCircumferenceCm: Number(chestCircumferenceCm),
        abdominalCircumferenceCm: Number(abdominalCircumferenceCm),
        upperArmCircumferenceCm: Number(upperArmCircumferenceCm),
      },
      currentEquipment: selectedEquipment,
      milestones: {
        lepasCPAP: !selectedEquipment.includes('CPAP'),
        lepasVentilator: !selectedEquipment.includes('Ventilator'),
        lepasInfus: !selectedEquipment.includes('Infus'),
        lepasOGT: !selectedEquipment.includes('OGT'),
        lepasO2Nasal: !selectedEquipment.includes('Nasal Kanul'),
        refleksMenghisapBaik: false,
        refleksMenelanBaik: false,
        bayiSementaraPemantauanKetat: false,
        selesaiPMK: false,
        selesaiHBO: false,
        hb0: false,
        shk: false,
        skriningPJB: false,
        bolehPulang: false,
      },
      status: 'Rawat NICU',
      nickname,
      accessPassword,
      roomNumber,
      coverPhotoUrl: coverPhotoUrl || undefined,
    });

    setIsAddPatientOpen(false);
    onRefreshData();
    setSelectedPatient(newPat);
    setIsShareModalOpen(true);
  };

  // Open Log Modal for selected patient
  const handleOpenLogModal = (patient: Patient) => {
    setSelectedPatient(patient);
    const lastLog = patient.dailyLogs[0];
    const logCount = patient.dailyLogs.length + 1;
    const isAterm = patient.gestationCategory === 'aterm';

    setLogDate(new Date().toISOString().split('T')[0]);
    setPeriodLabel(isAterm ? `Hari ke-${logCount}` : `Minggu ke-${logCount}`);
    setLogWeight(lastLog ? lastLog.weightGram : patient.initialAnthropometry.weightGram);
    setTemp(lastLog?.vitalSigns.temperature || 36.7);
    setHr(lastLog?.vitalSigns.heartRate || 138);
    setRr(lastLog?.vitalSigns.respiratoryRate || 42);
    setSpo2(lastLog?.vitalSigns.spo2 || 98);
    setDrinkMethod(lastLog?.drinkingAbility.method || 'OGT/Sonde');
    setDrinkCc(lastLog?.drinkingAbility.volumeCcPerFeeding || 15);
    setDrinkFreq(lastLog?.drinkingAbility.frequencyPerDay || 8);
    setDrinkNotes(lastLog?.drinkingAbility.notes || 'Toleransi minum baik.');
    setLogEquipment(lastLog?.activeEquipment ? [...lastLog.activeEquipment] : [...patient.currentEquipment]);
    setLogMilestones({ ...patient.milestones });
    setNakesNotes('Si kecil sehat dan dalam pemantauan rutin NICU RSUD Undata.');
    setUpdatedBy(
      currentNakesUser ? `${currentNakesUser.name} (${currentNakesUser.roleTitle})` : 'Ns. Perawat NICU'
    );
    setLogPhotoUrl('');
    setLogPhotoCaption('');

    setIsLogModalOpen(true);
  };

  const handleLogPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setLogPhotoUrl(evt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setCoverPhotoUrl(evt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    const freshPatient = addDailyLog(selectedPatient.id, {
      date: logDate,
      periodLabel,
      weightGram: Number(logWeight),
      vitalSigns: {
        temperature: Number(temp),
        heartRate: Number(hr),
        respiratoryRate: Number(rr),
        spo2: Number(spo2),
      },
      drinkingAbility: {
        method: drinkMethod,
        volumeCcPerFeeding: Number(drinkCc),
        frequencyPerDay: Number(drinkFreq),
        notes: drinkNotes,
      },
      activeEquipment: logEquipment,
      nakesNotes: nakesNotes,
      updatedBy: updatedBy,
      photoUrl: logPhotoUrl || undefined,
      photoCaption: logPhotoCaption || undefined,
    });

    if (freshPatient) {
      freshPatient.currentEquipment = logEquipment;
      freshPatient.milestones = logMilestones;
      if (logMilestones.bolehPulang && freshPatient.status !== 'Sudah Pulang') {
        freshPatient.status = 'Siap Pulang';
      } else if (!logMilestones.bolehPulang && freshPatient.status !== 'Sudah Pulang') {
        freshPatient.status = 'Rawat NICU';
      }
      if (logPhotoUrl && !freshPatient.coverPhotoUrl) {
        freshPatient.coverPhotoUrl = logPhotoUrl;
      }
      updatePatient(freshPatient);
    }

    setSuccessBanner(
      `✅ Hasil update progres & alat kesehatan untuk ${selectedPatient.babyName} telah berhasil disimpan dan langsung diperbarui di dashboard!`
    );
    setTimeout(() => setSuccessBanner(null), 5000);

    setIsLogModalOpen(false);
    onRefreshData();
  };

  const handleDischargePatientAction = (patient: Patient) => {
    setPatientToDischarge(patient);
    setDischargeNotes(
      'Selamat! Si kecil telah memenuhi syarat indikator medis dan dinyatakan LULUS dari NICU RSUD Undata.'
    );
    setDischargeDoctor(
      currentNakesUser ? `DPJP: ${currentNakesUser.name}` : 'Tim Dokter DPJP NICU RSUD Undata'
    );
    setIsDischargeModalOpen(true);
  };

  const confirmDischargePatient = () => {
    if (!patientToDischarge) return;
    markPatientDischarged(
      patientToDischarge.id,
      dischargeNotes.trim() || 'Selamat! Si kecil telah memenuhi syarat indikator medis dan dinyatakan LULUS dari NICU RSUD Undata.',
      dischargeDoctor.trim() || 'Tim Dokter DPJP NICU RSUD Undata'
    );
    setSuccessBanner(
      `🎉 Status ${patientToDischarge.babyName} berhasil diubah menjadi SUDAH PULANG (Alumni NICU).`
    );
    setTimeout(() => setSuccessBanner(null), 5000);
    setIsDischargeModalOpen(false);
    setPatientToDischarge(null);
    onRefreshData();
  };

  const handleCancelDischargeAction = (patient: Patient) => {
    setCancelDischargePatientTarget(patient);
  };

  const confirmCancelDischarge = () => {
    if (!cancelDischargePatientTarget) return;
    cancelPatientDischarge(cancelDischargePatientTarget.id);
    setSuccessBanner(`✓ Kepulangan ${cancelDischargePatientTarget.babyName} dibatalkan. Status dikembalikan ke Rawat NICU.`);
    setTimeout(() => setSuccessBanner(null), 5000);
    setCancelDischargePatientTarget(null);
    onRefreshData();
  };

  const handleManualSyncSheets = async () => {
    setIsSyncingSheets(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`✓ Berhasil disinkronkan ke Google Sheets Database! (${data.patientCount} Pasien)`);
      } else {
        setSyncMessage('⚠️ Sinkronisasi lokal berhasil disimpan.');
      }
    } catch (e) {
      setSyncMessage('✓ Sinkronisasi lokal aktif.');
    } finally {
      setIsSyncingSheets(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleDelete = (patientId: string, name: string) => {
    const pat = patients.find((p) => p.id === patientId);
    if (pat) {
      setDeletePatientTarget(pat);
    } else {
      softDeletePatient(patientId);
      onRefreshData();
    }
  };

  const confirmDeletePatient = () => {
    if (!deletePatientTarget) return;
    softDeletePatient(deletePatientTarget.id);
    setSuccessBanner(`Data pasien ${deletePatientTarget.babyName} dipindahkan ke Filter Hapus (Sampah).`);
    setTimeout(() => setSuccessBanner(null), 4000);
    setDeletePatientTarget(null);
    onRefreshData();
  };

  const handleRestore = (patient: Patient) => {
    setRestorePatientTarget(patient);
  };

  const confirmRestorePatient = () => {
    if (!restorePatientTarget) return;
    restorePatient(restorePatientTarget.id);
    onRefreshData();
    setSuccessBanner(`Data pasien ${restorePatientTarget.babyName} berhasil dipulihkan dari Sampah ke daftar aktif.`);
    setTimeout(() => setSuccessBanner(null), 4000);
    setRestorePatientTarget(null);
  };

  const handlePermanentDelete = (patientId: string, name: string) => {
    const pat = patients.find((p) => p.id === patientId);
    if (pat) {
      setPermanentDeletePatientTarget(pat);
    } else {
      permanentlyDeletePatient(patientId);
      onRefreshData();
    }
  };

  const confirmPermanentDelete = () => {
    if (!permanentDeletePatientTarget) return;
    permanentlyDeletePatient(permanentDeletePatientTarget.id);
    setSuccessBanner(`Data pasien ${permanentDeletePatientTarget.babyName} telah dihapus permanen.`);
    setTimeout(() => setSuccessBanner(null), 4000);
    setPermanentDeletePatientTarget(null);
    onRefreshData();
  };

  const handleEmptyTrash = () => {
    setIsEmptyTrashModalOpen(true);
  };

  const handleSeedDummyData = () => {
    seed25DummyPatients();
    onRefreshData();
    setSuccessBanner('⚡ 25 Data Pasien Dummy acak berhasil ditambahkan ke sistem!');
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  const handleClearAllPatients = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus SEMUA data pasien untuk persiapan demo? Data pasien yang ada saat ini akan dikosongkan.')) {
      clearAllPatientsData();
      onRefreshData();
      setSuccessBanner('🧹 Semua data pasien telah berhasil dikosongkan. Sistem siap untuk demo dari awal!');
      setTimeout(() => setSuccessBanner(null), 5000);
    }
  };

  const confirmEmptyTrash = () => {
    emptyTrash();
    setSuccessBanner(`Semua data di Filter Hapus (${overallStats.trash} pasien) berhasil dibersihkan secara permanen.`);
    setTimeout(() => setSuccessBanner(null), 4000);
    setIsEmptyTrashModalOpen(false);
    onRefreshData();
  };

  const handleCopyLink = (patient: Patient) => {
    const link = getShareableLink(patient);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenWhatsAppMessage = (patient: Patient) => {
    const link = getShareableLink(patient);
    const msg = `Kepada Yth. Ayah/Bunda dari ${patient.babyName},\n\nBerikut adalah tautan resmi NSPC (Neo Smart Progress Card) NICU RSUD Undata untuk memantau perkembangan harian buah hati Anda:\n\n🔗 Link Kartu: ${link}\n👤 Nickname: ${patient.nickname}\n🔑 Password: ${patient.accessPassword}\n\nSalam Hangat,\nTim Tenaga Kesehatan NICU RSUD Undata`;
    
    // Copy to clipboard as backup
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(msg);
      }
    } catch {
      // ignore clipboard fallback errors
    }

    // Direct to WhatsApp
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const SAMPLE_MESSAGES = [
    'Alhamdulillah, kondisi si kecil hari ini sangat stabil. Refleks hisap makin membaik dan toleransi minum lancar.',
    'Perkembangan berat badan mengalami kenaikan yang positif. Bantuan oksigen sudah berhasil dikurangi.',
    'Hari ini si kecil menyelesaikan sesi Perawatan Metode Kanguru (PMK). Si kecil tampak sangat nyaman.',
    'Selamat Bunda & Ayah! Seluruh indikator kesehatan si kecil telah terpenuhi dan dinyatakan SIAP PULANG.',
  ];

  if (showGlobalEducationPage) {
    return (
      <GlobalEducationPage
        patients={patients}
        onBack={() => setShowGlobalEducationPage(false)}
        onSavePatients={(updated) => {
          savePatients(updated);
        }}
        onRefreshData={onRefreshData}
        currentNakesUser={currentNakesUser}
      />
    );
  }

  if (activeProgressPagePatient) {
    const currentPat =
      patients.find((p) => p.id === activeProgressPagePatient.id) ||
      activeProgressPagePatient;

    return (
      <>
        <PatientProgressPage
          patient={currentPat}
          onBack={() => {
            setIsSouvenirOpen(false);
            setIsDischargeModalOpen(false);
            setActiveProgressPagePatient(null);
          }}
          onUpdatePatient={(updatedPat) => {
            updatePatient(updatedPat);
            setActiveProgressPagePatient(updatedPat);
            onRefreshData();
          }}
          onOpenCredentials={(p) => {
            setSelectedPatient(p);
            setIsShareModalOpen(true);
          }}
          onOpenSouvenirCard={(p) => {
            setSelectedPatient(p);
            setIsSouvenirOpen(true);
          }}
          onDischargePatient={(p) => handleDischargePatientAction(p)}
          onCancelDischargePatient={(p) => handleCancelDischargeAction(p)}
          currentNakesUser={currentNakesUser}
        />

        {/* MODAL SHARE ACCESS LINK & CREDENTIALS */}
        {isShareModalOpen && selectedPatient && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-base">Akses Private Orang Tua</h3>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg text-xs font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Berikut adalah informasi login portal untuk <strong className="text-slate-900">{selectedPatient.babyName}</strong>:
                </p>
                <div className="p-3 bg-teal-50/80 rounded-2xl border border-teal-200/80 space-y-1.5 font-mono">
                  <div>Nickname: <strong className="text-teal-900">{selectedPatient.nickname}</strong></div>
                  <div>Password: <strong className="text-teal-900">{selectedPatient.accessPassword}</strong></div>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div className="text-[11px] text-slate-500 font-medium">Link Langsung Portal:</div>
                  <div className="text-[11px] font-mono font-bold text-teal-800 break-all mt-0.5">
                    {getShareableLink(selectedPatient)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => handleOpenWhatsAppMessage(selectedPatient)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Kirim Via WA
                </button>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SOUVENIR CARD MODAL */}
        {isSouvenirOpen && selectedPatient && (
          <SouvenirCardModal
            patient={selectedPatient}
            onClose={() => setIsSouvenirOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* HEADER CONTROLS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-start gap-2.5 w-full">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90 rounded-full text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              title="Kembali ke Halaman Utama / Portal"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="whitespace-nowrap">Kembali Ke Portal</span>
            </button>
          )}

          <span className="hidden xl:inline-flex shrink-0 items-center gap-2 px-4 py-2 bg-teal-100/90 text-teal-900 border border-teal-300/80 rounded-full font-bold text-xs shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
            <span className="whitespace-nowrap">Panel Admin Nakes</span>
          </span>

          {currentNakesUser && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-emerald-50 border border-emerald-300/80 text-emerald-900 rounded-full text-xs font-bold shadow-2xs min-w-0 max-w-full truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Petugas: {currentNakesUser.name} ({currentNakesUser.roleTitle})</span>
              </span>

              {currentNakesUser.isSuperAdmin || currentNakesUser.username === 'superadmin' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-full font-black text-xs shadow-2xs">
                  🛡️ Super Admin
                </span>
              ) : currentNakesUser.hasAccessRights ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-100 text-teal-900 border border-teal-300 rounded-full font-bold text-xs shadow-2xs">
                  🛡️ Diberi Hak Akses
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-full font-bold text-xs shadow-2xs">
                  👤 Tanpa Hak Akses
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {currentNakesUser ? `Selamat Bertugas, ${currentNakesUser.name}` : 'Pengelolaan Data Pasien NICU'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Input data perkembangan harian/mingguan, foto harian, dan kelola login orang tua
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsSqlModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 font-bold text-xs shadow-2xs transition-all cursor-pointer"
              title="Periksa Koneksi Database MySQL Niagahoster & Status Real-Time"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Database MySQL & Sync</span>
            </button>

            <button
              onClick={handleOpenAddPatient}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Tambah Pasien Baru</span>
            </button>
          </div>
        </div>

        {/* TOTAL DASHBOARD STATS (BERDASARKAN FILTER & KESELURUHAN) */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Ringkasan Dashboard Total Pasien</span>
              {(statusFilter !== 'all' || categoryFilter !== 'all' || searchTerm) && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-black animate-fade-in">
                  Filter Aktif
                </span>
              )}
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Menampilkan <strong>{displayedPatients.length}</strong> dari <strong>{filteredPatients.length}</strong> Pasien
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* CARD 1: TOTAL PASIEN */}
            <div 
              onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                statusFilter === 'all' && categoryFilter === 'all'
                  ? 'bg-teal-900 text-white border-teal-800 shadow-md ring-2 ring-teal-500/30'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-semibold ${statusFilter === 'all' && categoryFilter === 'all' ? 'text-teal-200' : 'text-slate-500'}`}>
                  Total Pasien
                </span>
                <Users className={`w-4 h-4 ${statusFilter === 'all' && categoryFilter === 'all' ? 'text-teal-300' : 'text-teal-600'}`} />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black">
                  {statusFilter === 'all' && categoryFilter === 'all' ? overallStats.total : filteredStats.total}
                </div>
                <div className={`text-[10px] mt-0.5 ${statusFilter === 'all' && categoryFilter === 'all' ? 'text-teal-200' : 'text-slate-500'}`}>
                  {statusFilter === 'all' && categoryFilter === 'all' ? 'Keseluruhan Pasien' : 'Sesuai Filter'}
                </div>
              </div>
            </div>

            {/* CARD 2: RAWAT NICU */}
            <div 
              onClick={() => setStatusFilter('rawat')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                statusFilter === 'rawat'
                  ? 'bg-sky-700 text-white border-sky-800 shadow-md ring-2 ring-sky-500/30'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-semibold ${statusFilter === 'rawat' ? 'text-sky-100' : 'text-slate-500'}`}>
                  Sedang Rawat
                </span>
                <Activity className={`w-4 h-4 ${statusFilter === 'rawat' ? 'text-sky-200' : 'text-sky-600'}`} />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black">{overallStats.rawat}</div>
                <div className={`text-[10px] mt-0.5 ${statusFilter === 'rawat' ? 'text-sky-200' : 'text-slate-500'}`}>
                  Pasien Aktif NICU
                </div>
              </div>
            </div>

            {/* CARD 3: SIAP PULANG */}
            <div 
              onClick={() => setStatusFilter('siap_pulang')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                statusFilter === 'siap_pulang'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-500/30'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-semibold ${statusFilter === 'siap_pulang' ? 'text-emerald-100' : 'text-slate-500'}`}>
                  Siap Pulang
                </span>
                <Award className={`w-4 h-4 ${statusFilter === 'siap_pulang' ? 'text-emerald-200' : 'text-emerald-600'}`} />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black">{overallStats.siapPulang}</div>
                <div className={`text-[10px] mt-0.5 ${statusFilter === 'siap_pulang' ? 'text-emerald-200' : 'text-slate-500'}`}>
                  Lulus Indikator Medis
                </div>
              </div>
            </div>

            {/* CARD 4: ALUMNI NICU */}
            <div 
              onClick={() => setStatusFilter('alumni')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                statusFilter === 'alumni'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400/40'
                  : 'bg-amber-50/50 hover:bg-amber-50 text-slate-800 border-amber-200/80 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-bold ${statusFilter === 'alumni' ? 'text-amber-100' : 'text-amber-900'}`}>
                  🎓 Alumni NICU
                </span>
                <GraduationCap className={`w-4 h-4 ${statusFilter === 'alumni' ? 'text-amber-200' : 'text-amber-700'}`} />
              </div>
              <div className="mt-2">
                <div className={`text-2xl font-black ${statusFilter === 'alumni' ? 'text-white' : 'text-amber-950'}`}>{overallStats.alumni}</div>
                <div className={`text-[10px] mt-0.5 ${statusFilter === 'alumni' ? 'text-amber-100' : 'text-amber-800 font-medium'}`}>
                  Sudah Resmi Pulang
                </div>
              </div>
            </div>

            {/* CARD 5: ATERM & PRETERM BREAKDOWN */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-slate-500">Usia Gestasi</span>
                <Scale className="w-4 h-4 text-slate-600" />
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Aterm (&gt;37m):</span>
                  <strong className="text-teal-700 font-extrabold">{statusFilter === 'all' && categoryFilter === 'all' ? overallStats.aterm : filteredStats.aterm}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Preterm (&lt;36m):</span>
                  <strong className="text-amber-700 font-extrabold">{statusFilter === 'all' && categoryFilter === 'all' ? overallStats.preterm : filteredStats.preterm}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 font-extrabold text-xs px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* BANNER / BUTTON ACTION UPLOAD PDF EDUKASI GLOBAL */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-teal-800 text-white p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-xs flex items-center justify-center text-emerald-100 shrink-0 shadow-inner">
            <FileText className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Rekomendasi Edukasi Orang Tua (Global)
              </h3>
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full shadow-2xs">
                Otomatis Ke Semua Pasien
              </span>
            </div>
            <p className="text-xs text-emerald-100 font-medium mt-0.5">
              Unggah file PDF rekomendasi edukasi di sini agar langsung otomatis ditambahkan ke daftar edukasi semua pasien.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowGlobalEducationPage(true)}
          className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0 self-stretch sm:self-auto justify-center hover:scale-[1.02] active:scale-[0.98]"
        >
          <Upload className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          <span>Input / Upload File PDF Edukasi</span>
        </button>
      </div>

      {/* FILTER CONTROLS & SEARCH */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        {/* TOP ROW: SEARCH & STATUS TABS */}
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama bayi, nama bunda, ayah, atau nickname..."
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold px-1.5 py-0.5 bg-slate-200 rounded-full cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full lg:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'all' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Semua Pasien Rawat ({overallStats.activeCare})
            </button>
            <button
              onClick={() => setStatusFilter('rawat')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'rawat' ? 'bg-sky-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              🏥 Rawat NICU ({overallStats.rawat})
            </button>
            <button
              onClick={() => setStatusFilter('siap_pulang')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'siap_pulang' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              🎉 Siap Pulang ({overallStats.siapPulang})
            </button>
            <button
              onClick={() => setStatusFilter('alumni')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'alumni' ? 'bg-amber-600 text-white shadow-2xs font-extrabold' : 'text-amber-900 bg-amber-100 hover:bg-amber-200'
              }`}
            >
              🎓 Alumni Pasien ({overallStats.alumni})
            </button>
            <button
              onClick={() => setStatusFilter('trash')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'trash' ? 'bg-rose-700 text-white shadow-2xs font-extrabold' : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80'
              }`}
            >
              🗑️ Hapus ({overallStats.trash})
            </button>
          </div>
        </div>

        {/* BOTTOM ROW: GESTATION SUB-FILTER & RESET */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Kategori Gestasi:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua Gestasi
              </button>
              <button
                onClick={() => setCategoryFilter('aterm')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === 'aterm' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Aterm (&gt;37m)
              </button>
              <button
                onClick={() => setCategoryFilter('preterm')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === 'preterm' ? 'bg-amber-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Preterm (&lt;36m)
              </button>
            </div>
          </div>

          {/* ICON TOGGLE UNTUK SEMUA TAMPILAN (DESKTOP, TABLET & HANDPHONE) */}
          <button
            type="button"
            onClick={() => setIsMobileDisplayFilterOpen((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-2xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
              isMobileDisplayFilterOpen
                ? 'bg-teal-700 text-white border-teal-800 shadow-md'
                : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200'
            }`}
            title="Buka Filter Slide Tampilan Pasien"
          >
            <SlidersHorizontal className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Filter Slide ({displayLimit === 'all' ? 'Semua' : displayLimit})</span>
          </button>
        </div>

        {/* SLIDE FILTER TAMPILAN PANEL (DESKTOP, TABLET & HANDPHONE) */}
        {isMobileDisplayFilterOpen && (
          <div className="mt-3 p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="text-xs font-bold text-teal-100">
                  Filter Slide Tampilan Pasien
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDisplayFilterOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Batas Tampilkan Pasien:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-teal-500 text-teal-950 font-black text-xs shadow-2xs">
                  {displayLimit === 'all' ? `Semua (${filteredPatients.length})` : `${displayLimit} Pasien`}
                </span>
              </div>

              <input
                type="range"
                min={1}
                max={100}
                value={typeof displayLimit === 'number' ? Math.min(displayLimit, 100) : 100}
                onChange={(e) => setDisplayLimit(parseInt(e.target.value, 10))}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-hidden"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>1 Pasien</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[6, 12, 24, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDisplayLimit(preset)}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        displayLimit === preset
                          ? 'bg-teal-400 text-teal-950 font-black'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDisplayLimit('all')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      displayLimit === 'all'
                        ? 'bg-amber-400 text-amber-950 font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Semua
                  </button>
                </div>
                <span>100 Slider Max</span>
              </div>

              {/* INPUT NOMINAL CUSTOM */}
              <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-medium">Input Nominal Custom:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={typeof displayLimit === 'number' ? displayLimit : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setDisplayLimit(1);
                        } else {
                          const parsed = parseInt(val, 10);
                          if (!isNaN(parsed) && parsed > 0) {
                            setDisplayLimit(parsed);
                          }
                        }
                      }}
                      placeholder="e.g. 15"
                      className="w-24 px-2.5 py-1 bg-slate-800 border border-slate-700 focus:border-teal-400 text-teal-300 font-extrabold rounded-lg text-xs outline-hidden transition-all"
                    />
                    <span className="text-slate-400 text-[11px]">Pasien</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 italic">
                  *Ketik angka bebas (contoh: 15, 30, 85)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ALUMNI DIRECTORY BANNER HEADER */}
      {statusFilter === 'alumni' && (
        <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-3xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <span>🎓 Direktori Alumni Pasien NICU</span>
              </h3>
              <p className="text-xs text-amber-100 mt-0.5">
                Menampilkan daftar si kecil yang telah lulus medis dan dipulangkan. Data tersimpan secara permanen di direktori alumni sebagai rekam medis historis dan tidak dihapus.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-white/20 backdrop-blur-xs text-white rounded-xl text-xs font-bold shrink-0">
            Total Alumni: {overallStats.alumni} Bayi
          </span>
        </div>
      )}

      {/* TRASH FILTER BANNER HEADER */}
      {statusFilter === 'trash' && (
        <div className="p-4 bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 text-white rounded-3xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-700/80 rounded-2xl shrink-0">
              <Trash2 className="w-6 h-6 text-rose-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-rose-100">
                <span>🗑️ Filter Hapus (Sampah Data Pasien)</span>
              </h3>
              <p className="text-xs text-rose-100/90 mt-0.5">
                Data pasien yang dihapus tidak langsung hilang dari sistem dan tersimpan di filter ini. Anda dapat memulihkan (restore) data ke daftar aktif atau menghapusnya secara permanen.
              </p>
            </div>
          </div>
          {overallStats.trash > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="px-4 py-2 bg-rose-950 hover:bg-rose-900 text-rose-200 hover:text-white font-bold text-xs rounded-xl border border-rose-700 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Kosongkan Sampah ({overallStats.trash})</span>
            </button>
          )}
        </div>
      )}

      {/* PATIENT LIST CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPatients.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-100 space-y-2">
            <p className="text-sm font-bold text-slate-600">
              {statusFilter === 'trash' ? 'Tidak ada data pasien yang dihapus.' : 'Tidak ada data pasien yang sesuai filter.'}
            </p>
            <p className="text-xs text-slate-400">
              {statusFilter === 'trash' ? 'Data yang Anda hapus dari daftar pasien akan muncul di sini.' : 'Coba ubah kata kunci pencarian atau reset filter.'}
            </p>
          </div>
        ) : (
          displayedPatients.map((p) => {
            const isAterm = p.gestationCategory === 'aterm';
            const latestLog = p.dailyLogs[0];
            const currentWeight = latestLog ? latestLog.weightGram : p.initialAnthropometry.weightGram;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-3xl border shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden ${
                  p.isDeleted ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100'
                }`}
              >
                <div className="p-5 space-y-4">
                  
                    {/* Top Row: Gestational Category Badge & RM Number */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        isAterm
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : 'border-amber-300/90 bg-amber-50 text-amber-900'
                      }`}>
                        {isAterm ? 'Aterm (>37 Mgg) • Input Harian' : 'Preterm (<36 Mgg) • Input Mingguan'}
                      </span>
                      <span className="text-slate-500 font-bold text-[11px] tracking-wider font-mono">
                        {p.medicalRecordNumber || `RM-2026-${p.id.padStart(4, '0')}`}
                      </span>
                    </div>

                    {/* Main Header with Baby Avatar, Name, Parents & Location Pin */}
                    <div className="flex items-start gap-3 pt-1">
                      {/* Avatar Image */}
                      <div
                        onClick={() => setEditingPatientForModal(p)}
                        className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-slate-200 overflow-hidden shrink-0 shadow-2xs bg-slate-100 flex items-center justify-center cursor-pointer hover:border-teal-500 transition-all"
                        title="Klik untuk Edit Identitas & Foto Bayi"
                      >
                        <img
                          src={p.coverPhotoUrl || p.dailyLogs.find(l => l.photoUrl)?.photoUrl || 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&auto=format&fit=crop&q=80'}
                          alt={p.babyName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-all"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&auto=format&fit=crop&q=80';
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                          <Camera className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* Info & Status Badge */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                          <h3
                            className="text-sm sm:text-base font-extrabold text-slate-900 hover:text-teal-700 cursor-pointer truncate leading-tight"
                            onClick={() => onSelectPatientView(p)}
                            title={p.babyName}
                          >
                            {p.babyName.startsWith('By.') ? p.babyName : `By. Ny. ${p.motherName}`}
                          </h3>

                          {/* Status Badge matching uploaded image */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0 ${
                            p.isDeleted
                              ? 'bg-rose-500 text-white'
                              : p.status === 'Sudah Pulang'
                              ? 'bg-pink-100/90 text-pink-700 border border-pink-200'
                              : p.milestones.bolehPulang || p.status === 'Siap Pulang'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-teal-50 text-teal-800 border border-teal-200'
                          }`}>
                            {p.isDeleted ? (
                              '🗑️ Terhapus'
                            ) : p.status === 'Sudah Pulang' ? (
                              <>
                                <span className="text-pink-600 font-extrabold">✓</span> Alumni
                              </>
                            ) : p.milestones.bolehPulang || p.status === 'Siap Pulang' ? (
                              <>
                                <span className="text-emerald-600 font-extrabold">✓</span> Siap Pulang
                              </>
                            ) : (
                              <>
                                <span className="text-teal-600 font-extrabold">●</span> {p.status}
                              </>
                            )}
                          </span>
                        </div>

                        {/* Parents Subtitle */}
                        <p className="text-xs text-slate-500 font-medium mt-0.5 truncate leading-tight">
                          Orang Tua: <span className="text-slate-700 font-semibold">{p.motherName} & {p.fatherName}</span>
                        </p>

                        {/* Room & Location Pin */}
                        <p className="flex items-center gap-1 text-teal-700 font-bold text-xs mt-1 leading-tight">
                          <span className="text-rose-500 text-xs">📍</span>
                          <span>{p.roomNumber || 'Inkubator 01'}</span>
                        </p>
                      </div>
                    </div>

                  {/* Alumni status badge */}
                  {p.status === 'Sudah Pulang' && !p.isDeleted && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-bold text-amber-900 text-xs">🎓 Alumni Pasien NICU</div>
                          <div className="text-[10px] text-amber-700 font-medium">
                            Telah lulus medis • Rekam data tersimpan permanen
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Soft deleted status badge */}
                  {p.isDeleted && (
                    <div className="p-3 bg-rose-100/80 border border-rose-300 rounded-2xl text-xs text-rose-950 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-rose-700 shrink-0" />
                        <div>
                          <div className="font-bold text-rose-900 text-xs">🗑️ Terdaftar di Filter Hapus</div>
                          <div className="text-[10px] text-rose-800 font-medium">
                            {p.deletedAt ? `Dihapus: ${new Date(p.deletedAt).toLocaleString('id-ID')}` : 'Tersimpan di tempat sampah'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Usia Bayi</span>
                      <span className="font-bold text-slate-800">{formatBabyAge(p.birthDate, p.gestationalAgeWeeks)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Lama Perawatan</span>
                      <span className="font-bold text-slate-800">{formatLengthOfStay(p.admissionDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">BB Masuk</span>
                      <span className="font-bold text-slate-800">{p.initialAnthropometry.weightGram} gram</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">BB Terkini</span>
                      <span className="font-bold text-teal-700">{currentWeight} gram</span>
                    </div>
                  </div>

                  {/* Alat Kesehatan Aktif */}
                  {(() => {
                    const activeEq = latestLog?.activeEquipment || p.currentEquipment || [];
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-teal-800 tracking-wider uppercase">
                            Alat Kesehatan Aktif ({activeEq.length}):
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeEq.length > 0 ? (
                            activeEq.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 bg-cyan-50/80 text-teal-800 border border-teal-200/90 rounded-xl text-[11px] font-semibold shadow-2xs"
                              >
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Bebas alat / Tidak ada alat aktif</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Account Credentials summary */}
                  <div className="p-2.5 bg-teal-50/60 rounded-2xl border border-teal-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-teal-900">
                      <span className="font-bold flex items-center gap-1 text-[11px]">
                        <Key className="w-3.5 h-3.5 text-teal-600 shrink-0" /> Credentials Orang Tua
                      </span>
                      <button
                        onClick={() => { setSelectedPatient(p); setIsShareModalOpen(true); }}
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Share2 className="w-3 h-3" /> Share Link
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-700">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>Nick: <code className="bg-white px-1.5 py-0.5 rounded font-bold border border-teal-200 font-mono text-teal-950">{p.nickname}</code></span>
                        <span>Pass: <code className="bg-white px-1.5 py-0.5 rounded font-bold border border-teal-200 font-mono text-teal-950">{p.accessPassword}</code></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenEditCredentials(p)}
                        className="text-[11px] font-bold text-teal-800 hover:text-teal-950 hover:underline flex items-center gap-1 transition-all cursor-pointer shrink-0"
                        title="Edit Nickname & Password Orang Tua"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Card Footer Actions */}
                {p.isDeleted ? (
                  <div className="bg-rose-50/80 p-3 border-t border-rose-200 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleRestore(p)}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Pulihkan data pasien ini ke daftar aktif"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Pulihkan Data</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(p.id, p.babyName)}
                      className="px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Hapus permanen data ini dari sistem"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Hapus Permanen</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        onClick={() => { setSelectedPatient(p); setIsSouvenirOpen(true); }}
                        className="flex-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1"
                        title="Cetak & Download Kartu Kenangan Kelulusan"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-700" />
                        <span>Kartu Kenangan</span>
                      </button>

                      {p.status === 'Sudah Pulang' ? (
                        <button
                          onClick={() => handleCancelDischargeAction(p)}
                          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-600 hover:text-white text-rose-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1 border border-rose-200 cursor-pointer"
                          title="Batalkan Status Kepulangan Pasien"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Batalkan Pulang</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDischargePatientAction(p)}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-amber-500 hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                          title="Set Pasien Pulang"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Set Pulang</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                      <button
                        onClick={() => onSelectPatientView(p)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>Lihat Card</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveProgressPagePatient(p)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Input Progres</span>
                        </button>

                        <button
                          onClick={() => handleDelete(p.id, p.babyName)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          title="Pindahkan ke Filter Hapus (Sampah)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* BANNER BATAS TAMPILAN / LOAD MORE */}
      {displayedPatients.length < filteredPatients.length && (
        <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 animate-fadeIn">
          <div className="font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            <span>
              Menampilkan <strong className="text-slate-900 font-bold">{displayedPatients.length}</strong> dari total <strong className="text-slate-900 font-bold">{filteredPatients.length}</strong> data pasien yang sesuai filter (Batas: {displayLimit}/halaman).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDisplayLimit((prev) => (typeof prev === 'number' ? Math.min(100, prev + 10) : 100))}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              +10 Pasien Lagi
            </button>
            <button
              type="button"
              onClick={() => setDisplayLimit(Math.min(100, filteredPatients.length))}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              Tampilkan Semua ({filteredPatients.length})
            </button>
          </div>
        </div>
      )}

      {filteredPatients.length === 0 && (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            {statusFilter === 'alumni' ? <GraduationCap className="w-6 h-6 text-amber-600" /> : <Search className="w-6 h-6" />}
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">
            {statusFilter === 'alumni' ? 'Belum Ada Data Alumni Pasien' : 'Tidak Ada Data Pasien Ditemukan'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {statusFilter === 'alumni'
              ? 'Pasien yang telah ditandai "Sudah Pulang" akan otomatis dipindahkan ke dalam direktori Alumni Pasien RSUD Undata.'
              : 'Coba ubah kata kunci pencarian atau sesuaikan opsi filter di atas.'}
          </p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setCategoryFilter('all');
              setSearchTerm('');
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Tampilkan Semua Pasien</span>
          </button>
        </div>
      )}

      {/* MODAL: ADD NEW PATIENT */}
      {isAddPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 my-8 overflow-hidden">
            <div className="bg-teal-700 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Pendaftaran Pasien Bayi NICU Baru</h3>
                <p className="text-xs text-teal-100">Buat rekam medis NSPC dan akses orang tua</p>
              </div>
              <button onClick={() => setIsAddPatientOpen(false)} className="text-teal-200 hover:text-white font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveNewPatient} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">1. Identitas Bayi & Orang Tua</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">No. Rekam Medis (RM)</label>
                    <input
                      type="text"
                      value={medicalRecordNumber}
                      onChange={handleRMChange}
                      placeholder="RM-2026-0711"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-teal-900 uppercase"
                    />
                    <p className="text-[10px] text-teal-700 mt-0.5 font-medium">✨ Otomatis awalan 'RM-' & strip (-). Ketik angka saja.</p>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Nama Bayi *</label>
                    <input
                      type="text"
                      required
                      value={babyName}
                      onChange={handleBabyNameChange}
                      placeholder="Bayi Ny. [Nama Bunda]"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">Dapat diedit/dihapus (default diawali 'Bayi Ny.')</p>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Jenis Kelamin</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="Laki-Laki">Laki-Laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Nama Bunda *</label>
                    <input
                      type="text"
                      required
                      value={motherName}
                      onChange={handleMotherNameChange}
                      placeholder="Ketik Nama Ibu Kandung"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                    <p className="text-[10px] text-teal-700 mt-0.5 font-medium">Cukup ketik Nama Bunda, Nama Bayi otomatis menyesuaikan</p>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Nama Ayah</label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="Nama Ayah Kandung"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tanggal Masuk NICU</label>
                    <input
                      type="date"
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">2. Usia Gestasi & Antropometri Masuk</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Usia Kehamilan (Minggu)</label>
                    <input
                      type="number"
                      value={gestationalAgeWeeks}
                      onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-800"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {gestationalAgeWeeks >= 37 ? 'Aterm (>37m: Update Hari)' : 'Preterm (<36m: Update Minggu)'}
                    </p>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">BB Lahir/Masuk (gram)</label>
                    <input
                      type="number"
                      value={weightGram}
                      onChange={(e) => setWeightGram(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Panjang Badan (cm)</label>
                    <input
                      type="number"
                      value={lengthCm}
                      onChange={(e) => setLengthCm(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Lingkar Kepala (cm)</label>
                    <input
                      type="number"
                      value={headCircumferenceCm}
                      onChange={(e) => setHeadCircumferenceCm(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Lingkar Dada (cm)</label>
                    <input
                      type="number"
                      value={chestCircumferenceCm}
                      onChange={(e) => setChestCircumferenceCm(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Lingkar Perut (cm)</label>
                    <input
                      type="number"
                      value={abdominalCircumferenceCm}
                      onChange={(e) => setAbdominalCircumferenceCm(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Lingkar Lengan Atas / LILA (cm)</label>
                    <input
                      type="number"
                      value={upperArmCircumferenceCm}
                      onChange={(e) => setUpperArmCircumferenceCm(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Nomor Box / Inkubator</label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">3. Alat Kesehatan Digunakan</h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_EQUIPMENT.map((eq) => {
                    const isSel = selectedEquipment.includes(eq);
                    return (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => {
                          if (isSel) {
                            setSelectedEquipment(selectedEquipment.filter((x) => x !== eq));
                          } else {
                            setSelectedEquipment([...selectedEquipment, eq]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSel
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {isSel ? '✓ ' : '+ '}{eq}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center justify-between">
                  <span>4. Foto Profil / Sampul Bayi (Opsional)</span>
                  <span className="text-[10px] font-normal text-slate-500 normal-case">Bisa diisi sekarang atau saat input progres harian</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/50 hover:bg-teal-50 rounded-2xl cursor-pointer transition-all text-center">
                    <Camera className="w-6 h-6 text-teal-600 mb-1" />
                    <span className="text-xs font-bold text-teal-900">Unggah Foto Bayi</span>
                    <span className="text-[10px] text-slate-500">Pilih dari Galeri / Kamera (JPG, PNG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverPhotoChange}
                      className="hidden"
                    />
                  </label>

                  {coverPhotoUrl ? (
                    <div className="relative h-28 rounded-2xl overflow-hidden border-2 border-teal-500 shadow-xs group">
                      <img src={coverPhotoUrl} alt="Preview foto profil bayi" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCoverPhotoUrl('')}
                        className="absolute top-1.5 right-1.5 bg-rose-600 text-white w-6 h-6 rounded-full text-xs font-bold shadow-md hover:bg-rose-700 transition-all flex items-center justify-center cursor-pointer"
                        title="Hapus foto"
                      >
                        ✕
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[10px] py-1 text-center font-semibold">
                        Foto Profil Terpilih
                      </div>
                    </div>
                  ) : (
                    <div className="h-28 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2 space-y-1">
                      <Camera className="w-5 h-5 text-slate-300" />
                      <span>Belum ada foto terpilih</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">5. Akun Akses Orang Tua (Auto-Generated)</h4>
                <div className="grid grid-cols-2 gap-3 text-xs bg-teal-50/60 p-3 rounded-2xl border border-teal-100">
                  <div>
                    <label className="block font-semibold text-teal-900 mb-1">Nickname Pasien</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full p-2 bg-white border border-teal-200 rounded-xl font-bold text-teal-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-teal-900 mb-1">Password Akses</label>
                    <input
                      type="text"
                      value={accessPassword}
                      onChange={(e) => setAccessPassword(e.target.value)}
                      className="w-full p-2 bg-white border border-teal-200 rounded-xl font-bold text-teal-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddPatientOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Simpan & Daftarkan Pasien</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: INPUT DAILY / WEEKLY LOG */}
      {isLogModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 my-8 overflow-hidden">
            <div className="bg-teal-700 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Input Progres {selectedPatient.gestationCategory === 'aterm' ? 'Harian' : 'Mingguan'}</h3>
                <p className="text-xs text-teal-100">{selectedPatient.babyName}</p>
              </div>
              <button onClick={() => setIsLogModalOpen(false)} className="text-teal-200 hover:text-white font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveLog} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Periode Laporan</label>
                  <input
                    type="text"
                    required
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                    placeholder="Contoh: Hari ke-5 / Minggu ke-2"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Berat Badan (Gram)</label>
                  <input
                    type="number"
                    required
                    value={logWeight}
                    onChange={(e) => setLogWeight(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-800"
                  />
                </div>
              </div>

              {/* TTV */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">Tanda-Tanda Vital (TTV)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="block font-medium mb-1">Suhu (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={temp}
                      onChange={(e) => setTemp(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Detak Jantung (x/m)</label>
                    <input
                      type="number"
                      value={hr}
                      onChange={(e) => setHr(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Laju Napas (x/m)</label>
                    <input
                      type="number"
                      value={rr}
                      onChange={(e) => setRr(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">SpO2 (%)</label>
                    <input
                      type="number"
                      value={spo2}
                      onChange={(e) => setSpo2(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* DRINKING */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">Kemampuan Minum & Nutrisi</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block font-medium mb-1">Metode Minum</label>
                    <select
                      value={drinkMethod}
                      onChange={(e) => setDrinkMethod(e.target.value as any)}
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    >
                      <option value="OGT/Sonde">OGT / Sonde</option>
                      <option value="Sendok/Cup Feeder">Sendok / Cup Feeder</option>
                      <option value="Menyusu Langsung (DBF)">Menyusu Langsung (DBF)</option>
                      <option value="Kombinasi">Kombinasi</option>
                      <option value="NPO / Puasa sementara">NPO / Puasa sementara</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Jumlah cc / pemberian</label>
                    <input
                      type="number"
                      value={drinkCc}
                      onChange={(e) => setDrinkCc(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Frekuensi / 24 Jam</label>
                    <input
                      type="number"
                      value={drinkFreq}
                      onChange={(e) => setDrinkFreq(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* EQUIPMENT TOGGLE */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">Alat Kesehatan Digunakan Saat Ini</h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_EQUIPMENT.map((eq) => {
                    const isSel = logEquipment.includes(eq);
                    return (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => {
                          if (isSel) {
                            setLogEquipment(logEquipment.filter((x) => x !== eq));
                          } else {
                            setLogEquipment([...logEquipment, eq]);
                          }
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                          isSel
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {isSel ? '✓ ' : '+ '}{eq}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MILESTONES CHECKBOXES */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">Checklist Milestone Perkembangan</h4>
                  <span className="text-[10px] text-teal-600 font-medium">Indikator Kesehatan & Kelulusan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries({
                    lepasCPAP: 'Lepas CPAP',
                    lepasVentilator: 'Lepas Ventilator',
                    lepasInfus: 'Lepas Infus',
                    lepasOGT: 'Lepas OGT',
                    lepasO2Nasal: 'Lepas O2 Nasal',
                    refleksMenghisapBaik: 'Refleks Menghisap Baik',
                    refleksMenelanBaik: 'Refleks Menelan Baik',
                    selesaiPMK: 'Selesai Perawatan Metode Kanguru (PMK)',
                    selesaiHBO: 'Selesai Fototerapi (HBO)',
                    hb0: 'HB0 (Imunisasi Hepatitis B0)',
                    shk: 'SHK (Skrining Hipotiroid Kongenital)',
                    skriningPJB: 'Skrining PJB (Penyakit Jantung Bawaan)',
                    bayiSementaraPemantauanKetat: 'Bayi Dalam Pemantauan Ketat',
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input
                        type="checkbox"
                        checked={Boolean(logMilestones[key as keyof Milestones])}
                        onChange={(e) =>
                          setLogMilestones({
                            ...logMilestones,
                            [key]: e.target.checked,
                          })
                        }
                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-800">{label}</span>
                    </label>
                  ))}
                </div>

                {/* DEDICATED HIGHLIGHTED BOX FOR SIAP & BOLEH PULANG */}
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 border-2 border-emerald-300/80 rounded-2xl shadow-xs">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(logMilestones.bolehPulang)}
                      onChange={(e) =>
                        setLogMilestones({
                          ...logMilestones,
                          bolehPulang: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-5 h-5 cursor-pointer accent-emerald-600 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-emerald-950 text-xs sm:text-sm">🎉 SIAP & BOLEH PULANG</span>
                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                          Syarat Utama Filter Boleh Pulang
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium mt-1 leading-snug">
                        Centang checklist ini apabila si kecil telah memenuhi semua kriteria medis dan dinyatakan lulus. Hanya bayi dengan checklist ini yang akan dipindahkan ke kategori/filter <strong>"Siap Pulang"</strong>.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* PHOTO UPLOAD FOR DAILY LOG */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-teal-600" />
                    <span>Upload Foto Perkembangan Bayi Hari Ini</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Opsional • Foto untuk Orang Tua</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/50 hover:bg-teal-50 rounded-2xl cursor-pointer transition-all text-center">
                    <Upload className="w-6 h-6 text-teal-600 mb-1" />
                    <span className="text-xs font-bold text-teal-900">Pilih / Ambil Foto Bayi</span>
                    <span className="text-[10px] text-slate-500">JPG, PNG (Maks 10MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogPhotoChange}
                      className="hidden"
                    />
                  </label>

                  {logPhotoUrl ? (
                    <div className="relative h-28 rounded-2xl overflow-hidden border-2 border-teal-500 shadow-xs group">
                      <img src={logPhotoUrl} alt="Preview foto log" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setLogPhotoUrl('')}
                        className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="h-28 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                      <span>Belum ada foto terpilih</span>
                    </div>
                  )}
                </div>

                {logPhotoUrl && (
                  <input
                    type="text"
                    value={logPhotoCaption}
                    onChange={(e) => setLogPhotoCaption(e.target.value)}
                    placeholder="Keterangan singkat foto (Contoh: Si kecil mulai tersenyum saat tidur)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                )}
              </div>

              {/* NOTES */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">Pesan Nakes untuk Orang Tua</h4>
                  <span className="text-[11px] text-teal-600 font-semibold">Gunakan template ramah:</span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SAMPLE_MESSAGES.map((msg, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNakesNotes(msg)}
                      className="text-[11px] px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg border border-teal-200 transition-all text-left"
                    >
                      + Template {i + 1}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={nakesNotes}
                  onChange={(e) => setNakesNotes(e.target.value)}
                  placeholder="Tulis pesan penyemangat untuk Ayah & Bunda..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block font-medium mb-1">Nama Petugas Nakes</label>
                    <input
                      type="text"
                      value={updatedBy}
                      onChange={(e) => setUpdatedBy(e.target.value)}
                      placeholder="e.g. dr. Sp.A / Ns. Rahma, S.Kep"
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md"
                >
                  Simpan Laporan Perkembangan
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: SHARE ACCESS LINK */}
      {isShareModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-teal-700 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Bagikan Akses NSPC Orang Tua</h3>
                <p className="text-xs text-teal-100">{selectedPatient.babyName}</p>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-teal-200 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Nickname Login:</span>
                  <strong className="text-slate-900 font-mono bg-white px-2 py-0.5 rounded border">{selectedPatient.nickname}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Password Akses:</span>
                  <strong className="text-slate-900 font-mono bg-white px-2 py-0.5 rounded border">{selectedPatient.accessPassword}</strong>
                </div>
                <div className="pt-1.5 border-t border-slate-200/80 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsShareModalOpen(false);
                      handleOpenEditCredentials(selectedPatient);
                    }}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Edit Nick & Password</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppMessage(selectedPatient)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Pesan WhatsApp Orang Tua</span>
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Tutup Dialog
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* SOUVENIR CARD / CERTIFICATE MODAL */}
      {selectedPatient && (
        <SouvenirCardModal
          patient={selectedPatient}
          isOpen={isSouvenirOpen}
          onClose={() => setIsSouvenirOpen(false)}
        />
      )}

      {/* MODAL: EDIT CREDENTIALS (NICK & PASS) */}
      {isEditCredentialsOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-teal-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-700 rounded-xl">
                  <Key className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Edit Kredensial Orang Tua</h3>
                  <p className="text-xs text-teal-200">Pasien: {selectedPatient.babyName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCredentialsOpen(false)}
                className="text-teal-200 hover:text-white font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="p-6 space-y-4">
              {credentialsSuccess && (
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Kredensial Nickname & Password berhasil diperbarui!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nickname Orang Tua (Username Login)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="Contoh: BUNDA_AISYAH"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:bg-white focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Gunakan nama singkat/unik tanpa spasi untuk kemudahan login orang tua.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password Akses
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-[10px] font-bold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" /> Generate Acak
                  </button>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Contoh: Undata#1234"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:bg-white focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1 text-amber-950">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Catatan:
                </span>
                <p className="leading-relaxed">
                  Perubahan Nickname & Password akan langsung berlaku. Beritahukan kredensial baru ini kepada orang tua pasien.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditCredentialsOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MYSQL DATABASE & REAL-TIME STATUS MODAL */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Status MySQL Database & Real-Time Sync</h3>
                  <p className="text-xs text-emerald-700 font-medium">Server: Express + MySQL + SSE Stream</p>
                </div>
              </div>
              <button onClick={() => setIsSqlModalOpen(false)} className="text-slate-400 font-bold p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-4 bg-gradient-to-r from-teal-900 to-emerald-900 text-white rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-teal-100 flex items-center gap-2">
                      <span>🚀 Sinkronisasi Paksa Data ke MySQL</span>
                    </h4>
                    <p className="text-[11px] text-teal-200/90 mt-0.5">
                      Kirim seluruh {patients.length} data pasien dan {getStoredNakesUsers().length} akun nakes di memori browser ini langsung ke MySQL cPanel
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleForceSyncNow}
                    disabled={isForceSyncing}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {isForceSyncing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                        <span>Menyinkronkan...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Kirim ke MySQL Sekarang</span>
                      </>
                    )}
                  </button>
                </div>

                {forceSyncStatus && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      forceSyncStatus.isError
                        ? 'bg-rose-950/80 border border-rose-500/50 text-rose-200'
                        : 'bg-emerald-950/80 border border-emerald-400/50 text-emerald-200'
                    }`}
                  >
                    {forceSyncStatus.isError ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>{forceSyncStatus.text}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 font-mono">
                <p><strong>Database Engine:</strong> <span className="text-teal-800 font-bold">MySQL 8.0+ (Niagahoster / cPanel)</span></p>
                <p><strong>Database Name:</strong> <span className="text-sky-700 font-bold">{process.env.MYSQL_DATABASE || 'nspc_nicu_db'}</span></p>
                <p><strong>Sinkronisasi Real-Time:</strong> <span className="text-emerald-600 font-bold">● Server-Sent Events (SSE) Aktif Otomatis</span></p>
                <p><strong>Alur:</strong> <span className="text-slate-700">Bidirectional 2-Arah (Web ⇄ MySQL Otomatis tanpa tombol manual)</span></p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl space-y-1">
                <p className="font-bold text-emerald-950">📌 Struktur 5 Tabel MySQL Terintegrasi:</p>
                <ul className="list-disc list-inside ml-2 font-medium space-y-0.5 text-[11px]">
                  <li><code>patients</code>: Data identitas, antropometri, milestones, foto cover, & rekam medis pasien.</li>
                  <li><code>daily_logs</code>: Log harian/mingguan, tanda-tanda vital, status nutrisi, & foto perkembangan.</li>
                  <li><code>nakes_users</code>: Akun tenaga kesehatan, hak akses RBAC, & PIN keamanan.</li>
                  <li><code>nakes_login_logs</code>: Riwayat audit login tenaga kesehatan & IP address.</li>
                  <li><code>education_pdfs</code>: Katalog materi edukasi PDF digital untuk orang tua.</li>
                </ul>
              </div>

              <div className="relative">
                {(() => {
                  const sqlScript = `-- SKEMA TABEL MYSQL NSPC NICU RSUD UNDATA (5 TABEL)
-- Jalankan di phpMyAdmin / MySQL Niagahoster:

CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(64) PRIMARY KEY,
  medical_record_number VARCHAR(64),
  nickname VARCHAR(64) NOT NULL,
  access_password VARCHAR(64) NOT NULL,
  baby_name VARCHAR(128) NOT NULL,
  father_name VARCHAR(128),
  mother_name VARCHAR(128),
  gender ENUM('Laki-laki', 'Perempuan') DEFAULT 'Laki-laki',
  birth_date DATE,
  admission_date DATE,
  gestational_age_weeks INT,
  gestation_category ENUM('aterm', 'preterm') DEFAULT 'aterm',
  room_number VARCHAR(32),
  status ENUM('Rawat NICU', 'Sudah Pulang') DEFAULT 'Rawat NICU',
  discharged_at DATETIME NULL,
  cover_photo_url LONGTEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at DATETIME NULL,
  initial_anthropometry JSON,
  milestones JSON,
  current_equipment JSON,
  registered_equipment JSON,
  immunization_discharge JSON,
  discharge_summary JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patients_nickname (nickname),
  INDEX idx_patients_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daily_logs (
  id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  period_label VARCHAR(64),
  weight_gram INT NOT NULL,
  weight_change_gram INT DEFAULT 0,
  photo_url LONGTEXT,
  vital_signs JSON,
  drinking_ability JSON,
  active_equipment JSON,
  nakes_notes TEXT,
  updated_by VARCHAR(128),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_logs_patient_id (patient_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS nakes_users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  role_title VARCHAR(64) NOT NULL,
  account_type ENUM('Admin', 'Anggota Biasa') DEFAULT 'Anggota Biasa',
  username VARCHAR(64) UNIQUE NOT NULL,
  pin VARCHAR(64) NOT NULL,
  is_super_admin BOOLEAN DEFAULT FALSE,
  has_access_rights BOOLEAN DEFAULT FALSE,
  last_login_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nakes_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS nakes_login_logs (
  id VARCHAR(64) PRIMARY KEY,
  nakes_id VARCHAR(64),
  nakes_name VARCHAR(128),
  role_title VARCHAR(64),
  username VARCHAR(64),
  ip_address VARCHAR(45),
  user_agent TEXT,
  logged_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_logs_nakes (nakes_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS education_pdfs (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64),
  file_name VARCHAR(255),
  file_size_text VARCHAR(32),
  file_url LONGTEXT,
  cover_image_url LONGTEXT,
  nakes_note TEXT,
  order_index INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  published_at VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_edu_order (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

                  return (
                    <>
                      <textarea
                        readOnly
                        rows={10}
                        value={sqlScript}
                        className="w-full p-3 bg-slate-900 text-teal-300 font-mono text-[11px] rounded-2xl leading-relaxed focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(sqlScript);
                          setCopiedSql(true);
                          setTimeout(() => setCopiedSql(false), 2500);
                        }}
                        className="absolute right-3 top-3 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs transition-all"
                      >
                        {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSql ? 'SQL Tersalin!' : 'Salin Skema MySQL'}</span>
                      </button>
                    </>
                  );
                })()}
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setIsSqlModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-700 transition-all"
                >
                  Tutup Dialog
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI SET PULANG */}
      {isDischargeModalOpen && patientToDischarge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 via-teal-600 to-emerald-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Konfirmasi Set Pulang Pasien</h3>
                  <p className="text-xs text-amber-100/90 font-medium">Proses Kelulusan NICU & Kepulangan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDischargeModalOpen(false);
                  setPatientToDischarge(null);
                }}
                className="text-white/80 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Patient summary box */}
              <div className="p-3.5 bg-teal-50/70 rounded-2xl border border-teal-100 flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-xl border border-teal-200 overflow-hidden shrink-0 bg-white shadow-2xs flex items-center justify-center">
                  <img
                    src={
                      patientToDischarge.coverPhotoUrl ||
                      patientToDischarge.dailyLogs.find((l) => l.photoUrl)?.photoUrl ||
                      'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&auto=format&fit=crop&q=80'
                    }
                    alt={patientToDischarge.babyName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h4 className="font-extrabold text-slate-900 text-sm truncate">
                      {patientToDischarge.babyName.startsWith('By.')
                        ? patientToDischarge.babyName
                        : `By. Ny. ${patientToDischarge.motherName}`}
                    </h4>
                    <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-md shrink-0">
                      {patientToDischarge.medicalRecordNumber || `RM-${patientToDischarge.id.padStart(4, '0')}`}
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium truncate">
                    Orang Tua: <strong className="text-slate-800">{patientToDischarge.motherName} & {patientToDischarge.fatherName}</strong>
                  </p>
                  <p className="text-teal-700 font-semibold mt-0.5 flex items-center gap-1">
                    <span>📍 {patientToDischarge.roomNumber || 'Inkubator 01'}</span>
                  </p>
                </div>
              </div>

              {/* Warning / Informational note */}
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Informasi Kebijakan Sistem:</span>
                </div>
                <p className="leading-relaxed text-slate-700 text-[11px]">
                  Status pasien akan diubah menjadi <strong className="text-slate-900">SUDAH PULANG (Alumni NICU)</strong>. Data rekam medis pasien ini akan tersimpan <strong className="text-emerald-800 font-bold">permanen di Data Alumni</strong>.
                </p>
              </div>

              {/* Optional DPJP & Notes input */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dokter Penanggung Jawab (DPJP)
                  </label>
                  <input
                    type="text"
                    value={dischargeDoctor}
                    onChange={(e) => setDischargeDoctor(e.target.value)}
                    placeholder="Contoh: Dr. Sp.A (K) NICU"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Catatan Kelulusan / Pesan Dokter untuk Orang Tua
                    </label>
                    <span className="text-[10px] text-teal-700 font-extrabold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      4 Template Pesan
                    </span>
                  </div>

                  {/* 4 Template Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2.5">
                    {DISCHARGE_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDischargeNotes(tmpl.text)}
                        className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                          dischargeNotes === tmpl.text
                            ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                            : 'bg-slate-50 hover:bg-teal-50/70 border-slate-200 hover:border-teal-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`font-bold text-xs ${dischargeNotes === tmpl.text ? 'text-white' : 'text-teal-900'}`}>
                            {tmpl.title}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                            dischargeNotes === tmpl.text ? 'bg-teal-600 text-teal-100' : 'bg-teal-100 text-teal-800'
                          }`}>
                            {tmpl.badge}
                          </span>
                        </div>
                        <p className={`text-[10px] line-clamp-2 leading-tight ${
                          dischargeNotes === tmpl.text ? 'text-teal-100' : 'text-slate-500'
                        }`}>
                          {tmpl.text}
                        </p>
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={dischargeNotes}
                    onChange={(e) => setDischargeNotes(e.target.value)}
                    placeholder="Tuliskan catatan kelulusan atau pilih dari template di atas..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-hidden resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDischargeModalOpen(false);
                    setPatientToDischarge(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDischargePatient}
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ya, Set Pulang Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI BATALKAN PULANG */}
      {cancelDischargePatientTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-amber-500 to-rose-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Batalkan Kepulangan Pasien</h3>
                  <p className="text-xs text-amber-100 font-medium">Kembalikan Status ke Rawat NICU</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelDischargePatientTarget(null)}
                className="text-white/80 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white shadow-2xs flex items-center justify-center">
                  <img
                    src={
                      cancelDischargePatientTarget.coverPhotoUrl ||
                      cancelDischargePatientTarget.dailyLogs.find((l) => l.photoUrl)?.photoUrl ||
                      'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&auto=format&fit=crop&q=80'
                    }
                    alt={cancelDischargePatientTarget.babyName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">
                    {cancelDischargePatientTarget.babyName}
                  </h4>
                  <p className="text-slate-500 font-medium truncate">
                    Orang Tua: <strong className="text-slate-700">{cancelDischargePatientTarget.motherName} & {cancelDischargePatientTarget.fatherName}</strong>
                  </p>
                  <p className="text-teal-700 font-bold text-[11px] mt-0.5">
                    RM: {cancelDischargePatientTarget.medicalRecordNumber || `RM-${cancelDischargePatientTarget.id.padStart(4, '0')}`}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200/80 text-xs text-rose-900 space-y-1">
                <p className="font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  Konfirmasi Pembatalan:
                </p>
                <p className="leading-relaxed text-slate-700 text-[11px]">
                  Status pasien <strong className="text-slate-900">{cancelDischargePatientTarget.babyName}</strong> akan dikembalikan menjadi <strong className="text-teal-800">Rawat NICU (Aktif)</strong> dan data pasien dipindahkan kembali ke daftar pasien rawat aktif.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelDischargePatientTarget(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmCancelDischarge}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Ya, Batalkan Kepulangan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PASIEN (SAMPAH) */}
      {deletePatientTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Pindahkan ke Sampah</h3>
                  <p className="text-xs text-amber-100 font-medium">Penghapusan Sementara (Soft Delete)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletePatientTarget(null)}
                className="text-white/80 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white shadow-2xs flex items-center justify-center">
                  <img
                    src={
                      deletePatientTarget.coverPhotoUrl ||
                      deletePatientTarget.dailyLogs.find((l) => l.photoUrl)?.photoUrl ||
                      'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&auto=format&fit=crop&q=80'
                    }
                    alt={deletePatientTarget.babyName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">
                    {deletePatientTarget.babyName}
                  </h4>
                  <p className="text-slate-500 font-medium truncate">
                    Orang Tua: <strong className="text-slate-700">{deletePatientTarget.motherName} & {deletePatientTarget.fatherName}</strong>
                  </p>
                  <p className="text-teal-700 font-bold text-[11px] mt-0.5">
                    RM: {deletePatientTarget.medicalRecordNumber || `RM-${deletePatientTarget.id.padStart(4, '0')}`}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold text-amber-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Informasi:
                </p>
                <p className="leading-relaxed text-slate-700 text-[11px]">
                  Data pasien <strong className="text-slate-900">{deletePatientTarget.babyName}</strong> akan dipindahkan ke tab <strong className="text-amber-900">Filter Hapus (Sampah)</strong>. Data belum dihapus permanen dan dapat dipulihkan sewaktu-waktu.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletePatientTarget(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePatient}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Pindahkan ke Sampah</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI PULIHKAN DATA PASIEN */}
      {restorePatientTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                  <RotateCcw className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Konfirmasi Pulihkan Pasien</h3>
                  <p className="text-xs text-emerald-100 font-medium">Kembalikan Pasien ke Daftar Rawat Aktif</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestorePatientTarget(null)}
                className="text-white/80 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-emerald-200 overflow-hidden shrink-0 bg-white shadow-2xs flex items-center justify-center">
                  <img
                    src={
                      restorePatientTarget.coverPhotoUrl ||
                      restorePatientTarget.dailyLogs.find((l) => l.photoUrl)?.photoUrl ||
                      'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&auto=format&fit=crop&q=80'
                    }
                    alt={restorePatientTarget.babyName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">
                    {restorePatientTarget.babyName}
                  </h4>
                  <p className="text-slate-500 font-medium truncate">
                    Orang Tua: <strong className="text-slate-700">{restorePatientTarget.motherName} & {restorePatientTarget.fatherName}</strong>
                  </p>
                  <p className="text-teal-700 font-bold text-[11px] mt-0.5">
                    RM: {restorePatientTarget.medicalRecordNumber || `RM-${restorePatientTarget.id.padStart(4, '0')}`}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-teal-50 rounded-2xl border border-teal-200 text-xs text-teal-950 space-y-1">
                <p className="font-bold text-teal-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-teal-700 shrink-0" />
                  Informasi Pemulihan:
                </p>
                <p className="leading-relaxed text-slate-700 text-[11px]">
                  Apakah Anda yakin ingin memulihkan data pasien <strong className="text-slate-900">{restorePatientTarget.babyName}</strong>? Data akan dikembalikan dari Sampah ke daftar rawat aktif beserta seluruh rekam medisnya.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRestorePatientTarget(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmRestorePatient}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Ya, Pulihkan Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PERMANEN */}
      {permanentDeletePatientTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Hapus Permanen Data Pasien</h3>
                  <p className="text-xs text-rose-100 font-medium">Tindakan Tidak Dapat Dibatalkan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPermanentDeletePatientTarget(null)}
                className="text-white/80 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-rose-200 overflow-hidden shrink-0 bg-white shadow-2xs flex items-center justify-center">
                  <img
                    src={
                      permanentDeletePatientTarget.coverPhotoUrl ||
                      permanentDeletePatientTarget.dailyLogs.find((l) => l.photoUrl)?.photoUrl ||
                      'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&auto=format&fit=crop&q=80'
                    }
                    alt={permanentDeletePatientTarget.babyName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">
                    {permanentDeletePatientTarget.babyName}
                  </h4>
                  <p className="text-slate-500 font-medium truncate">
                    Orang Tua: <strong className="text-slate-700">{permanentDeletePatientTarget.motherName} & {permanentDeletePatientTarget.fatherName}</strong>
                  </p>
                  <p className="text-rose-700 font-bold text-[11px] mt-0.5">
                    RM: {permanentDeletePatientTarget.medicalRecordNumber || `RM-${permanentDeletePatientTarget.id.padStart(4, '0')}`}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-100/90 rounded-2xl border border-rose-300 text-xs text-rose-950 space-y-1">
                <p className="font-extrabold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                  PERINGATAN PERMANEN:
                </p>
                <p className="leading-relaxed text-rose-900 text-[11px] font-medium">
                  Apakah Anda yakin ingin menghapus <strong className="text-rose-950 underline">PERMANEN</strong> data pasien <strong>{permanentDeletePatientTarget.babyName}</strong>? Seluruh catatan rekam medis dan perkembangan harian akan dihancurkan total dan <strong className="text-rose-950 font-bold">TIDAK BISA DIKEMBALIKAN LAGI</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPermanentDeletePatientTarget(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmPermanentDelete}
                  className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus Permanen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI KOSONGKAN SAMPAH */}
      {isEmptyTrashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Kosongkan Semua Data Sampah</h3>
                  <p className="text-xs text-rose-100 font-medium">Pembersihan Total Data Terhapus</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmptyTrashModalOpen(false)}
                className="text-white/80 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200/80 text-center space-y-1">
                <span className="inline-block p-2 bg-rose-100 rounded-2xl text-rose-700 font-mono font-black text-lg">
                  🗑️ {overallStats.trash} Pasien
                </span>
                <p className="text-xs text-slate-600 font-medium">akan dibersihkan dari Filter Hapus</p>
              </div>

              <div className="p-3.5 bg-rose-100/80 rounded-2xl border border-rose-300 text-xs text-rose-950 space-y-1">
                <p className="font-extrabold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                  PERINGATAN BAHAYA:
                </p>
                <p className="leading-relaxed text-rose-900 text-[11px] font-medium">
                  Tindakan ini akan mengosongkan dan menghapus secara <strong className="text-rose-950 underline">PERMANEN</strong> seluruh data pasien yang ada di Filter Hapus. Seluruh rekam medis di sampah tidak dapat dipulihkan lagi setelahnya.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmptyTrashModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmEmptyTrash}
                  className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Kosongkan Sampah Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT PROFILE ADMIN NAKES */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 relative my-auto">
            
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <User className="w-6 h-6 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Pengaturan Profile Admin Nakes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kelola nama, jabatan/peran, username, dan PIN login Nakes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseProfileModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {profileSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Profile Nakes berhasil diperbarui dan tersimpan!</span>
              </div>
            )}

            <form onSubmit={handleSaveNakesProfile} className="space-y-4">
              {/* Nama Lengkap & Gelar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap & Gelar Nakes
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Contoh: Ns. Rahmawati, S.Kep"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none transition-all"
                  />
                  <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Jabatan / Role Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Profesi / Jabatan Medis
                </label>
                <div className="relative">
                  <select
                    value={profileRoleTitle}
                    onChange={(e) => setProfileRoleTitle(e.target.value)}
                    required
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="Kepala Ruangan">Kepala Ruangan</option>
                    <option value="Ketua">Ketua</option>
                    <option value="Anggota">Anggota</option>
                    {![
                      'Kepala Ruangan',
                      'Ketua',
                      'Anggota',
                    ].includes(profileRoleTitle) && profileRoleTitle && (
                      <option value={profileRoleTitle}>{profileRoleTitle}</option>
                    )}
                  </select>
                  <Award className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Username Login */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username Login Admin
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder="Username untuk login"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none transition-all"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* PIN / Password Login */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PIN / Password Login Admin
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profilePin}
                    onChange={(e) => setProfilePin(e.target.value)}
                    placeholder="PIN / Kata Sandi login"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-teal-500 outline-none transition-all"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseProfileModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT IDENTITAS & FOTO BAYI / ORANG TUA */}
      {editingPatientForModal && (
        <EditPatientModal
          isOpen={!!editingPatientForModal}
          patient={editingPatientForModal}
          onClose={() => setEditingPatientForModal(null)}
          onSaveSuccess={(updatedPat) => {
            if (selectedPatient && selectedPatient.id === updatedPat.id) {
              setSelectedPatient(updatedPat);
            }
            onRefreshData();
            setEditingPatientForModal(null);
          }}
        />
      )}

      {/* MODAL: INPUT / UPLOAD FILE PDF REKOMENDASI EDUKASI ORANG TUA (GLOBAL) */}
      {isGlobalPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto animate-fadeIn font-sans">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden my-auto transform transition-all">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                    Input / Upload File PDF Edukasi Orang Tua
                  </h3>
                  <p className="text-xs text-emerald-100 font-medium mt-0.5">
                    Otomatis ditambahkan ke seluruh daftar pasien
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGlobalPdfModalOpen(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-all cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveGlobalEducationPdf} className="p-5 sm:p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Judul Materi Edukasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Panduan PMK & Perawatan Rumah"
                  value={globalPdfTitle}
                  onChange={(e) => setGlobalPdfTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Kategori Edukasi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={globalPdfCategory}
                  onChange={(e) => setGlobalPdfCategory(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                >
                  <option value="Metode Kanguru (PMK)">Metode Kanguru (PMK)</option>
                  <option value="Pemberian ASI">Pemberian ASI</option>
                  <option value="Perawatan Tali Pusat">Perawatan Tali Pusat</option>
                  <option value="Tanda Bahaya Bayi Prematur">Tanda Bahaya Bayi Prematur</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Pilih File PDF <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-all shadow-2xs shrink-0">
                    Pilih File
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleGlobalPdfFileChange}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs font-medium text-slate-600 truncate flex-1 italic">
                    {globalPdfFileName || 'Belum ada file dipilih (.pdf)'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Khusus Nakes untuk Orang Tua
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Harap dibaca ibu sebelum melakukan latihan PMK besok pagi..."
                  value={globalPdfNakesNote}
                  onChange={(e) => setGlobalPdfNakesNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-teal-500 outline-none"
                />
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl text-[11px] text-teal-900 font-medium leading-relaxed">
                💡 <strong>Pemberitahuan Global:</strong> File PDF yang diunggah dari Dashboard ini akan otomatis diterbitkan dan tersedia di daftar edukasi seluruh pasien.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGlobalPdfModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Simpan & Terbitkan Ke Semua Pasien</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE NAKES USERS & HAK AKSES MODAL */}
      <ManageNakesUsersModal
        isOpen={isManageUsersModalOpen}
        currentNakesUser={currentNakesUser}
        onClose={() => setIsManageUsersModalOpen(false)}
        onRefreshNakes={onRefreshData}
      />

    </div>
  );
};
