import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { SpeakButton } from '../components/A11y.jsx';
import { Button, EmptyState, InfoTip, PageHead, ScoreRing, Sheet, StatusBadge } from '../components/ui.jsx';
import { HARGA_MATCH, Paywall, VerifiedCard } from '../components/Sheets.jsx';
import { fasilitasById, hitungArea, jenisById, kawasanById, kebutuhanById, kozyMatch, labelFasilitas, tujuanById } from '../api/kozy.js';
import { daftar, jarak, persen, rp, rpSingkat, rpSuara } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

function konteksDari(state, dari) {
  if (dari === 'cari' && state.cari?.pilih) {
    const c = state.cari;
    const tujuan = tujuanById(c.input.tujuanId);
    const area = hitungArea(c.input).find((a) => a.id === c.pilih.id);
    return {
      key: `${c.id}:${c.pilih.id}:${c.input.fasilitas.join()}`,
      purchaseId: c.id,
      judul: `Kos di ${c.pilih.nama}`,
      sub: area ? `Estimasi ${rpSingkat(area.estimasi[0])} – ${rpSingkat(area.estimasi[1])} · ${area.n} kos pembanding` : `Maks. ${rp(c.input.budgetMax)}`,
      kembali: '/kawasan',
      tujuan,
      pusat: kawasanById(c.pilih.id),
      args: { kawasanIds: [c.pilih.id], fasilitas: c.input.fasilitas, budgetMax: c.input.budgetMax, jenis: c.input.jenis, disabilitas: c.input.disabilitas, tujuan, seed: c.id },
    };
  }
  if (dari === 'cek' && state.cek?.faktor) {
    const r = state.cek;
    // alternatif selalu berharga wajar, jadi batasnya tidak di bawah harga wajar
    const batas = Math.max(r.harga_ditawarkan, r.harga_wajar);
    return {
      key: r.id,
      purchaseId: r.id,
      judul: `Alternatif di ${r.kawasan.nama}`,
      sub: `Kos ${jenisById(r.input.jenis)?.label.toLowerCase() || ''} · hingga ${rp(batas)}`,
      kembali: '/hasil',
      tujuan: null,
      pusat: kawasanById(r.kawasan.id),
      args: { kawasanIds: [r.kawasan.id], fasilitas: r.input.fasilitas, budgetMax: batas, jenis: r.input.jenis, seed: r.id },
    };
  }
  return null;
}

const markerTujuan = (t) => (t ? [{ kind: 'place', lat: t.lat, lng: t.lng, label: t.singkat, icon: kebutuhanById(t.jenis)?.icon || 'pin' }] : []);

