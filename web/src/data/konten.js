// Katalog barang untuk fitur "Upgrade kamar".
// Di produksi, daftar ini diganti hasil pipeline scraping marketplace (Shopee) dengan bentuk:
// { id, nama, kategori, harga, rating, terjual, image_url, url }.
// Tanpa image_url, kartu memakai ilustrasi kategori; tanpa url, tautan menuju hasil pencarian Shopee.
export const PRODUK = [
  { id: 'kipas-berdiri', grup: 'kipas', nama: 'Kipas angin berdiri 16 inci', kategori: 'kipas', harga: 185_000, rating: 4.8, terjual: '10rb+', keyword: 'kipas angin berdiri 16 inch', gantikan: 'ac', prioritas: 9 },
  { id: 'kipas-mini', grup: 'kipas', nama: 'Kipas meja mini USB', kategori: 'kipas', harga: 45_000, rating: 4.7, terjual: '25rb+', keyword: 'kipas meja mini usb', gantikan: 'ac', prioritas: 6 },
  { id: 'rak-baju', grup: 'lemari', nama: 'Rak gantungan baju portable', kategori: 'rak', harga: 89_000, rating: 4.8, terjual: '15rb+', keyword: 'rak gantungan baju portable', gantikan: 'lemari', prioritas: 8 },
  { id: 'lemari-plastik', grup: 'lemari', nama: 'Lemari plastik 4 susun', kategori: 'lemari', harga: 245_000, rating: 4.7, terjual: '5rb+', keyword: 'lemari plastik 4 susun', gantikan: 'lemari', prioritas: 8 },
  { id: 'meja-lipat', nama: 'Meja lipat laptop', kategori: 'meja', harga: 75_000, rating: 4.8, terjual: '30rb+', keyword: 'meja lipat laptop', gantikan: 'belajar', prioritas: 8 },
  { id: 'lampu-belajar', grup: 'lampu', nama: 'Lampu belajar LED', kategori: 'lampu', harga: 49_000, rating: 4.8, terjual: '20rb+', keyword: 'lampu belajar led', gantikan: 'belajar', prioritas: 7 },
  { id: 'rice-cooker', nama: 'Rice cooker mini 0,6 L', kategori: 'masak', harga: 135_000, rating: 4.7, terjual: '8rb+', keyword: 'rice cooker mini', gantikan: 'dapur', prioritas: 7 },
  { id: 'jemuran', nama: 'Jemuran baju lipat', kategori: 'jemuran', harga: 79_000, rating: 4.7, terjual: '12rb+', keyword: 'jemuran baju lipat', gantikan: 'laundry', prioritas: 6 },
  { id: 'karpet', nama: 'Karpet bulu 100×150 cm', kategori: 'karpet', harga: 65_000, rating: 4.8, terjual: '18rb+', keyword: 'karpet bulu 100x150', prioritas: 5 },
  { id: 'cermin', nama: 'Cermin berdiri full body', kategori: 'cermin', harga: 99_000, rating: 4.8, terjual: '9rb+', keyword: 'cermin berdiri full body', prioritas: 4 },
  { id: 'rak-sepatu', nama: 'Rak sepatu 4 susun', kategori: 'rak', harga: 55_000, rating: 4.7, terjual: '14rb+', keyword: 'rak sepatu 4 susun', prioritas: 4 },
  { id: 'tirai', nama: 'Tirai jendela blackout', kategori: 'tirai', harga: 59_000, rating: 4.7, terjual: '7rb+', keyword: 'tirai jendela blackout', prioritas: 4 },
  { id: 'lampu-tidur', grup: 'lampu', nama: 'Lampu tidur LED sensor', kategori: 'lampu', harga: 25_000, rating: 4.7, terjual: '20rb+', keyword: 'lampu tidur led sensor', prioritas: 3 },
  { id: 'topper', nama: 'Kasur lantai (topper) 90×200', kategori: 'kasur', harga: 199_000, rating: 4.8, terjual: '6rb+', keyword: 'topper kasur 90x200', prioritas: 5 },
  { id: 'stop-kontak', nama: 'Stop kontak 4 lubang + USB', kategori: 'listrik', harga: 65_000, rating: 4.8, terjual: '11rb+', keyword: 'stop kontak usb 4 lubang', prioritas: 5 },
  { id: 'hanger-dinding', nama: 'Gantungan dinding tanpa bor (isi 6)', kategori: 'gantungan', harga: 29_000, rating: 4.7, terjual: '16rb+', keyword: 'gantungan dinding tanpa bor', prioritas: 3 },
];

