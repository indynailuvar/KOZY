// Data untuk dashboard pemilik kos (B2B).
//
// Dua pertanyaan yang ingin dijawab pemilik:
//   1. "Siapa yang mencari kos di daerah saya?"  -> dari jejak aktivitas pengguna
//   2. "Saya bersaing dengan siapa?"             -> dari iklan kos sekecamatan
//
// Yang kedua datanya sudah lengkap sekarang. Yang pertama baru terisi begitu
// ada orang memakai aplikasinya — sampai itu terjadi, angkanya nol dan harus
// ditandai "belum ada isinya", bukan ditampilkan seolah fakta.
//
// CATATAN PENTING soal umur, gaji, dan jumlah kendaraan: ketiganya TIDAK pernah
// dikumpulkan aplikasi ini, jadi tidak bisa ditampilkan. Yang tersedia sebagai
// gambaran kalangan pencari adalah persona (mahasiswa / pekerja / tenaga
// kesehatan / guru), budget yang mereka pasang, tujuan terdekat, dan jenis kos
// yang dicari. Semuanya terekam saat pengguna menyelesaikan pencarian.
import { FASILITAS, JENIS_KOS, PERSONA } from '../data/surabaya.js';
import { GMAPS, kosKec, statKec } from './kozy.js';
import { hitungPer, semua } from '../lib/jejak.js';

const persen = (v, q) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.max(0, Math.min(s.length - 1, Math.round((q / 100) * (s.length - 1))))] : 0;
};

// ────────────────────────────────────────────── 1. Persaingan di sekitar
export function persaingan(kec, jenis = null) {
  const stat = statKec(kec);
  if (!stat) return null;
  const kos = kosKec(kec);
  const harga = kos.map((k) => k.harga);
  const titikGmaps = GMAPS.kos.filter((g) => g.kec === kec).length;

  // Pesaing paling langsung adalah kos dengan jenis yang sama. Fasilitasnya
  // sengaja TIDAK ikut menyaring: tidak ada satu pun kos di data ini yang
  // fasilitasnya persis sama dengan sebuah tipe kamar, dan saringan "minimal
  // selengkap punyamu" justru menyisakan kos yang jauh lebih lengkap sehingga
  // harganya memang pantas lebih mahal. Fasilitas juga tidak dipakai menghitung
  // posisi harga di tempat lain: di iklan ia hanya tercatat ada/tidak.
  // kuartilnya diambil dari benchmark pasar.json supaya sama persis dengan Cek Harga
  const sejenis = jenis ? stat.benchmark[jenis] : stat.benchmark.semua;

  return {
    kec,
    n: stat.n,
    titikGmaps,
    total: stat.n + titikGmaps,
    harga: { p10: stat.p10, p25: stat.p25, p50: stat.p50, p75: stat.p75, p90: stat.p90 },
    sebaranHarga: harga,
    komposisi: stat.komposisi,
    fasilitas: stat.fasilitas,
    keyakinan: stat.keyakinan,
    sumber: stat.sumber,
    jenis,
    nSejenis: sejenis?.n ?? 0,
    hargaSejenis: sejenis ? { p25: sejenis.q1, p50: sejenis.median, p75: sejenis.q3 } : null,
  };
}

// fasilitas yang dimiliki mayoritas pesaing tetapi belum ada di tipe kamar pemilik
export function fasilitasTertinggal(kec, tipe = [], ambang = 50) {
  const stat = statKec(kec);
  if (!stat || !tipe.length) return [];
  const punyaSemua = FASILITAS.filter((f) => tipe.every((t) => t.fasilitas.includes(f.id))).map((f) => f.id);
  return FASILITAS.filter((f) => !punyaSemua.includes(f.id) && stat.fasilitas[f.id] >= ambang)
    .map((f) => ({ id: f.id, label: f.label, icon: f.icon, pasar: stat.fasilitas[f.id] }))
    .sort((a, b) => b.pasar - a.pasar);
}

// ────────────────────────────────────────────── 2. Siapa yang mencari
export function pencari(kec = null) {
  const jejak = semua();
  const cari = jejak.filter((k) => k.jenis === 'cari_selesai');
  const cek = jejak.filter((k) => k.jenis === 'cek_selesai' && (!kec || k.kec === kec));
  const area = jejak.filter((k) => (k.jenis === 'area_dipilih' || k.jenis === 'cek_selesai') && (!kec || k.kec === kec));

  const budget = cari.map((k) => k.budget).filter((x) => typeof x === 'number');
  const labelPersona = Object.fromEntries(PERSONA.map((p) => [p.id, p.label]));
  const labelJenis = Object.fromEntries(JENIS_KOS.map((j) => [j.id, j.label]));

  return {
    nPencarian: cari.length,
    nCek: cek.length,
    nMinatArea: area.length,
    persona: hitungPer(cari, 'cari_selesai', 'persona').map((x) => ({ ...x, label: labelPersona[x.label] || x.label })),
    tujuan: hitungPer(cari, 'cari_selesai', 'tujuan'),
    jenisDicari: hitungPer(cari, 'cari_selesai', 'tipe').map((x) => ({ ...x, label: labelJenis[x.label] || x.label })),
    butuhAkses: cari.filter((k) => k.disabilitas).length,
    budget: budget.length ? { n: budget.length, p25: persen(budget, 25), p50: persen(budget, 50), p75: persen(budget, 75) } : null,
    vonis: hitungPer(cek, 'cek_selesai', 'status'),
    kosong: cari.length === 0 && cek.length === 0,
  };
}

// ────────────────────────────────────────────── 3. Saran penargetan
// `semua` adalah tiap tipe kamar lengkap dengan hasil analisisPemilik-nya,
// supaya saran harga memakai pembanding yang sama dengan sisa dashboard.
export function saranTarget(kec, tipe = [], jenis = null, semua = []) {
  const p = persaingan(kec, jenis);
  if (!p) return [];
  const u = pencari(kec);
  const saran = [];

  const dominan = Object.entries(p.komposisi).sort((a, b) => b[1] - a[1])[0];
  if (dominan && dominan[1] >= 50) {
    saran.push({
      icon: 'users',
      judul: `${dominan[1]}% kos di sini kos ${dominan[0]}`,
      isi: jenis === dominan[0] ? 'Pesaingmu banyak, jadi harga dan fasilitas paling menentukan.' : 'Jenis kosmu jarang di sini. Ini bisa jadi keunggulan.',
    });
  }

  // tipe yang harganya di bawah kuartil 1 pesaingnya: ruang naik yang belum
  // diambil, dan itu kebalikan dari peringatan kemahalan di lembar awal
  const murah = semua.filter((x) => x.a?.status === 'MURAH').sort((x, y) => x.a.selisih_persen - y.a.selisih_persen);
  if (murah.length) {
    const m = murah[0];
    saran.push({
      icon: 'trendup',
      judul: `Harga ${m.nama} masih bisa naik`,
      isi: `Kisaran wajarnya ${Math.round(m.a.kisaran[0] / 1000)}–${Math.round(m.a.kisaran[1] / 1000)} rb per bulan.`,
    });
  }

  if (u.butuhAkses > 0) {
    saran.push({ icon: 'access', judul: `${u.butuhAkses} pencari butuh akses kursi roda`, isi: 'Kos yang menyediakannya masih jarang.' });
  }
  return saran;
}
