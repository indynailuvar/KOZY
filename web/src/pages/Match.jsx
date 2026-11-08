import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Kamar360 from '../components/Kamar360.jsx';
import TanyaAI from '../components/TanyaAI.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { SpeakButton, useBacaOtomatis } from '../components/A11y.jsx';
import { Button, EmptyState, InfoTip, PageHead, ScoreRing, StatusBadge } from '../components/ui.jsx';
import { HARGA_MATCH, Paywall } from '../components/Sheets.jsx';
import { fasilitasById, hitungArea, jenisById, jumlahKosCocok, kawasanById, kebutuhanById, kosPetaDekat, kozyMatch, labelFasilitas, tujuanById } from '../api/kozy.js';
import { daftar, jarak, rp, rpRentang, rpSingkat, rpSuara } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

function konteksDari(state, dari) {
  // kawasan yang tersimpan bisa sudah tidak ada di data terbaru; jangan sampai halamannya pecah
  if (dari === 'cari' && state.cari?.pilih && kawasanById(state.cari.pilih.id)) {
    const c = state.cari;
    const tujuan = tujuanById(c.input.tujuanId);
    const area = hitungArea(c.input).find((a) => a.id === c.pilih.id);
    return {
      key: `${c.id}:${c.pilih.id}:${c.input.fasilitas.join()}`,
      purchaseId: c.id,
      judul: `Kos di ${c.pilih.nama}`,
      sub: area ? `Umumnya ${rpRentang(area.estimasi[0], area.estimasi[1])} per bulan` : `Maks. ${rp(c.input.budgetMax)}`,
      kembali: '/kawasan',
      tujuan,
      pusat: kawasanById(c.pilih.id),
      args: { kawasanIds: [c.pilih.id], fasilitas: c.input.fasilitas, budgetMax: c.input.budgetMax, jenis: c.input.jenis, tujuan, seed: c.id },
    };
  }
  if (dari === 'cek' && state.cek?.pembanding && kawasanById(state.cek.kawasan.id)) {
    const r = state.cek;
    // alternatif selalu berharga wajar, jadi batasnya tidak di bawah harga tengah pembanding
    const batas = Math.max(r.harga_ditawarkan, r.median);
    return {
      key: r.id,
      purchaseId: r.id,
      judul: `Kos lain di ${r.kawasan.nama}`,
      sub: `Kos ${jenisById(r.input.jenis)?.label.toLowerCase() || ''} · sampai ${rp(batas)}`,
      kembali: '/hasil',
      tujuan: null,
      pusat: kawasanById(r.kawasan.id),
      args: { kawasanIds: [r.kawasan.id], fasilitas: r.input.fasilitas, budgetMax: batas, jenis: r.input.jenis, seed: r.id },
    };
  }
  return null;
}

const markerTujuan = (t) => (t ? [{ kind: 'place', lat: t.lat, lng: t.lng, label: t.singkat, icon: kebutuhanById(t.jenis)?.icon || 'pin' }] : []);

