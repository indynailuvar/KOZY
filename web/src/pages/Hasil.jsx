import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { SpeakButton, useBacaOtomatis } from '../components/A11y.jsx';
import { Accordion, ActionBar, Banner, Button, EmptyState, InfoTip, ListRow, PageHead, StatusBadge } from '../components/ui.jsx';
import { HARGA_MATCH, Paywall, VerifiedCard } from '../components/Sheets.jsx';
import { jenisById, kawasanById, statusTampil, terlaluMurah } from '../api/kozy.js';
import { bulat10rb, bulat50rb, persen, rp, rpSingkat, rpSuara, tanggal } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const LEVEL = { besar: 'Besar', sedang: 'Sedang', kecil: 'Kecil' };
const ISI = { besar: 3, sedang: 2, kecil: 1 };
const STATUS_SUARA = { KEMAHALAN: 'kemahalan', WAJAR: 'wajar', MURAH: 'murah' };

function Fakta({ r, curiga }) {
  const tone = curiga ? 't-warn' : r.status === 'KEMAHALAN' ? 't-red' : r.status === 'MURAH' ? 't-blue' : 't-green';
  const tanda = r.selisih_rp < 0 ? '−' : '+';
  return (
    <dl className="facts">
      <div>
        <dt>Harga dari pemilik</dt>
        <dd>{rp(r.harga_ditawarkan)}</dd>
      </div>
      <div>
        <dt>{curiga ? 'Di bawah pasaran' : 'Selisih per bulan'}</dt>
        <dd className={tone}>
          {tanda}
          {rp(r.selisih_rp)} <small>({persen(r.selisih_persen)})</small>
        </dd>
      </div>
      {/* harga yang jauh di bawah pasaran belum tentu hemat, jadi tidak dihitung sebagai penghematan */}
      {!curiga && (
        <div>
          <dt>{r.selisih_rp < 0 ? 'Hemat setahun' : 'Selisih setahun'}</dt>
          <dd className={tone}>
            {r.selisih_rp < 0 ? '' : tanda}
            {rp(r.selisih_rp * 12)}
          </dd>
        </div>
      )}
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

  const curiga = !!r?.faktor && terlaluMurah(r);
  const ringkas = r?.faktor
    ? `Hasil cek kos di ${r.kawasan.nama}: harganya ${curiga ? 'jauh di bawah pasaran, jadi perlu dicek dulu' : STATUS_SUARA[r.status]}. Harga wajarnya sekitar ${rpSuara(
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
  const radius = r.meta.radius_m === 800 ? '800 m' : '1,5 km';
  const jenis = jenisById(r.input.jenis);
  const hemat = Math.abs(r.selisih_rp) >= 10_000 ? Math.abs(r.selisih_rp) : 0;

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
        status: statusTampil(r),
        persentil: r.persentil,
        n: r.pasar.n_pembanding,
        radius,
        updated_at: r.meta.updated_at,
      },
    });
    go(ke === 'match' ? '/match?dari=cek' : '/kartu-tawar');
  };
  const buka = (ke) => {
    tujuan.current = ke;
    if (paid) lanjut(ke);
    else setBayar(true);
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
    ? { t: 'Mau menawar harganya?', s: 'Tunjukkan Kartu Tawar berisi data ini ke pemilik.', cta: 'Buat Kartu Tawar' }
    : curiga
      ? { t: 'Bandingkan dengan kos terverifikasi', s: 'Lihat 5 kos berharga wajar dengan kontak pemilik yang sudah dicek.', cta: 'Lihat kos alternatif' }
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
            Hanya {r.pasar.n_pembanding} kos pembanding, jadi anggap angka ini perkiraan.
          </Banner>
        )}
        {curiga ? (
          <Banner tone="warn" icon="alert" title="Harganya jauh di bawah pasaran">
            Kos serupa di {k.nama} umumnya {rpSingkat(r.pasar.p10)} – {rpSingkat(r.pasar.p90)}. Pastikan fasilitasnya sesuai dan tidak ada biaya tambahan. Jangan transfer sebelum
            melihat kamarnya.
          </Banner>
        ) : (
          r.meta.anomali && (
            <Banner tone="warn" icon="alert" title="Harga ini tidak biasa">
              Pastikan harga dan fasilitas yang kamu isi sudah benar.
            </Banner>
          )
        )}

        <section className="card verdict">
          <StatusBadge status={statusTampil(r)} />
          <p className="v-label">Harga wajar kamar ini</p>
          <p className="v-num">
            {rp(r.harga_wajar)}
            <span>/bulan</span>
          </p>
          {rendah && <p className="v-note">Perkiraan ± {rp(bulat10rb(r.harga_wajar * 0.08))}</p>}
          <Fakta r={r} curiga={curiga} />
          <p className="v-basis">
            {r.pasar.n_pembanding} kos pembanding · data {tanggal(r.meta.updated_at)}
            <InfoTip label="Cara KOZY menghitung">
              Dibandingkan dengan kos serupa dalam {radius}, lalu disaring dari harga yang janggal. Keyakinan: <b>{r.meta.confidence}</b>.
            </InfoTip>
          </p>
        </section>

        {curiga && (
          <div className="list-card">
            <ListRow
              icon="wallet"
              title={`${rp(r.harga_ditawarkan)} itu budget kamu?`}
              sub={`Untuk kos seperti ini, budgetmu kurang ± ${rp(Math.abs(r.selisih_rp))} per bulan. Cari kos yang sesuai budget.`}
              onClick={cariSesuaiBudget}
            />
          </div>
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
            <h2>Kos lain di {k.nama}</h2>
            <span>radius {radius}</span>
          </div>
          <KozyMap
            className="map-sm"
            center={[k.lat, k.lng]}
            zoom={15}
            interactive={false}
            circle={{ lat: k.lat, lng: k.lng, radius: r.meta.radius_m }}
            markers={[{ kind: 'lock', lat: k.lat, lng: k.lng, label: k.nama, open: paid }]}
            onSelect={() => buka('match')}
          />
          <div className="unlock-row">
            <Icon name={paid ? 'unlock' : 'lock'} size={18} />
            <span>
              <b>5 kos dengan harga wajar</b>
              <small>{paid ? 'Sudah terbuka' : 'Lokasi, fasilitas, dan kontak'}</small>
            </span>
            <Button size="sm" variant="secondary" onClick={() => buka('match')}>
              {paid ? 'Lihat' : 'Buka'}
            </Button>
          </div>
        </section>

        {!curiga &&
          hemat > 0 && (
            <div className="list-card">
              <ListRow
                icon="sofa"
                title={r.selisih_rp < 0 ? `Hemat ${rp(hemat)} per bulan` : `Potensi hemat ${rp(hemat)} per bulan`}
                sub="Minta ide upgrade kamar ke KOZY AI"
                onClick={() => bukaAI({ teks: `Ide upgrade kamar dengan budget ${rp(hemat)}` })}
              />
            </div>
          )}

        {(rendah || curiga) && <VerifiedCard />}

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
