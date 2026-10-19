// Tiga komponen fitur eksklusif KOZY (Rp19.900 sekali bayar) + forecast pendapatan KOZY.
// Logikanya sama dengan api/premium.py; parameternya dibuat scripts/build_premium.py.
// Tanpa regresi, dan fasilitas 0/1 tidak dipakai sebagai variabel model:
//   1. kelas harga   K-Prototypes (log harga + kecamatan + jenis), kos baru -> prototipe terdekat
//   2. gap A vs B    selisih harga & jarak dalam satuan IQR pasar, persentil di kelas, TOPSIS
//   3. forecast      Monte Carlo funnel: konversi ~ Beta, pembeli ~ Poisson(pengunjung × musim × konversi)
import kelasModel from '../data/kelas.json';
import gapModel from '../data/gap_ab.json';
import forecastModel from '../data/forecast_kozy.json';

export const KELAS = kelasModel;
export const GAP_AB = gapModel;
export const FORECAST = forecastModel;
export const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// ---------- 1. Kelas harga ----------
// Porsi anggota kelas yang harganya lebih murah (distribusi empiris, bukan model).
export function persentilDi(urut, nilai) {
  if (!urut?.length) return 50;
  let lo = 0;
  let hi = urut.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (urut[mid] < nilai) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(1, Math.min(99, Math.round((lo / urut.length) * 100)));
}

export const kelasById = (id) => KELAS.kelas.find((k) => k.id === id);

// Jarak campuran Huang (1997): (z_harga − pusat)² + γ·[kec ≠ modus] + γ·[jenis ≠ modus].
// Kecamatan/jenis yang tidak diketahui dilewati — sukunya sama besar untuk semua prototipe.
export function kelasKos(harga, kec = null, jenis = null) {
  const p = KELAS.param;
  const z = (Math.log(Math.max(harga, 1)) - p.log_mean) / p.log_std;
  const kecG = kec ? (p.kec_dikenal.includes(kec) ? kec : 'lain') : null;
  const jarak = KELAS.prototipe.map((pr) => (z - pr.z) ** 2 + (kecG != null ? p.gamma * (kecG !== pr.kec) : 0) + (jenis ? p.gamma * (jenis !== pr.jenis) : 0));
  const urut = jarak.map((d, i) => i).sort((a, b) => jarak[a] - jarak[b]);
  const k = kelasById(KELAS.prototipe[urut[0]].id);
  return {
    id: k.id,
    label: k.label,
    jarak: KELAS.prototipe.map((pr, i) => ({ id: pr.id, nilai: Math.round(jarak[i] * 1000) / 1000 })),
    margin: urut.length > 1 ? Math.round((jarak[urut[1]] - jarak[urut[0]]) * 1000) / 1000 : null,
    persentil: persentilDi(k.harga_urut, harga),
    rentang: [k.harga.min, k.harga.max],
    median: k.harga.p50,
    n: k.n,
    pakai_kec: kecG != null,
    pakai_jenis: !!jenis,
  };
}

// ---------- 2. Gap A vs B ----------
// TOPSIS (Hwang & Yoon, 1981), semua kriteria berjenis biaya (makin kecil makin baik).
// Kriteria yang nilainya tidak lengkap dibuang dan bobotnya dinormalkan ulang.
export function topsis(alternatif, bobot) {
  const krit = Object.keys(bobot).filter((c) => bobot[c] > 0 && alternatif.every((a) => a[c] != null));
  if (!krit.length) return alternatif.map(() => 0.5);
  const total = krit.reduce((s, c) => s + bobot[c], 0);
  const norm = Object.fromEntries(krit.map((c) => [c, Math.sqrt(alternatif.reduce((s, a) => s + a[c] ** 2, 0)) || 1]));
  const v = alternatif.map((a) => Object.fromEntries(krit.map((c) => [c, ((bobot[c] / total) * a[c]) / norm[c]])));
  const ideal = Object.fromEntries(krit.map((c) => [c, Math.min(...v.map((x) => x[c]))]));
  const anti = Object.fromEntries(krit.map((c) => [c, Math.max(...v.map((x) => x[c]))]));
  return v.map((x) => {
    const dp = Math.sqrt(krit.reduce((s, c) => s + (x[c] - ideal[c]) ** 2, 0));
    const dm = Math.sqrt(krit.reduce((s, c) => s + (x[c] - anti[c]) ** 2, 0));
    return dp + dm === 0 ? 0.5 : dm / (dp + dm);
  });
}

