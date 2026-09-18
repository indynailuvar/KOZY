// KOZY AI — asisten untuk upgrade kamar, memilih kos, dan edukasi keuangan.
// Jika VITE_AI_URL diisi, pesan dikirim ke endpoint tersebut (mis. FastAPI yang meneruskan ke LLM)
// dengan body {pesan, konteks} dan respons berbentuk {teks, kartu?, saran?, aksi?}.
// Tanpa endpoint, jawaban disusun oleh mesin aturan di bawah ini.

import { PRODUK, TIPS, urlProduk } from '../data/konten.js';
import { fasilitasById, jenisById, labelFasilitas } from './kozy.js';
import { angkaRupiah, daftar, jarak, rp } from '../lib/format.js';

const AI_URL = import.meta.env.VITE_AI_URL;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const SARAN_AWAL = ['Ide upgrade kamar dari uang hemat', 'Bantu pilih kos A atau B', 'Tips bertahan di tanggal tua'];

// ---------- Upgrade kamar ----------
export function rekomendasiUpgrade(budget, punya = []) {
  const kurang = new Set(['ac', 'lemari', 'belajar', 'dapur', 'laundry'].filter((f) => !punya.includes(f)));
  const besar = budget >= 500_000;
  const kandidat = PRODUK.map((p) => ({ ...p, skor: p.prioritas + (p.gantikan && kurang.has(p.gantikan) ? 10 : 0) - (p.gantikan && !kurang.has(p.gantikan) ? 20 : 0) }))
    .filter((p) => p.skor > 0)
    .sort((a, b) => b.skor - a.skor || (besar ? b.harga - a.harga : a.harga - b.harga));
  const pilih = [];
  const dipakai = new Set();
  let total = 0;
  for (const p of kandidat) {
    if (pilih.length >= (besar ? 6 : 4)) break;
    const grup = p.grup || p.id;
    if (dipakai.has(grup) || total + p.harga > budget) continue;
    pilih.push(p);
    dipakai.add(grup);
    total += p.harga;
  }
  return { items: pilih.map((p) => ({ ...p, link: urlProduk(p) })), total, sisa: budget - total, kurang: [...kurang] };
}

function danaDariKonteks(ktx) {
  const r = ktx.cek;
  if (!r) return null;
  if (r.selisih_rp < -10_000) return { nilai: Math.abs(r.selisih_rp), alasan: `hemat ${rp(r.selisih_rp)} per bulan dari kos incaranmu` };
  if (r.selisih_rp > 10_000) return { nilai: r.selisih_rp, alasan: `potensi hemat ${rp(r.selisih_rp)} per bulan kalau berhasil nego ke harga wajar` };
  return null;
}

function jawabUpgrade(pesan, ktx) {
  const dariPesan = angkaRupiah(pesan);
  const dana = dariPesan ? { nilai: dariPesan, alasan: null } : danaDariKonteks(ktx);
  if (!dana) {
    return {
      teks: 'Berapa dana yang mau kamu pakai untuk upgrade kamar? Aku carikan barang yang paling berguna untuk anak kos.',
      saran: ['Budget Rp 150.000', 'Budget Rp 300.000', 'Budget Rp 500.000', 'Budget Rp 1 juta'],
    };
  }
  if (dana.nilai < 25_000) {
    return { teks: `Dengan ${rp(dana.nilai)} belum cukup untuk barang yang berguna. Coba kumpulkan hemat 2–3 bulan dulu, ya.`, saran: ['Budget Rp 150.000', 'Tips bertahan di tanggal tua'] };
  }
  const punya = ktx.cek?.input?.fasilitas || [];
  const hasil = rekomendasiUpgrade(dana.nilai, punya);
  const pembuka = dana.alasan ? `Kamu punya ${dana.alasan}. ` : '';
  const catatanKurang = ktx.cek && hasil.kurang.length ? ` Aku prioritaskan pengganti ${daftar(labelFasilitas(hasil.kurang.slice(0, 2)))} yang belum ada di kamarmu.` : '';
  return {
    teks: `${pembuka}Dengan ${rp(dana.nilai)}, ini barang yang paling terasa manfaatnya.${catatanKurang}`,
    kartu: { jenis: 'produk', ...hasil, budget: dana.nilai },
    saran: ['Budget Rp 300.000', 'Budget Rp 1 juta', 'Tips belanja hemat'],
  };
}

