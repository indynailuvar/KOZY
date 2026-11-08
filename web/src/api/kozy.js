// Lapisan data KOZY.
// Empat sumber, dengan peran yang berbeda-beda:
//   pasar.json  Mamikos + Papikost — iklan SEWA berharga asli, dasar pembanding harga
//   gmaps.json  Google Maps        — titik lokasi tanpa harga, ditampilkan dengan kisaran kecamatan
//   olx.json    OLX                — rumah kos DIJUAL, hanya untuk dashboard admin,
//                                    sengaja TIDAK ikut pembanding harga sewa
// Kewajaran harga dinilai dengan Robust Statistical Benchmarking, tanpa regresi:
// harga dibandingkan dengan median dan Q1–Q3 kos sejenis di kecamatan yang sama.
// Luas kamar dan nomor pemilik tidak ada di sumber mana pun.
//
// Semuanya dihitung di perangkat dari pasar.json. Kuartilnya dihitung dengan cara
// yang sama seperti bundle modeling, jadi angkanya identik dengan POST /modeling/price-gap.

import gmaps from '../data/gmaps.json';
import olx from '../data/olx.json';
import { FASILITAS, JENIS_KOS, KAWASAN, KEBUTUHAN, LUAR_CAKUPAN, PASAR, PERSONA, TEMPAT } from '../data/surabaya.js';
import { bulat50rb } from '../lib/format.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

export const kawasanById = (id) => KAWASAN.find((k) => k.id === id);
export const tempatById = (id) => TEMPAT.find((t) => t.id === id);
export const fasilitasById = (id) => FASILITAS.find((f) => f.id === id);
export const jenisById = (id) => JENIS_KOS.find((j) => j.id === id);
export const personaById = (id) => PERSONA.find((p) => p.id === id);
export const kebutuhanById = (id) => KEBUTUHAN.find((k) => k.id === id);
export const labelFasilitas = (ids = []) => ids.map((id) => fasilitasById(id)?.label).filter(Boolean);

// ---------- Cakupan data ----------
export const statKec = (kec) => PASAR.kecamatan[kec] || null;
export const tercakup = (kawasan) => !!(kawasan && statKec(kawasan.kec));
export const KAWASAN_TERCAKUP = KAWASAN.filter(tercakup);
export const kosKec = (kec) => PASAR.kos.filter((k) => k.kec === kec);

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
export const isLink = (s) => /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.)/i.test(s.trim());