const cariIklan = (k) => `https://www.google.com/search?q=${encodeURIComponent(`${k.nama} kos Surabaya`)}`;

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
  const selisih = Math.round(Math.abs(k.selisih_persen));
  return (
    <section className="kos-detail" aria-label={`Detail ${k.nama}`}>
      <div className="kd-head">
        <div>
          <h3 ref={judulRef} tabIndex={-1}>
            {k.nama}
          </h3>
          <p>
            {jarak(k.jarak)} dari {tujuan ? tujuan.singkat : k.kawasan.nama}
            {k.lokasiPerkiraan ? ' (perkiraan)' : ''} · Kos {jenis.label.toLowerCase()}
            {k.rating ? ` · ★ ${k.rating}` : ''}
          </p>
        </div>
        <div className="kd-head-act">
          <SpeakButton compact teks={suara} label="Bacakan detail kos" />
          <button type="button" className="icon-btn sm" aria-label="Tutup detail" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      {k.foto && <Kamar360 foto={k.foto} nama={`kamar di ${k.nama}`} tinggi="sm" />}

      <div className="kd-price">
        <b>{rp(k.harga)}</b>
        <span>/bulan</span>
        <StatusBadge status={k.status} size="sm" />
      </div>
      <p className="kd-vs">
        {selisih === 0 ? 'Sama dengan' : `${selisih}% ${k.selisih_persen < 0 ? 'di bawah' : 'di atas'}`} harga pasaran {rpSingkat(k.median)}
      </p>
      {/* Ketersediaan kamar tidak selalu ada di data; kalau kosong tidak dikarang. */}
      {k.sisaKamar != null && (
        <p className={`kd-sisa ${k.sisaKamar <= 2 ? 'is-tipis' : ''}`}>
          <Icon name="door" size={16} />
          {k.sisaKamar > 0 ? `Sisa ${k.sisaKamar} kamar` : 'Kamar sedang penuh'}
        </p>
      )}

      <ul className="kd-chips" aria-label="Fasilitas">
        {k.fasilitas.map((id) => {
          const f = fasilitasById(id);
          return (
            <li key={id}>
              <Icon name={f.icon} size={16} />
              {f.label}
            </li>
          );
        })}
      </ul>

      <div className="kd-actions">
        <a className="btn btn-primary btn-sm" href={k.url || cariIklan(k)} target="_blank" rel="noopener noreferrer" onClick={() => catat('iklan_dibuka', { kec: k.kec, harga: k.harga })}>
          <Icon name="external" size={16} />
          <span>Lihat iklan</span>
        </a>
        <Button size="sm" variant="secondary" icon="file" onClick={onTawar}>
          Kartu Tawar
        </Button>
      </div>
      <div className="kd-foot">
        <label className="check-row">
          <input type="checkbox" checked={dibanding} onChange={onBanding} />
          Bandingkan
        </label>
        <button type="button" className="kd-skor" aria-expanded={skor} onClick={() => setSkor((x) => !x)}>
          <ScoreRing value={k.skor.total} size={32} label="Skor cocok" />
          Skor cocok
          <Icon name="down" size={15} style={{ transform: skor ? 'rotate(180deg)' : undefined }} />
        </button>
      </div>
      {skor && (
        <ul className="skor">
          {[
            ['Harga', k.skor.harga, 40],
            ['Jarak', k.skor.jarak, 25],
            ['Fasilitas', k.skor.fasilitas, 25],
            ['Kelengkapan data', k.skor.keyakinan, 10],
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
          label={`Peta ${ktx.pusat.nama}. Lokasi tiap kos terlihat setelah paket dibuka.`}
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
            Ada {ktx.jumlah} kos yang cocok di Kec. {ktx.pusat.kec}
          </h2>
          <ul className="check-list">
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              5 kos dengan harga wajar, lengkap dengan peta dan tautan iklan
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Bandingkan dua kos pilihanmu
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Kartu Tawar untuk menawar ke pemilik
            </li>
          </ul>
          <Button block icon="lock" onClick={onBuka}>
            Buka paket · {rp(HARGA_MATCH)}
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
  // state.match bisa null (mis. setelah riwayat dibersihkan), jadi diperiksa dulu sebelum dibaca
  const [list, setList] = useState(state.match && state.match.key === ktx?.key ? state.match.list : null);
  const [pilih, setPilih] = useState(null);
  const [bayar, setBayar] = useState(false);
  const [semuaSekitar, setSemuaSekitar] = useState(false);
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
        <PageHead judul="Kos lain" onBack={() => go('/')} />
        <EmptyState icon="search" title="Belum ada pencarian" action={<Button onClick={() => go('/cari')}>Cari kos</Button>}>
          Mulai dari cek harga atau cari kos sesuai kebutuhanmu.
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
  // titik Google Maps di sekitar area ini: lokasinya asli, harganya kisaran kos sejenis sekecamatan
  const sekitar = kosPetaDekat(ktx.pusat, 1.5, 6);
  const bandingIds = state.bandingkan.map((k) => k.id);
  const markers = [
    ...markerTujuan(ktx.tujuan),
    ...(list || []).map((k) => ({ id: k.id, kind: 'price', lat: k.lat, lng: k.lng, label: rpSingkat(k.harga).slice(2), selected: k.id === pilih, title: k.nama })),
    ...sekitar.map((g) => ({ id: g.id, kind: 'est', lat: g.lat, lng: g.lng, label: `≈ ${rpSingkat(g.estimasi).slice(2)}`, selected: g.id === pilih, title: `${g.nama} · perkiraan` })),
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
        median: k.median,
        kisaran: k.kisaran,
        selisih_rp: k.selisih_rp,
        selisih_persen: k.selisih_persen,
        status: k.status,
        persentil: k.persentil,
        n: k.n,
        jenisPembanding: k.jenisPembanding,
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
        sub={list ? `${list.length} kos, harganya sudah dicek` : 'Memuat…'}
        onBack={() => go(ktx.kembali)}
        aksi={<InfoTip label="Tentang skor cocok">Skor 0–100 dari harga (40%), jarak (25%), fasilitas (25%), dan kelengkapan data (10%).</InfoTip>}
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
            <p className="note center">{list ? 'Ketuk harga di peta atau pilih dari daftar.' : 'Memuat kos…'}</p>
          )}
        </div>

        <div className="match-list">
          {!list ? (
            [0, 1, 2].map((i) => <div key={i} className="skeleton" />)
          ) : list.length === 0 ? (
            <EmptyState icon="search" title="Belum ada kos yang cocok">
              Coba naikkan budget atau kurangi fasilitas yang wajib.
            </EmptyState>
          ) : (
            <div className="kos-list">
              {list.map((k) => (
                <button key={k.id} type="button" className={`kos-row ${k.id === pilih ? 'is-on' : ''}`} onClick={() => pilihKos(k.id)}>
                  <span className="kr-t">
                    <span className="kr-tags">
                      <span className="tag">{jenisById(k.jenis).label}</span>
                      <StatusBadge status={k.status} size="sm" />
                      {bandingIds.includes(k.id) && <span className="tag tag-brand">Dibandingkan</span>}
                    </span>
                    <b>{k.nama}</b>
                    <small>
                      {jarak(k.jarak)} · {labelFasilitas(k.fasilitas).slice(0, 3).join(', ') || 'Fasilitas tidak dicantumkan'}
                    </small>
                  </span>
                  <span className="kr-p">
                    <b>{rp(k.harga)}</b>
                    <small>/bulan</small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {sekitar.length > 0 && (
            <section className="sekitar">
              <p className="sec-label">Kos lain di sekitar</p>
              <p className="note">Harganya perkiraan dari kos sejenis di kecamatan ini.</p>
              <div className="kos-list">
                {(semuaSekitar ? sekitar : sekitar.slice(0, 3)).map((g) => (
                  <a key={g.id} className={`kos-row is-est ${g.id === pilih ? 'is-on' : ''}`} href={g.link || '#'} target="_blank" rel="noopener noreferrer" onClick={() => catat('gmaps_dibuka', { kec: g.kec })}>
                    <span className="kr-t">
                      <span className="kr-tags">
                        <span className="tag">Perkiraan</span>
                      </span>
                      <b>{g.nama}</b>
                      <small>
                        {jarak(g.jarak)}
                        {g.rating ? ` · ★ ${g.rating}` : ''}
                      </small>
                    </span>
                    <span className="kr-p">
                      <b>≈ {rpSingkat(g.estimasi)}</b>
                      <small>/bulan</small>
                    </span>
                  </a>
                ))}
              </div>
              {sekitar.length > 3 && (
                <button type="button" className="text-btn center" onClick={() => setSemuaSekitar((v) => !v)}>
                  {semuaSekitar ? 'Tampilkan lebih sedikit' : `Lihat ${sekitar.length - 3} lagi`}
                </button>
              )}
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
          <span>{dipilih.length === 2 ? `${dipilih[0].nama} vs ${dipilih[1].nama}` : `${dipilih[0].nama} dipilih. Pilih 1 lagi.`}</span>
          <Button size="sm" disabled={dipilih.length !== 2} onClick={() => (dipilih.length === 2 ? go('/bandingkan?dari=match') : toast('Pilih 1 kos lagi'))}>
            Bandingkan
          </Button>
        </div>
      )}

    </div>
  );
}
