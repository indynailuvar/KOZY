import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { SpeakButton, useBacaOtomatis } from '../components/A11y.jsx';
import { Button, EmptyState, InfoTip, PageHead, ScoreRing, Segmented } from '../components/ui.jsx';
import { fasilitasById, hitungArea, jenisById, kebutuhanById, ringkasInsight, saranAI, tujuanById } from '../api/kozy.js';
import { daftar, rp, rpSingkat, rpSuara } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const FIT = { pas: 'Pas budget', sebagian: 'Sebagian pas', atas: 'Di atas budget' };

function Sebaran({ bins }) {
  const max = Math.max(...bins.map((b) => b.jumlah), 1);
  const label = (v) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : `${v / 1000} rb`);
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
      <p className="note">Batang biru = rentang harga yang paling banyak ditemui.</p>
    </div>
  );
}

export default function Insight() {
  const { state, set } = useStore();
  const r = state.cari;
  const [dilepas, setDilepas] = useState([]);
  const [semua, setSemua] = useState(false);
  const [tampilan, setTampilan] = useState('daftar');
  const [sebaran, setSebaran] = useState(false);
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
  const detail = (a) => {
    set({ cari: { ...r, input, pilih: { id: a.id, nama: a.nama } }, match: null });
    go('/match?dari=cari');
  };
  const areaPilih = areas.find((a) => a.id === pilihId);
  const subJudul = [`Dekat ${tujuan.singkat}`, r.input.jenis ? `kos ${jenisById(r.input.jenis).label.toLowerCase()}` : null, `maks. ${rpSingkat(r.input.budgetMax)}`].filter(Boolean).join(' · ');

  const peta = (
    <div className="ins-map-box">
      <KozyMap
        className="map-md"
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

  return (
    <div className="page insight">
      <PageHead judul="Rekomendasi area" sub={subJudul} onBack={() => go('/cari')} aksi={<SpeakButton compact teks={ringkasSuara} label="Dengarkan ringkasan" />} />

      <div className="ins-grid">
        <div className="ins-main">
          <section className="card ins-sum">
            <p className="v-label">Harga wajar di area pilihanmu</p>
            <p className="ins-range">
              <span className="nw">{rp(insight.range[0])} –</span> <span className="nw">{rp(insight.range[1])}</span>
              <small>/bulan</small>
            </p>
            <p className="v-basis">
              {insight.n} data pembanding · akurasi model {Math.round(insight.akurasi * 100)}%
              <InfoTip label="Tentang akurasi">Seberapa dekat perkiraan model dengan harga sebenarnya pada data uji.</InfoTip>
            </p>
            <button type="button" className="text-btn" aria-expanded={sebaran} onClick={() => setSebaran((s) => !s)}>
              {sebaran ? 'Sembunyikan sebaran harga' : 'Lihat sebaran harga'}
              <Icon name="down" size={16} style={{ transform: sebaran ? 'rotate(180deg)' : undefined }} />
            </button>
            {sebaran && <Sebaran bins={insight.bins} />}
          </section>

          {saran && (
            <div className="ai-tip">
              <span className="ic-circle sm">
                <Icon name="sparkles" size={16} />
              </span>
              <p>
                <b>Saran KOZY AI</b>
                {saran.jenis === 'lepas' ? `Tanpa ${saran.label}, ${saran.tambah} area lagi masuk budgetmu` : `Tambah budget ${rp(saran.naik)}, ${saran.tambah} area lagi masuk budgetmu`}, misalnya {daftar(saran.nama)}.
              </p>
              {saran.jenis === 'lepas' && (
                <Button size="sm" variant="secondary" onClick={() => setDilepas((d) => [...d, saran.fasilitas])}>
                  Coba
                </Button>
              )}
            </div>
          )}
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
            <p className="sec-label">{areas.length} area dianalisis</p>
            {tampil.map((a, i) => (
              <button key={a.id} type="button" className={`area-row ${a.id === pilihId ? 'is-on' : ''}`} onClick={() => detail(a)} onMouseEnter={() => setPilihId(a.id)}>
                <span className="rank">{i + 1}</span>
                <span className="ar-t">
                  <b>{a.nama}</b>
                  <small>{a.alasan.slice(0, 2).join(' · ') || `Kec. ${a.kec}`}</small>
                  <span className="ar-price">
                    {rpSingkat(a.estimasi[0])} – {rpSingkat(a.estimasi[1])}
                    <em className={`fit-${a.fit}`}>{FIT[a.fit]}</em>
                  </span>
                </span>
                <ScoreRing value={a.skor} size={42} label="Skor area" />
                <Icon name="right" size={18} className="lr-go" />
              </button>
            ))}
            {areas.length > 4 && (
              <button type="button" className="text-btn center" onClick={() => setSemua((s) => !s)}>
                {semua ? 'Tampilkan lebih sedikit' : `Lihat semua ${areas.length} area`}
              </button>
            )}
          </div>
        </div>

        <aside className="ins-map only-desk-block">{peta}</aside>
      </div>
    </div>
  );
}
