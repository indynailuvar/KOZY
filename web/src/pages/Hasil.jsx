import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import TanyaAI from '../components/TanyaAI.jsx';
import Rincian from '../components/Rincian.jsx';
import Lembar from '../components/Lembar.jsx';
import { SpeakButton, useBacaOtomatis } from '../components/A11y.jsx';
import { ActionBar, Banner, Button, EmptyState, PageHead, StatusBadge } from '../components/ui.jsx';
import { HARGA_MATCH, Paywall } from '../components/Sheets.jsx';
import { jenisById, kawasanById, kisaranWajar, perluDiperiksa } from '../api/kozy.js';
import { bulat10rb, bulat50rb, persen, rp, rpSingkat, rpSuara, tanggal } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';
import { classifyPrice } from '../api/modeling.js';

const LEVEL = { besar: 'Besar', sedang: 'Sedang', kecil: 'Kecil' };
const STATUS_SUARA = { KEMAHALAN: 'kemahalan', WAJAR: 'wajar', MURAH: 'murah' };

function Fakta({ r }) {
  const tone = r.status === 'KEMAHALAN' ? 't-red' : r.status === 'MURAH' ? 't-blue' : 't-green';
  const tanda = r.selisih_rp < 0 ? '−' : '+';
  return (
    <dl className="facts">
      <div>
        <dt>Harga dari pemilik</dt>
        <dd>{rp(r.harga_ditawarkan)}</dd>
      </div>
      <div>
        <dt>{r.selisih_rp < 0 ? 'Kamu hemat' : 'Selisihnya'}</dt>
        <dd className={tone}>
          {tanda}
          {rp(Math.abs(r.selisih_rp))} <small>({persen(r.selisih_persen)})</small>
        </dd>
      </div>
    </dl>
  );
}

