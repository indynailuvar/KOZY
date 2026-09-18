import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { AmountInput, Button, Options, Question, Tiles, Wizard } from '../components/ui.jsx';
import { ProcessSheet } from '../components/Sheets.jsx';
import { WaitlistBox } from '../components/Waitlist.jsx';
import { FASILITAS } from '../data/surabaya.js';
import { cekHarga, isLink, kenaliLokasi, LANGKAH_CEK, saranLokasi, statusTampil } from '../api/kozy.js';
import { rp } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

export const OPSI_JENIS = [
  { id: 'putra', label: 'Putra', sub: 'Khusus laki-laki', icon: 'mars' },
  { id: 'putri', label: 'Putri', sub: 'Khusus perempuan', icon: 'venus' },
  { id: 'campur', label: 'Campur', sub: 'Laki-laki dan perempuan', icon: 'users' },
  { id: 'syariah', label: 'Syariah', sub: 'Mengikuti aturan syariah', icon: 'moon' },
];

const UKURAN_CEPAT = [
  { m2: 9, label: '3 × 3 m' },
  { m2: 12, label: '3 × 4 m' },
  { m2: 16, label: '4 × 4 m' },
];

const urlMaps = (teks, k) =>
  isLink(teks) ? (teks.startsWith('http') ? teks : `https://${teks}`) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${k.nama}, ${k.kec}, Surabaya`)}`;

const TOTAL = 5;

