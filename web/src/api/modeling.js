// Model KOZY tanpa server. Angka diambil dari src/data/model.json yang
// diekspor oleh scripts/build_model_statis.py dari bundle modeling, lalu
// dihitung di browser dengan rumus yang sama dengan backend lama:
//   segmen     = cluster K-Prototypes terdekat (jarak kuadrat harga log robust
//                + gamma x jumlah kategori kecamatan/jenis yang berbeda)
//   gap harga  = selisih terhadap median, Q1 dan Q3 kecamatan x jenis
// Fungsi tetap async supaya halaman yang memanggilnya tidak perlu diubah.
import MODEL from '../data/model.json';

const { ringkasan, kprototypes: KP } = MODEL;
const { kecamatan: KEC, jenis: JENIS } = ringkasan.segmentasi.kategori;

const gagal = (pesan) => Promise.reject(new Error(pesan));

export const getModelingSummary = async () => ringkasan;

export async function classifyPrice({ harga, kecamatan, jenis }) {
  if (!(harga > 0)) return gagal('Harga harus lebih dari 0.');
  if (!KEC.includes(kecamatan)) return gagal('Kecamatan tidak termasuk kategori training bundle.');
  if (!JENIS.includes(jenis)) return gagal('Jenis kos tidak termasuk kategori training bundle.');

  const x = (Math.log(harga) - KP.log_harga_median) / KP.log_harga_iqr;
  let cluster_id = 0;
  let terdekat = Infinity;
  KP.pusat.forEach(([h, k, j], i) => {
    const jarak = (x - h) ** 2 + KP.gamma * ((kecamatan !== k) + (jenis !== j));
    if (jarak < terdekat) {
      terdekat = jarak;
      cluster_id = i;
    }
  });
  return {
    cluster_id,
    segmen: ringkasan.segmentasi.profil.find((p) => p.cluster_id === cluster_id),
    model: ringkasan.segmentasi.metadata.model,
    jumlah_listing: ringkasan.segmentasi.metadata.jumlah_listing,
  };
}

export async function analyzePriceGap({ harga, kecamatan, jenis }) {
  const data = ringkasan.gap_harga.benchmark.find((b) => b.kec === kecamatan && b.jenis === jenis);
  if (!data) return gagal('Benchmark untuk kecamatan dan jenis ini tidak tersedia.');
  const gap = harga - data.median;
  return {
    harga_diuji: harga,
    benchmark: data,
    gap_rp_dari_median: Math.round(gap),
    gap_iqr: data.iqr ? Math.round((gap / data.iqr) * 1000) / 1000 : null,
    posisi_q1_q3: harga < data.q1 ? 'di_bawah_q1' : harga > data.q3 ? 'di_atas_q3' : 'dalam_iqr',
    catatan: 'Benchmark menggambarkan listing dalam dataset, bukan seluruh pasar.',
  };
}

// Forecast omzet paket dari hasil Chronos-2 yang sudah dihitung untuk setiap
// pilihan di layar Admin. File dimuat saat tab Omzet dibuka saja.
export async function forecastOmzet({ pembeli_awal, pertumbuhan_persen, horizon }) {
  const F = (await import('../data/forecast_omzet.json')).default;
  const g = Math.round(pertumbuhan_persen * 2) / 2;
  const baris = F.hasil[`${pembeli_awal}|${g}`];
  if (!baris) return gagal('Kombinasi ini belum dihitung. Pilih nilai dari daftar.');

  const [th, bl] = F.akhir_histori.split('-').map(Number);
  const geser = (n) => {
    const i = th * 12 + bl - 1 + n;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`;
  };
  const histori = [];
  for (let langkah = -35; langkah <= 0; langkah++) {
    const bulan = geser(langkah);
    const musim = F.musim[Number(bulan.slice(5, 7)) - 1];
    histori.push({ bulan, pembeli: Math.max(0, Math.round(pembeli_awal * (1 + g / 100) ** (langkah + 35) * musim)) });
  }
  const forecast = baris.slice(0, horizon).map(([p10, p50, p90], i) => ({
    bulan: geser(i + 1),
    pembeli_p10: p10,
    pembeli_p50: p50,
    pembeli_p90: p90,
    omzet_p10: p10 * F.harga_paket,
    omzet_p50: p50 * F.harga_paket,
    omzet_p90: p90 * F.harga_paket,
  }));
  return {
    model: F.model,
    dihitung: F.dihitung,
    harga_paket: F.harga_paket,
    pilihan: F.pilihan,
    histori,
    forecast,
    ringkasan: {
      pembeli_p50_total: forecast.reduce((s, x) => s + x.pembeli_p50, 0),
      omzet_p50_total: forecast.reduce((s, x) => s + x.omzet_p50, 0),
    },
  };
}