export const PRIORITAS_GAP = [
  { id: 'seimbang', label: 'Seimbang', sub: 'Harga dan jarak sama penting', icon: 'sliders' },
  { id: 'hemat', label: 'Paling hemat', sub: 'Harga sewa paling ringan', icon: 'wallet' },
  { id: 'dekat', label: 'Paling dekat', sub: 'Jarak ke tujuan paling pendek', icon: 'pin' },
];

// Kisaran harga kos berharga asli di sekitar satu titik — INFORMASI saja, tidak ikut gap.
// (Uji leave-one-out: taksiran dari tetangga tidak lebih baik daripada median kota.)
const KM_RAD = Math.PI / 180;
const jarakKm = (la1, lo1, la2, lo2) => {
  const h = Math.sin(((la2 - la1) * KM_RAD) / 2) ** 2 + Math.cos(la1 * KM_RAD) * Math.cos(la2 * KM_RAD) * Math.sin(((lo2 - lo1) * KM_RAD) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
export function kisaranSekitar(lat, lng) {
  const { k, titik } = GAP_AB.tetangga;
  const dekat = titik
    .map(([la, lo, h]) => ({ h, d: jarakKm(lat, lng, la, lo) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, k);
  const hs = dekat.map((x) => x.h).sort((x, y) => x - y);
  const q = (p) => {
    const pos = (hs.length - 1) * p;
    const lo = Math.floor(pos);
    return hs[lo] + (hs[Math.min(lo + 1, hs.length - 1)] - hs[lo]) * (pos - lo);
  };
  return { p25: q(0.25), p50: q(0.5), p75: q(0.75), n: hs.length, radius: dekat[dekat.length - 1]?.d ?? null };
}

// a, b: { nama, harga (null = belum diketahui), jarak (km, boleh null), kec?, jenis? }
// Harga yang belum diketahui tidak ditaksir: gap harga & kelas dilewati, TOPSIS memakai jarak saja.
export function gapAB(a, b, prioritas = 'seimbang') {
  const skala = GAP_AB.skala;
  const ka = a.harga != null ? kelasKos(a.harga, a.kec, a.jenis) : null;
  const kb = b.harga != null ? kelasKos(b.harga, b.kec, b.jenis) : null;
  const adaHarga = a.harga != null && b.harga != null;
  const dHarga = adaHarga ? b.harga - a.harga : null;
  const adaJarak = a.jarak != null && b.jarak != null;
  const dJarak = adaJarak ? b.jarak - a.jarak : null;
  const bobot = GAP_AB.topsis.bobot[prioritas] || GAP_AB.topsis.bobot.seimbang;
  const [ca, cb] = topsis(
    [
      { harga: a.harga, jarak: a.jarak },
      { harga: b.harga, jarak: b.jarak },
    ],
    bobot,
  );
  return {
    a: { ...a, kelas: ka },
    b: { ...b, kelas: kb },
    gap: {
      harga: adaHarga ? { selisih_rp: dHarga, selisih_persen: (dHarga / a.harga) * 100, selisih_iqr: dHarga / skala.harga.iqr, setahun_rp: dHarga * 12 } : null,
      jarak: adaJarak ? { selisih_km: dJarak, selisih_iqr: dJarak / skala.jarak.iqr } : null,
      persentil_poin: ka && kb ? kb.persentil - ka.persentil : null,
    },
    topsis: { prioritas, bobot, skor: { a: ca, b: cb }, menang: ca >= cb ? 'a' : 'b', pakai_jarak: adaJarak, pakai_harga: adaHarga },
    uji_pasar: GAP_AB.uji_jarak_harga,
  };
}

// ---------- 3. Forecast pendapatan ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (u) => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
// Gamma(shape, 1) — Marsaglia & Tsang (2000)
function gamma(shape, u) {
  if (shape < 1) return gamma(shape + 1, u) * u() ** (1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = normal(u);
      v = 1 + c * x;
    } while (v <= 0);
    v = v ** 3;
    const w = u();
    if (w < 1 - 0.0331 * x ** 4 || Math.log(w) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
const beta = (a, b, u) => {
  const x = gamma(a, u);
  return x / (x + gamma(b, u));
};
// Poisson: Knuth untuk λ kecil, pendekatan normal untuk λ ≥ 30
function poisson(lam, u) {
  if (lam <= 0) return 0;
  if (lam >= 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * normal(u)));
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= u();
  } while (p > L);
  return k - 1;
}
const kuantil = (urut, q) => {
  const pos = (urut.length - 1) * q;
  const lo = Math.floor(pos);
  return urut[lo] + (urut[Math.min(lo + 1, urut.length - 1)] - urut[lo]) * (pos - lo);
};
function ringkas(baris) {
  // baris[draw][bulan] -> kuantil per bulan
  const h = baris[0].length;
  const keluar = { p2_5: [], p10: [], p50: [], p90: [], p97_5: [] };
  for (let t = 0; t < h; t++) {
    const kol = baris.map((r) => r[t]).sort((x, y) => x - y);
    keluar.p2_5.push(kuantil(kol, 0.025));
    keluar.p10.push(kuantil(kol, 0.1));
    keluar.p50.push(kuantil(kol, 0.5));
    keluar.p90.push(kuantil(kol, 0.9));
    keluar.p97_5.push(kuantil(kol, 0.975));
  }
  return keluar;
}

// konversi p ~ Beta(prior_a + pembeli, prior_b + sesi − pembeli)
// pembeli_t | p ~ Poisson(λ_t · p), λ_t = pengunjung_awal · (1+g)^t · indeks musiman bulan t
// (penipisan Poisson: Binomial(Poisson(λ), p) = Poisson(λp)); sekali bayar per pembeli.
export function simulasiPendapatan({ pengunjungAwal, pertumbuhan, priorA = FORECAST.prior.a, priorB = FORECAST.prior.b, sesi = 0, pembeli = 0, horizon = 12, draws = 5000, seed = 7 }) {
  const u = mulberry32(seed);
  const indeks = FORECAST.musiman.indeks;
  const harga = FORECAST.meta.harga;
  const beli = Math.max(0, Math.min(pembeli, sesi));
  const aPost = priorA + beli;
  const bPost = priorB + sesi - beli;
  const mulai = FORECAST.mulai;
  const bulan = Array.from({ length: horizon }, (_, t) => (mulai.bulan + t) % 12);
  const label = bulan.map((m, t) => `${NAMA_BULAN[m]} ${String(mulai.tahun + Math.floor((mulai.bulan + t) / 12)).slice(2)}`);
  const lam = bulan.map((m, t) => pengunjungAwal * (1 + pertumbuhan) ** t * indeks[m]);
  const ps = [];
  const pembeliSim = [];
  const uang = [];
  const kum = [];
  for (let i = 0; i < draws; i++) {
    const p = beta(aPost, bPost, u);
    ps.push(p);
    let total = 0;
    const rb = [];
    const ru = [];
    const rk = [];
    for (let t = 0; t < horizon; t++) {
      const n = poisson(lam[t] * p, u);
      total += n * harga;
      rb.push(n);
      ru.push(n * harga);
      rk.push(total);
    }
    pembeliSim.push(rb);
    uang.push(ru);
    kum.push(rk);
  }
  ps.sort((x, y) => x - y);
  return {
    bulan,
    label,
    pengunjung: lam.map(Math.round),
    indeks: bulan.map((m) => indeks[m]),
    pembeli: ringkas(pembeliSim),
    pendapatan: ringkas(uang),
    kumulatif: ringkas(kum),
    konversi: { a: aPost, b: bPost, rata: aPost / (aPost + bPost), ci95: [kuantil(ps, 0.025), kuantil(ps, 0.975)] },
    draws,
    harga,
  };
}

// Funnel dari data aktivitas (lib/jejak.js): satu sesi = satu pengunjung.
export function funnelDariJejak(kejadian) {
  const sesi = new Set();
  const dikunci = new Set();
  const bayar = new Set();
  for (const k of kejadian) {
    if (!k.sesi) continue;
    sesi.add(k.sesi);
    if (k.jenis === 'match_dikunci' || k.jenis === 'eksklusif_dikunci') dikunci.add(k.sesi);
    if (k.jenis === 'bayar') bayar.add(k.sesi);
  }
  const waktu = kejadian.map((k) => k.waktu).filter(Boolean).sort();
  return { sesi: sesi.size, dikunci: dikunci.size, pembeli: bayar.size, dari: waktu[0] || null, sampai: waktu[waktu.length - 1] || null };
}
