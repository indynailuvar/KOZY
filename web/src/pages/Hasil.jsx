import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import TanyaAI from '../components/TanyaAI.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { SpeakButton, useBacaOtomatis } from '../components/A11y.jsx';
import { Accordion, ActionBar, Banner, Button, EmptyState, InfoTip, ListRow, PageHead, StatusBadge } from '../components/ui.jsx';
import { HARGA_MATCH, Paywall } from '../components/Sheets.jsx';
import { jenisById, kawasanById, kisaranWajar, perluDiperiksa } from '../api/kozy.js';
import { bulat10rb, bulat50rb, persen, rp, rpSingkat, rpSuara, tanggal } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const LEVEL = { besar: 'Besar', sedang: 'Sedang', kecil: 'Kecil' };
const ISI = { besar: 3, sedang: 2, kecil: 1 };
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
        <dt>{r.selisih_rp < 0 ? 'Lebih murah per bulan' : 'Selisih per bulan'}</dt>
        <dd className={tone}>
          {tanda}
          {rp(r.selisih_rp)} <small>({persen(r.selisih_persen)})</small>
        </dd>
      </div>
      <div>
        <dt>{r.selisih_rp < 0 ? 'Hemat setahun' : 'Selisih setahun'}</dt>
        <dd className={tone}>
          {r.selisih_rp < 0 ? '' : tanda}
          {rp(r.selisih_rp * 12)}
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
      <p className="faktor-t">Pengaruh tiap faktor</p>
      <ul className="faktor-list">
        {r.faktor.map((f) => (
          <li key={f.key}>
            <Icon name={f.icon} size={17} />
            <span className="fk-l">{f.label}</span>
            <span className="fk-lv" aria-label={`${f.arah === 'turun' ? 'Menurunkan' : 'Menaikkan'} harga, pengaruh ${LEVEL[f.level].toLowerCase()}`}>
              {f.arah === 'turun' && <Icon name="trenddown" size={13} strokeWidth={2.6} />}
              <span className="fk-meter" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <i key={i} className={i <= ISI[f.level] ? 'on' : ''} />
                ))}
              </span>
              <em>{LEVEL[f.level]}</em>
            </span>
          </li>
        ))}
      </ul>
      <p className="note">Nilai tiap fasilitas berbeda di setiap kawasan, jadi yang ditampilkan adalah besar pengaruhnya.</p>
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
  const tujuan = useRef('tawar');
  const r = state.cek;

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
  const kec = r.meta.kecamatan || r.kawasan.kec;
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

        {rendah && (
          <Banner tone="warn" icon="alert" title="Data di sekitar masih sedikit">
            Baru {r.pasar.n_pembanding} iklan kos yang terkumpul di Kec. {r.kawasan.kec}, jadi anggap angka ini perkiraan kasar. Kecamatan ini belum punya tingkat harganya
            sendiri dan sementara memakai rata-rata kota.
          </Banner>
        )}
        {r.meta.anomali && r.selisih_rp > 0 && (
          <Banner tone="warn" icon="alert" title="Harga ini tidak biasa">
            Pastikan harga dan fasilitas yang kamu isi sudah benar.
          </Banner>
        )}

        <section className="card verdict">
          <StatusBadge status={r.status} />
          <p className="v-label">Harga wajar kamar ini</p>
          <p className="v-num">
            {rp(r.harga_wajar)}
            <span>/bulan</span>
          </p>
          <p className="v-note">
            Masih wajar di kisaran {rpSingkat(kisaran[0])} – {rpSingkat(kisaran[1])}
            {rendah && ' · data di kecamatan ini masih sedikit'}
          </p>
          <Fakta r={r} />
          <p className="v-basis">
            {r.pasar.n_pembanding} iklan kos di Kec. {kec} · data {r.meta.sumber} {tanggal(r.meta.updated_at)}
            <InfoTip label="Cara KOZY menghitung">
              Harga wajar dihitung dari {r.pasar.n_pembanding} iklan kos di Kec. {kec} ({r.meta.sumber}, {tanggal(r.meta.updated_at)}) memakai model yang menimbang lokasi, jenis
              kos, dan fasilitas. Saat diuji, perkiraan model meleset rata-rata ± {rp(r.meta.mae)}. Keyakinan data: <b>{r.meta.confidence}</b>.
            </InfoTip>
          </p>
        </section>

        {periksa && (
          <Banner icon="checkc" title="Harga bagus. Pastikan dulu sebelum transfer">
            Selisihnya besar, jadi cek langsung: fasilitasnya sesuai iklan, biaya listrik dan air, serta kondisi kamarnya. Kos serupa di sini umumnya {rpSingkat(r.pasar.p10)} –{' '}
            {rpSingkat(r.pasar.p90)}.
          </Banner>
        )}

        <div className="stack">
          <Accordion title="Kenapa harganya segini?" icon="calc">
            <FaktorHarga r={r} />
          </Accordion>
          <Accordion title="Posisi di pasar" icon="bars">
            <PosisiPasar r={r} />
          </Accordion>
        </div>

        <section className="card map-sec">
          <div className="sec-head">
            <h2>Kos lain di sekitar sini</h2>
            <span>Kec. {kec}</span>
          </div>
          <KozyMap
            className="map-sm"
            label={`Peta ${k.nama}. Lokasi 5 kos dengan harga wajar bisa dibuka lewat tombol di bawah peta.`}
            center={[k.lat, k.lng]}
            zoom={15}
            interactive={false}
            circle={{ lat: k.lat, lng: k.lng, radius: 1200 }}
            markers={[{ kind: 'lock', lat: k.lat, lng: k.lng, label: k.nama, open: paid }]}
            onSelect={() => buka('match')}
          />
          <div className="unlock-row">
            <Icon name={paid ? 'unlock' : 'lock'} size={18} />
            <span>
              <b>Kos lain yang harganya wajar</b>
              <small>{paid ? 'Sudah terbuka' : 'Lokasi, fasilitas, dan kontak'}</small>
            </span>
            <Button size="sm" variant="secondary" onClick={() => buka('match')}>
              {paid ? 'Lihat' : 'Buka'}
            </Button>
          </div>
        </section>

        {hemat > 0 && (
          <div className="list-card">
            <ListRow
              icon="sofa"
              title={r.selisih_rp < 0 ? `Hemat ${rp(hemat)} per bulan dibanding pasaran` : `Potensi hemat ${rp(hemat)} per bulan`}
              sub={r.selisih_rp < 0 ? `Sisa ${rp(hemat)} enaknya dibuat apa? Tanya KOZY AI` : 'Minta ide upgrade kamar ke KOZY AI'}
              onClick={() => bukaAI({ teks: `Ide upgrade kamar dengan budget ${rp(hemat)}` })}
            />
          </div>
        )}
        {periksa && (
          <div className="list-card">
            <ListRow
              icon="wallet"
              title={`${rp(r.harga_ditawarkan)} itu budgetmu, bukan harga pemilik?`}
              sub="Cari kos yang harganya pas dengan budget itu"
              onClick={cariSesuaiBudget}
            />
          </div>
        )}


        <TanyaAI
          dari="hasil"
          judul={r.status === 'KEMAHALAN' ? 'Mau coba nawar?' : 'Masih ragu sebelum transfer?'}
          saran={
            r.status === 'KEMAHALAN'
              ? [`Cara nawar harga kos dari ${rp(r.harga_ditawarkan)} ke ${rp(r.harga_wajar)}`, 'Apa saja yang wajib dicek sebelum bayar kos?', 'Tips bertahan di tanggal tua']
              : [`Sisa budget ${rp(Math.max(0, r.harga_wajar - r.harga_ditawarkan))} enaknya dibuat apa?`, 'Apa saja yang wajib dicek sebelum bayar kos?', 'Cara nawar harga kos']
          }
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
          <ActionBar note={paid ? null : `${rp(HARGA_MATCH)} · termasuk 5 kos alternatif`}>
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
