// Dashboard tim KOZY. Dibuka lewat #/internal dan dilindungi kode akses di
// Internal.jsx; tidak pernah ditautkan dari halaman mana pun. Dashboard untuk
// PEMILIK KOS adalah halaman yang berbeda (#/pemilik) dan isinya tidak sama:
// pemilik membaca pasarnya sendiri, bukan mutu dataset atau aktivitas pengguna.
// Angkanya dihitung langsung dari berkas data, tanpa angka yang ditulis tangan:
//   pasar.json  iklan sewa berharga asli (Mamikos + Papikost) — dasar pembanding harga
//   gmaps.json  titik lokasi tanpa harga — ditampilkan dengan kisaran kos sejenis sekecamatan
//   olx.json    rumah kos DIJUAL — sisi pemilik, sengaja dipisah dari harga sewa
import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Lembar from '../components/Lembar.jsx';
import Belum from '../components/Belum.jsx';
import { Angka, BarH, Corong, Garis, GarisRentang, Heatmap, Histogram, Kartu, Sebar, Tabel, Tumpuk100, rpJuta } from '../components/Grafik.jsx';
import { Button, PageHead, Segmented } from '../components/ui.jsx';
import { KAWASAN, FASILITAS, JENIS_KOS, PASAR } from '../data/surabaya.js';
import { GMAPS, KAWASAN_TERCAKUP, OLX, nilaiHarga, pembanding } from '../api/kozy.js';
import { rp, tanggal } from '../lib/format.js';
import { go } from '../router.js';
import { deretHarian, hapus as hapusJejak, hitungPer, jumlah, semua } from '../lib/jejak.js';

const M = PASAR.meta;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

const KOSONG = 'Belum ada aktivitas. Grafik terisi sendiri begitu ada yang memakai aplikasinya.';

function DaftarAtau({ data, format, label, kosong = KOSONG }) {
  if (!data.length) return <p className="g-kosong">{kosong}</p>;
  return <BarH data={data} format={format} label={label} />;
}