export function haversine(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// perkiraan jarak tempuh jalan
const jarakJalan = (a, b) => haversine(a, b) * 1.25;

// ---------- Lokasi ----------
export function saranLokasi(q) {
  const n = norm(q);
  if (n.length < 2 || isLink(q)) return [];
  return KAWASAN.filter((k) => norm(k.nama).includes(n) || norm(k.kec).includes(n))
    .slice(0, 5)
    .map((k) => ({ id: k.id, label: k.nama, sub: tercakup(k) ? `Kec. ${k.kec}` : `Kec. ${k.kec} · belum ada data` }));
}

export function kenaliLokasi(text) {
  const raw = (text || '').trim();
  if (!raw) return { status: 'kosong' };
  const link = isLink(raw);
  const n = norm(link ? decodeURIComponent(raw) : raw);
  const hit = KAWASAN.find((k) => n.includes(norm(k.nama))) || (!link && KAWASAN.find((k) => norm(k.kec) === n));
  if (hit) return { status: tercakup(hit) ? 'ok' : 'belum-data', kawasan: hit, nama: hit.nama, sumber: link ? 'link' : 'teks' };
  const luar = LUAR_CAKUPAN.find((l) => n.includes(l));
  if (luar) return { status: 'luar', nama: luar.replace(/\b\w/g, (c) => c.toUpperCase()) };
  if (link) {
    // Tanpa backend: link pendek tidak memuat nama kawasan -> dipetakan secara deterministik
    // ke kawasan yang datanya ada.
    const pool = KAWASAN_TERCAKUP;
    return { status: 'ok', kawasan: pool[hashStr(raw) % pool.length], sumber: 'link' };
  }
  return { status: 'tidak-dikenal', nama: raw };
}

const saranTempat = (t) => ({ id: t.id, label: t.nama, sub: kebutuhanById(t.jenis).label, icon: kebutuhanById(t.jenis).icon });

export function saranTujuan(q, dekat = []) {
  const n = norm(q || '');
  if (!n) {
    const jenis = dekat.length ? dekat : ['kampus'];
    return TEMPAT.filter((t) => jenis.includes(t.jenis)).slice(0, 6).map(saranTempat);
  }
  const tempat = TEMPAT.filter((t) => norm(t.nama).includes(n) || norm(t.singkat).includes(n)).map(saranTempat);
  const kaw = KAWASAN_TERCAKUP.filter((k) => norm(k.nama).includes(n)).map((k) => ({ id: `kw:${k.id}`, label: k.nama, sub: `Kawasan · Kec. ${k.kec}`, icon: 'pin' }));
  return [...tempat, ...kaw].slice(0, 6);
}

export function tujuanById(id) {
  if (!id) return null;
  if (id.startsWith('kw:')) {
    const k = kawasanById(id.slice(3));
    return k ? { id, nama: `Kawasan ${k.nama}`, singkat: k.nama, jenis: 'kawasan', lat: k.lat, lng: k.lng } : null;
  }
  return tempatById(id) || null;
}

// ---------- Titik kos dari Google Maps ----------
// Sumber ini punya koordinat dan (sebagian) rating, tapi harga dan fasilitasnya kosong.
// Halaman Google Maps-nya pun tidak memuat fasilitas kos, jadi tidak bisa dilengkapi.
// Angka harganya median dan Q1–Q3 harga iklan kos sejenis di kecamatan itu
// (lihat scripts/build_gmaps.py) — jadi sesama kos di satu kecamatan angkanya sama.
export const GMAPS = gmaps;

// ---------- Rumah kos dijual (OLX) ----------
// BUKAN harga sewa: ini harga jual bangunan, miliaran rupiah. Tidak pernah dipakai
// untuk menilai harga sewa penyewa. Yang dihitung dari median sewa kecamatan hanyalah
// perkiraan pendapatan bangunannya, untuk sisi pemilik/investor di dashboard admin.
export const OLX = olx;

export function kosPetaDekat(titik, radiusKm = 1.5, batas = 6) {
  if (!titik) return [];
  return gmaps.kos
    .filter((k) => !k.harga_asli) // kos yang sudah punya harga asli ditampilkan lewat daftar iklan, jangan dua kali
    .map((k) => ({ ...k, jarak: jarakJalan(titik, k) }))
    .filter((k) => k.jarak <= radiusKm)
    .sort((a, b) => a.jarak - b.jarak)
    .slice(0, batas);
}

// ---------- Pembanding harga (Robust Statistical Benchmarking) ----------
// Harga dinilai terhadap sebaran harga iklan asli yang sebanding: kos sejenis
// (putra/putri/campur) di kecamatan yang sama. Kalau kelompok itu belum sampai
// MIN_PEMBANDING iklan, pembandingnya seluruh kos di kecamatan tersebut.
//   acuan          median
//   kisaran wajar  Q1 – Q3, separuh tengah harga pembanding
//   gap            (harga − median) / IQR
// Fasilitas tidak ikut menghitung: di iklan ia hanya tercatat ada/tidak dan
// sering tidak ditulis pemiliknya, jadi "tidak ada" belum tentu benar-benar tidak ada.
export const MIN_PEMBANDING = PASAR.meta.min_pembanding;

// Kuantil dengan interpolasi linear, sama seperti build_pasar.py dan bundle modeling.
function kuantil(urut, q) {
  const p = (urut.length - 1) * q;
  const lo = Math.floor(p);
  return urut[lo] + (urut[Math.ceil(p)] - urut[lo]) * (p - lo);
}

// Harga pasaran tiap kecamatan untuk daftar di beranda. Hanya kecamatan dengan
// iklan yang cukup (>= MIN_PEMBANDING); median dari 2-3 iklan bisa menyesatkan.
export const PASAR_KEC = Object.entries(PASAR.kecamatan)
  .map(([kec, s]) => ({ kec, ...s.benchmark.semua }))
  .filter((x) => x.n >= MIN_PEMBANDING)
  .sort((a, b) => b.n - a.n);

// Ringkasan semua iklan sewa di Surabaya, untuk angka pembuka di beranda.
// Bukan dasar penilaian: vonis tetap per kecamatan × jenis kos.
export const RINGKAS_KOTA = (() => {
  const h = PASAR.kos.map((k) => k.harga).sort((a, b) => a - b);
  return {
    n: h.length,
    median: kuantil(h, 0.5),
    q1: kuantil(h, 0.25),
    q3: kuantil(h, 0.75),
    kecamatan: PASAR.meta.kecamatan,
    diambil: PASAR.meta.diambil,
  };
})();

export function pembanding(kec, jenis = null) {
  const s = statKec(kec);
  if (!s) return null;
  const sejenis = jenis ? s.benchmark[jenis] : null;
  const pakaiJenis = !!sejenis && sejenis.n >= MIN_PEMBANDING;
  return { ...(pakaiJenis ? sejenis : s.benchmark.semua), kec, jenis: pakaiJenis ? jenis : null, n_sejenis: sejenis?.n ?? 0 };
}

const hargaPembanding = (b) => kosKec(b.kec).filter((k) => !b.jenis || k.jenis === b.jenis).map((k) => k.harga);

// Posisi harga di antara harga pembanding: berapa dari 100 yang lebih murah.
function persentilDi(harga, hs) {
  if (!hs.length) return 50;
  const lebihMurah = hs.filter((h) => h < harga).length;
  return Math.max(1, Math.min(99, Math.round((lebihMurah / hs.length) * 100)));
}

// Di atas Q3 berarti lebih mahal dari tiga perempat kos pembanding; di bawah Q1
// lebih murah dari tiga perempatnya. Di antara keduanya: separuh tengah pasar.
export const statusDari = (harga, b) => (harga > b.q3 ? 'KEMAHALAN' : harga < b.q1 ? 'MURAH' : 'WAJAR');

export function nilaiHarga(harga, b) {
  const selisih_rp = harga - b.median;
  const hs = hargaPembanding(b);
  // di luar pagar Tukey (1,5 × IQR dari kuartil) atau di luar semua harga pembanding
  const ekstrem = harga > b.q3 + 1.5 * b.iqr || harga > b.max ? 'atas' : harga < b.q1 - 1.5 * b.iqr || harga < b.min ? 'bawah' : null;
  return {
    status: statusDari(harga, b),
    median: b.median,
    kisaran: [b.q1, b.q3],
    selisih_rp,
    selisih_persen: (selisih_rp / b.median) * 100,
    gap_iqr: b.iqr ? selisih_rp / b.iqr : null,
    persentil: persentilDi(harga, hs),
    // hitungan mentah untuk ditampilkan apa adanya ("54 dari 76 kos"), lebih jujur
    // daripada persen kalau pembandingnya sedikit
    n_lebih_murah: hs.filter((h) => h < harga).length,
    n_lebih_mahal: hs.filter((h) => h > harga).length,
    ekstrem,
  };
}

// Harga jauh di bawah pasaran tetap kabar baik (hemat), tetapi kalau sampai lebih
// murah dari semua pembanding, layak dipastikan dulu: fasilitas sesuai iklan,
// tidak ada biaya tersembunyi.
export const perluDiperiksa = (r) => r.ekstrem === 'bawah';

// n >= MIN_PEMBANDING sama dengan kelompok "Prioritas" di bundle modeling
const confidenceDari = (n) => (n >= 30 ? 'tinggi' : n >= MIN_PEMBANDING ? 'sedang' : 'rendah');

// ---------- Cek kos incaran ----------
export const LANGKAH_CEK = ['Mengenali lokasi', 'Mencari kos sejenis di sekitar', 'Menghitung harga pasaran', 'Menyiapkan hasil'];

export async function cekHarga(input, onStep = () => {}) {
  const kawasan = kawasanById(input.kawasanId);
  const b = pembanding(kawasan.kec, input.jenis);
  onStep(0);
  await wait(650);
  onStep(1, { n: b.n, kec: kawasan.kec });
  await wait(850);
  onStep(2);
  await wait(850);
  if (/error|gagal/i.test(input.lokasiTeks || '')) throw new Error('Koneksi terputus saat menghitung posisi harga.');
  const nilai = nilaiHarga(input.harga, b);
  onStep(3);
  await wait(600);
  return {
    id: `cek-${Date.now()}`,
    dibuat: new Date().toISOString(),
    input,
    kawasan: { id: kawasan.id, nama: kawasan.nama, kec: kawasan.kec, jarak: kawasan.jarak, lat: kawasan.lat, lng: kawasan.lng },
    harga_ditawarkan: input.harga,
    ...nilai,
    pembanding: b,
    meta: {
      confidence: confidenceDari(b.n),
      kecamatan: kawasan.kec,
      updated_at: PASAR.meta.diambil,
      sumber: PASAR.meta.sumber,
    },
  };
}

// ---------- Cari kos berdasarkan kebutuhan ----------
export const LANGKAH_CARI = ['Membaca kebutuhanmu', 'Mencari area di sekitar tujuan', 'Menghitung harga tiap area', 'Menyusun rekomendasi'];

function terdekat(titik, jenis) {
  let best = null;
  for (const t of TEMPAT) {
    if (t.jenis !== jenis) continue;
    const d = jarakJalan(titik, t);
    if (!best || d < best.d) best = { t, d };
  }
  return best;
}

export function hitungArea(input) {
  const { dekat = [], tujuanId, budgetMin = 0, budgetMax, jenis = null, fasilitas = [] } = input;
  const tujuan = tujuanById(tujuanId);
  if (!tujuan) return [];
  const kandidat = KAWASAN_TERCAKUP.map((k) => ({ k, km: jarakJalan(tujuan, k) })).sort((a, b) => a.km - b.km);
  let pool = kandidat.filter((x) => x.km <= 7);
  if (pool.length < 5) pool = kandidat.slice(0, 6);

  return pool
    .map(({ k, km }) => {
      const stat = statKec(k.kec);
      // kos nyata di kecamatan ini yang cocok dengan jenis + fasilitas wajib
      const cocok = kosKec(k.kec).filter((x) => (!jenis || x.jenis === jenis) && fasilitas.every((f) => x.fasilitas.includes(f)));
      const dalamBudget = cocok.filter((x) => x.harga <= budgetMax && x.harga >= budgetMin * 0.9);
      const rasio = cocok.length ? dalamBudget.length / cocok.length : 0;
      const fit = rasio >= 0.4 ? 'pas' : rasio > 0 ? 'sebagian' : 'atas';

      const hargaS = clamp01(rasio * 1.6);
      const jarakS = clamp01(1 - (km - 0.5) / 5);
      const dekatInfo = dekat.map((c) => terdekat(k, c)).filter(Boolean);
      const kebS = dekatInfo.length ? avg(dekatInfo.map((x) => clamp01(1 - (x.d - 0.5) / 3))) : jarakS;
      const jenisS = jenis ? clamp01(stat.komposisi[jenis] / 40) : 1;
      const skor = 40 * hargaS + 30 * jarakS + 20 * kebS + 10 * jenisS;

      const alasan = [];
      if (km <= 1.6) alasan.push(`Dekat ${tujuan.singkat}`);
      for (const x of dekatInfo) if (x.d <= 1.6 && x.t.id !== tujuan.id) alasan.push(`Dekat ${x.t.singkat}`);
      if (dalamBudget.length) alasan.push(`${dalamBudget.length} kos masuk budget`);
      if (jenis && stat.komposisi[jenis] >= 35) alasan.push(`Banyak kos ${jenisById(jenis).label.toLowerCase()}`);
      if (stat.n >= 40) alasan.push('Banyak data pembanding');

      const hs = dalamBudget.length >= 3 ? dalamBudget.map((x) => x.harga) : cocok.map((x) => x.harga);
      const estimasi = hs.length ? [bulat50rb(Math.min(...hs)), bulat50rb(Math.max(...hs))] : [bulat50rb(stat.p25), bulat50rb(stat.p75)];

      return {
        id: k.id,
        nama: k.nama,
        kec: k.kec,
        lat: k.lat,
        lng: k.lng,
        n: cocok.length,
        nTotal: stat.n,
        cocok: dalamBudget.length,
        km,
        p10: stat.p10,
        p50: stat.p50,
        p90: stat.p90,
        estimasi,
        fit,
        skor: Math.round(skor),
        alasan: [...new Set(alasan)].slice(0, 3),
      };
    })
    .sort((a, b) => Number(a.fit === 'atas') - Number(b.fit === 'atas') || b.skor - a.skor);
}

// Sebaran harga asli dari seluruh kos di kecamatan area yang direkomendasikan.
export function ringkasInsight(areas) {
  const kecs = [...new Set(areas.map((a) => a.kec))];
  const harga = kecs.flatMap((k) => kosKec(k).map((x) => x.harga)).sort((a, b) => a - b);
  const cocok = areas.filter((a) => a.fit !== 'atas').slice(0, 3);
  const pakai = cocok.length ? cocok : areas.slice(0, 3);
  const range = [bulat50rb(Math.min(...pakai.map((a) => a.estimasi[0]))), bulat50rb(Math.max(...pakai.map((a) => a.estimasi[1])))];
  const step = 250_000;
  const mulai = Math.floor(harga[0] / step) * step;
  const akhir = Math.ceil(harga[harga.length - 1] / step) * step;
  const bins = [];
  for (let x = mulai; x < akhir; x += step) {
    bins.push({ lo: x, hi: x + step, jumlah: harga.filter((h) => h >= x && h < x + step).length, sorot: x + step > range[0] && x < range[1] });
  }
  const median = harga.length % 2 ? harga[(harga.length - 1) / 2] : (harga[harga.length / 2 - 1] + harga[harga.length / 2]) / 2;
  return { range, n: harga.length, median, jumlahArea: areas.length, kecs, confidence: harga.length >= 120 ? 'tinggi' : harga.length >= 60 ? 'sedang' : 'rendah', bins };
}

export function saranAI(input) {
  const dasar = hitungArea(input);
  const pasDasar = new Set(dasar.filter((a) => a.fit === 'pas').map((a) => a.id));
  let best = null;
  for (const f of input.fasilitas || []) {
    const alt = hitungArea({ ...input, fasilitas: input.fasilitas.filter((x) => x !== f) });
    const baru = alt.filter((a) => a.fit === 'pas' && !pasDasar.has(a.id));
    if (baru.length && (!best || baru.length > best.baru.length)) best = { jenis: 'lepas', fasilitas: f, label: fasilitasById(f).label, baru };
  }
  if (!best) {
    const naik = 200_000;
    const alt = hitungArea({ ...input, budgetMax: input.budgetMax + naik });
    const baru = alt.filter((a) => a.fit === 'pas' && !pasDasar.has(a.id));
    if (baru.length) best = { jenis: 'budget', naik, baru };
  }
  if (!best) return null;
  const top = best.baru.slice(0, 2);
  return { ...best, tambah: best.baru.length, nama: top.map((a) => a.nama), range: [Math.min(...top.map((a) => a.estimasi[0])), Math.max(...top.map((a) => a.estimasi[1]))] };
}

export async function analisisPasar(input, onStep = () => {}) {
  for (let i = 0; i < 4; i++) {
    onStep(i);
    await wait(i === 0 ? 500 : 700);
  }
  return { id: `cari-${Date.now()}`, dibuat: new Date().toISOString(), input, updated_at: PASAR.meta.diambil };
}

// ---------- KOZY Match ----------
// Kos asli dari hasil scraping. Sumber tidak memuat alamat/koordinat, jadi titik peta
// disebar di sekitar kawasan yang dipilih dan ditandai sebagai perkiraan area.
export async function kozyMatch({ kawasanIds, fasilitas = [], budgetMax = null, jenis = null, tujuan = null, seed = 'kozy', jumlah = 5 }) {
  await wait(700);
  const kawasan = kawasanIds.map(kawasanById).filter(Boolean);
  if (!kawasan.length) return [];
  const kecs = [...new Set(kawasan.map((k) => k.kec))];

  const daftar = kecs
    .flatMap((kec) => kosKec(kec))
    .filter((k) => (!jenis || k.jenis === jenis) && fasilitas.every((f) => k.fasilitas.includes(f)) && (!budgetMax || k.harga <= budgetMax));

  const hasil = daftar
    .map((k, i) => {
      // Papikost membawa koordinat asli; Mamikos tidak, jadi titiknya disebar di
      // sekitar pusat kawasan dan ditandai sebagai perkiraan lokasi.
      const asli = k.lat != null && k.lng != null;
      const kaw = asli ? (kawasan.find((w) => w.kec === k.kec) ?? kawasan[i % kawasan.length]) : kawasan[i % kawasan.length];
      const r = rng(hashStr(seed + k.nama + k.harga));
      const sudut = r() * Math.PI * 2;
      const sebar = 0.0012 + r() * 0.0042;
      const titik = asli ? { lat: k.lat, lng: k.lng } : { lat: kaw.lat + Math.sin(sudut) * sebar, lng: kaw.lng + Math.cos(sudut) * sebar };
      const km = tujuan ? jarakJalan(tujuan, titik) : asli ? jarakJalan(kaw, titik) : jarakJalan(kaw, titik) + kaw.jarak;
      // tiap kos dinilai terhadap pembanding jenisnya sendiri, sama seperti Cek Harga
      const b = pembanding(k.kec, k.jenis);
      const nilai = nilaiHarga(k.harga, b);
      const skor = {
        harga: Math.max(10, Math.min(40, Math.round(34 - nilai.selisih_persen * 0.5))),
        jarak: Math.max(5, Math.min(25, Math.round(26 - km * 4))),
        fasilitas: Math.min(25, 8 + k.fasilitas.length * 3),
        keyakinan: b.n >= 30 ? 10 : b.n >= MIN_PEMBANDING ? 8 : 6,
      };
      skor.total = skor.harga + skor.jarak + skor.fasilitas + skor.keyakinan;
      return {
        id: `kos-${hashStr(k.nama + k.harga).toString(36)}`,
        nama: k.nama,
        kawasan: { id: kaw.id, nama: kaw.nama },
        kec: k.kec,
        ...titik,
        lokasiPerkiraan: !asli,
        jarak: km,
        jenis: k.jenis,
        fasilitas: k.fasilitas,
        fasilitasLain: k.fasilitas_lain ?? [],
        sisaKamar: k.sisa_kamar ?? null,
        foto: k.foto ?? null,
        rating: k.rating,
        dilihat: k.dilihat,
        promo: k.promo,
        url: k.url ?? null,
        harga: k.harga,
        median: nilai.median,
        kisaran: nilai.kisaran,
        selisih_rp: nilai.selisih_rp,
        selisih_persen: nilai.selisih_persen,
        status: nilai.status,
        persentil: nilai.persentil,
        n: b.n,
        jenisPembanding: b.jenis,
        skor,
        sumber: k.sumber,
      };
    })
    .filter((k) => k.status !== 'KEMAHALAN') // hanya kos yang lolos cek harga: tidak di atas Q3 pembandingnya
    .sort((a, b) => b.skor.total - a.skor.total);

  return hasil.slice(0, jumlah);
}

export function jumlahKosCocok({ kawasanIds = [], fasilitas = [], budgetMax = null, jenis = null }) {
  const kecs = [...new Set(kawasanIds.map((id) => kawasanById(id)?.kec).filter(Boolean))];
  return kecs
    .flatMap((kec) => kosKec(kec))
    .filter((k) => (!jenis || k.jenis === jenis) && fasilitas.every((f) => k.fasilitas.includes(f)) && (!budgetMax || k.harga <= budgetMax)).length;
}

// ---------- Pemilik ----------
// Semua tipe kamar satu kos punya pembanding yang sama (kecamatan dan jenis kosnya
// sama); yang membedakan hasilnya hanya harga tiap tipe.
export function analisisPemilik({ kawasanId, jenis, harga }) {
  const k = kawasanById(kawasanId);
  const b = pembanding(k.kec, jenis);
  return { ...nilaiHarga(harga, b), pembanding: b, n: b.n, kec: k.kec };
}
