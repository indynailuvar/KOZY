import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Kamar360 from '../components/Kamar360.jsx';
import TanyaAI from '../components/TanyaAI.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { SpeakButton, useBacaOtomatis } from '../components/A11y.jsx';
import { Button, EmptyState, InfoTip, PageHead, ScoreRing, StatusBadge } from '../components/ui.jsx';
import { HARGA_MATCH, Paywall } from '../components/Sheets.jsx';
import { fasilitasById, hitungArea, jenisById, jumlahKosCocok, kawasanById, kebutuhanById, kosPetaDekat, kozyMatch, labelFasilitas, tujuanById } from '../api/kozy.js';
import { daftar, jarak, persen, rp, rpSingkat, rpSuara } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
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
      sub: area ? `Harga kos di sini ${rpSingkat(area.estimasi[0])} – ${rpSingkat(area.estimasi[1])}` : `Maks. ${rp(c.input.budgetMax)}`,
      kembali: '/kawasan',
      tujuan,
      pusat: kawasanById(c.pilih.id),
      args: { kawasanIds: [c.pilih.id], fasilitas: c.input.fasilitas, budgetMax: c.input.budgetMax, jenis: c.input.jenis, tujuan, seed: c.id },
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

const cariIklan = (k) => `https://www.google.com/search?q=${encodeURIComponent(`site:mamikos.com ${k.nama} Surabaya`)}`;

function KosDetail({ k, tujuan, dibanding, onClose, onTawar, onBanding }) {
  const [skor, setSkor] = useState(false);
  useEffect(() => {
    setSkor(false);
  }, [k.id]);
  const jenis = jenisById(k.jenis);
  const suara = `${k.nama}, kos ${jenis.label.toLowerCase()} di Kecamatan ${k.kec}. Harga ${rpSuara(k.harga)} per bulan. Fasilitas: ${daftar(labelFasilitas(k.fasilitas))}.`;
  useBacaOtomatis(suara, k.id);
  const judulRef = useRef(null);
  useEffect(() => {
    judulRef.current?.focus({ preventScroll: true });
  }, [k.id]);
  return (
    <section className="kos-detail" aria-label={`Detail ${k.nama}`}>
      <div className="kd-head">
        <div>
          <h3 ref={judulRef} tabIndex={-1}>
            {k.nama}
          </h3>
          <p>
            {k.kawasan.nama} · {jarak(k.jarak)} dari {tujuan ? tujuan.singkat : 'pusat aktivitas'}
          </p>
        </div>
        <button type="button" className="icon-btn sm" aria-label="Tutup detail" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>

      {k.foto && <Kamar360 foto={k.foto} nama={`kamar di ${k.nama}`} tinggi="sm" />}

      <div className="kd-price">
        <b>{rp(k.harga)}</b>
        <span>/bulan</span>
        <StatusBadge status={k.status} size="sm" />
      </div>
      <p className="note">
        Harga wajar {rp(k.harga_wajar)} ({persen(k.selisih_persen)}) · Kos {jenis.label.toLowerCase()}
        {k.rating ? ` · ★ ${k.rating}` : ''}
        {k.dilihat ? ` · dilihat ${k.dilihat}×` : ''}
      </p>
      {/* Ketersediaan kamar hanya ada di iklan Papikost; kalau kosong tidak dikarang. */}
      {k.sisaKamar != null && (
        <p className={`kd-sisa ${k.sisaKamar <= 2 ? 'is-tipis' : ''}`}>
          <Icon name="door" size={16} />
          {k.sisaKamar > 0 ? (
            <>
              <b>
                {k.sisaKamar} kamar
              </b>{' '}
              masih kosong{k.sisaKamar <= 2 ? ' — tinggal sedikit' : ''}
            </>
          ) : (
            <b>Kamar sedang penuh</b>
          )}
          <small>menurut iklan {k.sumber}</small>
        </p>
      )}

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

      <p className="note kd-sumber">
        Iklan {k.sumber} · titik di peta adalah perkiraan area, bukan alamat persis.
      </p>

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
        <a className="btn btn-primary btn-sm" href={cariIklan(k)} target="_blank" rel="noopener noreferrer" onClick={() => catat('iklan_dibuka', { kec: k.kec, harga: k.harga })}>
          <Icon name="external" size={16} />
          <span>Lihat iklannya</span>
        </a>
        <Button size="sm" variant="secondary" icon="file" onClick={onTawar}>
          Kartu Tawar
        </Button>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={dibanding} onChange={onBanding} />
        Pilih untuk dibandingkan
      </label>
    </section>
  );
}