export default function Admin({ query = {}, prefix = '/internal' }) {
  const bagian = ['aktivitas', 'model', 'omzet'].includes(query.tab) ? query.tab : 'data';
  const [ukur, setUkur] = useState('median');
  const [jejak, setJejak] = useState(semua);
  const [omzetParams, setOmzetParams] = useState({ pembeli_awal: 6, pertumbuhan_persen: 3, horizon: 12 });
  const [omzetData, setOmzetData] = useState(null);
  const [omzetLoading, setOmzetLoading] = useState(false);
  const [omzetError, setOmzetError] = useState('');
  // aktivitas bisa bertambah dari tab lain, jadi dibaca ulang saat halaman ini kembali aktif
  useEffect(() => {
    const muat = () => setJejak(semua());
    window.addEventListener('focus', muat);
    window.addEventListener('storage', muat);
    document.addEventListener('visibilitychange', muat);
    return () => {
      window.removeEventListener('focus', muat);
      window.removeEventListener('storage', muat);
      document.removeEventListener('visibilitychange', muat);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [bagian]);
  const muatOmzet = async (params = omzetParams) => {
    setOmzetLoading(true);
    setOmzetError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/forecast/omzet-paket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Forecast omzet gagal dimuat.');
      setOmzetData(data);
    } catch (error) {
      setOmzetError(error.message || 'Forecast omzet gagal dimuat.');
      setOmzetData(null);
    } finally {
      setOmzetLoading(false);
    }
  };
  useEffect(() => {
    if (bagian === 'omzet' && !omzetData && !omzetLoading) muatOmzet();
  }, [bagian]); // eslint-disable-line react-hooks/exhaustive-deps
  const kos = PASAR.kos;
  const kecs = Object.entries(PASAR.kecamatan);

  const [semuaKec, setSemuaKec] = useState(false);
  const TOP = 6; // jumlah kecamatan yang ditampilkan sebelum "lihat semua"

  const d = useMemo(() => {
    const harga = kos.map((k) => k.harga);
    const urutHarga = [...kecs].sort((a, b) => b[1].p50 - a[1].p50);
    const urutData = [...kecs].sort((a, b) => b[1].n - a[1].n);

    const step = 250_000;
    const akhir = Math.ceil(Math.max(...harga) / step) * step;
    const bins = [];
    for (let x = 0; x < akhir; x += step) {
      const jumlah = harga.filter((h) => h >= x && h < x + step).length;
      if (jumlah || x > 250_000) bins.push({ lo: x, hi: x + step, jumlah });
    }
    const puncak = bins.reduce((a, b) => (b.jumlah > a.jumlah ? b : a), bins[0]);
    puncak.sorot = true;

    // kelompok pembanding kecamatan × jenis, urut dari yang iklannya paling banyak
    const kelompok = kecs
      .flatMap(([kec, s]) => JENIS_KOS.filter((j) => s.benchmark[j.id]).map((j) => ({ kec, jenis: j.label, ...s.benchmark[j.id] })))
      .sort((x, y) => y.n - x.n);
    const prioritas = kelompok.filter((g) => g.n >= M.min_pembanding);
    const lebarKisaran = prioritas.map((g) => ({ label: `${g.kec} · ${g.jenis.toLowerCase()}`, nilai: g.iqr, sub: `${g.n} iklan` })).sort((x, y) => y.nilai - x.nilai);
    lebarKisaran[0].sorot = true;

    // tiap iklan dicek terhadap pembandingnya sendiri, persis seperti Cek Harga
    const vonisIklan = { MURAH: 0, WAJAR: 0, KEMAHALAN: 0 };
    let ekstrem = 0;
    for (const k of kos) {
      const v = nilaiHarga(k.harga, pembanding(k.kec, k.jenis));
      vonisIklan[v.status]++;
      if (v.ekstrem) ekstrem++;
    }

    // harga menurut jumlah fasilitas tercatat
    const perJumlah = [];
    for (let i = 0; i <= FASILITAS.length; i++) {
      const g = kos.filter((k) => k.fasilitas.length === i);
      if (g.length >= 3) perJumlah.push({ x: i, y: median(g.map((k) => k.harga)), n: g.length });
    }

    const tanpaData = KAWASAN.filter((k) => !KAWASAN_TERCAKUP.includes(k));

    // perbandingan peran tiap sumber: apa yang dibawa, apa yang kosong
    const ADA = 'ada';
    const KOSONG_ = 'kosong';
    const sumber = [
      ['Mamikos', M.n_sumber.Mamikos, ADA, KOSONG_, '6 jenis', 'pembanding harga + KOZY Match'],
      ['Papikost', M.n_sumber.Papikost, ADA, ADA, '10 jenis', 'pembanding harga + pin peta asli'],
      ['Google Maps', GMAPS.meta.n, KOSONG_, ADA, KOSONG_, 'jangkauan lokasi, harga = kisaran kecamatan'],
      ['OLX', OLX.meta.n, 'harga jual', 'kasar', KOSONG_, 'sisi pemilik, tidak untuk harga sewa'],
    ];

    // OLX: harga jual per kamar tiap kecamatan (median, supaya satu iklan besar tidak menyetir)
    const olxKec = Object.entries(
      OLX.kos.reduce((acc, k) => {
        (acc[k.kec] = acc[k.kec] || []).push(k.per_kamar);
        return acc;
      }, {}),
    )
      .map(([label, v]) => ({ label, nilai: median(v), sub: `${v.length} iklan` }))
      .sort((x, y) => y.nilai - x.nilai);
    if (olxKec.length) olxKec[0].sorot = true;
    // sumber kedua: titik Google Maps (koordinatnya asli, harganya kisaran kos sejenis sekecamatan).
    // Kecamatan dengan iklan < min_iklan_kec memakai kisaran kota, sama dengan scripts/build_gmaps.py.
    const punyaKisaran = (kec) => (PASAR.kecamatan[kec]?.n || 0) >= M.min_iklan_kec;
    const perKecGmaps = Object.entries(GMAPS.kos.reduce((acc, k) => ({ ...acc, [k.kec]: (acc[k.kec] || 0) + 1 }), {}))
      .map(([label, nilai]) => ({ label, nilai, sub: punyaKisaran(label) ? 'kisaran kecamatan' : 'kisaran kota', sorot: punyaKisaran(label) }))
      .sort((x, y) => y.nilai - x.nilai);
    return {
      harga,
      median: median(harga),
      urutHarga,
      urutData,
      bins,
      puncak,
      kelompok,
      prioritas,
      lebarKisaran,
      vonisIklan,
      ekstrem,
      perJumlah,
      tanpaData,
      kecTanpaData: [...new Set(tanpaData.map((k) => k.kec))],
      titikTanpaHarga: GMAPS.kos.filter((k) => !punyaKisaran(k.kec)).length,
      perKecGmaps,
      sumber,
      olxKec,
      berkoordinat: kos.filter((k) => k.lat).length,
      rating: kos.filter((k) => k.rating).length,
      promo: kos.filter((k) => k.promo).length,
      maxHarga: Math.max(...harga),
    };
  }, [kos, kecs]);

  const a = useMemo(() => {
    const sesi = new Set(jejak.map((k) => k.sesi)).size;
    const cekSelesai = jumlah(jejak, 'cek_selesai');
    const bayar = jumlah(jejak, 'bayar');
    const beranda = jejak.filter((k) => k.jenis === 'halaman' && k.path === '/').length;
    const tanpaData = [...hitungPer(jejak, 'area_belum_data', 'kec'), ...hitungPer(jejak, 'luar_cakupan', 'nama')].sort((x, y) => y.nilai - x.nilai).slice(0, 6);
    const gabung = (daftar) =>
      daftar
        .reduce((acc, x) => {
          const ada = acc.find((y) => y.label === x.label);
          if (ada) ada.nilai += x.nilai;
          else acc.push({ ...x });
          return acc;
        }, [])
        .sort((x, y) => y.nilai - x.nilai)
        .slice(0, 6);
    const areaDicek = gabung([...hitungPer(jejak, 'cek_selesai', 'kawasan'), ...hitungPer(jejak, 'area_dipilih', 'kawasan')]);
    const vonis = hitungPer(jejak, 'cek_selesai', 'status');
    for (const d of [areaDicek, tanpaData, vonis]) if (d[0]) d[0].sorot = true;
    return {
      sesi,
      cekSelesai,
      cariSelesai: jumlah(jejak, 'cari_selesai'),
      bayar,
      konversi: cekSelesai ? Math.round((bayar / cekSelesai) * 100) : 0,
      deret: deretHarian(jejak, ['cek_selesai', 'cari_selesai']),
      corong: [
        { label: 'Buka beranda', nilai: beranda },
        { label: 'Mulai cek harga', nilai: jumlah(jejak, 'cek_mulai') },
        { label: 'Lihat hasil', nilai: cekSelesai },
        { label: 'Buka paywall', nilai: jumlah(jejak, 'match_dikunci') },
        { label: 'Bayar', nilai: bayar },
      ],
      areaDicek,
      tanpaData,
      vonis,
      terakhir: [...jejak].reverse().slice(0, 8),
    };
  }, [jejak]);

  const nilaiKec = ([nama, s]) => ({
    label: nama,
    sub: `${s.n} iklan`,
    nilai: ukur === 'median' ? s.p50 : s.n,
  });
  // Daftar kecamatan dipotong ke TOP teratas. Menampilkan seluruh 14-16 baris
  // di tiap grafik membuat satu kartu setinggi 900-1.140 px, dan ekornya nyaris
  // tidak pernah dibaca. Sisanya tetap bisa dibuka lewat satu tombol.
  const potong = (arr) => (semuaKec ? arr : arr.slice(0, TOP));
  const SemuaKec = () =>
    d.urutData.length > TOP ? (
      <button type="button" className="text-btn" onClick={() => setSemuaKec((v) => !v)}>
        {semuaKec ? `Tampilkan ${TOP} teratas` : `Lihat semua ${d.urutData.length} kecamatan`}
      </button>
    ) : null;

  const dataKec = potong(ukur === 'median' ? d.urutHarga : d.urutData).map(nilaiKec);
  dataKec[0].sorot = true;

  return (
    <div className="page admin">
      <PageHead
        judul="Dashboard internal KOZY"
        sub={`${M.n} iklan ${M.sumber} · ${tanggal(M.diambil)}`}
        aksi={
          <a className="text-btn" href="#/">
            Ke aplikasi <Icon name="arrowr" size={15} />
          </a>
        }
      />

      <div className="admin-tab">
        <Segmented
          label="Bagian dashboard"
          value={bagian}
          onChange={(v) => go(v === 'data' ? prefix : `${prefix}?tab=${v}`)}
          options={[
            { id: 'data', label: 'Data pasar', icon: 'bars' },
            { id: 'aktivitas', label: 'Aktivitas', icon: 'trend' },
            { id: 'model', label: 'Metode', icon: 'calc' },
            { id: 'omzet', label: 'Omzet paket', icon: 'wallet' },
          ]}
        />
      </div>

      {bagian === 'data' && (
        /* Dipecah per lembar, bukan satu gulungan sepanjang 10 layar.
           Urutannya mengikuti alur cerita: ringkasan dulu, baru sebaran
           harga, apa yang menentukannya, komposisi pasar, dari mana
           datanya, dan terakhir apa yang belum bisa dijanjikan. */
        <Lembar
          label="Dashboard data"
          lembar={[
            {
              id: 'ringkas',
              judul: 'Ringkasan',
              isi: (
                <>
              <Angka
                items={[
                  {
                    nilai: M.n,
                    label: 'iklan sewa berharga asli',
                    sub: `${M.n_sumber.Mamikos} Mamikos + ${M.n_sumber.Papikost} Papikost · ${M.kecamatan} kecamatan`,
                  },
                  {
                    nilai: rp(d.median),
                    label: 'median harga sewa',
                    sub: `terendah ${rpJuta(Math.min(...d.harga))} · tertinggi ${rpJuta(d.maxHarga)}`,
                  },
                  {
                    nilai: d.prioritas.length,
                    label: 'kelompok pembanding siap pakai',
                    sub: `kecamatan × jenis dengan ≥ ${M.min_pembanding} iklan, dari ${d.kelompok.length} kelompok`,
                  },
                  {
                    nilai: `${Math.round((d.prioritas.reduce((t, g) => t + g.n, 0) / M.n) * 100)}%`,
                    label: 'iklan di kelompok itu',
                    sub: 'sisanya dibandingkan per kecamatan',
                  },
                ]}
              />
              <Kartu
                judul={
                  ukur === 'median'
                    ? `${d.urutHarga[0][0]} paling mahal, ${d.urutHarga[d.urutHarga.length - 1][0]} paling murah`
                    : `${d.urutData[0][0]} menyumbang ${Math.round((d.urutData[0][1].n / M.n) * 100)}% data`
                }
                sub={ukur === 'median' ? 'Median harga sewa per bulan tiap kecamatan' : 'Jumlah iklan yang terkumpul tiap kecamatan'}
              >
                <Segmented
                  label="Ukuran"
                  value={ukur}
                  onChange={setUkur}
                  options={[
                    { id: 'median', label: 'Median harga' },
                    { id: 'jumlah', label: 'Jumlah iklan' },
                  ]}
                />
                <BarH data={dataKec} format={ukur === 'median' ? rpJuta : (v) => `${v}`} label={ukur === 'median' ? 'Median harga per kecamatan' : 'Jumlah iklan per kecamatan'} />
                <SemuaKec />
              </Kartu>
                </>
              ),
            },
            {
              id: 'sebaran',
              judul: 'Sebaran',
              isi: (
                <>
              <Kartu
                judul={`Harga paling menumpuk di ${rpJuta(d.puncak.lo)} – ${rpJuta(d.puncak.hi)}`}
                sub={`Sebaran ${M.n} harga iklan, dikelompokkan per Rp 250 rb`}
                lebar
              >
                <Histogram bins={d.bins} format={rpJuta} label="Sebaran harga kos" />
              </Kartu>
              <Kartu
                judul="Makin lengkap fasilitas makin mahal, tapi sebarannya lebar"
                sub="Tiap titik satu iklan kos. Garis biru = median tiap kelompok"
                lebar
              >
                <Sebar
                  label={`Hubungan jumlah fasilitas dengan harga. Median: ${d.perJumlah.map((p) => `${p.x} fasilitas ${rpJuta(p.y)}`).join(', ')}.`}
                  titik={kos.map((k) => ({ x: k.fasilitas.length, y: k.harga }))}
                  rata={d.perJumlah}
                  xMax={FASILITAS.length}
                  yMax={4_000_000}
                  xLabel="Jumlah fasilitas tercatat"
                  yLabel="Harga/bulan"
                />
              </Kartu>
                </>
              ),
            },
            {
              id: 'pembanding',
              judul: 'Pembanding',
              isi: (
                <>
              <Kartu
                judul={`${d.prioritas.length} kelompok cukup besar untuk jadi pembanding`}
                sub={`Median dan kisaran wajar (Q1–Q3) tiap kecamatan × jenis kos. ${d.kelompok.length - d.prioritas.length} kelompok lain di bawah ${M.min_pembanding} iklan masih eksploratif, jadi kos di sana dibandingkan dengan seluruh kecamatannya`}
                lebar
              >
                <Tabel
                  label="Kelompok pembanding harga"
                  kolom={['Kecamatan', 'Jenis', 'Iklan', 'Median', 'Kisaran wajar', 'IQR']}
                  baris={d.prioritas.map((g) => [g.kec, g.jenis, g.n, rpJuta(g.median), `${rpJuta(g.q1)} – ${rpJuta(g.q3)}`, rpJuta(g.iqr)])}
                />
              </Kartu>
              <Kartu
                judul={`Kisaran paling lebar: ${d.lebarKisaran[0].label}`}
                sub="Lebar kisaran wajar (IQR) tiap kelompok. Makin lebar, makin beragam harga kos sejenis di sana, jadi makin longgar batas wajarnya"
              >
                <BarH data={d.lebarKisaran} format={rpJuta} label="Lebar kisaran wajar tiap kelompok pembanding" />
              </Kartu>
                </>
              ),
            },
            {
              id: 'komposisi',
              judul: 'Kecamatan',
              isi: (
                <>
              <Kartu
                judul="WiFi hampir merata, AC dan kamar mandi dalam masih timpang"
                sub="Persentase kos yang punya tiap fasilitas. Kloset dan akses 24 jam tidak dicatat Papikost, jadi kecamatan yang datanya hanya dari sana memakai rata-rata kota"
                lebar
              >
                <Heatmap
                  label="Kelengkapan fasilitas per kecamatan"
                  kolom={FASILITAS.map((f) => ({ id: f.id, label: f.label }))}
                  baris={potong(d.urutData).map(([nama, s]) => ({
                    label: nama,
                    nilai: s.fasilitas,
                  }))}
                />
              </Kartu>
              <Kartu
                judul="Kos putri mendominasi di hampir semua kecamatan"
                sub="Komposisi jenis kos, tiap baris 100%"
              >
                <Tumpuk100
                  label="Komposisi jenis kos per kecamatan"
                  seri={JENIS_KOS.map((j) => ({ id: j.id, label: j.label }))}
                  baris={potong(d.urutData).map(([nama, s]) => ({
                    label: nama,
                    nilai: s.komposisi,
                  }))}
                />
              </Kartu>
                </>
              ),
            },
            {
              id: 'sumber',
              judul: 'Sumber',
              isi: (
                <>
              <Kartu
                judul="Tidak ada satu sumber pun yang lengkap sendirian"
                sub="Apa yang dibawa tiap sumber, dan apa yang kosong di sana"
                lebar
              >
                <Tabel label="Peran tiap sumber data" kolom={['Sumber', 'Jumlah', 'Harga sewa', 'Koordinat', 'Fasilitas', 'Dipakai untuk']} baris={d.sumber} />
              </Kartu>
              <Kartu
                judul={`Rumah kos dijual rata-rata Rp ${(OLX.ringkas.median_per_kamar / 1e6).toFixed(0)} juta per kamar`}
                sub={`Median harga jual dibagi jumlah kamar. Imbal hasil kotor ${String(OLX.ringkas.median_imbal_hasil).replace('.', ',')}% per tahun, balik modal ${String(OLX.ringkas.median_balik_modal).replace('.', ',')} tahun`}
                lebar
              >
                <BarH data={d.olxKec} format={(v) => `Rp ${(v / 1e6).toFixed(0)} jt`} label="Harga jual per kamar tiap kecamatan" />
              </Kartu>
                </>
              ),
            },
            {
              id: 'batas',
              judul: 'Batas data',
              isi: (
                <>
              <Kartu judul="Yang masih kosong di data" sub="Penentu fitur mana yang belum bisa dijanjikan ke pengguna" lebar>
                <ul className="admin-gap">
                  <li>
                    <b>{d.kecTanpaData.length} kecamatan belum ada datanya</b>
                    <span>
                      {d.kecTanpaData.join(', ')}. {d.tanpaData.length} kawasan di aplikasi memunculkan pesan "belum ada data".
                    </span>
                  </li>
                  <li>
                    <b>Luas kamar dan nomor pemilik kosong di semua sumber</b>
                    <span>Luas tidak ikut dihitung, tombol kontak diganti tautan ke sumbernya.</span>
                  </li>
                  <li>
                    <b>Fasilitas kos tidak ada di Google Maps</b>
                    <span>{GMAPS.meta.n} titik itu hanya bisa dipakai untuk lokasi; harganya ditampilkan sebagai kisaran kos sejenis di kecamatannya.</span>
                  </li>
                  <li>
                    <b>Fasilitas hanya tercatat ada atau tidak</b>
                    <span>Karena itu fasilitas tidak dipakai menghitung posisi harga: kosong di iklan bisa berarti tidak ditulis, bukan tidak ada.</span>
                  </li>
                </ul>
              </Kartu>
                </>
              ),
            },
          ]}
        />
      )}

      {bagian === 'aktivitas' && (
        /* Sama seperti tab data: dipecah per lembar supaya tidak jadi
           gulungan panjang. Urutannya mengikuti pertanyaan yang biasa
           diajukan: seberapa ramai, apakah berujung bayar, apa yang
           dicari, bagaimana hasilnya, lalu kejadian mentahnya. */
        <Lembar
          label="Aktivitas pengguna"
          lembar={[
            {
              id: 'ramai',
              judul: 'Ramai',
              isi: (
                <>
              <Angka
                items={[
                  {
                    nilai: a.sesi,
                    label: 'sesi tercatat',
                    sub: `${jejak.length} kejadian tersimpan`,
                  },
                  {
                    nilai: a.cekSelesai,
                    label: 'cek harga selesai',
                    sub: `${a.cariSelesai} pencarian kos`,
                  },
                  {
                    nilai: a.bayar,
                    label: 'KOZY Match dibuka',
                    sub: `konversi ${a.konversi}% dari cek harga`,
                  },
                  {
                    nilai: a.tanpaData.reduce((t, x) => t + x.nilai, 0),
                    label: 'permintaan area tanpa data',
                    sub: 'antrean prioritas scraping',
                  },
                ]}
              />
              <Kartu
                judul={a.deret.some((x) => x.nilai) ? 'Aktivitas 14 hari terakhir' : 'Aktivitas harian belum terisi'}
                sub="Jumlah cek harga dan pencarian kos per hari"
                lebar
              >
                <Garis titik={a.deret} label="Aktivitas harian" kosong={KOSONG} />
              </Kartu>
                </>
              ),
            },
            {
              id: 'corong',
              judul: 'Corong',
              isi: (
                <>
              <Kartu
                judul={a.corong[0].nilai ? `Dari ${a.corong[0].nilai} kunjungan beranda, ${a.bayar} berujung bayar` : 'Corong pemakaian belum terisi'}
                sub="Tiap tahap dibandingkan dengan jumlah kunjungan beranda"
              >
                <Corong tahap={a.corong} label="Corong pemakaian" />
              </Kartu>
              <Kartu
                judul="Hasil vonis harga"
                sub="Sebaran status dari cek harga yang sudah dijalankan"
              >
                <DaftarAtau data={a.vonis} format={(v) => `${v}`} label="Sebaran status hasil cek" />
              </Kartu>
                </>
              ),
            },
            {
              id: 'dicari',
              judul: 'Yang dicari',
              isi: (
                <>
              <Kartu
                judul="Area yang paling sering dicek"
                sub="Gabungan hasil cek harga dan area yang dibuka dari rekomendasi"
              >
                <DaftarAtau data={a.areaDicek} format={(v) => `${v}`} label="Area paling sering dicek" />
              </Kartu>
              <Kartu
                judul="Permintaan area yang datanya belum ada"
                sub="Tercatat tiap kali pengguna mengetik area di luar cakupan"
              >
                <DaftarAtau data={a.tanpaData} format={(v) => `${v}`} label="Permintaan area tanpa data" kosong="Belum ada permintaan area di luar cakupan." />
              </Kartu>
                </>
              ),
            },
            {
              id: 'mentah',
              judul: 'Terbaru',
              isi: (
                <>
              <Kartu judul="Kejadian terakhir" sub="8 aktivitas paling baru" lebar>
                {a.terakhir.length ? (
                  <Tabel
                    label="Kejadian terakhir"
                    kolom={['Waktu', 'Kejadian', 'Rincian']}
                    baris={a.terakhir.map((k) => [
                      new Date(k.waktu).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                      k.jenis,
                      Object.entries(k)
                        .filter(([kunci]) => !['jenis', 'waktu', 'sesi'].includes(kunci))
                        .map(([kunci, v]) => `${kunci}: ${v}`)
                        .join(' · ') || '–',
                    ])}
                  />
                ) : (
                  <p className="g-kosong">{KOSONG}</p>
                )}
                <div className="admin-act">
                  <Button size="sm" variant="secondary" icon="refresh" onClick={() => setJejak(semua())}>
                    Muat ulang data
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="trash"
                    onClick={() => {
                      hapusJejak();
                      setJejak([]);
                    }}
                  >
                    Hapus data aktivitas
                  </Button>
                </div>
              </Kartu>
                </>
              ),
            },
          ]}
        />
      )}


      {bagian === 'model' && (
        /* Tab ini menjawab tiga pertanyaan penguji yang berbeda dari dua tab
           sebelumnya: bagaimana harga dinilai, bagaimana metodenya berperilaku
           di data sendiri, dan apa yang belum bisa diramalkan. Yang belum ada
           datanya ditandai terus terang, bukan diisi angka tebakan. */
        <Lembar
          label="Metode dan ramalan"
          lembar={[
            {
              id: 'metode',
              judul: 'Metode',
              isi: (
                <>
                  <Angka
                    items={[
                      { nilai: 'Median & IQR', label: 'cara menilai harga', sub: 'Robust Statistical Benchmarking, tanpa regresi' },
                      { nilai: M.min_pembanding, label: 'iklan minimal per kelompok', sub: 'di bawahnya dibandingkan per kecamatan' },
                      { nilai: d.prioritas.length, label: 'kelompok kecamatan × jenis', sub: `mencakup ${d.prioritas.reduce((t, g) => t + g.n, 0)} dari ${M.n} iklan` },
                      { nilai: d.ekstrem, label: 'iklan berharga ekstrem', sub: 'di luar pagar 1,5 × IQR kelompoknya' },
                    ]}
                  />
                  <Kartu judul="Aturan yang sama dipakai di semua halaman" sub="Cek Harga, KOZY Match, Kartu Tawar, dan dashboard pemilik membaca angka yang sama" lebar>
                    <ul className="admin-gap">
                      <li>
                        <b>Pembanding: kos sejenis di kecamatan yang sama</b>
                        <span>Putra, putri, dan campur dipisah karena tingkat harganya berbeda jauh. Kelompok di bawah {M.min_pembanding} iklan diganti seluruh kecamatan.</span>
                      </li>
                      <li>
                        <b>Wajar = kuartil 1 sampai kuartil 3</b>
                        <span>Di atas Q3 ditandai kemahalan, di bawah Q1 murah. Median dipakai sebagai acuan selisih karena tidak terseret harga ekstrem.</span>
                      </li>
                      <li>
                        <b>Ekstrem = di luar Q1 − 1,5 × IQR sampai Q3 + 1,5 × IQR, atau di luar harga termurah–termahal</b>
                        <span>Harga seperti ini diberi catatan supaya dipastikan dulu, bukan otomatis dicap salah.</span>
                      </li>
                      <li>
                        <b>Fasilitas tidak ikut menghitung</b>
                        <span>Di iklan, fasilitas hanya tercatat ada atau tidak dan sering tidak ditulis, jadi tidak cukup andal untuk menggeser harga acuan.</span>
                      </li>
                    </ul>
                  </Kartu>
                  <Kartu
                    judul={`Kalau ${M.n} iklan itu sendiri dicek, ${d.vonisIklan.WAJAR} masuk kisaran wajar`}
                    sub="Tiap iklan dibandingkan dengan kelompoknya sendiri. Sekitar separuh memang jatuh di Q1–Q3; itulah arti kisaran wajar"
                  >
                    <BarH
                      data={[
                        { label: 'Murah (di bawah Q1)', nilai: d.vonisIklan.MURAH },
                        { label: 'Wajar (Q1–Q3)', nilai: d.vonisIklan.WAJAR, sorot: true },
                        { label: 'Kemahalan (di atas Q3)', nilai: d.vonisIklan.KEMAHALAN },
                      ]}
                      format={(v) => `${v} iklan`}
                      label="Sebaran status iklan terhadap pembandingnya sendiri"
                    />
                  </Kartu>
                </>
              ),
            },
            {
              id: 'ramalharga',
              judul: 'Ramalan',
              isi: (
                <>
                  <Belum
                    keadaan="mustahil"
                    judul="Kenaikan harga kos belum bisa diramalkan"
                    syarat={`iklan yang sama di-scrape ulang secara berkala. Dengan 3–4 putaran berjarak sebulan, kenaikannya sudah bisa dihitung.`}
                  >
                    Meramalkan kenaikan harga butuh harga yang sama diukur di dua waktu berbeda. Data sekarang baru satu kali pengambilan per sumber
                    {' '}({Object.entries(M.diambil_per_sumber).map(([k, v]) => `${k} ${tanggal(v)}`).join(', ')}) Selisih kedua tanggal itu perbedaan antar situs, bukan
                    perubahan harga.
                  </Belum>
                  <Kartu
                    judul="Yang sudah siap begitu data berikutnya masuk"
                    sub="Perhitungannya tinggal dijalankan ulang, tidak perlu dibangun dari awal"
                    lebar
                  >
                    <ul className="admin-gap">
                      <li>
                        <b>Pembanding per kecamatan × jenis sudah tersusun</b>
                        <span>Kenaikan harga nanti cukup dibaca dari median tiap kelompok antar putaran; karena median, satu-dua iklan ekstrem tidak membuat kenaikannya semu.</span>
                      </li>
                      <li>
                        <b>Satu perintah untuk menghitung ulang</b>
                        <span>scripts/build_pasar.py membaca hasil scraping baru, menghitung ulang median dan kuartil, dan menolak jalan kalau datanya cacat.</span>
                      </li>
                      <li>
                        <b>Tanggal pengambilan sudah dicatat per sumber</b>
                        <span>Putaran scraping berikutnya otomatis jadi titik waktu kedua.</span>
                      </li>
                    </ul>
                  </Kartu>
                </>
              ),
            },
            {
              id: 'ramalpasar',
              judul: 'Kebutuhan',
              isi: (
                <>
                  {a.tanpaData.length || a.areaDicek.length ? (
                    <Kartu
                      judul="Area yang diminta tetapi datanya belum ada"
                      sub="Tercatat tiap kali pengguna mengetik area di luar cakupan"
                    >
                      <DaftarAtau data={a.tanpaData} format={(v) => `${v} permintaan`} label="Permintaan area tanpa data" kosong="Belum ada permintaan area di luar cakupan." />
                    </Kartu>
                  ) : (
                    <Belum
                      keadaan="kosong"
                      judul="Permintaan pengguna belum ada yang tercatat"
                      syarat="satu orang memakai Cari Kos atau mengetik area yang belum ada datanya."
                    >
                      Kebutuhan pasar dibaca dari apa yang dicari pengguna, bukan dari survei. Pencatatannya sudah berjalan, isinya yang masih nol.
                    </Belum>
                  )}
                  <Kartu
                    judul={`${d.titikTanpaHarga} titik kos berada di kecamatan yang iklan berharganya belum cukup`}
                    sub={`Titik kos yang terdata lokasinya di tiap kecamatan. Biru = kecamatannya punya minimal ${M.min_iklan_kec} iklan berharga, jadi kisarannya memakai harga kecamatan itu sendiri`}
                    lebar
                  >
                    <BarH data={potong(d.perKecGmaps)} format={(v) => `${v} titik`} label="Titik kos per kecamatan" />
                    <SemuaKec />
                  </Kartu>
                </>
              ),
            },
          ]}
        />
      )}

      {bagian === 'omzet' && (
        <Lembar
          label="Forecast omzet paket"
          lembar={[{
            id: 'omzet-chronos',
            judul: 'Omzet paket',
            isi: (
              <>
                <div className="admin-omzet-head">
                  <div>
                    <p className="eyebrow">Chronos-2 · simulasi zero-shot</p>
                    <h2 className="admin-omzet-title">Proyeksi omzet paket KOZY</h2>
                    <p className="note">Chronos-2 meramal jumlah pembeli dari histori dummy. Omzet dihitung dari pembeli × Rp19.900 per akses.</p>
                  </div>
                  <span className="admin-dummy">DATA DUMMY</span>
                </div>

                <form className="admin-omzet-form" onSubmit={(event) => { event.preventDefault(); muatOmzet(); }}>
                  <label>
                    Pembeli pada bulan awal
                    <input type="number" min="0" max="5000" value={omzetParams.pembeli_awal} onChange={(event) => setOmzetParams((p) => ({ ...p, pembeli_awal: Number(event.target.value) }))} />
                  </label>
                  <label>
                    Pertumbuhan asumsi per bulan
                    <span className="admin-omzet-input"><input type="number" min="-5" max="10" step="0.5" value={omzetParams.pertumbuhan_persen} onChange={(event) => setOmzetParams((p) => ({ ...p, pertumbuhan_persen: Number(event.target.value) }))} /><i>%</i></span>
                  </label>
                  <label>
                    Horizon forecast
                    <select value={omzetParams.horizon} onChange={(event) => setOmzetParams((p) => ({ ...p, horizon: Number(event.target.value) }))}>
                      {[3, 6, 9, 12].map((bulan) => <option key={bulan} value={bulan}>{bulan} bulan</option>)}
                    </select>
                  </label>
                  <Button type="submit" icon="refresh" disabled={omzetLoading}>{omzetLoading ? 'Menghitung…' : 'Hitung ulang'}</Button>
                </form>

                {omzetLoading && <p className="model-notice" role="status">Chronos-2 sedang menghitung forecast…</p>}
                {omzetError && <p className="admin-omzet-error" role="alert">{omzetError}</p>}
                {omzetData && (
                  <>
                    <Angka items={[
                      { nilai: rp(omzetData.ringkasan.omzet_p50_total), label: 'proyeksi omzet median', sub: `total ${omzetData.forecast.length} bulan` },
                      { nilai: omzetData.ringkasan.pembeli_p50_total.toLocaleString('id-ID'), label: 'pembeli median', sub: 'total pada horizon forecast' },
                      { nilai: rp(omzetData.harga_paket), label: 'harga paket', sub: 'sekali bayar per akses' },
                      { nilai: omzetData.device === 'cuda' ? 'GPU' : 'CPU', label: 'runtime Chronos-2', sub: `histori dummy ${omzetData.histori.length} bulan` },
                    ]} />
                    <Kartu
                      judul="Rentang proyeksi omzet per bulan"
                      sub="Garis = median Chronos-2 · area = P10–P90 · berdasarkan histori sintetis"
                      lebar
                    >
                      <GarisRentang
                        titik={omzetData.forecast.map((bulan) => ({
                          label: new Date(`${bulan.bulan}T00:00:00`).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
                          bulan: bulan.bulan,
                          p10: bulan.omzet_p10,
                          p50: bulan.omzet_p50,
                          p90: bulan.omzet_p90,
                        }))}
                        format={rpJuta}
                        label="Forecast omzet bulanan Chronos-2"
                      />
                    </Kartu>
                    <p className="admin-omzet-warning"><Icon name="info" size={16} /> Simulasi untuk perencanaan, bukan laporan transaksi atau prediksi yang dilatih dari penjualan KOZY. Ganti histori dummy dengan data pembeli aktual sebelum mengambil keputusan.</p>
                  </>
                )}
              </>
            ),
          }]}
        />
      )}

      <p className="trust-line">
        <Icon name="db" size={15} />
        Sumber: {M.sumber}, {tanggal(M.diambil)}. Perbarui dengan menjalankan scripts/build_pasar.py setelah scraping baru.
      </p>
    </div>
  );
}
