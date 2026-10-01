// Dashboard internal (buka lewat #/admin, tidak ditautkan di menu).
// Angkanya dihitung langsung dari berkas data, tanpa angka yang ditulis tangan:
//   pasar.json  iklan sewa berharga asli (Mamikos + Papikost) — dasar model
//   gmaps.json  titik lokasi tanpa harga — harganya perkiraan model
//   olx.json    rumah kos DIJUAL — sisi pemilik, sengaja dipisah dari harga sewa
import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Angka, BarH, Corong, Garis, Heatmap, Histogram, Kartu, Sebar, Slope, Tabel, Tumpuk100, rpJuta } from '../components/Grafik.jsx';
import { Button, PageHead, Segmented } from '../components/ui.jsx';
import { KAWASAN, FASILITAS, JENIS_KOS, PASAR } from '../data/surabaya.js';
import { GMAPS, KAWASAN_TERCAKUP, OLX } from '../api/kozy.js';
import { rp, tanggal } from '../lib/format.js';
import { go } from '../router.js';
import { deretHarian, duaPekan, hapus as hapusJejak, hitungPer, jumlah, semua } from '../lib/jejak.js';

const M = PASAR.meta;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const persenEfek = (b) => Math.round((Math.exp(b) - 1) * 100);

const NIAT = {
  upgrade: 'Upgrade kamar',
  keputusan: 'Pilih kos A atau B',
  tips: 'Tips keuangan',
  sapa: 'Sapaan',
  lain: 'Lainnya',
};
const KOSONG = 'Belum ada aktivitas. Grafik terisi sendiri begitu ada yang memakai aplikasinya.';

function DaftarAtau({ data, format, label, kosong = KOSONG }) {
  if (!data.length) return <p className="g-kosong">{kosong}</p>;
  return <BarH data={data} format={format} label={label} />;
}

