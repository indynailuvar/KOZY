// Lapisan data KOZY.
// Tanpa backend, angka dihitung model hedonic sederhana di browser (data acuan: src/data/surabaya.js).
// Jika VITE_API_URL diisi, cekHarga() memanggil FastAPI POST /vonis dan mengharapkan respons:
// {status, harga_wajar, selisih_rp, selisih_persen, persentil, breakdown[], pasar{p10,p50,p90,n_pembanding}, meta{confidence, updated_at}}

import { BIAYA_FASILITAS, DATA_UPDATED, FASILITAS, FITUR_AKSES, JENIS_KOS, KAWASAN, KEBUTUHAN, LUAR_CAKUPAN, MODEL, NAMA_KOS, PERSONA, TEMPAT } from '../data/surabaya.js';
import { bulat10rb, bulat50rb, jarak as fmtJarak } from '../lib/format.js';

const API = import.meta.env.VITE_API_URL;
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
    .map((k) => ({ id: k.id, label: k.nama, sub: `Kec. ${k.kec}` }));
}

export function kenaliLokasi(text) {
  const raw = (text || '').trim();
  if (!raw) return { status: 'kosong' };
  const link = isLink(raw);
  const n = norm(link ? decodeURIComponent(raw) : raw);
  const hit = KAWASAN.find((k) => n.includes(norm(k.nama))) || (!link && KAWASAN.find((k) => norm(k.kec) === n));
  if (hit) return { status: 'ok', kawasan: hit, sumber: link ? 'link' : 'teks' };
  const luar = LUAR_CAKUPAN.find((l) => n.includes(l));
  if (luar) return { status: 'luar', nama: luar.replace(/\b\w/g, (c) => c.toUpperCase()) };
  if (link) {
    // Tanpa backend: link pendek tidak memuat nama kawasan -> dipetakan secara deterministik.
    const pool = KAWASAN.filter((k) => k.n >= 15);
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
  const kaw = KAWASAN.filter((k) => norm(k.nama).includes(n)).map((k) => ({ id: `kw:${k.id}`, label: k.nama, sub: `Kawasan · Kec. ${k.kec}`, icon: 'pin' }));
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

// ---------- Model harga (hedonic sederhana) ----------
export function kontribusiJarak(km) {
  if (km < 0.5) return 10_000;
  if (km < 1) return -20_000;
  if (km < 2) return -40_000;
  return -60_000;
}

export function kontribusiLuas(m2) {
  if (!m2) return 0;
  return Math.max(-30_000, Math.min(150_000, Math.round((m2 - 9) * 12_000)));
}

const URUT_LEVEL = { besar: 0, sedang: 1, kecil: 2 };

export function hitungWajar(kawasan, { fasilitas = [], luas = null, jenis = null } = {}, jarakKm = kawasan.jarak) {
  const rincian = [{ key: 'lokasi', label: `Lokasi di ${kawasan.nama}`, nilai: kawasan.base, icon: 'pin' }];
  for (const f of FASILITAS) if (fasilitas.includes(f.id)) rincian.push({ key: f.id, label: f.label, nilai: f.harga, icon: f.icon });
  if (luas) rincian.push({ key: 'luas', label: `Luas kamar ${luas} m²`, nilai: kontribusiLuas(luas), icon: 'ruler' });
  const j = jenisById(jenis);
  if (j?.harga) rincian.push({ key: 'jenis', label: `Kos ${j.label.toLowerCase()}`, nilai: j.harga, icon: 'user' });
  rincian.push({ key: 'akses', label: `Jarak ke pusat aktivitas (${fmtJarak(jarakKm)})`, nilai: kontribusiJarak(jarakKm), icon: 'grad' });

  const harga_wajar = bulat10rb(rincian.reduce((s, r) => s + r.nilai, 0));
  const lokasi = Math.round(((kawasan.base + kontribusiJarak(jarakKm)) / harga_wajar) * 100);
  const faktor = rincian
    .filter((r) => r.key === 'lokasi' || r.nilai !== 0)
    .map((r, i) => {
      const porsi = Math.abs(r.nilai) / harga_wajar;
      return { key: r.key, label: r.label, icon: r.icon, arah: r.nilai < 0 ? 'turun' : 'naik', level: porsi >= 0.3 ? 'besar' : porsi >= 0.1 ? 'sedang' : 'kecil', i };
    })
    .sort((a, b) => URUT_LEVEL[a.level] - URUT_LEVEL[b.level] || a.i - b.i);
  return { harga_wajar, breakdown: rincian, faktor, komposisi: { lokasi, kamar: 100 - lokasi } };
}

export function pasarDari(wajar, n) {
  return { p10: bulat10rb(wajar * 0.76), p50: bulat10rb(wajar * 0.98), p90: bulat10rb(wajar * 1.25), n_pembanding: n };
}

export function persentilDari(harga, { p10, p50, p90 }) {
  let p;
  if (harga <= p10) p = 10 * (harga / p10) ** 3;
  else if (harga <= p50) p = 10 + ((harga - p10) / (p50 - p10)) * 40;
  else if (harga <= p90) p = 50 + ((harga - p50) / (p90 - p50)) * 40;
  else p = 90 + Math.min(9, ((harga - p90) / (p90 * 0.3)) * 9);
  return Math.max(1, Math.min(99, Math.round(p)));
}

export function statusDari(selisihPersen) {
  if (selisihPersen > 10) return 'KEMAHALAN';
  if (selisihPersen < -10) return 'MURAH';
  return 'WAJAR';
}

// Harga yang jauh di bawah pasaran (lebih murah dari ±90% kos serupa) bukan "hemat",
// tapi tanda perlu dicek: fasilitas berbeda, biaya tersembunyi, atau penipuan.
export const BATAS_TERLALU_MURAH = -25;
export const terlaluMurah = (r) => r.selisih_persen <= BATAS_TERLALU_MURAH;
export const statusTampil = (r) => (terlaluMurah(r) ? 'CEK' : r.status);

const confidenceDari = (n) => (n >= 25 ? 'tinggi' : n >= 15 ? 'sedang' : 'rendah');

// ---------- Cek kos incaran ----------
export const LANGKAH_CEK = ['Memvalidasi lokasi', 'Menemukan kos pembanding', 'Menghitung harga wajar', 'Memeriksa anomali'];

export async function cekHarga(input, onStep = () => {}) {
  const kawasan = kawasanById(input.kawasanId);
  const radius = kawasan.n >= 15 ? 800 : 1500;
  onStep(0);
  await wait(650);
  onStep(1, { n: kawasan.n, radius });
  await wait(850);
  onStep(2);

  let result;
  if (API) {
    const res = await fetch(`${API}/vonis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kawasan: kawasan.id, harga: input.harga, jenis: input.jenis, fasilitas: input.fasilitas, luas: input.luas, lokasi: input.lokasiTeks, catatan: input.catatan }),
    });
    if (!res.ok) throw new Error('Server KOZY sedang bermasalah.');
    result = await res.json();
  } else {
    await wait(850);
    if (/error|gagal/i.test(input.lokasiTeks || '')) throw new Error('Koneksi terputus saat menghitung harga wajar.');
    const { harga_wajar, breakdown, faktor, komposisi } = hitungWajar(kawasan, input);
    const selisih_rp = input.harga - harga_wajar;
    const selisih_persen = (selisih_rp / harga_wajar) * 100;
    const pasar = pasarDari(harga_wajar, kawasan.n);
    result = {
      status: statusDari(selisih_persen),
      harga_wajar,
      selisih_rp,
      selisih_persen,
      persentil: persentilDari(input.harga, pasar),
      breakdown,
      faktor,
      komposisi,
      pasar,
      meta: { confidence: confidenceDari(kawasan.n), radius_m: radius, updated_at: DATA_UPDATED, anomali: Math.abs(selisih_persen) > 45 },
    };
  }
  onStep(3);
  await wait(600);
  return {
    id: `cek-${Date.now()}`,
    dibuat: new Date().toISOString(),
    input,
    kawasan: { id: kawasan.id, nama: kawasan.nama, kec: kawasan.kec, jarak: kawasan.jarak, lat: kawasan.lat, lng: kawasan.lng },
    harga_ditawarkan: input.harga,
    ...result,
  };
}

// ---------- Cari kos berdasarkan kebutuhan ----------
export const LANGKAH_CARI = ['Membaca kebutuhanmu', 'Mencari area di sekitar tujuan', 'Menghitung harga wajar tiap area', 'Menyusun rekomendasi'];

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
  const { dekat = [], tujuanId, budgetMin = 0, budgetMax, jenis = null, fasilitas = [], disabilitas = false } = input;
  const tujuan = tujuanById(tujuanId);
  const kandidat = KAWASAN.map((k) => ({ k, km: jarakJalan(tujuan, k) })).sort((a, b) => a.km - b.km);
  let pool = kandidat.filter((x) => x.km <= 6.5);
  if (pool.length < 5) pool = kandidat.slice(0, 6);

  return pool
    .map(({ k, km }) => {
      const { harga_wajar } = hitungWajar(k, { fasilitas, jenis }, km);
      const pasar = pasarDari(harga_wajar, k.n);
      const fit = pasar.p50 <= budgetMax ? 'pas' : pasar.p10 <= budgetMax ? 'sebagian' : 'atas';
      const hargaS = fit === 'pas' ? (pasar.p50 >= budgetMin ? 1 : 0.92) : fit === 'sebagian' ? 0.5 : 0.1;
      const jarakS = clamp01(1 - (km - 0.5) / 4.5);
      const dekatInfo = dekat.map((c) => terdekat(k, c)).filter(Boolean);
      const kebS = dekatInfo.length ? avg(dekatInfo.map((x) => clamp01(1 - (x.d - 0.5) / 3))) : jarakS;
      const jenisS = jenis ? clamp01(k.komposisi[jenis] / 40) : 1;
      let skor = 35 * hargaS + 25 * jarakS + 20 * kebS + 10 * jenisS + 10 * (k.aman / 5);
      if (disabilitas) skor *= 0.55 + 0.45 * (k.aksesibel >= 3 ? 1 : k.aksesibel >= 1 ? 0.6 : 0);

      const alasan = [];
      if (km <= 1.6) alasan.push(`Dekat ${tujuan.singkat}`);
      for (const x of dekatInfo) if (x.d <= 1.6 && x.t.id !== tujuan.id) alasan.push(`Dekat ${x.t.singkat}`);
      if (disabilitas && k.aksesibel >= 2) alasan.push('Ramah disabilitas');
      if (jenis && k.komposisi[jenis] >= 35) alasan.push(`Banyak kos ${jenisById(jenis).label.toLowerCase()}`);
      if (k.aman >= 4) alasan.push('Lingkungan aman');
      if (k.n >= 25) alasan.push('Banyak pilihan kos');
      if (fit === 'pas' && pasar.p50 <= budgetMax * 0.8) alasan.push('Value baik');

      return {
        id: k.id,
        nama: k.nama,
        kec: k.kec,
        lat: k.lat,
        lng: k.lng,
        n: k.n,
        km,
        harga_wajar,
        ...pasar,
        estimasi: [bulat50rb(harga_wajar * 0.87), bulat50rb(harga_wajar * 1.18)],
        fit,
        skor: Math.round(skor),
        alasan: [...new Set(alasan)].slice(0, 3),
        aksesibel: k.aksesibel,
      };
    })
    .sort((a, b) => Number(a.fit === 'atas') - Number(b.fit === 'atas') || b.skor - a.skor);
}

function massaSegitiga(a, c, b, x0, x1) {
  const cdf = (x) => {
    if (x <= a) return 0;
    if (x >= b) return 1;
    if (x <= c) return (x - a) ** 2 / ((b - a) * (c - a));
    return 1 - (b - x) ** 2 / ((b - a) * (b - c));
  };
  return cdf(x1) - cdf(x0);
}

export function ringkasInsight(areas) {
  const cocok = areas.filter((a) => a.fit !== 'atas').slice(0, 3);
  const pakai = cocok.length ? cocok : areas.slice(0, 3);
  const range = [bulat50rb(Math.min(...pakai.map((a) => a.p50)) * 0.9), bulat50rb(Math.max(...pakai.map((a) => a.p50)) * 1.1)];
  const n = areas.reduce((s, a) => s + a.n, 0);
  const step = 100_000;
  const mulai = Math.floor(Math.min(...areas.map((a) => a.p10)) / step) * step;
  const akhir = Math.ceil(Math.max(...areas.map((a) => a.p90)) / step) * step;
  const bins = [];
  for (let x = mulai; x < akhir; x += step) {
    const jumlah = areas.reduce((s, a) => s + a.n * massaSegitiga(a.p10, a.p50, a.p90, x, x + step), 0);
    bins.push({ lo: x, hi: x + step, jumlah, sorot: x + step > range[0] && x < range[1] });
  }
  return { range, n, jumlahArea: areas.length, akurasi: MODEL.akurasi, confidence: n >= 120 ? 'tinggi' : n >= 60 ? 'sedang' : 'rendah', bins };
}

export function saranAI(input) {
  const dasar = hitungArea(input);
  const pasDasar = new Set(dasar.filter((a) => a.fit === 'pas').map((a) => a.id));
  let best = null;
  for (const f of input.fasilitas || []) {
    const alt = hitungArea({ ...input, fasilitas: input.fasilitas.filter((x) => x !== f) });
    const baru = alt.filter((a) => a.fit === 'pas' && !pasDasar.has(a.id));
    const lebihBaik = best && (baru.length > best.baru.length || (baru.length === best.baru.length && fasilitasById(f).harga > fasilitasById(best.fasilitas).harga));
    if (baru.length && (!best || lebihBaik)) best = { jenis: 'lepas', fasilitas: f, label: fasilitasById(f).label, baru };
  }
  if (!best) {
    const alt = hitungArea({ ...input, budgetMax: input.budgetMax + 100_000 });
    const baru = alt.filter((a) => a.fit === 'pas' && !pasDasar.has(a.id));
    if (baru.length) best = { jenis: 'budget', naik: 100_000, baru };
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
  return { id: `cari-${Date.now()}`, dibuat: new Date().toISOString(), input, updated_at: DATA_UPDATED };
}

// ---------- KOZY Match ----------
function pilihJenis(komposisi, x) {
  let acc = 0;
  for (const [id, pct] of Object.entries(komposisi)) {
    acc += pct / 100;
    if (x <= acc) return id;
  }
  return 'campur';
}

export async function kozyMatch({ kawasanIds, fasilitas = [], budgetMax = null, jenis = null, disabilitas = false, tujuan = null, seed = 'kozy' }) {
  await wait(700);
  const r = rng(hashStr(seed + kawasanIds.join() + (jenis || '') + (disabilitas ? 'a' : '')));
  const semua = FASILITAS.map((f) => f.id);
  const hasil = [];
  let tries = 0;
  while (hasil.length < 5 && tries < 80) {
    tries++;
    const k = kawasanById(kawasanIds[hasil.length % kawasanIds.length]);
    const sudut = r() * Math.PI * 2;
    const sebar = 0.0012 + r() * 0.0034;
    const titik = { lat: k.lat + Math.sin(sudut) * sebar, lng: k.lng + Math.cos(sudut) * sebar };
    const km = tujuan ? jarakJalan(tujuan, titik) : Math.max(0.2, k.jarak * (0.55 + r() * 0.9));
    const jenisKos = jenis || pilihJenis(k.komposisi, r());
    const luas = 9 + Math.floor(r() * 8);
    const fas = [...new Set([...fasilitas, ...semua.filter(() => r() > 0.62)])];
    const aksesibel = disabilitas || r() < k.aksesibel / 12;
    const fiturAkses = aksesibel ? FITUR_AKSES.filter((_, i) => i < 2 || r() > 0.4) : [];
    const { harga_wajar } = hitungWajar(k, { fasilitas: fas, luas, jenis: jenisKos }, km);
    const harga = bulat10rb(harga_wajar * (0.86 + r() * 0.2));
    if (budgetMax && harga > budgetMax) continue;
    const selisih_persen = ((harga - harga_wajar) / harga_wajar) * 100;
    if (selisih_persen > 10) continue; // tidak lolos skrining harga
    const skor = {
      harga: Math.max(20, Math.min(40, Math.round(36 - selisih_persen * 0.6))),
      jarak: Math.max(10, Math.min(25, Math.round(26 - km * 5))),
      fasilitas: Math.min(25, 18 + fas.length - fasilitas.length + (fas.length > 3 ? 2 : 0)),
      keyakinan: k.n >= 25 ? 9 : k.n >= 15 ? 8 : 6,
    };
    skor.total = skor.harga + skor.jarak + skor.fasilitas + skor.keyakinan;
    hasil.push({
      id: `kos-${hash6(seed + kawasanIds.join())}-${hasil.length}`,
      nama: NAMA_KOS[(hashStr(seed + kawasanIds.join()) + hasil.length) % NAMA_KOS.length],
      kawasan: { id: k.id, nama: k.nama },
      ...titik,
      jarak: km,
      jenis: jenisKos,
      luas,
      fasilitas: fas,
      aksesibel,
      fiturAkses,
      aman: k.aman,
      harga,
      harga_wajar,
      selisih_rp: harga - harga_wajar,
      selisih_persen,
      status: statusDari(selisih_persen),
      persentil: persentilDari(harga, pasarDari(harga_wajar, k.n)),
      n: k.n,
      skor,
    });
  }
  return hasil.sort((a, b) => b.skor.total - a.skor.total);
}
const hash6 = (s) => hashStr(s).toString(36).slice(0, 6);

// ---------- Pemilik ----------
export function analisisPemilik({ kawasanId, fasilitas, luas, jenis, harga }) {
  const k = kawasanById(kawasanId);
  const { harga_wajar } = hitungWajar(k, { fasilitas, luas, jenis });
  const pasar = pasarDari(harga_wajar, k.n);
  const selisih_persen = ((harga - harga_wajar) / harga_wajar) * 100;
  const simulasi = FASILITAS.filter((f) => !fasilitas.includes(f.id)).map((f) => ({
    id: f.id,
    label: f.label,
    icon: f.icon,
    tambah: f.harga,
    harga_baru: bulat10rb(harga_wajar + f.harga),
    balik_modal: Math.ceil(BIAYA_FASILITAS[f.id] / f.harga),
  }));
  return { harga_wajar, pasar, selisih_persen, status: statusDari(selisih_persen), persentil: persentilDari(harga, pasar), simulasi, n: k.n };
}