// ---------- Memilih kos ----------
const PRIORITAS = {
  seimbang: { label: 'seimbang', w: { harga: 0.35, jarak: 0.25, fasilitas: 0.25, aman: 0.15 } },
  hemat: { label: 'paling hemat', w: { harga: 0.6, jarak: 0.15, fasilitas: 0.15, aman: 0.1 } },
  dekat: { label: 'paling dekat', w: { harga: 0.2, jarak: 0.55, fasilitas: 0.15, aman: 0.1 } },
  fasilitas: { label: 'fasilitas lengkap', w: { harga: 0.2, jarak: 0.15, fasilitas: 0.55, aman: 0.1 } },
  aman: { label: 'paling aman', w: { harga: 0.2, jarak: 0.15, fasilitas: 0.15, aman: 0.5 } },
};
export const DAFTAR_PRIORITAS = Object.entries(PRIORITAS).map(([id, p]) => ({ id, label: p.label }));

export function prioritasDariTeks(t) {
  const s = t.toLowerCase();
  if (/murah|hemat|irit/.test(s)) return 'hemat';
  if (/dekat|jarak|jauh/.test(s)) return 'dekat';
  if (/fasilitas|lengkap|nyaman/.test(s)) return 'fasilitas';
  if (/aman|keamanan/.test(s)) return 'aman';
  return 'seimbang';
}

export const labelYakin = (yakin) => (yakin === 'tipis' ? 'Selisih tipis' : `Keyakinan ${yakin}`);

export function putuskan(a, b, prioritas = 'seimbang') {
  const w = PRIORITAS[prioritas].w;
  const nilai = (k, lawan) => {
    const harga = Math.min(k.harga, lawan.harga) / k.harga;
    const jarakS = k.jarak != null && lawan.jarak != null ? (Math.min(k.jarak, lawan.jarak) + 0.2) / (k.jarak + 0.2) : 1;
    const fas = (k.fasilitas.length + 1) / (Math.max(k.fasilitas.length, lawan.fasilitas.length) + 1);
    const aman = (k.aman || 3) / 5;
    const wajar = k.selisih_persen != null ? Math.max(0, 1 - Math.max(0, k.selisih_persen) / 30) : 1;
    return w.harga * harga * (0.8 + 0.2 * wajar) + w.jarak * jarakS + w.fasilitas * fas + w.aman * aman;
  };
  const sa = nilai(a, b);
  const sb = nilai(b, a);
  const [menang, kalah] = sa >= sb ? [a, b] : [b, a];
  const selisihSkor = Math.abs(sa - sb);

  const alasan = [];
  const dh = kalah.harga - menang.harga;
  if (dh > 0) alasan.push(`${rp(dh)} lebih murah per bulan (hemat ${rp(dh * 12)} setahun)`);
  if (menang.jarak != null && kalah.jarak != null && kalah.jarak - menang.jarak >= 0.15) alasan.push(`${jarak(kalah.jarak - menang.jarak)} lebih dekat ke tujuanmu`);
  const lebih = menang.fasilitas.filter((f) => !kalah.fasilitas.includes(f));
  if (lebih.length) alasan.push(`Punya ${daftar(labelFasilitas(lebih))} yang tidak ada di ${kalah.nama}`);
  if ((menang.aman || 0) > (kalah.aman || 0)) alasan.push('Lingkungannya dinilai lebih aman');
  if (menang.selisih_persen != null && kalah.selisih_persen != null && menang.selisih_persen + 3 < kalah.selisih_persen) alasan.push('Harganya lebih wajar menurut data pasar');
  if (menang.aksesibel && !kalah.aksesibel) alasan.push('Punya akses ramah disabilitas');
  if (!alasan.length) alasan.push('Keduanya hampir setara; skor keseluruhannya sedikit lebih tinggi');

  const keunggulanKalah = [];
  if (kalah.harga < menang.harga) keunggulanKalah.push('harga');
  if (kalah.jarak != null && menang.jarak != null && kalah.jarak < menang.jarak - 0.15) keunggulanKalah.push('jarak');
  const lebihKalah = kalah.fasilitas.filter((f) => !menang.fasilitas.includes(f));
  if (lebihKalah.length) keunggulanKalah.push(`fasilitas ${daftar(labelFasilitas(lebihKalah))}`);

  return {
    menang,
    kalah,
    yakin: selisihSkor > 0.08 ? 'tinggi' : selisihSkor > 0.03 ? 'sedang' : 'tipis',
    prioritas: PRIORITAS[prioritas].label,
    alasan: alasan.slice(0, 3),
    alternatif: keunggulanKalah.length ? `Pilih ${kalah.nama} kalau kamu lebih mementingkan ${daftar(keunggulanKalah)}.` : null,
    cek: ['Kebersihan kamar mandi & dapur', 'Sinyal internet di dalam kamar', 'Aturan jam malam dan tamu', 'Rincian biaya listrik & air'],
  };
}

