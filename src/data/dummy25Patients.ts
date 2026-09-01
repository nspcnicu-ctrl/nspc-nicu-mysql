import { Patient, MedicalEquipment, DrinkingAbility } from '../types';

export function generate25DummyPatients(): Patient[] {
  const motherNames = [
    'Fitriani', 'Rahmawati', 'Siti Nurhaliza', 'Maryam', 'Nurul Hidayah',
    'Dewi Sartika', 'Andi Tenri', 'Fatmawati', 'Rostina', 'Megawati',
    'Hasnidar', 'Kasmawati', 'Yuliana', 'Aisyah', 'Sri Wahyuni',
    'Kartini', 'Indah Permata', 'Zubaidah', 'Wulandari', 'Rosdiana',
    'Nurlina', 'Asmawati', 'Harlina', 'Ratnasari', 'Sulastri'
  ];

  const fatherNames = [
    'Hendra Pratama', 'Fajar Kurniawan', 'Ridwan Syah', 'Bambang Irawan', 'Agus Salim',
    'Wahyu Hidayat', 'Andi Baso', 'Ilham Nugraha', 'Rahmat Hidayat', 'Dedi Supriadi',
    'Syarifuddin', 'Mustafa Kamal', 'Heriansyah', 'Zulkifli', 'Budi Santoso',
    'Eko Prasetyo', 'Mansyur', 'Arif Rahman', 'Junaedi', 'Samsul Bahri',
    'Rusdianto', 'Fachruddin', 'Taufik Hidayat', 'Irfan Bachdim', 'Herman Wijaya'
  ];

  const rooms = [
    'Inkubator 01 (NICU)', 'Inkubator 02 (NICU)', 'Inkubator 03 (NICU)', 'Inkubator 04 (NICU)',
    'Inkubator 05 (NICU)', 'Inkubator 06 (NICU)', 'Boks Isolasi 01', 'Boks Isolasi 02',
    'Boks Transisi 01', 'Boks Transisi 02', 'Boks Bayi Sehat 01', 'Boks Bayi Sehat 02'
  ];

  const list: Patient[] = [];

  for (let i = 0; i < 25; i++) {
    const idx = i + 1;
    const pad = String(idx).padStart(2, '0');
    const mother = motherNames[i % motherNames.length];
    const father = fatherNames[i % fatherNames.length];
    const gender = i % 2 === 0 ? 'Laki-Laki' : 'Perempuan';
    const isPreterm = i % 3 !== 0; // ~66% preterm in NICU
    const gestWeeks = isPreterm ? 28 + (i % 8) : 37 + (i % 4);
    const gestCat = isPreterm ? 'preterm' : 'aterm';
    
    // Status distribution
    let status: 'Rawat NICU' | 'Siap Pulang' | 'Sudah Pulang' = 'Rawat NICU';
    if (i % 5 === 3) status = 'Siap Pulang';
    if (i % 5 === 4) status = 'Sudah Pulang';

    const baseWeight = isPreterm ? 1200 + (i * 50) : 2700 + (i * 40);
    const birthDay = Math.max(1, 28 - (i % 25));
    const birthDate = `2026-08-${String(birthDay).padStart(2, '0')}`;

    const nick = `bayi_${mother.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}_${idx}`;
    const mrn = `RM-2026-${pad}${String(100 + i)}`;

    const currentEq: MedicalEquipment[] = status === 'Sudah Pulang' ? [] : (isPreterm ? ['CPAP', 'Infus', 'Monitor TTV'] : ['Monitor TTV']);

    const drinkMethod: DrinkingAbility['method'] = isPreterm ? 'OGT/Sonde' : 'Menyusu Langsung (DBF)';

    const p: Patient = {
      id: `p-dummy-${pad}`,
      nickname: nick,
      accessPassword: '123',
      babyName: `Bayi Ny. ${mother}`,
      fatherName: `Tn. ${father}`,
      motherName: `Ny. ${mother}`,
      gender,
      birthDate,
      birthTime: `${String(8 + (i % 12)).padStart(2, '0')}:${String((i * 15) % 60).padStart(2, '0')} WITA`,
      admissionDate: birthDate,
      gestationalAgeWeeks: gestWeeks,
      gestationCategory: gestCat,
      status,
      medicalRecordNumber: mrn,
      roomNumber: rooms[i % rooms.length],
      initialAnthropometry: {
        weightGram: baseWeight,
        lengthCm: isPreterm ? 38 + (i % 6) : 46 + (i % 5),
        headCircumferenceCm: isPreterm ? 27 + (i % 4) : 32 + (i % 3),
        chestCircumferenceCm: isPreterm ? 25 + (i % 4) : 30 + (i % 3),
        abdominalCircumferenceCm: isPreterm ? 23 + (i % 4) : 28 + (i % 3),
        upperArmCircumferenceCm: isPreterm ? 8 + (i % 2) : 10 + (i % 2),
      },
      currentEquipment: currentEq,
      milestones: [
        'refleksMenghisapBaik',
        'refleksMenelanBaik',
        'selesaiHBO',
        'hb0',
        'shk',
        'skriningPJB',
        ...(status === 'Sudah Pulang' ? ['SIAP & BOLEH PULANG'] : []),
      ],
      dailyLogs: [
        {
          id: `log-dum-${pad}-02`,
          date: '2026-08-31',
          periodLabel: isPreterm ? `Minggu ke-2 (Hari ke-10)` : `Hari ke-10`,
          weightGram: baseWeight + 280,
          weightChangeGram: 280,
          vitalSigns: {
            temperature: 36.7 + (i % 4) * 0.1,
            heartRate: 136 + (i % 10),
            respiratoryRate: 40 + (i % 8),
            spo2: 97 + (i % 3),
          },
          drinkingAbility: {
            method: drinkMethod,
            volumeCcPerFeeding: isPreterm ? 20 + (i % 10) : 40 + (i % 15),
            frequencyPerDay: 8,
            notes: 'Toleransi minum baik, tidak kembung, residu lambung jernih.',
          },
          activeEquipment: status === 'Sudah Pulang' ? [] : ['Monitor TTV'],
          nakesNotes: 'Kondisi umum stabil. Terus pantau kenaikan berat badan dan pertahankan kehangatan.',
          updatedBy: 'Nakes Tim NICU',
          createdAt: '2026-08-31T08:30:00.000Z',
        },
        {
          id: `log-dum-${pad}-01`,
          date: birthDate,
          periodLabel: isPreterm ? `Minggu ke-1 (Hari ke-1)` : `Hari ke-1`,
          weightGram: baseWeight,
          weightChangeGram: 0,
          vitalSigns: {
            temperature: 36.5,
            heartRate: 144,
            respiratoryRate: 48,
            spo2: 95,
          },
          drinkingAbility: {
            method: 'OGT/Sonde',
            volumeCcPerFeeding: 10,
            frequencyPerDay: 8,
            notes: 'Pemberian ASI perah kolostrum bertahap.',
          },
          activeEquipment: isPreterm ? ['CPAP', 'Infus', 'Monitor TTV'] : ['Infus', 'Monitor TTV'],
          nakesNotes: 'Penerimaan awal pasien di ruang NICU RSUD Undata.',
          updatedBy: 'Ns. Hasni Hilipito, S.Kep',
          createdAt: `${birthDate}T10:00:00.000Z`,
        },
      ],
      ...(status === 'Sudah Pulang'
        ? {
            dischargeSummary: {
              dischargeDate: '2026-08-30',
              dischargeWeightGram: baseWeight + 450,
              dischargeNotes: 'Kondisi stabil, refleks hisap-telan baik, edukasi perawatan bayi di rumah telah tuntas.',
              doctorInCharge: 'dr. Spesialis Anak, Sp.A',
            },
            dischargedAt: '2026-08-30T10:00:00.000Z',
          }
        : {}),
      isActive: true,
      isDeleted: false,
    };

    list.push(p);
  }

  return list;
}
