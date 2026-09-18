// Data acuan untuk pengembangan frontend. Di produksi, angka-angka ini datang dari API KOZY
// (hasil scraping iklan + model hedonic). Koordinat adalah perkiraan titik tengah / lokasi umum.

export const MODEL = { akurasi: 0.92, updated: '2026-09-12' };
export const DATA_UPDATED = MODEL.updated;

// harga = perkiraan kontribusi ke harga wajar (dipakai model, tidak ditampilkan per item ke penyewa)
export const FASILITAS = [
  { id: 'ac', label: 'AC', icon: 'snow', harga: 150_000 },
  { id: 'wifi', label: 'WiFi', icon: 'wifi', harga: 40_000 },
  { id: 'km', label: 'KM Dalam', icon: 'bath', harga: 120_000 },
  { id: 'parkir', label: 'Parkir', icon: 'park', harga: 15_000 },
  { id: 'lemari', label: 'Lemari', icon: 'door', harga: 20_000 },
  { id: 'laundry', label: 'Laundry', icon: 'shirt', harga: 60_000 },
  { id: 'dapur', label: 'Dapur', icon: 'utensils', harga: 40_000 },
  { id: 'belajar', label: 'Ruang Belajar', icon: 'book', harga: 25_000 },
];

export const JENIS_KOS = [
  { id: 'putra', label: 'Putra', harga: 0 },
  { id: 'putri', label: 'Putri', harga: 20_000 },
  { id: 'campur', label: 'Campur', harga: 30_000 },
  { id: 'syariah', label: 'Syariah', harga: 10_000 },
];

export const PERSONA = [
  { id: 'mahasiswa', label: 'Mahasiswa', icon: 'grad', dekat: ['kampus'] },
  { id: 'pekerja', label: 'Pekerja', icon: 'brief', dekat: ['kantor', 'transportasi'] },
  { id: 'nakes', label: 'Tenaga Kesehatan', icon: 'medical', dekat: ['rs'] },
  { id: 'guru', label: 'Guru', icon: 'book', dekat: ['sekolah'] },
  { id: 'lainnya', label: 'Lainnya', icon: 'dots', dekat: [] },
];

export const KEBUTUHAN = [
  { id: 'kampus', label: 'Kampus', icon: 'grad' },
  { id: 'kantor', label: 'Kantor', icon: 'building' },
  { id: 'rs', label: 'Rumah Sakit', icon: 'hospital' },
  { id: 'pasar', label: 'Pasar', icon: 'basket' },
  { id: 'stasiun', label: 'Stasiun', icon: 'train' },
  { id: 'sekolah', label: 'Sekolah', icon: 'school' },
  { id: 'transportasi', label: 'Transportasi Umum', icon: 'bus' },
];