function jawabKeputusan(pesan, ktx) {
  const prioritas = prioritasDariTeks(pesan);
  const pilihan = ktx.bandingkan || [];
  if (pilihan.length === 2) {
    const d = putuskan(pilihan[0], pilihan[1], prioritas);
    return {
      teks: `Untuk prioritas ${d.prioritas}, aku sarankan ${d.menang.nama}.`,
      kartu: { jenis: 'keputusan', ...d },
      saran: ['Kalau prioritasku paling hemat?', 'Kalau prioritasku paling dekat?', 'Ide upgrade kamar dari uang hemat'],
    };
  }
  const daftarKos = ktx.daftarKos || [];
  if (daftarKos.length >= 2) {
    return { teks: 'Pilih dua kos yang mau dibandingkan:', kartu: { jenis: 'pilihKos', kos: daftarKos } };
  }
  return {
    teks: 'Aku butuh data dua kos. Isi harga, jarak, dan fasilitas keduanya di halaman Bandingkan — aku bantu menimbangnya.',
    aksi: [{ label: 'Buka halaman Bandingkan', ke: '/bandingkan' }],
  };
}

// ---------- Edukasi keuangan ----------
function jawabTips(pesan) {
  const s = pesan.toLowerCase();
  const cocok = TIPS.filter((t) => t.tag.some((tag) => s.includes(tag)));
  const topik = cocok[0] || TIPS[0];
  return {
    teks: `${topik.judul}: ${topik.ringkas}`,
    kartu: { jenis: 'tips', topik },
    saran: TIPS.filter((t) => t.id !== topik.id)
      .slice(0, 2)
      .map((t) => t.judul),
    aksi: [{ label: 'Lihat semua tips keuangan', ke: '/edukasi' }],
  };
}

// ---------- Router niat ----------
export function kenaliNiat(pesan) {
  const s = pesan.toLowerCase();
  if (/upgrade|perabot|perabotan|barang|beli|belanja kamar|dekor|sisa uang|uang hemat|budget rp|^budget/.test(s)) return 'upgrade';
  if (/pilih|bandingkan|banding|a atau b|mana yang|bingung|prioritas/.test(s)) return 'keputusan';
  if (/tips|tanggal tua|hemat|tabung|nabung|darurat|listrik|keuangan|nego|atur uang|gaji|uang saku|ideal|belanja/.test(s)) return 'tips';
  if (/^(hai|halo|hi|hello|pagi|siang|sore|malam)\b/.test(s)) return 'sapa';
  return 'lain';
}

export function jawabLokal(pesan, ktx = {}) {
  const niat = kenaliNiat(pesan);
  if (niat === 'upgrade') return jawabUpgrade(pesan, ktx);
  if (niat === 'keputusan') return jawabKeputusan(pesan, ktx);
  if (niat === 'tips') {
    const t = TIPS.find((x) => x.judul.toLowerCase() === pesan.toLowerCase());
    return t ? { teks: `${t.judul}: ${t.ringkas}`, kartu: { jenis: 'tips', topik: t }, aksi: [{ label: 'Lihat semua tips keuangan', ke: '/edukasi' }] } : jawabTips(pesan);
  }
  const t = TIPS.find((x) => x.judul.toLowerCase() === pesan.toLowerCase());
  if (t) return { teks: `${t.judul}: ${t.ringkas}`, kartu: { jenis: 'tips', topik: t }, aksi: [{ label: 'Lihat semua tips keuangan', ke: '/edukasi' }] };
  return {
    teks:
      niat === 'sapa'
        ? 'Halo! Aku KOZY AI. Aku bisa bantu tiga hal: ide upgrade kamar dari uang hemat, memilih antara dua kos, dan tips keuangan anak kos.'
        : 'Aku belum paham pertanyaannya. Aku bisa bantu: ide upgrade kamar, memilih antara dua kos, atau tips keuangan anak kos.',
    saran: SARAN_AWAL,
  };
}

export async function tanyaAI(pesan, ktx = {}) {
  if (AI_URL) {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pesan, konteks: ringkasKonteks(ktx) }),
    });
    if (!res.ok) throw new Error('KOZY AI sedang sibuk. Coba lagi sebentar.');
    return res.json();
  }
  await wait(550 + Math.min(900, pesan.length * 12));
  return jawabLokal(pesan, ktx);
}

function ringkasKonteks(ktx) {
  const r = ktx.cek;
  return {
    cek: r && { kawasan: r.kawasan?.nama, status: r.status, harga: r.harga_ditawarkan, harga_wajar: r.harga_wajar, fasilitas: r.input?.fasilitas, jenis: jenisById(r.input?.jenis)?.label },
    bandingkan: ktx.bandingkan?.map((k) => ({ nama: k.nama, harga: k.harga, jarak_km: k.jarak, fasilitas: k.fasilitas.map((f) => fasilitasById(f)?.label) })),
  };
}