export const urlProduk = (p) => p.url || `https://shopee.co.id/search?keyword=${encodeURIComponent(p.keyword)}`;

// Materi edukasi keuangan
export const TIPS = [
  {
    id: 'tanggal-tua',
    judul: 'Bertahan di tanggal tua',
    ringkas: 'Supaya uang tetap cukup sampai akhir bulan.',
    icon: 'cal',
    tag: ['tanggal tua', 'hemat', 'akhir bulan', 'bokek'],
    poin: [
      'Bayar kos dan kebutuhan wajib di awal bulan, baru sisanya untuk jajan.',
      'Bagi uang jajan per minggu, bukan per bulan — lebih mudah dikontrol.',
      'Masak nasi sendiri dan beli lauk saja; bisa hemat Rp 10.000–15.000 per hari.',
      'Sisihkan Rp 5.000 per hari di awal bulan sebagai cadangan tanggal tua.',
      'Hindari paylater untuk belanja yang tidak mendesak.',
    ],
  },
  {
    id: 'aturan-30',
    judul: 'Berapa biaya kos yang ideal?',
    ringkas: 'Patokan: maksimal 30% dari penghasilan atau uang saku.',
    icon: 'wallet',
    tag: ['budget', 'ideal', 'gaji', 'uang saku', 'penghasilan', 'atur uang'],
    poin: [
      'Kos (termasuk listrik & air) idealnya maksimal 30% dari penghasilan bulanan.',
      'Makan dan kebutuhan harian sekitar 40%.',
      'Transportasi, pulsa, dan lainnya sekitar 15%.',
      'Tabungan dan dana darurat minimal 15%.',
    ],
  },
  {
    id: 'dana-darurat',
    judul: 'Dana darurat anak kos',
    ringkas: 'Jaga-jaga kalau sakit, laptop rusak, atau telat kiriman.',
    icon: 'shieldc',
    tag: ['darurat', 'tabungan', 'nabung'],
    poin: [
      'Targetkan dana darurat setara 3 kali biaya hidup bulanan.',
      'Simpan di rekening terpisah supaya tidak terpakai jajan.',
      'Mulai dari kecil: Rp 100.000 per bulan tetap berarti.',
      'Isi ulang segera setelah dana darurat terpakai.',
    ],
  },
  {
    id: 'hemat-listrik',
    judul: 'Hemat listrik & air di kos',
    ringkas: 'Penting kalau token listrik ditanggung sendiri.',
    icon: 'bulb',
    tag: ['listrik', 'air', 'token', 'ac'],
    poin: [
      'Atur AC di 25–26°C dan pakai mode timer saat tidur.',
      'Cabut charger dan perangkat yang tidak dipakai.',
      'Pakai lampu LED; jemur pakaian di luar alih-alih pengering.',
      'Tanyakan ke pemilik apakah listrik sudah termasuk harga sewa.',
    ],
  },
  {
    id: 'nego-kos',
    judul: 'Cara nego harga kos',
    ringkas: 'Nego dengan data, bukan perasaan.',
    icon: 'file',
    tag: ['nego', 'tawar', 'murah'],
    poin: [
      'Bawa data harga wajar — Kartu Tawar KOZY bisa langsung ditunjukkan.',
      'Tawarkan bayar beberapa bulan di muka sebagai ganti potongan harga.',
      'Tanyakan biaya tambahan (listrik, air, parkir) sebelum sepakat.',
      'Minta kesepakatan tertulis, termasuk aturan uang jaminan.',
    ],
  },
  {
    id: 'belanja-cerdas',
    judul: 'Belanja bulanan cerdas',
    ringkas: 'Kebutuhan kamar tanpa bikin dompet jebol.',
    icon: 'basket',
    tag: ['belanja', 'perabot', 'barang', 'diskon'],
    poin: [
      'Tulis daftar belanja dan patok total sebelum membuka marketplace.',
      'Bandingkan harga per satuan, bukan harga per paket.',
      'Beli barang serbaguna: meja lipat bisa untuk makan dan belajar.',
      'Manfaatkan tanggal kembar hanya untuk barang yang sudah direncanakan.',
    ],
  },
];
