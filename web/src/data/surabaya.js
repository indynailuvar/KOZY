// Data acuan wilayah + metadata tampilan.
// Angka harga TIDAK ada di sini: semuanya berasal dari hasil scraping di `pasar.json`
// (dibuat oleh scripts/build_pasar.py). Di sini hanya hal yang bukan hasil pengukuran harga:
// daftar titik penting kota dan label tampilan.
import kawasanData from './kawasan.json';
import pasar from './pasar.json';

export const PASAR = pasar;
export const MODEL = pasar.meta;
export const DATA_UPDATED = pasar.meta.diambil;

// Fasilitas yang ikut dihitung model. Papikost juga mencatat lemari, meja belajar,
// dan parkir, tetapi hampir semua iklannya punya itu sehingga pengaruhnya tidak bisa
// dipisahkan — datanya disimpan di `fasilitas_lain` untuk ditampilkan saja.
export const FASILITAS = [
  { id: 'km', label: 'KM Dalam', icon: 'bath' },
  { id: 'ac', label: 'AC', icon: 'snow' },
  { id: 'wifi', label: 'WiFi', icon: 'wifi' },
  { id: 'kasur', label: 'Kasur', icon: 'bed' },
  { id: 'kloset', label: 'Kloset Duduk', icon: 'toilet' },
  { id: 'akses24', label: 'Akses 24 Jam', icon: 'clock' },
];

export const JENIS_KOS = [
  { id: 'putra', label: 'Putra' },
  { id: 'putri', label: 'Putri' },
  { id: 'campur', label: 'Campur' },
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

  { id: 'rs-soetomo', nama: 'RSUD Dr. Soetomo', singkat: 'RS Soetomo', jenis: 'rs', lat: -7.2686, lng: 112.7583 },
  { id: 'rs-unair', nama: 'RS Universitas Airlangga', singkat: 'RS UNAIR', jenis: 'rs', lat: -7.2665, lng: 112.7815 },
  { id: 'rs-haji', nama: 'RS Haji Surabaya', singkat: 'RS Haji', jenis: 'rs', lat: -7.3118, lng: 112.7806 },
  { id: 'rs-ramelan', nama: 'RSAL Dr. Ramelan', singkat: 'RSAL', jenis: 'rs', lat: -7.3012, lng: 112.7418 },
  { id: 'rs-premier', nama: 'RS Premier Surabaya', singkat: 'RS Premier', jenis: 'rs', lat: -7.3155, lng: 112.7771 },

  { id: 'pasar-pucang', nama: 'Pasar Pucang Anom', singkat: 'Pasar Pucang', jenis: 'pasar', lat: -7.2828, lng: 112.7574 },
  { id: 'pasar-wonokromo', nama: 'Pasar Wonokromo', singkat: 'Pasar Wonokromo', jenis: 'pasar', lat: -7.3015, lng: 112.7364 },
  { id: 'pasar-keputran', nama: 'Pasar Keputran', singkat: 'Keputran', jenis: 'pasar', lat: -7.2759, lng: 112.7401 },
  { id: 'pasar-soponyono', nama: 'Pasar Soponyono Rungkut', singkat: 'Pasar Rungkut', jenis: 'pasar', lat: -7.3305, lng: 112.7826 },

  { id: 'st-gubeng', nama: 'Stasiun Gubeng', singkat: 'St. Gubeng', jenis: 'stasiun', lat: -7.2653, lng: 112.7524 },
  { id: 'st-wonokromo', nama: 'Stasiun Wonokromo', singkat: 'St. Wonokromo', jenis: 'stasiun', lat: -7.3018, lng: 112.7373 },

  { id: 'sma5', nama: 'SMAN 5 Surabaya', singkat: 'SMAN 5', jenis: 'sekolah', lat: -7.2637, lng: 112.7481 },
  { id: 'sma16', nama: 'SMAN 16 Surabaya', singkat: 'SMAN 16', jenis: 'sekolah', lat: -7.3247, lng: 112.7266 },
  { id: 'smk6', nama: 'SMKN 6 Surabaya', singkat: 'SMKN 6', jenis: 'sekolah', lat: -7.2905, lng: 112.7413 },

  { id: 'trans-merr', nama: 'Halte Suroboyo Bus MERR', singkat: 'Halte MERR', jenis: 'transportasi', lat: -7.2884, lng: 112.7825 },
  { id: 'trans-rajawali', nama: 'Terminal Bratang', singkat: 'Terminal Bratang', jenis: 'transportasi', lat: -7.2925, lng: 112.7597 },
  { id: 'trans-purabaya', nama: 'Terminal Purabaya', singkat: 'Purabaya', jenis: 'transportasi', lat: -7.3477, lng: 112.7238 },
];

// Kawasan = kelurahan tempat kos benar-benar terdata. Daftar ini TIDAK ditulis tangan:
// isinya dibuat scripts/build_kawasan.py dari koordinat kos yang sudah dikenali
// kelurahan + kecamatannya, dengan titik tengah = median koordinat kos di sana.
// `kec` menentukan data pasar mana yang dipakai (harga hanya terdata sampai kecamatan).
const KM_PER_DERAJAT_LAT = 111.32;
const KM_PER_DERAJAT_LNG = 110.57;
const jarakKm = (a, b) => Math.hypot((a.lat - b.lat) * KM_PER_DERAJAT_LAT, (a.lng - b.lng) * KM_PER_DERAJAT_LNG);

// `jarak` = jarak ke pusat aktivitas terdekat, dihitung dari koordinat, bukan ditaksir.
export const KAWASAN = kawasanData.kawasan.map((k) => ({
  ...k,
  jarak: Math.round(Math.min(...TEMPAT.map((t) => jarakKm(k, t))) * 10) / 10,
}));
export const KAWASAN_META = kawasanData.meta;

export const LUAR_CAKUPAN = ['sidoarjo', 'waru', 'gresik', 'driyorejo', 'taman', 'geluran', 'malang', 'bangkalan'];

export const BUDGET_RANGE = { min: 300_000, max: 5_000_000, step: 50_000 };

// Perkiraan biaya pasang fasilitas untuk simulasi pemilik kos (asumsi, bukan hasil scraping).
export const BIAYA_FASILITAS = { ac: 3_500_000, wifi: 600_000, km: 6_000_000, kasur: 1_800_000, kloset: 1_500_000, akses24: 1_200_000 };