// Titik penting (perkiraan lokasi)
export const TEMPAT = [
  { id: 'its', nama: 'ITS Sukolilo', singkat: 'ITS', jenis: 'kampus', lat: -7.2819, lng: 112.7953 },
  { id: 'pens', nama: 'PENS', singkat: 'PENS', jenis: 'kampus', lat: -7.2759, lng: 112.7937 },
  { id: 'unair-c', nama: 'UNAIR Kampus C', singkat: 'UNAIR C', jenis: 'kampus', lat: -7.2686, lng: 112.7843 },
  { id: 'unair-b', nama: 'UNAIR Kampus B', singkat: 'UNAIR B', jenis: 'kampus', lat: -7.2722, lng: 112.7585 },
  { id: 'unesa', nama: 'UNESA Ketintang', singkat: 'UNESA', jenis: 'kampus', lat: -7.3163, lng: 112.7258 },
  { id: 'ubaya', nama: 'UBAYA Tenggilis', singkat: 'UBAYA', jenis: 'kampus', lat: -7.32, lng: 112.768 },
  { id: 'upn', nama: 'UPN Veteran Jatim', singkat: 'UPN', jenis: 'kampus', lat: -7.3337, lng: 112.7883 },
  { id: 'uinsa', nama: 'UIN Sunan Ampel', singkat: 'UINSA', jenis: 'kampus', lat: -7.3228, lng: 112.7317 },
  { id: 'untag', nama: 'UNTAG Surabaya', singkat: 'UNTAG', jenis: 'kampus', lat: -7.298, lng: 112.7703 },

  { id: 'tunjungan', nama: 'Perkantoran Tunjungan', singkat: 'Tunjungan', jenis: 'kantor', lat: -7.2626, lng: 112.739 },
  { id: 'darmo-office', nama: 'Perkantoran Raya Darmo', singkat: 'Raya Darmo', jenis: 'kantor', lat: -7.2862, lng: 112.7375 },
  { id: 'sier', nama: 'Kawasan Industri SIER', singkat: 'SIER', jenis: 'kantor', lat: -7.3338, lng: 112.7555 },
  { id: 'merr-office', nama: 'Perkantoran MERR', singkat: 'MERR', jenis: 'kantor', lat: -7.2905, lng: 112.7825 },

  { id: 'rs-soetomo', nama: 'RSUD Dr. Soetomo', singkat: 'RSUD Soetomo', jenis: 'rs', lat: -7.2681, lng: 112.758 },
  { id: 'rs-unair', nama: 'RS Universitas Airlangga', singkat: 'RS UNAIR', jenis: 'rs', lat: -7.2708, lng: 112.7866 },
  { id: 'rs-haji', nama: 'RS Haji Surabaya', singkat: 'RS Haji', jenis: 'rs', lat: -7.2839, lng: 112.7811 },
  { id: 'rs-ramelan', nama: 'RSAL Dr. Ramelan', singkat: 'RSAL Ramelan', jenis: 'rs', lat: -7.3106, lng: 112.7383 },
  { id: 'rs-premier', nama: 'RS Premier Surabaya', singkat: 'RS Premier', jenis: 'rs', lat: -7.3002, lng: 112.7729 },

  { id: 'pasar-pucang', nama: 'Pasar Pucang Anom', singkat: 'Pasar Pucang', jenis: 'pasar', lat: -7.2877, lng: 112.7605 },
  { id: 'pasar-wonokromo', nama: 'Pasar Wonokromo', singkat: 'Pasar Wonokromo', jenis: 'pasar', lat: -7.3021, lng: 112.7381 },
  { id: 'pasar-genteng', nama: 'Pasar Genteng', singkat: 'Pasar Genteng', jenis: 'pasar', lat: -7.2587, lng: 112.7442 },
  { id: 'pasar-keputih', nama: 'Pasar di Keputih', singkat: 'pasar Keputih', jenis: 'pasar', lat: -7.2935, lng: 112.8021 },

  { id: 'st-gubeng', nama: 'Stasiun Gubeng', singkat: 'St. Gubeng', jenis: 'stasiun', lat: -7.2654, lng: 112.752 },
  { id: 'st-wonokromo', nama: 'Stasiun Wonokromo', singkat: 'St. Wonokromo', jenis: 'stasiun', lat: -7.303, lng: 112.7337 },
  { id: 'st-pasarturi', nama: 'Stasiun Pasar Turi', singkat: 'St. Pasar Turi', jenis: 'stasiun', lat: -7.2459, lng: 112.731 },

  { id: 'sman5', nama: 'SMAN 5 Surabaya', singkat: 'SMAN 5', jenis: 'sekolah', lat: -7.2657, lng: 112.7449 },
  { id: 'sman6', nama: 'SMAN 6 Surabaya', singkat: 'SMAN 6', jenis: 'sekolah', lat: -7.2605, lng: 112.7478 },
  { id: 'sekolah-mulyorejo', nama: 'Sekolah di Mulyorejo', singkat: 'sekolah Mulyorejo', jenis: 'sekolah', lat: -7.2655, lng: 112.7905 },
  { id: 'sekolah-ketintang', nama: 'Sekolah di Ketintang', singkat: 'sekolah Ketintang', jenis: 'sekolah', lat: -7.314, lng: 112.73 },

  { id: 'joyoboyo', nama: 'Terminal Intermoda Joyoboyo', singkat: 'Terminal Joyoboyo', jenis: 'transportasi', lat: -7.299, lng: 112.7366 },
  { id: 'bratang', nama: 'Terminal Bratang', singkat: 'Terminal Bratang', jenis: 'transportasi', lat: -7.298, lng: 112.7581 },
  { id: 'halte-merr', nama: 'Halte Suroboyo Bus MERR', singkat: 'Halte MERR', jenis: 'transportasi', lat: -7.2878, lng: 112.7818 },
];

