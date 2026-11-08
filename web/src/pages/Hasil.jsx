import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Rincian from '../components/Rincian.jsx';
import Lembar from '../components/Lembar.jsx';
import HeroHarga from '../components/HeroHarga.jsx';
import { SpeakButton, useBacaOtomatis } from '../components/A11y.jsx';
import { ActionBar, Button, EmptyState, InfoTip, PageHead } from '../components/ui.jsx';
import { HARGA_MATCH, Paywall } from '../components/Sheets.jsx';
import { jenisById, kawasanById, perluDiperiksa } from '../api/kozy.js';
import { bulat50rb, rp, rpRentang, rpSigned, rpSingkat, rpSuara } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';
import { classifyPrice } from '../api/modeling.js';

const STATUS_SUARA = { KEMAHALAN: 'kemahalan', WAJAR: 'wajar', MURAH: 'murah' };

// "kos putri di Kec. Sukolilo", atau "kos di Kec. Sukolilo" kalau semua jenis ikut dibandingkan
const labelPembanding = (b) => `kos ${b.jenis ? `${jenisById(b.jenis).label.toLowerCase()} ` : ''}di Kec. ${b.kec}`;

// Sebaran harga kos sejenis: termurah sampai termahal, pita kisaran wajar,
// titik harga pasaran, dan penanda harga kos yang dicek.
function PosisiPasar({ r }) {
  const b = r.pembanding;
  const lo = Math.min(b.min, r.harga_ditawarkan) * 0.94;
  const hi = Math.max(b.max, r.harga_ditawarkan) * 1.04;
  const pos = (v) => `${Math.max(2, Math.min(98, ((v - lo) / (hi - lo)) * 100))}%`;
  const mahal = r.harga_ditawarkan >= b.median;
  // hasil lama belum menyimpan hitungannya; dihitung balik dari persentil
  const jumlah = (mahal ? r.n_lebih_murah : r.n_lebih_mahal) ?? Math.round(((mahal ? r.persentil : 100 - r.persentil) / 100) * b.n);
  return (
    <div className="pasar">
      <p className="big-stat">
        <b>
          {jumlah} dari {b.n}
        </b>
        <span>
          {labelPembanding(b)} lebih {mahal ? 'murah' : 'mahal'} dari kos ini
        </span>
      </p>
      <div
        className="range"
        role="img"
        aria-label={`Harga kos sejenis dari ${rpSuara(b.min)} sampai ${rpSuara(b.max)}. Kisaran wajar ${rpSuara(b.q1)} sampai ${rpSuara(b.q3)}, harga pasaran ${rpSuara(
          b.median,
        )}. Kos ini ${rpSuara(r.harga_ditawarkan)}.`}
      >
        <div className="range-track">
          <i className="range-band" style={{ left: pos(b.q1), width: `calc(${pos(b.q3)} - ${pos(b.q1)})` }} />
          <i className="range-mark wajar" style={{ left: pos(b.median) }} />
          <i className="range-mark tawar" style={{ left: pos(r.harga_ditawarkan) }} />
        </div>
        <div className="range-lab">
          <span style={{ left: pos(b.min) }}>{rpSingkat(b.min)}</span>
          <span style={{ left: pos(b.max) }}>{rpSingkat(b.max)}</span>
        </div>
      </div>
      <ul className="legend">
        <li>
          <i className="lg-dot wajar" /> Harga pasaran
        </li>
        <li>
          <i className="lg-dot tawar" /> Kos ini
        </li>
        <li>
          <i className="lg-band" /> Kisaran wajar
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

  const b = r?.pembanding;
  const periksa = !!b && perluDiperiksa(r);
  const ringkas = b
    ? `Hasil cek kos di ${r.kawasan.nama}: harganya ${STATUS_SUARA[r.status]}. Harga pasaran ${labelPembanding(b)} sekitar ${rpSuara(r.median)} per bulan, umumnya ${rpSuara(
        r.kisaran[0],
      )} sampai ${rpSuara(r.kisaran[1])}. Kos ini ${rpSuara(r.harga_ditawarkan)}, ${r.selisih_rp >= 0 ? 'lebih mahal' : 'lebih murah'} ${rpSuara(r.selisih_rp)} dari harga pasaran.`
    : '';
  useBacaOtomatis(ringkas, r?.id);

  // Hasil tersimpan dari versi lama tidak punya angka yang dibutuhkan halaman ini.
  if (!b)
    return (
      <div className="page narrow">
        <PageHead judul="Hasil cek harga" onBack={() => go('/')} />
        <EmptyState
          icon="calc"
          title={r ? 'Hasil ini perlu dicek ulang' : 'Belum ada hasil cek'}
          action={<Button onClick={() => go(r ? '/cek?ubah=1' : '/cek')}>{r ? 'Cek ulang' : 'Cek harga sekarang'}</Button>}
        >
          {r ? 'Cara KOZY menghitung sudah diperbarui. Isian kosmu masih tersimpan.' : 'Isi data kos incaranmu untuk melihat apakah harganya wajar.'}
        </EmptyState>
      </div>
    );

  const k = { ...kawasanById(r.kawasan.id), ...r.kawasan };
  const kemahalan = r.status === 'KEMAHALAN';
  const rendah = r.meta.confidence === 'rendah';
  const paid = !!state.paid[r.id];
  const jenis = jenisById(r.input.jenis);
  const hemat = Math.abs(r.selisih_rp) >= 10_000 ? Math.abs(r.selisih_rp) : 0;
  const kisaran = r.kisaran;
  // kotak angka kedua: hemat (hijau) kalau lebih murah, selisih kalau lebih mahal
  const selisih =
    Math.abs(r.selisih_rp) < 10_000
      ? { label: 'Selisih', nilai: 'Sama' }
      : r.selisih_rp < 0
        ? { label: 'Hemat per bulan', nilai: rp(r.selisih_rp), nada: 't-green' }
        : { label: 'Di atas pasaran', nilai: rpSigned(r.selisih_rp), nada: kemahalan ? 't-red' : '' };
  // Paling banyak satu peringatan. Kalau datanya sedikit, itu yang terpenting.
  const peringatan = rendah
    ? `Baru ${b.n} iklan pembanding. Hasil belum pasti.`
    : r.ekstrem === 'atas'
      ? 'Jauh di atas semua iklan. Cek lagi angkanya.'
      : periksa
        ? 'Jauh di bawah pasaran. Pastikan fasilitas sesuai iklan.'
        : null;

  const lanjut = (ke) => {
    set({
      tawar: {
        purchaseId: r.id,
        dari: 'cek',
        nama: 'Kos incaranmu',
        kawasan: r.kawasan.nama,
        harga: r.harga_ditawarkan,
        median: r.median,
        kisaran: r.kisaran,
        selisih_rp: r.selisih_rp,
        selisih_persen: r.selisih_persen,
        status: r.status,
        persentil: r.persentil,
        n: b.n,
        jenisPembanding: b.jenis,
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
  const rail = kemahalan
    ? { t: 'Mau menawar?', s: 'Bawa Kartu Tawar berisi data ini saat bertemu pemilik.', cta: 'Buat Kartu Tawar' }
    : { t: 'Bandingkan dulu', s: 'Lihat 5 kos lain di sekitar yang harganya juga wajar.', cta: 'Lihat kos lain' };

  return (
    <div className="page result">
      <div className="result-main">
        <PageHead
          judul="Hasil cek harga"
          sub={`${k.nama}${k.kec !== k.nama ? `, ${k.kec}` : ''}${jenis ? ` · Kos ${jenis.label.toLowerCase()}` : ''}`}
          onBack={() => go('/cek?ubah=1')}
          aksi={<SpeakButton compact teks={ringkas} label="Dengarkan hasil" />}
        />

        <Lembar
          label="Hasil cek harga"
          lembar={[
            {
              id: 'vonis',
              judul: 'Ringkasan',
              isi: (
                <>
                  <HeroHarga
                    status={r.status}
                    nilai={r.median}
                    rentang={kisaran}
                    harga={r.harga_ditawarkan}
                    labelHarga="Kos ini"
                    selisih={selisih}
                    tanda={peringatan ? [peringatan] : []}
                    ringkas={`Harga kos ini ${STATUS_SUARA[r.status]}. Kos ini ${rp(r.harga_ditawarkan)}, harga pasaran ${rp(r.median)}.`}
                  />
                </>
              ),
            },
            {
              id: 'pasar',
              judul: 'Posisi pasar',
              isi: (
                <>
                  <section className="card">
                    <h2 className="card-t only-desk-block">Posisi di pasar</h2>
                    <PosisiPasar r={r} />
                    {!b.jenis && r.input.jenis && <p className="note pasar-note">Kos {jenis.label.toLowerCase()} di sini masih sedikit, jadi semua jenis kos ikut dibandingkan.</p>}
                  </section>
                  {/* Kelompok K-Prototypes hanya melabeli; vonisnya tetap dari median dan kuartil */}
                  {(clusterInfo.loading || clusterInfo.data) && (
                    <section className="cluster-readout" aria-live="polite" aria-busy={clusterInfo.loading}>
                      <span className="ic-circle">
                        <Icon name="bars" size={18} />
                      </span>
                      <span className="cluster-readout-t">
                        <b>{clusterInfo.data ? clusterInfo.data.segmen.segmen_harga : 'Mencari kelompok…'}</b>
                        {clusterInfo.data && (
                          <span>
                            {clusterInfo.data.segmen.jumlah} dari {clusterInfo.data.jumlah_listing} iklan
                          </span>
                        )}
                      </span>
                      {clusterInfo.data && (
                        <InfoTip label="Tentang kelompok harga">
                          Kelompok dibentuk dengan K-Prototypes dari fasilitas, kecamatan, dan jenis kos. Ini hanya label; wajar atau tidaknya tetap dari harga kos sejenis.
                        </InfoTip>
                      )}
                    </section>
                  )}
                </>
              ),
            },
            {
              id: 'lanjut',
              judul: 'Langkah lanjut',
              isi: (
                <>
                  <Rincian
                    judul="Langkah lanjut"
                    baris={[
                      periksa && {
                        id: 'cek',
                        judul: 'Cek ini saat datang',
                        icon: 'list',
                        isi: (
                          <ul className="dot-list">
                            <li>Fasilitas sesuai iklan</li>
                            <li>Biaya listrik dan air</li>
                            <li>Kondisi kamar dan kamar mandi</li>
                            <li>Kos serupa di sini umumnya {rpRentang(kisaran[0], kisaran[1])}</li>
                          </ul>
                        ),
                      },
                      {
                        id: 'sekitar',
                        judul: 'Kos lain di sekitar sini',
                        sub: paid ? 'Sudah dibuka' : '5 kos dan peta',
                        icon: paid ? 'unlock' : 'lock',
                        onClick: () => buka('match'),
                      },
                      {
                        id: 'setahun',
                        judul: r.selisih_rp < 0 ? 'Hemat dalam setahun' : 'Selisih dalam setahun',
                        icon: 'wallet',
                        nilai: rp(Math.abs(r.selisih_rp * 12)),
                        isi: <p className="note">{rp(Math.abs(r.selisih_rp))} × 12 bulan</p>,
                      },
                      periksa && {
                        id: 'budget',
                        judul: `${rp(r.harga_ditawarkan)} itu budgetmu?`,
                        sub: 'Cari kos yang pas',
                        icon: 'search',
                        onClick: cariSesuaiBudget,
                      },
                      {
                        id: 'ai',
                        judul: kemahalan ? 'Cara menawar harganya' : hemat > 0 ? `Sisa ${rp(hemat)} enaknya buat apa?` : 'Yang wajib dicek sebelum bayar',
                        sub: 'Tanya KOZY AI',
                        icon: 'sparkles',
                        onClick: () =>
                          bukaAI({
                            teks: kemahalan
                              ? `Cara nawar harga kos dari ${rp(r.harga_ditawarkan)} ke ${rp(kisaran[1])}`
                              : hemat > 0
                                ? `Ide upgrade kamar dengan budget ${rp(hemat)}`
                                : 'Apa saja yang wajib dicek sebelum bayar kos?',
                          }),
                      },
                    ]}
                  />

                  <section className="habis">
                    <Icon name="shieldc" size={20} />
                    <div>
                      <p>
                        <b>Jangan transfer sebelum lihat kamarnya.</b>
                      </p>
                      <button type="button" className="text-btn" onClick={() => go('/cek?ubah=1')}>
                        Cek kos lain
                      </button>
                    </div>
                  </section>
                </>
              ),
            },
          ]}
        />
      </div>

      <aside className="result-rail">
        <div className="rail-card">
          <p className="rail-t">{rail.t}</p>
          <p className="rail-s">{rail.s}</p>
          <ActionBar>
            <Button block icon={paid ? undefined : 'lock'} iconRight={paid ? 'arrowr' : undefined} onClick={() => buka(kemahalan ? 'tawar' : 'match')}>
              {paid ? rail.cta : `${rail.cta} · ${rp(HARGA_MATCH)}`}
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