export default function CekWizard({ query }) {
  const { state, set, addRiwayat } = useStore();
  const awal = useMemo(() => state.draftCek || (query.ubah && state.cek?.input) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState(1);
  const [lokasiTeks, setLokasiTeks] = useState(awal.lokasiTeks || '');
  const [jenis, setJenis] = useState(awal.jenis || null);
  const [harga, setHarga] = useState(awal.harga || 0);
  const [fasilitas, setFasilitas] = useState(awal.fasilitas || []);
  const [luas, setLuas] = useState(awal.luas || 0);
  const [coba, setCoba] = useState(false);
  const [proses, setProses] = useState({ open: false, active: 0, error: null, info: null });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (state.draftCek) set({ draftCek: null });
    return () => {
      alive.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lok = useMemo(() => kenaliLokasi(lokasiTeks), [lokasiTeks]);
  const saran = useMemo(() => (lok.status === 'ok' ? [] : saranLokasi(lokasiTeks)), [lokasiTeks, lok.status]);

  const galat = {
    1: lok.status === 'ok' ? null : lok.status === 'kosong' ? 'Isi lokasi kos dulu.' : lok.status === 'luar' ? ' ' : 'Lokasi belum dikenali. Pilih dari saran atau tempel link Google Maps.',
    2: jenis ? null : 'Pilih salah satu jenis kos.',
    3: harga >= 100_000 ? null : 'Masukkan harga minimal Rp 100.000.',
    4: null,
    5: luas && (luas < 4 || luas > 60) ? 'Luas kamar antara 4 dan 60 m².' : null,
  };

  const jalankan = async () => {
    const input = { lokasiTeks, kawasanId: lok.kawasan.id, harga, jenis, fasilitas, luas: luas || null };
    setProses({ open: true, active: 0, error: null, info: null });
    try {
      const hasil = await cekHarga(input, (i, info) => alive.current && setProses((p) => ({ ...p, active: i, info: info || p.info })));
      if (!alive.current) return;
      set({ cek: hasil, tawar: null });
      addRiwayat({ id: hasil.id, jenis: 'cek', dibuat: hasil.dibuat, judul: `${hasil.kawasan.nama} · ${rp(hasil.harga_ditawarkan)}`, status: statusTampil(hasil), data: hasil });
      setProses((p) => ({ ...p, active: 4 }));
      setTimeout(() => go('/hasil'), 250);
    } catch (e) {
      if (alive.current) setProses((p) => ({ ...p, error: e.message }));
    }
  };

  const lanjut = () => {
    setCoba(true);
    if (galat[step]) return;
    setCoba(false);
    if (step < TOTAL) setStep(step + 1);
    else jalankan();
  };
  const kembali = () => {
    setCoba(false);
    if (step > 1) setStep(step - 1);
    else go('/');
  };

  const langkah = LANGKAH_CEK.map((l, i) => (i === 1 && proses.info ? `Menemukan ${proses.info.n} kos pembanding dalam ${proses.info.radius === 800 ? '800 m' : '1,5 km'}` : l));
  const err = coba ? galat[step]?.trim() : null;

  return (
    <>
      <Wizard
        judul="Cek harga kos"
        langkah={step}
        total={TOTAL}
        onBack={kembali}
        footer={
          <>
            <Button block iconRight={step < TOTAL ? 'arrowr' : undefined} onClick={lanjut} disabled={step === 1 && lok.status === 'luar'}>
              {step < TOTAL ? 'Lanjut' : 'Cek Harga Wajar'}
            </Button>
            {step === TOTAL && !luas && (
              <Button variant="ghost" block onClick={jalankan}>
                Lewati & cek sekarang
              </Button>
            )}
          </>
        }
      >
        {step === 1 && (
          <>
            <Question judul="Di mana lokasi kosnya?" sub="Tempel link Google Maps, atau ketik nama daerahnya." />
            <label className={`field lg ${err ? 'is-err' : ''}`}>
              <Icon name={isLink(lokasiTeks) ? 'link' : 'search'} size={20} />
              <input value={lokasiTeks} onChange={(e) => setLokasiTeks(e.target.value)} placeholder="Contoh: Keputih" aria-label="Lokasi kos" autoComplete="off" />
              {lokasiTeks && (
                <button type="button" className="icon-btn sm" aria-label="Hapus" onClick={() => setLokasiTeks('')}>
                  <Icon name="x" size={17} />
                </button>
              )}
            </label>
            {saran.length > 0 && (
              <ul className="pick-rows" aria-label="Saran lokasi">
                {saran.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setLokasiTeks(s.label)}>
                      <Icon name="pin" size={18} />
                      <span>
                        <b>{s.label}</b>
                        <small>{s.sub}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {lok.status === 'ok' && (
              <div className="loc-card">
                <KozyMap className="map-xs" center={[lok.kawasan.lat, lok.kawasan.lng]} zoom={15} interactive={false} fitKey={lok.kawasan.id} markers={[{ kind: 'pin', lat: lok.kawasan.lat, lng: lok.kawasan.lng, label: lok.kawasan.nama }]} />
                <div className="loc-row">
                  <span className="ic-circle sm">
                    <Icon name="checkc" size={16} />
                  </span>
                  <span>
                    <b>{lok.kawasan.nama}</b>
                    <small>Kec. {lok.kawasan.kec}, Surabaya</small>
                  </span>
                  <a href={urlMaps(lokasiTeks, lok.kawasan)} target="_blank" rel="noopener noreferrer" className="link-sm">
                    Maps <Icon name="external" size={13} />
                  </a>
                </div>
              </div>
            )}
            {lok.status === 'luar' && <WaitlistBox nama={lok.nama} dikenal />}
          </>
        )}

        {step === 2 && (
          <>
            <Question judul="Kos ini untuk siapa?" sub="Pilih jenis kosnya." />
            <Options label="Jenis kos" value={jenis} onChange={setJenis} options={OPSI_JENIS} />
          </>
        )}

        {step === 3 && (
          <>
            <Question judul="Berapa harga sewa dari pemilik?" sub="Harga per bulan yang tertulis di iklan atau disebut pemilik." />
            <AmountInput id="harga" label="Harga sewa dari pemilik per bulan" prefix="Rp" value={harga} onChange={setHarga} placeholder="0" />
            <p className="amount-note">per bulan</p>
            <p className="hint-link">
              Baru punya budget, belum ada kos incaran?{' '}
              <a href="#/cari" className="text-btn sm">
                Cari kos sesuai budget
              </a>
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <Question judul="Fasilitas apa saja yang ada?" sub="Pilih semua yang tersedia. Boleh dilewati." />
            <Tiles label="Fasilitas" values={fasilitas} options={FASILITAS} onToggle={(id) => setFasilitas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))} />
          </>
        )}

        {step === 5 && (
          <>
            <Question judul="Berapa luas kamarnya?" sub="Opsional, tapi membuat hasil lebih akurat." />
            <AmountInput id="luas" label="Luas kamar" suffix="m²" value={luas} onChange={setLuas} placeholder="0" max={99} />
            <div className="quick">
              {UKURAN_CEPAT.map((u) => (
                <button key={u.m2} type="button" className={luas === u.m2 ? 'is-on' : ''} onClick={() => setLuas(u.m2)}>
                  {u.label}
                </button>
              ))}
            </div>
          </>
        )}

        {err && (
          <p className="err" role="alert">
            {err}
          </p>
        )}
      </Wizard>

      <ProcessSheet
        open={proses.open}
        title="Menganalisis harga…"
        steps={langkah}
        active={proses.active}
        error={proses.error}
        onRetry={jalankan}
        onEdit={() => setProses({ open: false, active: 0, error: null, info: null })}
      />
    </>
  );
}
