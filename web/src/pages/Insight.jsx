import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import TanyaAI from '../components/TanyaAI.jsx';
import Rincian from '../components/Rincian.jsx';
import Lembar from '../components/Lembar.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { SpeakButton, useBacaOtomatis } from '../components/A11y.jsx';
import { ActionBar, Button, EmptyState, InfoTip, PageHead, Segmented } from '../components/ui.jsx';
import { fasilitasById, hitungArea, jenisById, kebutuhanById, ringkasInsight, saranAI, tujuanById } from '../api/kozy.js';
import { bulat10rb, daftar, jarak, rp, rpSingkat, rpSuara } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const FIT = { pas: 'Pas budget', sebagian: 'Sebagian pas', atas: 'Di atas budget' };

function Sebaran({ bins }) {
  const max = Math.max(...bins.map((b) => b.jumlah), 1);
  const label = (v) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : `${Math.round(v / 1000)} rb`);
  return (
    <div className="histo">
      <div className="histo-bars" aria-hidden="true">
        {bins.map((b) => (
          <span key={b.lo} className={b.sorot ? 'on' : ''} style={{ height: `${Math.max(6, (b.jumlah / max) * 100)}%` }} />
        ))}
      </div>
      <div className="histo-ax">
        <span>{label(bins[0].lo)}</span>
        <span>{label(bins[bins.length - 1].hi)}</span>
      </div>
      <p className="note">Tinggi batang = banyaknya kos pada rentang harga itu. Biru tua = rentang yang cocok untukmu.</p>
    </div>
  );
}