// base = harga dasar kawasan (kamar polos), n = kos pembanding, jarak = ke pusat aktivitas terdekat (km)
// aman = 1–5, komposisi = % tipe kos di kawasan, aksesibel = jumlah kos dengan akses disabilitas
export const KAWASAN = [
  { id: 'keputih', nama: 'Keputih', kec: 'Sukolilo', base: 610_000, n: 28, jarak: 0.65, lat: -7.2922, lng: 112.8003, aman: 4, komposisi: { putra: 40, putri: 35, campur: 20, syariah: 5 }, aksesibel: 3 },
  { id: 'gebang', nama: 'Gebang Putih', kec: 'Sukolilo', base: 580_000, n: 24, jarak: 1.2, lat: -7.2838, lng: 112.7878, aman: 4, komposisi: { putra: 35, putri: 40, campur: 20, syariah: 5 }, aksesibel: 2 },
  { id: 'semolowaru', nama: 'Semolowaru', kec: 'Sukolilo', base: 540_000, n: 17, jarak: 2.8, lat: -7.2985, lng: 112.7765, aman: 3, komposisi: { putra: 40, putri: 30, campur: 25, syariah: 5 }, aksesibel: 1 },
  { id: 'mulyorejo', nama: 'Mulyorejo', kec: 'Mulyorejo', base: 820_000, n: 31, jarak: 2.4, lat: -7.2632, lng: 112.7872, aman: 5, komposisi: { putra: 30, putri: 40, campur: 25, syariah: 5 }, aksesibel: 4 },
  { id: 'klampis', nama: 'Klampis Ngasem', kec: 'Sukolilo', base: 860_000, n: 19, jarak: 3.1, lat: -7.2905, lng: 112.7702, aman: 4, komposisi: { putra: 30, putri: 35, campur: 30, syariah: 5 }, aksesibel: 2 },
  { id: 'menur', nama: 'Menur Pumpungan', kec: 'Sukolilo', base: 830_000, n: 16, jarak: 3.5, lat: -7.2968, lng: 112.7668, aman: 4, komposisi: { putra: 35, putri: 35, campur: 25, syariah: 5 }, aksesibel: 1 },
  { id: 'nginden', nama: 'Nginden Jangkungan', kec: 'Sukolilo', base: 620_000, n: 22, jarak: 1.3, lat: -7.3002, lng: 112.769, aman: 4, komposisi: { putra: 35, putri: 35, campur: 25, syariah: 5 }, aksesibel: 2 },
  { id: 'airlangga', nama: 'Airlangga', kec: 'Gubeng', base: 680_000, n: 26, jarak: 0.7, lat: -7.2695, lng: 112.7562, aman: 4, komposisi: { putra: 35, putri: 40, campur: 20, syariah: 5 }, aksesibel: 3 },
  { id: 'dharmawangsa', nama: 'Dharmawangsa', kec: 'Gubeng', base: 720_000, n: 22, jarak: 0.9, lat: -7.2768, lng: 112.7563, aman: 5, komposisi: { putra: 30, putri: 45, campur: 20, syariah: 5 }, aksesibel: 2 },
  { id: 'pucang', nama: 'Pucang Sewu', kec: 'Gubeng', base: 640_000, n: 25, jarak: 1.0, lat: -7.289, lng: 112.7585, aman: 4, komposisi: { putra: 35, putri: 35, campur: 25, syariah: 5 }, aksesibel: 3 },
  { id: 'gubeng', nama: 'Gubeng', kec: 'Gubeng', base: 750_000, n: 42, jarak: 1.4, lat: -7.2752, lng: 112.7478, aman: 4, komposisi: { putra: 35, putri: 30, campur: 30, syariah: 5 }, aksesibel: 5 },
  { id: 'tegalsari', nama: 'Tegalsari', kec: 'Tegalsari', base: 780_000, n: 27, jarak: 0.9, lat: -7.2688, lng: 112.7352, aman: 4, komposisi: { putra: 30, putri: 30, campur: 35, syariah: 5 }, aksesibel: 3 },
  { id: 'darmo', nama: 'Darmo', kec: 'Wonokromo', base: 700_000, n: 24, jarak: 1.2, lat: -7.289, lng: 112.7385, aman: 5, komposisi: { putra: 30, putri: 35, campur: 30, syariah: 5 }, aksesibel: 3 },
  { id: 'wonokromo', nama: 'Wonokromo', kec: 'Wonokromo', base: 480_000, n: 21, jarak: 1.8, lat: -7.3005, lng: 112.7352, aman: 3, komposisi: { putra: 45, putri: 25, campur: 25, syariah: 5 }, aksesibel: 2 },
  { id: 'ketintang', nama: 'Ketintang', kec: 'Gayungan', base: 520_000, n: 30, jarak: 0.6, lat: -7.3142, lng: 112.7282, aman: 3, komposisi: { putra: 40, putri: 35, campur: 15, syariah: 10 }, aksesibel: 2 },
  { id: 'jemursari', nama: 'Jemursari', kec: 'Wonocolo', base: 560_000, n: 18, jarak: 1.6, lat: -7.3238, lng: 112.7438, aman: 4, komposisi: { putra: 30, putri: 35, campur: 15, syariah: 20 }, aksesibel: 1 },
  { id: 'tenggilis', nama: 'Tenggilis Mejoyo', kec: 'Tenggilis Mejoyo', base: 540_000, n: 20, jarak: 0.8, lat: -7.3186, lng: 112.7648, aman: 4, komposisi: { putra: 35, putri: 35, campur: 25, syariah: 5 }, aksesibel: 2 },
  { id: 'rungkut', nama: 'Rungkut', kec: 'Rungkut', base: 500_000, n: 23, jarak: 1.1, lat: -7.3278, lng: 112.7792, aman: 3, komposisi: { putra: 45, putri: 25, campur: 25, syariah: 5 }, aksesibel: 2 },
  { id: 'lakarsantri', nama: 'Lakarsantri', kec: 'Lakarsantri', base: 430_000, n: 13, jarak: 1.9, lat: -7.3218, lng: 112.6498, aman: 3, komposisi: { putra: 40, putri: 30, campur: 25, syariah: 5 }, aksesibel: 0 },
  { id: 'benowo', nama: 'Benowo', kec: 'Benowo', base: 400_000, n: 11, jarak: 2.2, lat: -7.2392, lng: 112.6302, aman: 3, komposisi: { putra: 45, putri: 25, campur: 25, syariah: 5 }, aksesibel: 0 },
  { id: 'pakal', nama: 'Pakal', kec: 'Pakal', base: 380_000, n: 9, jarak: 2.6, lat: -7.2331, lng: 112.6148, aman: 3, komposisi: { putra: 45, putri: 25, campur: 25, syariah: 5 }, aksesibel: 0 },
];

// Di luar cakupan (masuk daftar tunggu)
export const LUAR_CAKUPAN = ['sidoarjo', 'waru', 'gresik', 'driyorejo', 'taman', 'malang', 'bangkalan'];

export const BUDGET_RANGE = { min: 300_000, max: 3_000_000, step: 50_000 };

// Perkiraan biaya pasang fasilitas (simulator pemilik)
export const BIAYA_FASILITAS = { ac: 3_500_000, wifi: 600_000, km: 6_000_000, parkir: 1_500_000, lemari: 700_000, laundry: 2_500_000, dapur: 2_000_000, belajar: 800_000 };

export const FITUR_AKSES = ['Kamar di lantai dasar', 'Pintu lebar untuk kursi roda', 'Kamar mandi dengan pegangan', 'Jalan masuk landai'];

export const NAMA_KOS = ['Kos Melati', 'Kos Cemara', 'Kos Salsabila', 'Kos Harmoni', 'Kos Kenanga', 'Kos Anggrek', 'Kos Flamboyan', 'Kos Teratai', 'Kos Bougenville', 'Kos Seruni'];