function Terkunci({ ktx, onBuka }) {
  return (
    <div className="page narrow">
      <PageHead judul={ktx.judul} sub={ktx.sub} onBack={() => go(ktx.kembali)} />
      <section className="card lock-card">
        <KozyMap
          className="map-md"
          label={`Peta ${ktx.pusat.nama}. Lokasi tiap kos terkunci sampai KOZY Match dibuka.`}
          center={[ktx.pusat.lat, ktx.pusat.lng]}
          zoom={15}
          interactive={false}
          circle={{ lat: ktx.pusat.lat, lng: ktx.pusat.lng, radius: 800 }}
          markers={[...markerTujuan(ktx.tujuan), { kind: 'lock', lat: ktx.pusat.lat, lng: ktx.pusat.lng, label: ktx.pusat.nama }]}
          fitKey={ktx.key}
          onSelect={onBuka}
        />
        <div className="lock-body">
          <h2>
            {ktx.jumlah} kos cocok di Kec. {ktx.pusat.kec}
          </h2>
          <p>Buka untuk melihat nama kos, fasilitas, jenis kos, dan kontak pemilik.</p>
          <ul className="check-list">
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Diambil dari iklan asli, harganya sudah dicek wajar
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Nama kos, fasilitas, dan tautan ke iklan aslinya
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
  const ktx0 = useMemo(() => konteksDari(state, dari), [state.cari, state.cek, dari]); // eslint-disable-line react-hooks/exhaustive-deps
  const ktx = ktx0 && { ...ktx0, jumlah: jumlahKosCocok(ktx0.args) };
  const [list, setList] = useState(state.match?.key === ktx?.key ? state.match.list : null);
  const [pilih, setPilih] = useState(null);
  const [bayar, setBayar] = useState(false);
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
        <Terkunci
          ktx={ktx}
          onBuka={() => {
            catat('match_dikunci', { dari, kec: ktx.pusat.kec });
            setBayar(true);
          }}
        />
        <Paywall open={bayar} purchaseId={ktx.purchaseId} onClose={() => setBayar(false)} onPaid={() => setBayar(false)} />
      </>
    );

  const kos = list?.find((k) => k.id === pilih);
  // titik Google Maps di sekitar area ini: lokasinya asli, harganya masih perkiraan model
  const sekitar = kosPetaDekat(ktx.pusat, 1.5, 6);
  const bandingIds = state.bandingkan.map((k) => k.id);
  const markers = [
    ...markerTujuan(ktx.tujuan),
    ...(list || []).map((k) => ({ id: k.id, kind: 'price', lat: k.lat, lng: k.lng, label: rpSingkat(k.harga).replace(/^Rp\s/, ''), selected: k.id === pilih, title: k.nama })),
    ...sekitar.map((g) => ({ id: g.id, kind: 'est', lat: g.lat, lng: g.lng, label: `≈ ${rpSingkat(g.estimasi).replace(/^Rp\s/, '')}`, selected: g.id === pilih, title: `${g.nama} · perkiraan` })),
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
    catat('kartu_tawar', { status: k.status, kec: k.kec });
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
        kec: k.kec,
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
        sub={list ? `${list.length} kos dari iklan ${[...new Set(list.map((k) => k.sumber))].join(' + ')} · harganya sudah dicek` : 'Memuat…'}
        onBack={() => go(ktx.kembali)}
        aksi={<InfoTip label="Tentang skor kecocokan">Skor 0–100 dari harga (40%), jarak (25%), fasilitas (25%), dan keyakinan data (10%).</InfoTip>}
      />

      <div className="match-grid">
        <div className="match-map" ref={mapRef}>
          <KozyMap
            className="map-lg"
            label="Peta lokasi kos. Semua kos juga tercantum di daftar."
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
              dibanding={bandingIds.includes(kos.id)}
              onClose={() => setPilih(null)}
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
          {sekitar.length > 0 && (
            <section className="sekitar">
              <p className="sec-label">Kos lain di sekitar · Google Maps</p>
              <p className="note">Harga kos ini belum ada di sumbernya. Angka di bawah adalah perkiraan model untuk kos dengan fasilitas rata-rata di kecamatan ini, bukan harga dari pemilik.</p>
              {sekitar.map((g) => (
                <a key={g.id} className={`kos-row is-est ${g.id === pilih ? 'is-on' : ''}`} href={g.link || '#'} target="_blank" rel="noopener noreferrer" onClick={() => catat('gmaps_dibuka', { kec: g.kec })}>
                  <span className="kr-t">
                    <b>{g.nama}</b>
                    <small>
                      {jarak(g.jarak)}
                      {g.rating ? ` · ★ ${g.rating}` : ''}
                      {g.keyakinan === 'rendah' ? ' · perkiraan kasar' : ''}
                    </small>
                  </span>
                  <span className="kr-p">
                    <b>
                      ≈ {rpSingkat(g.rendah)} – {rpSingkat(g.tinggi)}
                    </b>
                    <em className="tag-est">perkiraan</em>
                  </span>
                </a>
              ))}
            </section>
          )}

          {list?.length > 0 && (
          <TanyaAI
            dari="match"
            judul="Bingung pilih yang mana?"
            saran={[
              list.length >= 2 ? `Bantu pilih antara ${list[0].nama} dan ${list[1].nama}` : 'Bantu pilih kos yang paling cocok',
              'Apa saja yang wajib dicek saat lihat kos?',
              'Cara nawar harga kos ke pemilik',
            ]}
          />
          )}
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

    </div>
  );
}