export default function Insight() {
  const { state, set, bukaAI } = useStore();
  const r = state.cari;
  const [dilepas, setDilepas] = useState([]);
  const [semua, setSemua] = useState(false);
  const [tampilan, setTampilan] = useState('daftar');
  const [pilihId, setPilihId] = useState(null);

  const input = r && { ...r.input, fasilitas: r.input.fasilitas.filter((f) => !dilepas.includes(f)) };
  const kunci = `${r?.id}:${dilepas.join()}`;
  const areas = useMemo(() => (input ? hitungArea(input) : []), [kunci]); // eslint-disable-line react-hooks/exhaustive-deps
  const insight = useMemo(() => (areas.length ? ringkasInsight(areas) : null), [areas]);
  const saran = useMemo(() => (input ? saranAI(input) : null), [kunci]); // eslint-disable-line react-hooks/exhaustive-deps
  const tujuan = r && tujuanById(r.input.tujuanId);

  const ringkasSuara = insight
    ? `Harga kos wajar di area pilihanmu sekitar ${rpSuara(insight.range[0])} sampai ${rpSuara(insight.range[1])} per bulan. Area terbaik: ${areas
        .slice(0, 3)
        .map((a) => a.nama)
        .join(', ')}.`
    : '';
  useBacaOtomatis(ringkasSuara, kunci);

  if (!r || !tujuan || !insight)
    return (
      <div className="page narrow">
        <EmptyState icon="map" title="Belum ada pencarian" action={<Button onClick={() => go('/cari')}>Cari Kos</Button>}>
          Jawab beberapa pertanyaan singkat untuk melihat area terbaik.
        </EmptyState>
      </div>
    );

  const tampil = semua ? areas : areas.slice(0, 4);
  // budget lebih besar daripada harga pasaran area terbaik: sisanya bisa dipakai melengkapi kamar
  const teratas = areas[0];
  const sisa = teratas ? bulat10rb(r.input.budgetMax - teratas.p50) : 0;
  const detail = (a) => {
    catat('area_dipilih', { kawasan: a.nama, kec: a.kec, skor: a.skor, fit: a.fit });
    set({ cari: { ...r, input, pilih: { id: a.id, nama: a.nama } }, match: null });
    go('/match?dari=cari');
  };
  const areaPilih = areas.find((a) => a.id === pilihId);
  const subJudul = [`Dekat ${tujuan.singkat}`, r.input.jenis ? `kos ${jenisById(r.input.jenis).label.toLowerCase()}` : null, `maks. ${rpSingkat(r.input.budgetMax)}`]
    .filter(Boolean)
    .join(' · ');

  const peta = (
    <div className="ins-map-box">
      <KozyMap
        className="map-md"
        label="Peta area rekomendasi. Semua area juga tercantum di daftar."
        center={[tujuan.lat, tujuan.lng]}
        zoom={14}
        fitKey={`${kunci}:${semua}`}
        padBottom={60}
        onSelect={setPilihId}
        markers={[
          { kind: 'place', lat: tujuan.lat, lng: tujuan.lng, label: tujuan.singkat, icon: kebutuhanById(tujuan.jenis)?.icon || 'pin' },
          ...tampil.map((a) => ({ id: a.id, kind: 'area', lat: a.lat, lng: a.lng, label: a.nama, selected: a.id === pilihId })),
        ]}
      />
      {areaPilih ? (
        <button type="button" className="map-pick" onClick={() => detail(areaPilih)}>
          <span>
            <b>{areaPilih.nama}</b>
            <small>
              {rpSingkat(areaPilih.estimasi[0])} – {rpSingkat(areaPilih.estimasi[1])} · {FIT[areaPilih.fit]}
            </small>
          </span>
          <span className="map-pick-go">
            Lihat kos <Icon name="arrowr" size={15} />
          </span>
        </button>
      ) : (
        <p className="note center">Ketuk nama area di peta untuk melihat ringkasannya.</p>
      )}
    </div>
  );

  // Rentang bisa mengerut jadi satu angka kalau area teratas harganya seragam.
  // Menuliskannya "Rp 1.750.000 - Rp 1.750.000" terbaca seperti salah hitung.
  const satuHarga = insight.range[0] === insight.range[1];

  const daftarArea = (
    <>
      {dilepas.length > 0 && (
        <p className="undo">
          Tanpa {daftar(dilepas.map((f) => fasilitasById(f).label))}.{' '}
          <button type="button" className="text-btn" onClick={() => setDilepas([])}>
            Kembalikan
          </button>
        </p>
      )}

      <div className="only-mob">
        <Segmented
          label="Tampilan"
          value={tampilan}
          onChange={setTampilan}
          options={[
            { id: 'daftar', label: 'Daftar', icon: 'list' },
            { id: 'peta', label: 'Peta', icon: 'map' },
          ]}
        />
      </div>

      {tampilan === 'peta' && <div className="only-mob">{peta}</div>}

      <div className={`area-list ${tampilan === 'peta' ? 'hide-mob' : ''}`}>
        <p className="sec-label">Area paling cocok</p>
        {tampil.map((a, i) => (
          <button key={a.id} type="button" className={`area-row ${a.id === pilihId ? 'is-on' : ''}`} onClick={() => detail(a)} onMouseEnter={() => setPilihId(a.id)}>
            <span className="rank">{i + 1}</span>
            <span className="ar-t">
              <b>
                {a.nama}
                <em className={`fit-${a.fit}`}>{FIT[a.fit]}</em>
              </b>
              {/* Jumlah kos sengaja TIDAK ditampilkan di sini: datanya hanya terurai
                  sampai kecamatan, jadi angka yang sama akan muncul di semua kelurahan
                  satu kecamatan dan terbaca seolah milik kelurahan itu. Jarak adalah
                  pembeda yang benar-benar per kawasan. */}
              <small>
                {jarak(a.km)} dari {tujuan.singkat} · Kec. {a.kec}
              </small>
            </span>
            <Icon name="right" size={18} className="lr-go" />
          </button>
        ))}
        {areas.length > 4 && (
          <button type="button" className="text-btn center" onClick={() => setSemua((s) => !s)}>
            {semua ? 'Tampilkan lebih sedikit' : `Lihat semua ${areas.length} area`}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="page insight">
      <PageHead judul="Rekomendasi area" sub={subJudul} onBack={() => go('/cari')} aksi={<SpeakButton compact teks={ringkasSuara} label="Dengarkan ringkasan" />} />

      {/* Dipecah per lembar seperti halaman hasil cek harga, supaya tiap layar
          cuma mengurus satu hal. Daftar areanya tetap berupa daftar — memaging
          puluhan area satu per satu justru menyulitkan membandingkan.
          Pembungkus ins-grid dipertahankan: di layar >= 960 px ia menata lembar
          dan peta berdampingan dua kolom. */}
      <div className="ins-grid">
        <div className="ins-main">
          <Lembar
            label="Rekomendasi area"
            lembar={[
              {
                id: 'harga',
                judul: 'Harga wajarnya',
                isi: (
                  <section className="card ins-sum">
                    <p className="v-label">Harga wajar di area pilihanmu</p>
                    <p className="ins-range">
                      {satuHarga ? (
                        <span className="nw">{rp(insight.range[0])}</span>
                      ) : (
                        <>
                          <span className="nw">{rp(insight.range[0])} –</span> <span className="nw">{rp(insight.range[1])}</span>
                        </>
                      )}
                      <small>/bulan</small>
                    </p>
                    <p className="v-basis">
                      Dari {insight.n} iklan kos di {insight.kecs.length} kecamatan
                      <InfoTip label="Tentang angka ini">
                        Rentang harga diambil dari harga iklan kos yang sebenarnya, bukan tebakan. Saat diuji ulang, perkiraan model meleset rata-rata ± {rp(insight.mae)} (
                        {String(insight.mape).replace('.', ',')}%).
                      </InfoTip>
                    </p>
                  </section>
                ),
              },
              { id: 'area', judul: 'Area paling cocok', isi: daftarArea },
              {
                id: 'rincian',
                judul: 'Rincian',
                isi: (
                  <Rincian
                    judul="Rincian"
                    baris={[
                      { id: 'sebaran', judul: 'Sebaran harga', sub: `${insight.n} iklan kos · meleset ± ${rpSingkat(insight.mae)}`, icon: 'bars', isi: <Sebaran bins={insight.bins} /> },
                      sisa >= 150_000 && {
                        id: 'sisa',
                        judul: `Sisa budget ${rp(sisa)} per bulan`,
                        sub: `Kos di ${teratas.nama} umumnya ${rpSingkat(teratas.p50)}`,
                        icon: 'sofa',
                        onClick: () => bukaAI({ teks: `Ide upgrade kamar dengan budget ${rp(sisa)}` }),
                      },
                      saran && {
                        id: 'saran',
                        judul:
                          saran.jenis === 'lepas' ? `Tanpa ${saran.label}, ${saran.tambah} area lagi masuk budget` : `Tambah budget ${rp(saran.naik)}, ${saran.tambah} area lagi masuk`,
                        sub: `Misalnya ${daftar(saran.nama)}`,
                        icon: 'sparkles',
                        onClick: saran.jenis === 'lepas' ? () => setDilepas((d) => [...d, saran.fasilitas]) : () => bukaAI({ teks: 'Cara atur budget kos' }),
                      },
                      {
                        id: 'cek',
                        judul: 'Yang wajib dicek sebelum bayar kos',
                        sub: 'Tanya KOZY AI',
                        icon: 'list',
                        onClick: () => bukaAI({ teks: 'Apa saja yang wajib dicek sebelum bayar kos?' }),
                      },
                      { id: 'nawar', judul: 'Cara nawar harga kos', sub: 'Tanya KOZY AI', icon: 'sparkles', onClick: () => bukaAI({ teks: 'Cara nawar harga kos' }) },
                    ]}
                  />
                ),
              },
              {
                id: 'tutup',
                judul: 'Sudah siap',
                isi: (
                  <section className="habis">
                    <span className="ic-circle lg">
                      <Icon name="checkc" size={22} />
                    </span>
                    <h2>Sudah, segitu saja</h2>
                    <p>
                      Terima kasih sudah memakai KOZY. Sebelum memutuskan, <b>datangi dua atau tiga kos dulu</b> supaya punya pembanding langsung — foto iklan sering berbeda dengan
                      aslinya.
                    </p>
                    <button type="button" className="text-btn" onClick={() => go('/cari')}>
                      Ubah pencarian
                    </button>
                  </section>
                ),
              },
            ]}
          />
        </div>
        <aside className="ins-map only-desk-block">{peta}</aside>
      </div>

      {teratas && (
        <ActionBar note={`${areas.length} area punya data · urut dari yang paling cocok`}>
          <Button block iconRight="arrowr" onClick={() => detail(teratas)}>
            Lihat kos di {teratas.nama}
          </Button>
        </ActionBar>
      )}
    </div>
  );
}