function FaktorHarga({ r }) {
  const { lokasi, kamar } = r.komposisi;
  return (
    <div className="faktor">
      <div className="komp" role="img" aria-label={`Lokasi sekitar ${lokasi} persen, kamar dan fasilitas sekitar ${kamar} persen`}>
        <div className="komp-bar">
          <i style={{ width: `${lokasi}%` }} />
        </div>
        <div className="komp-lab">
          <span>
            <i className="dot a" /> Lokasi {lokasi}%
          </span>
          <span>
            <i className="dot b" /> Kamar & fasilitas {kamar}%
          </span>
        </div>
      </div>
      <ul className="faktor-list">
        {r.faktor.map((f) => (
          <li key={f.key}>
            <Icon name={f.icon} size={17} />
            <span className="fk-l">{f.label}</span>
            <span className={`fk-lv lv-${f.level}`} aria-label={`${f.arah === 'turun' ? 'Menurunkan' : 'Menaikkan'} harga, pengaruh ${LEVEL[f.level].toLowerCase()}`}>
              {f.arah === 'turun' && <Icon name="trenddown" size={14} strokeWidth={2.6} />}
              <em>{LEVEL[f.level]}</em>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PosisiPasar({ r }) {
  const { p10, p50, p90 } = r.pasar;
  const lo = p10 * 0.85;
  const hi = p90 * 1.12;
  const pos = (v) => `${Math.max(2, Math.min(98, ((v - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="pasar">
      <p>
        {r.harga_ditawarkan >= p50 ? (
          <>
            Lebih mahal dari <b>{r.persentil} dari 100</b> kos serupa di sekitar.
          </>
        ) : (
          <>
            Lebih murah dari <b>{100 - r.persentil} dari 100</b> kos serupa di sekitar.
          </>
        )}
      </p>
      <div className="range">
        <div className="range-track">
          <i className="range-band" style={{ left: pos(p10), width: `calc(${pos(p90)} - ${pos(p10)})` }} />
          <i className="range-mark wajar" style={{ left: pos(r.harga_wajar) }} />
          <i className="range-mark tawar" style={{ left: pos(r.harga_ditawarkan) }} />
        </div>
        <div className="range-lab">
          <span style={{ left: pos(p10) }}>{rpSingkat(p10)}</span>
          <span style={{ left: pos(p90) }}>{rpSingkat(p90)}</span>
        </div>
      </div>
      <ul className="legend">
        <li>
          <i className="lg-dot wajar" /> Harga wajar
        </li>
        <li>
          <i className="lg-dot tawar" /> Harga pemilik
        </li>
        <li>
          <i className="lg-band" /> Umumnya
        </li>
      </ul>
    </div>
  );
}

export default function Hasil() {
  const { state, set, bukaAI } = useStore();
  const [bayar, setBayar] = useState(false);
  const [clusterInfo, setClusterInfo] = useState({ loading: false, data: null });
  const tujuan = useRef('tawar');
  const r = state.cek;
  const kec = r?.meta?.kecamatan || r?.kawasan?.kec;

  useEffect(() => {
    if (!r?.input?.jenis || !kec || !r?.harga_ditawarkan) return;
    let aktif = true;
    setClusterInfo({ loading: true, data: null });
    classifyPrice({ harga: r.harga_ditawarkan, kecamatan: kec, jenis: r.input.jenis })
      .then((data) => aktif && setClusterInfo({ loading: false, data }))
      .catch(() => aktif && setClusterInfo({ loading: false, data: null }))
      .finally(() => aktif && setClusterInfo((info) => (aktif && info.loading ? { ...info, loading: false } : info)));
    return () => {
      aktif = false;
    };
  }, [r?.id, r?.harga_ditawarkan, r?.input?.jenis, kec]);

  const periksa = !!r?.faktor && perluDiperiksa(r);
  const ringkas = r?.faktor
    ? `Hasil cek kos di ${r.kawasan.nama}: harganya ${STATUS_SUARA[r.status]}. Harga wajarnya sekitar ${rpSuara(
        r.harga_wajar,
      )} per bulan. Harga dari pemilik ${rpSuara(r.harga_ditawarkan)}, ${r.selisih_rp >= 0 ? 'lebih mahal' : 'lebih murah'} ${rpSuara(r.selisih_rp)} per bulan.`
    : '';
  useBacaOtomatis(ringkas, r?.id);

  if (!r?.faktor)
    return (
      <div className="page narrow">
        <EmptyState icon="calc" title="Belum ada hasil cek" action={<Button onClick={() => go('/cek')}>Cek Harga Sekarang</Button>}>
          Isi data kos incaranmu untuk melihat harga wajarnya.
        </EmptyState>
      </div>
    );

  const k = { ...kawasanById(r.kawasan.id), ...r.kawasan };
  const kemahalan = r.status === 'KEMAHALAN';
  const rendah = r.meta.confidence === 'rendah';
  const paid = !!state.paid[r.id];
  const jenis = jenisById(r.input.jenis);
  const hemat = Math.abs(r.selisih_rp) >= 10_000 ? Math.abs(r.selisih_rp) : 0;
  const kisaran = r.kisaran || kisaranWajar(r.harga_wajar);

  const lanjut = (ke) => {
    set({
      tawar: {
        purchaseId: r.id,
        dari: 'cek',
        nama: 'Kos incaranmu',
        kawasan: r.kawasan.nama,
        harga: r.harga_ditawarkan,
        harga_wajar: r.harga_wajar,
        selisih_rp: r.selisih_rp,
        selisih_persen: r.selisih_persen,
        status: r.status,
        persentil: r.persentil,
        n: r.pasar.n_pembanding,
        kec,
        updated_at: r.meta.updated_at,
      },
    });
    if (ke !== 'match') catat('kartu_tawar', { status: r.status, kec });
    go(ke === 'match' ? '/match?dari=cek' : '/kartu-tawar');
  };
  const buka = (ke) => {
    tujuan.current = ke;
    if (paid) return lanjut(ke);
    catat('match_dikunci', { dari: 'cek', kec });
    setBayar(true);
  };
  const cariSesuaiBudget = () => {
    set({
      draftCari: {
        budgetMin: 300_000,
        budgetMax: Math.min(3_000_000, Math.max(400_000, bulat50rb(r.harga_ditawarkan))),
        jenis: r.input.jenis,
        fasilitas: r.input.fasilitas,
      },
    });
    go('/cari');
  };
  const rail =
    r.status === 'KEMAHALAN'
      ? { t: 'Mau menawar harganya?', s: 'Tunjukkan Kartu Tawar berisi data ini ke pemilik.', cta: 'Buat Kartu Tawar' }
      : r.status === 'MURAH'
        ? { t: 'Harganya di bawah pasaran', s: 'Bandingkan dengan kos lain di sekitar sebelum memutuskan.', cta: 'Lihat kos alternatif' }
        : { t: 'Mau bandingkan dulu?', s: 'Lihat 5 kos lain yang harganya juga wajar.', cta: 'Lihat kos alternatif' };

  return (
    <div className="page result">
      <div className="result-main">
        <PageHead
          judul="Hasil cek harga"
          sub={`${k.nama}${k.kec !== k.nama ? `, ${k.kec}` : ''}${jenis ? ` · Kos ${jenis.label.toLowerCase()}` : ''}`}
          onBack={() => go('/cek?ubah=1')}
          aksi={<SpeakButton compact teks={ringkas} label="Dengarkan hasil" />}
        />

        {/* Satu banner saja, yang paling mendesak. Menumpuk tiga peringatan
            membuat angka utamanya terdorong keluar layar di HP. */}
        {r.meta.anomali && r.selisih_rp > 0 ? (
          <Banner tone="warn" icon="alert" title="Harga ini tidak biasa">
            Pastikan harga dan fasilitas yang kamu isi sudah benar.
          </Banner>
        ) : rendah ? (
          <Banner tone="warn" icon="alert" title="Data di sekitar masih sedikit">
            Baru {r.pasar.n_pembanding} iklan kos di Kec. {r.kawasan.kec}. Anggap ini perkiraan kasar.
          </Banner>
        ) : null}

        <Lembar
          label="Hasil cek harga"
          lembar={[
            {
              id: 'vonis',
              judul: 'Harga wajarnya',
              isi: (
                <>
                  <section className="card verdict">
                    <StatusBadge status={r.status} />
                    <p className="v-label">Harga wajar kamar ini</p>
                    <p className="v-num">
                      {rp(r.harga_wajar)}
                      <span>/bulan</span>
                    </p>
                    <p className="v-note">
                      Wajar di kisaran {rpSingkat(kisaran[0])} – {rpSingkat(kisaran[1])}
                    </p>
                    <Fakta r={r} />
                  </section>
                  {periksa && (
                    <Banner icon="checkc" title="Harga bagus, pastikan dulu">
                      Selisihnya besar. Datangi kosnya sebelum transfer.
                    </Banner>
                  )}
                  <section className="cluster-readout" aria-live="polite" aria-busy={clusterInfo.loading}>
                    <div className="cluster-readout-head">
                      <Icon name="bars" size={18} />
                      <div>
                        <h2>Segmen harga K-Prototypes</h2>
                        <p>Kelompok relatif dalam dataset, bukan penilaian kualitas kos.</p>
                      </div>
                    </div>
                    {clusterInfo.loading ? (
                      <p className="note">Mengelompokkan harga kos…</p>
                    ) : clusterInfo.data ? (
                      <div className="cluster-readout-result">
                        <b>{clusterInfo.data.segmen.segmen_harga}</b>
                        <span>
                          {clusterInfo.data.segmen.jumlah} dari {clusterInfo.data.jumlah_listing} listing · median {rp(Math.round(clusterInfo.data.segmen.median_harga / 1000) * 1000)}
                        </span>
                      </div>
                    ) : (
                      <p className="note">Segmen harga belum tersedia untuk kombinasi lokasi dan jenis kos ini.</p>
                    )}
                  </section>
                </>
              ),
            },
            {
              id: 'faktor',
              judul: 'Kenapa segini',
              isi: (
                <section className="card">
                  <h2 className="card-t">Kenapa harganya segini?</h2>
                  <FaktorHarga r={r} />
                </section>
              ),
            },
            {
              id: 'pasar',
              judul: 'Posisi di pasar',
              isi: (
                <section className="card">
                  <h2 className="card-t">Posisi di pasar</h2>
                  <PosisiPasar r={r} />
                  <p className="note">
                    Dasarnya {r.pasar.n_pembanding} iklan kos di Kec. {kec} ({r.meta.sumber}, {tanggal(r.meta.updated_at)}). Perkiraan model meleset rata-rata ±{' '}
                    {rp(r.meta.mae)}, keyakinan data <b>{r.meta.confidence}</b>.
                  </p>
                </section>
              ),
            },
            {
              id: 'lanjut',
              judul: 'Langkah berikutnya',
              isi: (
                <>
                  <Rincian
                    judul="Langkah berikutnya"
                    baris={[
                      periksa && {
                        id: 'cek',
                        judul: 'Yang perlu dicek saat datang',
                        sub: 'Karena harganya jauh di bawah pasaran',
                        icon: 'list',
                        isi: (
                          <ul className="dot-list">
                            <li>Fasilitasnya sesuai iklan</li>
                            <li>Biaya listrik dan air</li>
                            <li>Kondisi kamar dan kamar mandi</li>
                            <li>
                              Kos serupa di sini umumnya {rpSingkat(r.pasar.p10)} – {rpSingkat(r.pasar.p90)}
                            </li>
                          </ul>
                        ),
                      },
                      {
                        id: 'sekitar',
                        judul: 'Kos lain di sekitar sini',
                        sub: paid ? 'Sudah terbuka' : `Kec. ${kec} · lokasi & fasilitas`,
                        icon: paid ? 'unlock' : 'lock',
                        onClick: () => buka('match'),
                      },
                      {
                        id: 'setahun',
                        judul: r.selisih_rp < 0 ? 'Hemat setahun' : 'Selisih setahun',
                        icon: 'wallet',
                        nilai: rp(Math.abs(r.selisih_rp * 12)),
                        isi: <p className="note">Dari selisih {rp(Math.abs(r.selisih_rp))} per bulan dikali 12.</p>,
                      },
                      periksa && {
                        id: 'budget',
                        judul: `${rp(r.harga_ditawarkan)} itu budgetmu, bukan harga pemilik?`,
                        sub: 'Cari kos yang harganya pas',
                        icon: 'wallet',
                        onClick: cariSesuaiBudget,
                      },
                      {
                        id: 'ai',
                        judul: r.status === 'KEMAHALAN' ? 'Cara menawar harganya' : hemat > 0 ? `Sisa ${rp(hemat)} enaknya dibuat apa?` : 'Yang wajib dicek sebelum bayar',
                        sub: 'Tanya KOZY AI',
                        icon: 'sparkles',
                        onClick: () =>
                          bukaAI({
                            teks:
                              r.status === 'KEMAHALAN'
                                ? `Cara nawar harga kos dari ${rp(r.harga_ditawarkan)} ke ${rp(r.harga_wajar)}`
                                : hemat > 0
                                  ? `Ide upgrade kamar dengan budget ${rp(hemat)}`
                                  : 'Apa saja yang wajib dicek sebelum bayar kos?',
                          }),
                      },
                    ]}
                  />

                  <section className="habis">
                    <span className="ic-circle lg">
                      <Icon name="checkc" size={22} />
                    </span>
                    <h2>Sudah, segitu saja</h2>
                    <p>
                      Terima kasih sudah memakai KOZY. Satu pesan terakhir: <b>jangan transfer sebelum melihat kamarnya langsung</b>, dan minta rincian biaya listrik dan air di
                      depan.
                    </p>
                    <button type="button" className="text-btn" onClick={() => go('/cek?ubah=1')}>
                      Cek kos lain
                    </button>
                  </section>
                </>
              ),
            },
          ]}
        />

        <p className="trust-line">
          <Icon name="shieldc" size={15} />
          KOZY netral: pemilik tidak bisa membayar untuk mengubah penilaian.
        </p>
      </div>

      <aside className="result-rail">
        <div className="rail-card">
          <p className="rail-t">{rail.t}</p>
          <p className="rail-s">{rail.s}</p>
          <ActionBar note={paid ? null : `${rp(HARGA_MATCH)} · cek detail, bandingkan, 5 alternatif`}>
            <Button block icon={paid ? undefined : 'lock'} iconRight={paid ? 'arrowr' : undefined} onClick={() => buka(kemahalan ? 'tawar' : 'match')}>
              {rail.cta}
            </Button>
          </ActionBar>
        </div>
      </aside>

      <Paywall
        open={bayar}
        purchaseId={r.id}
        onClose={() => setBayar(false)}
        onPaid={() => {
          setBayar(false);
          lanjut(tujuan.current);
        }}
      />
    </div>
  );
}
