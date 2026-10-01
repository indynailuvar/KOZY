// Pencatat aktivitas pemakaian untuk analisa bisnis di halaman #/admin.
//
// Sekarang tersimpan di perangkat pemakai (localStorage), karena belum ada backend.
// Kalau VITE_ANALYTICS_URL diisi, tiap kejadian juga dikirim ke sana:
//   POST { jenis, waktu, sesi, ...data }
// Yang dicatat hanya pilihan di aplikasi (kecamatan, status harga, persona, dll),
// tanpa nama, email, atau nomor siapa pun.

const KUNCI = 'kozy:jejak';
const BATAS = 800; // simpan kejadian terbaru saja
const URL_KIRIM = import.meta.env.VITE_ANALYTICS_URL;

const sesiId = () => {
  try {
    let s = sessionStorage.getItem('kozy:sesi');
    if (!s) {
      s = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('kozy:sesi', s);
    }
    return s;
  } catch {
    return 'anon';
  }
};

export function semua() {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI) || '[]');
    return Array.isArray(isi) ? isi : [];
  } catch {
    return [];
  }
}

export function catat(jenis, data = {}) {
  // `jenis` ditaruh terakhir supaya tidak tertimpa kalau data ikut punya kunci bernama sama
  const kejadian = { ...data, jenis, waktu: new Date().toISOString(), sesi: sesiId() };
  try {
    localStorage.setItem(KUNCI, JSON.stringify([...semua(), kejadian].slice(-BATAS)));
  } catch {
    /* mode privat: abaikan */
  }
  if (URL_KIRIM) {
    try {
      const blob = new Blob([JSON.stringify(kejadian)], { type: 'application/json' });
      navigator.sendBeacon ? navigator.sendBeacon(URL_KIRIM, blob) : fetch(URL_KIRIM, { method: 'POST', body: blob, keepalive: true });
    } catch {
      /* jangan pernah mengganggu pemakaian */
    }
  }
  return kejadian;
}

export function hapus() {
  try {
    localStorage.removeItem(KUNCI);
  } catch {
    /* abaikan */
  }
}

// ---------- ringkasan untuk dashboard ----------
const hariKe = (iso) => iso.slice(0, 10);
export const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function deretHarian(kejadian, jenis, jumlahHari = 14) {
  const hitung = {};
  for (const k of kejadian) if (!jenis || jenis.includes(k.jenis)) hitung[hariKe(k.waktu)] = (hitung[hariKe(k.waktu)] || 0) + 1;
  const keluar = [];
  for (let i = jumlahHari - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const kunci = d.toISOString().slice(0, 10);
    keluar.push({ kunci, label: `${d.getDate()}/${d.getMonth() + 1}`, nilai: hitung[kunci] || 0 });
  }
  return keluar;
}

export function hitungPer(kejadian, jenis, kolom) {
  const h = {};
  for (const k of kejadian) {
    if (k.jenis !== jenis) continue;
    const v = k[kolom];
    if (v == null || v === '') continue;
    h[v] = (h[v] || 0) + 1;
  }
  return Object.entries(h)
    .map(([label, nilai]) => ({ label, nilai }))
    .sort((a, b) => b.nilai - a.nilai);
}

export const jumlah = (kejadian, jenis) => kejadian.filter((k) => k.jenis === jenis).length;

// perbandingan 7 hari terakhir dengan 7 hari sebelumnya (untuk slopegraph)
export function duaPekan(kejadian, jenis) {
  const batas = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };
  const p14 = batas(14);
  const p7 = batas(7);
  const dalam = kejadian.filter((k) => k.jenis === jenis);
  return { lalu: dalam.filter((k) => k.waktu >= p14 && k.waktu < p7).length, ini: dalam.filter((k) => k.waktu >= p7).length };
}