export default function Admin({ query = {} }) {
  const bagian = query.tab === 'aktivitas' ? 'aktivitas' : 'data';
  const [ukur, setUkur] = useState('median');
  const [jejak, setJejak] = useState(semua);
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
  const kos = PASAR.kos;
  const kecs = Object.entries(PASAR.kecamatan);

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
      perJumlah,
      tanpaData,
      kecTanpaData: [...new Set(tanpaData.map((k) => k.kec))],
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
    const niat = hitungPer(jejak, 'ai_tanya', 'niat').map((x) => ({
      ...x,
      label: NIAT[x.label] || x.label,
    }));
    for (const d of [areaDicek, tanpaData, vonis, niat]) if (d[0]) d[0].sorot = true;
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
      niat,
      pekan: [
        { label: 'Cek harga', ...duaPekan(jejak, 'cek_selesai') },
        { label: 'Cari kos', ...duaPekan(jejak, 'cari_selesai') },
        { label: 'Bayar', ...duaPekan(jejak, 'bayar') },
      ].map((x) => ({ label: x.label, a: x.lalu, b: x.ini })),
      terakhir: [...jejak].reverse().slice(0, 8),
    };
  }, [jejak]);

  const nilaiKec = ([nama, s]) => ({
    label: nama,
    sub: `${s.n} iklan`,
    nilai: ukur === 'median' ? s.p50 : s.n,
  });
  const dataKec = (ukur === 'median' ? d.urutHarga : d.urutData).map(nilaiKec);
  dataKec[0].sorot = true;

  return (
    <div className="page admin">
      <PageHead
        judul="Dashboard data"
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
          onChange={(v) => go(v === 'aktivitas' ? '/admin?tab=aktivitas' : '/admin')}
          options={[
            { id: 'data', label: 'Data pasar & model', icon: 'bars' },
            { id: 'aktivitas', label: 'Aktivitas pengguna', icon: 'trend' },
          ]}
        />
      </div>

      {bagian === 'data' && (
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
                sub: `${M.mape}% dari harga, uji silang 5 lipat`,
              },
              {
                nilai: `${Math.round(M.r2_log * 100)}%`,
                label: 'ragam harga terjelaskan',
                sub: 'R² model log-linear',
              },
            ]}
          />

          <div className="admin-grid">
            <Kartu
              judul={
                ukur === 'median'
                  ? `${d.urutHarga[0][0]} paling mahal, ${d.urutHarga[d.urutHarga.length - 1][0]} paling murah`
                  : `${d.urutData[0][0]} menyumbang ${Math.round((d.urutData[0][1].n / M.n) * 100)}% data`
              }
              sub={ukur === 'median' ? 'Median harga sewa per bulan tiap kecamatan' : 'Jumlah iklan yang terkumpul tiap kecamatan'}
              catatan={
                ukur === 'median'
                  ? 'Median dipakai supaya kos mewah yang segelintir tidak menarik angkanya ke atas.'
                  : 'Kecamatan dengan data sedikit ditandai keyakinan rendah di aplikasi.'
              }
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
            </Kartu>

            <Kartu
              judul={`${d.efek[0].label} menaikkan harga paling besar, +${d.efek[0].nilai}%`}
              sub="Pengaruh tiap fasilitas terhadap harga sewa, hasil regresi hedonic"
              catatan="Dihitung dengan menahan kecamatan dan jenis kos tetap sama. Akses 24 jam praktis tidak memengaruhi harga."
            >
              <BarH data={d.efek} format={(v) => `${v > 0 ? '+' : ''}${v}%`} label="Pengaruh fasilitas terhadap harga" />
            </Kartu>

            <Kartu
              judul={`Harga paling menumpuk di ${rpJuta(d.puncak.lo)} – ${rpJuta(d.puncak.hi)}`}
              sub={`Sebaran ${M.n} harga iklan, dikelompokkan per Rp 250 rb`}
              catatan="Ekor kanan yang panjang adalah alasan median lebih dipakai daripada rata-rata."
              lebar
            >
              <Histogram bins={d.bins} format={rpJuta} label="Sebaran harga kos" />
            </Kartu>

            <Kartu
              judul="WiFi hampir merata, AC dan kamar mandi dalam masih timpang"
              sub="Persentase kos yang punya tiap fasilitas di kecamatan itu"
              catatan="Dipakai untuk menilai kewajaran: fasilitas yang langka di suatu kecamatan menaikkan harga lebih tajam. Kloset dan akses 24 jam tidak dicatat Papikost, jadi kecamatan yang datanya hanya dari sana memakai rata-rata kota, bukan 0%."
              lebar
            >
              <Heatmap
                label="Kelengkapan fasilitas per kecamatan"
                kolom={FASILITAS.map((f) => ({ id: f.id, label: f.label }))}
                baris={d.urutData.map(([nama, s]) => ({
                  label: nama,
                  nilai: s.fasilitas,
                }))}
              />
            </Kartu>

            <Kartu
              judul="Kos putri mendominasi di hampir semua kecamatan"
              sub="Komposisi jenis kos, tiap baris 100%"
              catatan="Komposisi ini dipakai untuk menilai seberapa banyak pilihan yang tersedia sesuai jenis kos yang dicari."
            >
              <Tumpuk100
                label="Komposisi jenis kos per kecamatan"
                seri={JENIS_KOS.map((j) => ({ id: j.id, label: j.label }))}
                baris={d.urutData.map(([nama, s]) => ({
                  label: nama,
                  nilai: s.komposisi,
                }))}
              />
            </Kartu>

            <Kartu
              judul="Makin lengkap fasilitas makin mahal, tapi sebarannya lebar"
              sub="Tiap titik satu iklan kos. Garis biru = median tiap kelompok"
              catatan={`Lebarnya sebaran inilah yang membuat model masih meleset ± ${rpJuta(M.mae)}.`}
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

            <Kartu judul="Ringkasan angka per kecamatan" sub="p10, median, dan p90 dari harga iklan yang sebenarnya" lebar>
              <Tabel
                label="Ringkasan harga per kecamatan"
                kolom={['Kecamatan', 'Iklan', 'p10', 'Median', 'p90', 'Model']}
                baris={d.urutData.map(([nama, s]) => [
                  nama,
                  s.n,
                  rpJuta(s.p10),
                  rpJuta(s.p50),
                  rpJuta(s.p90),
                  `${persenEfek(PASAR.model.kec[nama]) > 0 ? '+' : ''}${persenEfek(PASAR.model.kec[nama])}%`,
                ])}
              />
              <p className="note">
                Kolom Model = selisih harga kecamatan itu terhadap rata-rata Surabaya setelah jenis kos dan fasilitas disamakan. {M.kecamatan - M.kecamatan_kuat} kecamatan dengan
                iklan di bawah {M.min_iklan_kec} tidak diberi angka sendiri dan ikut satu kelompok bersama, karena datanya terlalu sedikit untuk dipisah.
              </p>
            </Kartu>

            <Kartu
              judul="Tidak ada satu sumber pun yang lengkap sendirian"
              sub="Apa yang dibawa tiap sumber, dan apa yang kosong di sana"
              catatan="Karena itu perannya dibagi: harga sewa asli hanya dari Mamikos + Papikost, jangkauan lokasi dari Google Maps, dan OLX dipisah karena isinya harga jual bangunan, bukan sewa."
              lebar
            >
              <Tabel label="Peran tiap sumber data" kolom={['Sumber', 'Jumlah', 'Harga sewa', 'Koordinat', 'Fasilitas', 'Dipakai untuk']} baris={d.sumber} />
            </Kartu>

            <Kartu
              judul={`${GMAPS.meta.n} titik Google Maps melengkapi lokasi, bukan harga`}
              sub={`Sebaran titik per kecamatan. Biru = kecamatannya ada di data ${PASAR.meta.sumber}, jadi perkiraannya memakai efek kecamatan`}
              catatan={`Harga di sumber ini kosong. ${GMAPS.meta.n_sedang} titik diperkirakan dengan efek kecamatan (± ${PASAR.meta.mape}%), sisanya memakai rata-rata kota dan ditandai perkiraan kasar di aplikasi.`}
              lebar
            >
              <BarH data={d.perKecGmaps} format={(v) => `${v}`} label="Titik Google Maps per kecamatan" />
            </Kartu>

            <Kartu
              judul={`Rumah kos dijual rata-rata Rp ${(OLX.ringkas.median_per_kamar / 1e6).toFixed(0)} juta per kamar`}
              sub="Median harga jual dibagi jumlah kamar, tiap kecamatan. Sisi pemilik, bukan penyewa"
              catatan={OLX.meta.batasan}
              lebar
            >
              <BarH data={d.olxKec} format={(v) => `Rp ${(v / 1e6).toFixed(0)} jt`} label="Harga jual per kamar tiap kecamatan" />
              <p className="note">
                Harga jualnya tidak pernah ikut melatih model sewa. Yang dipakai justru sebaliknya: model sewa memperkirakan pendapatan bangunan itu, lalu dibandingkan dengan
                harga jualnya — median imbal hasil kotor {String(OLX.ringkas.median_imbal_hasil).replace('.', ',')}% per tahun, balik modal sekitar{' '}
                {String(OLX.ringkas.median_balik_modal).replace('.', ',')} tahun.
              </p>
            </Kartu>

            <Kartu judul="Yang masih kosong di data" sub="Penentu fitur mana yang belum bisa dijanjikan ke pengguna" lebar>
              <ul className="admin-gap">
                <li>
                  <b>{d.kecTanpaData.length} kecamatan belum ada datanya</b>
                  <span>
                    {d.kecTanpaData.join(', ')}. {d.tanpaData.length} kawasan di aplikasi memunculkan pesan "belum ada data".
                  </span>
                </li>
                <li>
                  <b>Luas kamar dan nomor pemilik masih kosong di semua sumber</b>
                  <span>
                    Luas tidak ikut dihitung dan tombol kontak diganti tautan ke sumbernya. Koordinat sudah ada untuk {d.berkoordinat} iklan berharga dan {GMAPS.meta.n} titik
                    Google Maps; sisanya masih pin perkiraan area.
                  </span>
                </li>
                <li>
                  <b>Fasilitas kos tidak ada di Google Maps</b>
                  <span>
                    Halaman Google Maps-nya sudah diperiksa dan memang tidak memuat fasilitas kos, jadi {GMAPS.meta.n} titik itu hanya bisa dipakai untuk lokasi. Harganya
                    memakai fasilitas rata-rata kecamatan, sehingga sesama titik di satu kecamatan angkanya sama.
                  </span>
                </li>
                <li>
                  <b>
                    Rating terisi di {d.rating} dari {M.n} iklan ({Math.round((d.rating / M.n) * 100)}%)
                  </b>
                  <span>Belum cukup untuk dipakai sebagai faktor harga. Promo tercatat di {d.promo} iklan.</span>
                </li>
                <li>
                  <b>Fasilitas yang ikut dihitung baru {FASILITAS.length} jenis</b>
                  <span>
                    Papikost sebenarnya mencatat lemari, meja belajar, dan parkir, tetapi hampir semua iklannya punya itu sehingga pengaruhnya tidak bisa dipisahkan — ikut
                    dihitung malah membuat model lebih sering meleset. Datanya tetap disimpan untuk ditampilkan.
                  </span>
                </li>
              </ul>
            </Kartu>
          </div>
        </>
      )}

      {bagian === 'aktivitas' && (
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

          <div className="admin-grid">
            <Kartu
              judul={a.deret.some((x) => x.nilai) ? 'Aktivitas 14 hari terakhir' : 'Aktivitas harian belum terisi'}
              sub="Jumlah cek harga dan pencarian kos per hari"
              catatan="Garis dipakai karena datanya berurut waktu, dan jarak antar titiknya dijaga tetap satu hari."
              lebar
            >
              <Garis titik={a.deret} label="Aktivitas harian" kosong={KOSONG} />
            </Kartu>

            <Kartu
              judul={a.corong[0].nilai ? `Dari ${a.corong[0].nilai} kunjungan beranda, ${a.bayar} berujung bayar` : 'Corong pemakaian belum terisi'}
              sub="Tiap tahap dibandingkan dengan jumlah kunjungan beranda"
              catatan="Batang horizontal dipilih supaya panjang tiap tahap dibandingkan dari garis nol yang sama."
            >
              <Corong tahap={a.corong} label="Corong pemakaian" />
            </Kartu>

            <Kartu
              judul={a.pekan.some((x) => x.a || x.b) ? 'Perubahan dibanding pekan lalu' : 'Perbandingan antar pekan belum terisi'}
              sub="7 hari sebelumnya dibanding 7 hari terakhir"
              catatan="Slopegraph menampilkan nilai awal, nilai akhir, dan arah perubahannya sekaligus."
            >
              <Slope baris={a.pekan} kiri="Pekan lalu" kanan="Pekan ini" label="Perbandingan dua pekan" kosong={KOSONG} />
            </Kartu>

            <Kartu
              judul="Area yang paling sering dicek"
              sub="Gabungan hasil cek harga dan area yang dibuka dari rekomendasi"
              catatan="Dipakai untuk menentukan area mana yang datanya perlu diperdalam."
            >
              <DaftarAtau data={a.areaDicek} format={(v) => `${v}`} label="Area paling sering dicek" />
            </Kartu>

            <Kartu
              judul="Permintaan area yang datanya belum ada"
              sub="Tercatat tiap kali pengguna mengetik area di luar cakupan"
              catatan="Ini daftar belanja untuk scraping berikutnya: yang paling sering diminta dikerjakan lebih dulu."
            >
              <DaftarAtau data={a.tanpaData} format={(v) => `${v}`} label="Permintaan area tanpa data" kosong="Belum ada permintaan area di luar cakupan." />
            </Kartu>

            <Kartu
              judul="Hasil vonis harga"
              sub="Sebaran status dari cek harga yang sudah dijalankan"
              catatan="Kalau status kemahalan terlalu mendominasi, ambang wajar perlu ditinjau ulang."
            >
              <DaftarAtau data={a.vonis} format={(v) => `${v}`} label="Sebaran status hasil cek" />
            </Kartu>

            <Kartu judul="Topik yang ditanyakan ke KOZY AI" sub="Dikelompokkan dari niat pertanyaan" catatan="Menunjukkan fitur AI mana yang benar-benar dipakai.">
              <DaftarAtau data={a.niat} format={(v) => `${v}`} label="Topik pertanyaan KOZY AI" />
            </Kartu>

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
                <p className="note">
                  Aktivitas tersimpan di perangkat ini (localStorage). Isi VITE_ANALYTICS_URL untuk mengirimkannya ke server. Tidak ada nama, email, atau nomor yang dicatat.
                </p>
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
          </div>
        </>
      )}

      <p className="trust-line">
        <Icon name="db" size={15} />
        Sumber: {M.sumber}, {tanggal(M.diambil)}. Perbarui dengan menjalankan scripts/build_pasar.py setelah scraping baru.
      </p>
    </div>
  );
}