function KosDetail({ k, tujuan, terbuka, dibanding, onClose, onBuka, onTawar, onBanding }) {
  const [skor, setSkor] = useState(false);
  useEffect(() => setSkor(false), [k.id]);
  const jenis = jenisById(k.jenis);
  const waText = encodeURIComponent(`Halo, saya lihat ${k.nama} (${k.kawasan.nama}) di KOZY. Apakah kamarnya masih tersedia?`);
  const suara = `${k.nama}, kos ${jenis.label.toLowerCase()} di ${k.kawasan.nama}. Harga ${rpSuara(k.harga)} per bulan. Fasilitas: ${daftar(labelFasilitas(k.fasilitas))}.${
    k.aksesibel ? ` Akses disabilitas: ${k.fiturAkses.join(', ')}.` : ''
  }`;
  return (
    <div className="kos-detail" role="dialog" aria-label={`Detail ${k.nama}`}>
      <div className="kd-head">
        <div>
          <h3>{k.nama}</h3>
          <p>
            {k.kawasan.nama} · {jarak(k.jarak)} dari {tujuan ? tujuan.singkat : 'pusat aktivitas'}
          </p>
        </div>
        <button type="button" className="icon-btn sm" aria-label="Tutup detail" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="kd-price">
        <b>{rp(k.harga)}</b>
        <span>/bulan</span>
        <StatusBadge status={k.status} size="sm" />
      </div>
      <p className="note">
        Harga wajar {rp(k.harga_wajar)} ({persen(k.selisih_persen)}) · Kos {jenis.label.toLowerCase()} · {k.luas} m²
      </p>

      <p className="kd-label">Fasilitas</p>
      <ul className="kd-grid">
        {k.fasilitas.map((id) => {
          const f = fasilitasById(id);
          return (
            <li key={id}>
              <Icon name={f.icon} size={17} />
              {f.label}
            </li>
          );
        })}
      </ul>

      {k.aksesibel && (
        <>
          <p className="kd-label">Akses disabilitas</p>
          <ul className="kd-grid one">
            {k.fiturAkses.map((x) => (
              <li key={x}>
                <Icon name="check" size={16} strokeWidth={2.6} />
                {x}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="kd-score">
        <ScoreRing value={k.skor.total} size={36} label="Skor kecocokan" />
        <button type="button" className="text-btn" aria-expanded={skor} onClick={() => setSkor((s) => !s)}>
          Skor kecocokan
          <Icon name="down" size={15} style={{ transform: skor ? 'rotate(180deg)' : undefined }} />
        </button>
        <SpeakButton compact teks={suara} label="Bacakan detail kos" />
      </div>
      {skor && (
        <ul className="skor">
          {[
            ['Harga', k.skor.harga, 40],
            ['Jarak', k.skor.jarak, 25],
            ['Fasilitas', k.skor.fasilitas, 25],
            ['Keyakinan data', k.skor.keyakinan, 10],
          ].map(([l, v, m]) => (
            <li key={l}>
              <span>{l}</span>
              <span className="skor-track">
                <i style={{ width: `${(v / m) * 100}%` }} />
              </span>
              <b>
                {v}/{m}
              </b>
            </li>
          ))}
        </ul>
      )}

      <div className="kd-actions">
        {terbuka ? (
          <a className="btn btn-primary btn-sm" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={16} />
            <span>Chat pemilik</span>
          </a>
        ) : (
          <Button size="sm" icon="phone" onClick={onBuka}>
            Buka Nomor
          </Button>
        )}
        <Button size="sm" variant="secondary" icon="file" onClick={onTawar}>
          Kartu Tawar
        </Button>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={dibanding} onChange={onBanding} />
        Pilih untuk dibandingkan
      </label>
    </div>
  );
}

function Terkunci({ ktx, onBuka }) {
  return (
    <div className="page narrow">
      <PageHead judul={ktx.judul} sub={ktx.sub} onBack={() => go(ktx.kembali)} />
      <section className="card lock-card">
        <KozyMap
          className="map-md"
          center={[ktx.pusat.lat, ktx.pusat.lng]}
          zoom={15}
          interactive={false}
          circle={{ lat: ktx.pusat.lat, lng: ktx.pusat.lng, radius: 800 }}
          markers={[...markerTujuan(ktx.tujuan), { kind: 'lock', lat: ktx.pusat.lat, lng: ktx.pusat.lng, label: ktx.pusat.nama }]}
          fitKey={ktx.key}
          onSelect={onBuka}
        />
        <div className="lock-body">
          <h2>5 kos cocok di {ktx.pusat.nama}</h2>
          <p>Buka untuk melihat lokasi tiap kos, fasilitas, jenis kos, dan kontak pemilik.</p>
          <ul className="check-list">
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Semua harganya sudah dicek wajar
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Kontak pemilik terverifikasi
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Kartu Tawar untuk nego
            </li>
          </ul>
          <Button block icon="lock" onClick={onBuka}>
            Buka KOZY Match · {rp(HARGA_MATCH)}
          </Button>
        </div>
      </section>
    </div>
  );
}

export default function Match({ query }) {
  const { state, set, toast } = useStore();
  const dari = query.dari || 'cek';
  const ktx = useMemo(() => konteksDari(state, dari), [state.cari, state.cek, dari]); // eslint-disable-line react-hooks/exhaustive-deps
  const [list, setList] = useState(state.match?.key === ktx?.key ? state.match.list : null);
  const [pilih, setPilih] = useState(null);
  const [bayar, setBayar] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(null);
  const mapRef = useRef(null);
  const paid = ktx && state.paid[ktx.purchaseId];

  useEffect(() => {
    if (!ktx || !paid || list) return;
    let hidup = true;
    kozyMatch(ktx.args).then((l) => {
      if (!hidup) return;
      setList(l);
      set({ match: { key: ktx.key, list: l } });
    });
    return () => {
      hidup = false;
    };
  }, [ktx?.key, paid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ktx)
    return (
      <div className="page narrow">
        <EmptyState icon="search" title="Belum ada pencarian" action={<Button onClick={() => go('/cari')}>Cari Kos</Button>}>
          Mulai dari cek harga atau cari kos sesuai kebutuhan.
        </EmptyState>
      </div>
    );

  if (!paid)
    return (
      <>
        <Terkunci ktx={ktx} onBuka={() => setBayar(true)} />
        <Paywall open={bayar} purchaseId={ktx.purchaseId} onClose={() => setBayar(false)} onPaid={() => setBayar(false)} />
      </>
    );

  const kos = list?.find((k) => k.id === pilih);
  const bandingIds = state.bandingkan.map((k) => k.id);
  const markers = [
    ...markerTujuan(ktx.tujuan),
    ...(list || []).map((k) => ({ id: k.id, kind: 'price', lat: k.lat, lng: k.lng, label: rpSingkat(k.harga).replace(/^Rp\s/, ''), selected: k.id === pilih, title: k.nama })),
  ];
  const pilihKos = (id) => {
    setPilih(id);
    if (window.matchMedia('(max-width: 959px)').matches) mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const toggleBanding = (k) =>
    set((s) => {
      const ada = s.bandingkan.some((x) => x.id === k.id);
      return { bandingkan: ada ? s.bandingkan.filter((x) => x.id !== k.id) : [...s.bandingkan.filter((x) => list.some((l) => l.id === x.id)), k].slice(-2) };
    });
  const buatTawar = (k) => {
    set({
      tawar: {
        purchaseId: ktx.purchaseId,
        dari,
        nama: k.nama,
        kawasan: k.kawasan.nama,
        harga: k.harga,
        harga_wajar: k.harga_wajar,
        selisih_rp: k.selisih_rp,
        selisih_persen: k.selisih_persen,
        status: k.status,
        persentil: k.persentil,
        n: k.n,
        radius: k.n >= 15 ? '800 m' : '1,5 km',
        updated_at: state.cek?.meta?.updated_at || state.cari?.updated_at || '2026-09-12',
      },
    });
    go('/kartu-tawar');
  };
  const dipilih = state.bandingkan.filter((x) => list?.some((l) => l.id === x.id));

  return (
    <div className="page match">
      <PageHead
        judul={ktx.judul}
        sub={list ? `${list.length} kos lolos cek harga · kontak terverifikasi` : 'Memuat…'}
        onBack={() => go(ktx.kembali)}
        aksi={<InfoTip label="Tentang skor kecocokan">Skor 0–100 dari harga (40%), jarak (25%), fasilitas (25%), dan keyakinan data (10%).</InfoTip>}
      />

      <div className="match-grid">
        <div className="match-map" ref={mapRef}>
          <KozyMap
            className="map-lg"
            center={[ktx.pusat.lat, ktx.pusat.lng]}
            zoom={15}
            markers={markers}
            fitKey={list ? ktx.key : null}
            padBottom={60}
            focus={kos ? { lat: kos.lat, lng: kos.lng, offsetY: 0 } : null}
            onSelect={(id) => setPilih(id)}
          />
          {kos ? (
            <KosDetail
              k={kos}
              tujuan={ktx.tujuan}
              terbuka={!!state.kontakDibuka[kos.id]}
              dibanding={bandingIds.includes(kos.id)}
              onClose={() => setPilih(null)}
              onBuka={() => setKonfirmasi(kos)}
              onTawar={() => buatTawar(kos)}
              onBanding={() => toggleBanding(kos)}
            />
          ) : (
            <p className="note center">{list ? 'Ketuk harga di peta atau pilih kos di daftar.' : 'Memuat kos…'}</p>
          )}
        </div>

        <div className="match-list">
          {!list ? (
            [0, 1, 2].map((i) => <div key={i} className="skeleton" />)
          ) : list.length === 0 ? (
            <EmptyState icon="search" title="Belum ada kos yang cocok">
              Coba naikkan budget atau kurangi fasilitas wajib.
            </EmptyState>
          ) : (
            list.map((k) => (
              <button key={k.id} type="button" className={`kos-row ${k.id === pilih ? 'is-on' : ''}`} onClick={() => pilihKos(k.id)}>
                <span className="kr-t">
                  <b>{k.nama}</b>
                  <small>
                    Kos {jenisById(k.jenis).label.toLowerCase()} · {jarak(k.jarak)}
                    {k.aksesibel && ' · ramah disabilitas'}
                  </small>
                </span>
                <span className="kr-p">
                  <b>{rp(k.harga)}</b>
                  <StatusBadge status={k.status} size="sm" />
                </span>
                {bandingIds.includes(k.id) && <Icon name="scale" size={16} className="kr-flag" />}
              </button>
            ))
          )}
          <VerifiedCard />
        </div>
      </div>

      {dipilih.length > 0 && (
        <div className="compare-bar" role="status">
          <span>{dipilih.length === 2 ? `${dipilih[0].nama} vs ${dipilih[1].nama}` : `${dipilih[0].nama} dipilih · pilih 1 lagi`}</span>
          <Button size="sm" disabled={dipilih.length !== 2} onClick={() => (dipilih.length === 2 ? go('/bandingkan') : toast('Pilih 1 kos lagi'))}>
            Bandingkan
          </Button>
        </div>
      )}

      <Sheet open={!!konfirmasi} onClose={() => setKonfirmasi(null)} label="Buka nomor pemilik">
        {konfirmasi && (
          <div className="sheet-body">
            <h2 className="h2">Buka nomor pemilik {konfirmasi.nama}?</h2>
            <p className="muted">Nomor akan tercatat di akunmu. Gunakan untuk menanyakan kamar, bukan untuk promosi.</p>
            <Button
              block
              onClick={() => {
                set((s) => ({ kontakDibuka: { ...s.kontakDibuka, [konfirmasi.id]: true } }));
                setKonfirmasi(null);
              }}
            >
              Buka Nomor
            </Button>
            <Button variant="ghost" block onClick={() => setKonfirmasi(null)}>
              Batal
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
