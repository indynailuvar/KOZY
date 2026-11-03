// Dashboard tim KOZY. Dibuka lewat #/internal dan dilindungi kode akses di
// Internal.jsx; tidak pernah ditautkan dari halaman mana pun. Dashboard untuk
// PEMILIK KOS adalah halaman yang berbeda (#/pemilik) dan isinya tidak sama:
// pemilik membaca pasarnya sendiri, bukan mutu dataset atau aktivitas pengguna.
// Angkanya dihitung langsung dari berkas data, tanpa angka yang ditulis tangan:
//   pasar.json  iklan sewa berharga asli (Mamikos + Papikost) — dasar model
//   gmaps.json  titik lokasi tanpa harga — harganya perkiraan model
//   olx.json    rumah kos DIJUAL — sisi pemilik, sengaja dipisah dari harga sewa
import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Lembar from '../components/Lembar.jsx';
import Belum from '../components/Belum.jsx';
import { Angka, BarH, Corong, Garis, GarisRentang, Heatmap, Histogram, Kartu, Sebar, Tabel, Tumpuk100, rpJuta } from '../components/Grafik.jsx';
import { Button, PageHead, Segmented } from '../components/ui.jsx';
import { KAWASAN, FASILITAS, JENIS_KOS, PASAR } from '../data/surabaya.js';
import AKURASI from '../data/akurasi.json';
import { GMAPS, KAWASAN_TERCAKUP, OLX, prediksi } from '../api/kozy.js';
import { rp, tanggal } from '../lib/format.js';
import { go } from '../router.js';
import { deretHarian, hapus as hapusJejak, hitungPer, jumlah, semua } from '../lib/jejak.js';

const M = PASAR.meta;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const persenEfek = (b) => Math.round((Math.exp(b) - 1) * 100);

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

    const efek = Object.entries(PASAR.model.fasilitas)
      .map(([id, b]) => ({
        label: FASILITAS.find((f) => f.id === id)?.label || id,
        nilai: persenEfek(b),
      }))
      .sort((a, b) => b.nilai - a.nilai);
    efek[0].sorot = true;

    // efek kecamatan dari model, dibaca sebagai selisih terhadap rata-rata kota
    const kuat = [];
    const lemah = [];
    for (const [label, b] of Object.entries(PASAR.model.kec)) {
      const n = PASAR.kecamatan[label]?.n || 0;
      (n >= M.min_iklan_kec ? kuat : lemah).push({ label, nilai: persenEfek(b), sub: `${n} iklan` });
    }
    const efekKec = kuat.sort((x, y) => y.nilai - x.nilai);
    const rentangKec = { atas: kuat[0], bawah: kuat[kuat.length - 1] };
    if (lemah.length) {
      efekKec.push({
        label: `${lemah.length} kecamatan lain`,
        nilai: lemah[0].nilai,
        sub: `digabung, masing-masing di bawah ${M.min_iklan_kec} iklan`,
      });
    }
    efekKec[0].sorot = true;

    // harga menurut jumlah fasilitas tercatat
    const perJumlah = [];
    for (let i = 0; i <= FASILITAS.length; i++) {
      const g = kos.filter((k) => k.fasilitas.length === i);
      if (g.length >= 3) perJumlah.push({ x: i, y: median(g.map((k) => k.harga)), n: g.length });
    }

    // seberapa jauh tebakan model dari harga iklan yang sebenarnya, per iklan.
    // MAPE 21% hanya satu angka rata-rata; sebarannya menunjukkan bahwa
    // sebagian besar iklan jauh lebih dekat dari itu dan ekornya yang panjang.
    const sebarGalat = { b10: 0, b25: 0, b50: 0, b99: 0 };
    const galatRp = [];
    for (const k of kos) {
      const tebak = prediksi(k.kec, { fasilitas: k.fasilitas, jenis: k.jenis });
      if (!tebak) continue;
      galatRp.push(Math.abs(tebak - k.harga));
      const g = (Math.abs(tebak - k.harga) / k.harga) * 100;
      if (g < 10) sebarGalat.b10++;
      else if (g < 25) sebarGalat.b25++;
      else if (g < 50) sebarGalat.b50++;
      else sebarGalat.b99++;
    }
    galatRp.sort((x, y) => x - y);
    const nGalat = sebarGalat.b10 + sebarGalat.b25 + sebarGalat.b50 + sebarGalat.b99;
    // 8 dari 10 iklan meleset di bawah angka ini — lebih mudah dibaca daripada MAPE
    const galatP80 = galatRp[Math.round(0.8 * (galatRp.length - 1))];
    const persenDekat = Math.round(((sebarGalat.b10 + sebarGalat.b25) / nGalat) * 100);

    const tanpaData = KAWASAN.filter((k) => !KAWASAN_TERCAKUP.includes(k));

    // perbandingan peran tiap sumber: apa yang dibawa, apa yang kosong
    const ADA = 'ada';
    const KOSONG_ = 'kosong';
    const sumber = [
      ['Mamikos', M.n_sumber.Mamikos, ADA, KOSONG_, '6 jenis', 'melatih model + KOZY Match'],
      ['Papikost', M.n_sumber.Papikost, ADA, ADA, '10 jenis', 'melatih model + pin peta asli'],
      ['Google Maps', GMAPS.meta.n, KOSONG_, ADA, KOSONG_, 'jangkauan lokasi, harga diperkirakan'],
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
    // sumber kedua: titik Google Maps (koordinatnya asli, harganya perkiraan model)
    const perKecGmaps = Object.entries(GMAPS.kos.reduce((acc, k) => ({ ...acc, [k.kec]: (acc[k.kec] || 0) + 1 }), {}))
      .map(([label, nilai]) => ({ label, nilai, sub: PASAR.kecamatan[label] ? 'model kecamatan' : 'rata-rata kota', sorot: !!PASAR.kecamatan[label] }))
      .sort((x, y) => y.nilai - x.nilai);
    return {
      harga,
      median: median(harga),
      urutHarga,
      urutData,
      bins,
      puncak,
      efek,
      efekKec,
      rentangKec,
      perJumlah,
      tanpaData,
      kecTanpaData: [...new Set(tanpaData.map((k) => k.kec))],
      titikTanpaModel: GMAPS.kos.filter((k) => !PASAR.kecamatan[k.kec]).length,
      perKecGmaps,
      sumber,
      olxKec,
      berkoordinat: kos.filter((k) => k.lat).length,
      rating: kos.filter((k) => k.rating).length,
      promo: kos.filter((k) => k.promo).length,
      sebarGalat,
      galatP80,
      persenDekat,
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
            { id: 'model', label: 'Model', icon: 'calc' },
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
                    nilai: `± ${rpJuta(M.mae)}`,
                    label: 'meleset rata-rata',
                    sub: `${String(M.mape).replace('.', ',')}% dari harga, uji silang bersarang`,
                  },
                  {
                    nilai: `${Math.round(M.r2_log * 100)}%`,
                    label: 'ragam harga terjelaskan',
                    sub: 'R² model log-linear (Ridge)',
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
              judul: 'Sebaran harga',
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
              id: 'penentu',
              judul: 'Penentu harga',
              isi: (
                <>
              <Kartu
                judul={`${d.efek[0].label} menaikkan harga paling besar, +${d.efek[0].nilai}%`}
                sub="Pengaruh tiap fasilitas terhadap harga sewa, hasil regresi hedonic dengan estimasi Ridge"
              >
                <BarH data={d.efek} format={(v) => `${v > 0 ? '+' : ''}${v}%`} label="Pengaruh fasilitas terhadap harga" />
              </Kartu>
              <Kartu
                judul={`${d.rentangKec.atas.label} ${d.rentangKec.atas.nilai}% di atas rata-rata kota, ${d.rentangKec.bawah.label} ${Math.abs(d.rentangKec.bawah.nilai)}% di bawah`}
                sub={`Selisih terhadap rata-rata Surabaya setelah jenis kos dan fasilitas disamakan. Hanya ${M.kecamatan_kuat} kecamatan yang datanya cukup untuk punya angka sendiri`}
              >
                <BarH data={d.efekKec} format={(v) => `${v > 0 ? '+' : ''}${v}%`} label="Efek kecamatan terhadap harga" />
              </Kartu>
                </>
              ),
            },
            {
              id: 'komposisi',
              judul: 'Profil kecamatan',
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
              judul: 'Sumber data',
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
                    <span>{GMAPS.meta.n} titik itu hanya bisa dipakai untuk lokasi; harganya memakai fasilitas rata-rata kecamatan.</span>
                  </li>
                  <li>
                    <b>Fasilitas yang ikut dihitung baru {FASILITAS.length} jenis</b>
                    <span>Lemari, meja, dan parkir hampir selalu ada, jadi pengaruhnya tidak bisa dipisahkan.</span>
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
              judul: 'Seberapa ramai',
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
              judul: 'Sampai mana',
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
              judul: 'Kejadian terakhir',
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
           sebelumnya: seberapa sering modelnya meleset, apakah ada model lain
           yang lebih baik, dan apa yang belum bisa diramalkan. Yang belum ada
           datanya ditandai terus terang, bukan diisi angka tebakan. */
        <Lembar
          label="Model dan ramalan"
          lembar={[
            {
              id: 'akurasi',
              judul: 'Akurasi model',
              isi: (
                <>
                  <Angka
                    items={[
                      { nilai: `${String(M.mape).replace('.', ',')}%`, label: 'rata-rata meleset', sub: `setara ${rpJuta(M.mae)} dari harga` },
                      { nilai: `${Math.round(M.r2_log * 100)}%`, label: 'ragam harga terjelaskan', sub: 'R² pada skala log' },
                      { nilai: M.n, label: 'iklan melatih model', sub: `uji silang bersarang ${M.pembanding_ols.lipatan} lipatan` },
                      {
                        nilai: 'Ridge',
                        label: 'cara koefisien dihitung',
                        sub: `alpha ${M.alpha.toFixed(2).replace('.', ',')} · OLS di lipatan yang sama ${String(M.pembanding_ols.mape).replace('.', ',')}%`,
                      },
                    ]}
                  />
                  <Kartu
                    judul={`8 dari 10 iklan ditebak dalam ${rpJuta(d.galatP80)} dari harga aslinya`}
                    sub={`${d.persenDekat}% iklan meleset di bawah 25%. Sisanya tidak bisa ditekan ke nol: dua kos yang kecamatan, jenis, dan fasilitasnya sama persis pun bisa berbeda harga 2,5 kali, dan selisih itulah yang dijual KOZY`}
                  >
                    <BarH
                      data={[
                        { label: 'Meleset < 10%', nilai: d.sebarGalat.b10, sorot: true },
                        { label: '10 – 25%', nilai: d.sebarGalat.b25 },
                        { label: '25 – 50%', nilai: d.sebarGalat.b50 },
                        { label: 'Meleset > 50%', nilai: d.sebarGalat.b99 },
                      ]}
                      format={(v) => `${v} iklan`}
                      label="Sebaran besarnya kesalahan tebakan"
                    />
                  </Kartu>
                  {AKURASI.siap ? (
                    <>
                      <Kartu judul={AKURASI.kesimpulan} sub={AKURASI.uji} lebar>
                        <Tabel
                          label="Perbandingan model"
                          kolom={['Model', AKURASI.satuan, 'MAE', 'R²']}
                          baris={AKURASI.model.map((m) => [m.nama, `${m.galat}%`, rpJuta(m.mae), m.r2])}
                        />
                      </Kartu>
                      {/* Sebaran antar lipatan ditampilkan sebagai grafik, bukan catatan
                          kecil, karena justru di sinilah batas keandalannya terlihat:
                          dengan 68 baris, hasilnya ikut berubah tergantung kos mana
                          yang kebetulan masuk data uji. */}
                      {AKURASI.per_lipatan && (
                        <Kartu
                          judul={`Hasilnya goyah: ${Math.min(...AKURASI.per_lipatan.nilai)}% sampai ${Math.max(...AKURASI.per_lipatan.nilai)}% tergantung lipatan`}
                          sub={`${AKURASI.satuan} ${AKURASI.per_lipatan.model} di tiap lipatan uji. Semakin sedikit datanya, semakin jauh jarak antar lipatan`}
                        >
                          <BarH
                            data={AKURASI.per_lipatan.nilai.map((v, i) => ({ label: `Lipatan ${i + 1}`, nilai: v, sorot: v === Math.max(...AKURASI.per_lipatan.nilai) }))}
                            format={(v) => `${v}%`}
                            label={`${AKURASI.satuan} tiap lipatan`}
                          />
                        </Kartu>
                      )}
                    </>
                  ) : (
                    <Belum
                      keadaan="menunggu"
                      judul="Perbandingan dengan Random Forest dan kawan-kawannya belum masuk"
                      syarat="hasil pengujiannya diisikan ke src/data/akurasi.json, lalu tabelnya muncul sendiri di sini tanpa mengubah kode."
                    >
                      Angka di atas adalah akurasi model regresi hedonic yang dipakai aplikasi sekarang. Perbandingannya dengan model lain sedang dikerjakan terpisah.
                    </Belum>
                  )}
                </>
              ),
            },
            {
              id: 'ramalharga',
              judul: 'Ramalan harga',
              isi: (
                <>
                  <Belum
                    keadaan="mustahil"
                    judul="Kenaikan harga kos belum bisa diramalkan"
                    syarat={`iklan yang sama di-scrape ulang secara berkala. Dengan 3–4 putaran berjarak sebulan, kenaikannya sudah bisa dihitung.`}
                  >
                    Meramalkan kenaikan harga butuh harga yang sama diukur di dua waktu berbeda. Data sekarang baru satu kali pengambilan per sumber
                    {' '}({Object.entries(M.diambil_per_sumber).map(([k, v]) => `${k} ${tanggal(v)}`).join(', ')}) — selisih kedua tanggal itu perbedaan antar situs, bukan
                    perubahan harga.
                  </Belum>
                  <Kartu
                    judul="Yang sudah siap begitu data berikutnya masuk"
                    sub="Modelnya tinggal dijalankan ulang, tidak perlu dibangun dari awal"
                    lebar
                  >
                    <ul className="admin-gap">
                      <li>
                        <b>Efek kecamatan sudah terpisah dari efek fasilitas</b>
                        <span>Jadi kenaikan harga nanti bisa dipisah: mana yang karena lokasinya naik, mana yang karena kosnya menambah fasilitas.</span>
                      </li>
                      <li>
                        <b>Satu perintah untuk melatih ulang</b>
                        <span>scripts/build_pasar.py membaca hasil scraping baru, melatih ulang, dan menolak jalan kalau datanya cacat.</span>
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
              judul: 'Kebutuhan pasar',
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
                      syarat="satu orang memakai Cari Kos atau mengetik area yang belum ada datanya — permintaannya langsung masuk ke daftar ini."
                    >
                      Kebutuhan pasar dibaca dari apa yang dicari pengguna, bukan dari survei. Pencatatannya sudah berjalan, isinya yang masih nol.
                    </Belum>
                  )}
                  <Kartu
                    judul={`${d.titikTanpaModel} titik kos berada di kecamatan yang belum punya harga sendiri`}
                    sub="Titik kos yang terdata lokasinya di tiap kecamatan. Biru = kecamatannya sudah punya iklan berharga, jadi perkiraannya memakai efek kecamatan"
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
