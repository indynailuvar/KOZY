import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import KozyMap from '../components/KozyMap.jsx';
import { AmountInput, Button, Options, Question, Tiles, Wizard } from '../components/ui.jsx';
import { ProcessSheet } from '../components/Sheets.jsx';
import { WaitlistBox } from '../components/Waitlist.jsx';
import { FASILITAS } from '../data/surabaya.js';
import { cekHarga, isLink, kenaliLokasi, LANGKAH_CEK, saranLokasi } from '../api/kozy.js';
import { rp } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

export const OPSI_JENIS = [
  { id: 'putra', label: 'Putra', sub: 'Khusus laki-laki', icon: 'mars' },
  { id: 'putri', label: 'Putri', sub: 'Khusus perempuan', icon: 'venus' },
  { id: 'campur', label: 'Campur', sub: 'Laki-laki dan perempuan', icon: 'users' },
];

const urlMaps = (teks, k) =>
  isLink(teks) ? (teks.startsWith('http') ? teks : `https://${teks}`) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${k.nama}, ${k.kec}, Surabaya`)}`;

const TOTAL = 4;

export default function CekWizard({ query }) {
  const { state, set, addRiwayat } = useStore();
  const awal = useMemo(() => state.draftCek || (query.ubah && state.cek?.input) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState(1);
  const [lokasiTeks, setLokasiTeks] = useState(awal.lokasiTeks || '');
  const [jenis, setJenis] = useState(awal.jenis || null);
  const [harga, setHarga] = useState(awal.harga || 0);
  const [fasilitas, setFasilitas] = useState(awal.fasilitas || []);
  const [coba, setCoba] = useState(false);
  const [proses, setProses] = useState({ open: false, active: 0, error: null, info: null });
  const alive = useRef(true);

  const mulaiDicatat = useRef(false);
  useEffect(() => {
    alive.current = true;
    if (!mulaiDicatat.current) {
      mulaiDicatat.current = true;
      catat('cek_mulai');
    }
    if (state.draftCek) set({ draftCek: null });
    return () => {
      alive.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lok = useMemo(() => kenaliLokasi(lokasiTeks), [lokasiTeks]);
  // permintaan area yang datanya belum ada = sinyal prioritas scraping berikutnya
  const dicatat = useRef('');
  useEffect(() => {
    const kunci = lok.status === 'belum-data' ? `bd:${lok.kawasan.id}` : lok.status === 'luar' ? `lr:${lok.nama}` : '';
    if (!kunci || dicatat.current === kunci) return;
    dicatat.current = kunci;
    if (lok.status === 'belum-data') catat('area_belum_data', { kawasan: lok.kawasan.nama, kec: lok.kawasan.kec });
    else catat('luar_cakupan', { nama: lok.nama });
  }, [lok.status, lok.kawasan?.id, lok.nama]);
  const saran = useMemo(() => (lok.status === 'ok' ? [] : saranLokasi(lokasiTeks)), [lokasiTeks, lok.status]);

  const galat = {
    1:
      lok.status === 'ok'
        ? null
        : lok.status === 'kosong'
          ? 'Isi lokasi kos dulu.'
          : lok.status === 'luar' || lok.status === 'belum-data'
            ? ' '
            : 'Lokasi belum dikenali. Pilih dari saran atau tempel link Google Maps.',
    2: jenis ? null : 'Pilih salah satu jenis kos.',
    3: harga >= 100_000 ? null : 'Masukkan harga minimal Rp 100.000.',
    4: null,
  };

  const jalankan = async () => {
    const input = { lokasiTeks, kawasanId: lok.kawasan.id, harga, jenis, fasilitas };
    setProses({ open: true, active: 0, error: null, info: null });
    try {
      const hasil = await cekHarga(input, (i, info) => alive.current && setProses((p) => ({ ...p, active: i, info: info || p.info })));
      if (!alive.current) return;
      set({ cek: hasil, tawar: null });
      catat('cek_selesai', {
        kawasan: hasil.kawasan.nama,
        kec: hasil.kawasan.kec,
        status: hasil.status,
        tipe: hasil.input.jenis,
        harga: hasil.harga_ditawarkan,
        selisih: Math.round(hasil.selisih_persen),
        fasilitas: hasil.input.fasilitas.length,
      });
      addRiwayat({ id: hasil.id, jenis: 'cek', dibuat: hasil.dibuat, judul: `${hasil.kawasan.nama} · ${rp(hasil.harga_ditawarkan)}`, status: hasil.status, data: hasil });
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

  const langkah = LANGKAH_CEK.map((l, i) => (i === 1 && proses.info ? `Menemukan ${proses.info.n} kos pembanding di Kec. ${proses.info.kec}` : l));
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
            <Button block iconRight={step < TOTAL ? 'arrowr' : undefined} onClick={lanjut} disabled={step === 1 && (lok.status === 'luar' || lok.status === 'belum-data')}>
              {step < TOTAL ? 'Lanjut' : 'Cek Harga Wajar'}
            </Button>
          </>
        }
      >
        {step === 1 && (
          <>
            <Question judul="Di mana lokasi kosnya?" sub="Tempel link Google Maps, atau ketik nama daerahnya." />
            <label className={`field lg ${err ? 'is-err' : ''}`}>
              <Icon name={isLink(lokasiTeks) ? 'link' : 'search'} size={20} />
              <input
                value={lokasiTeks}
                onChange={(e) => setLokasiTeks(e.target.value)}
                placeholder="Contoh: Keputih"
                aria-label="Lokasi kos"
                autoComplete="off"
                aria-invalid={!!err || undefined}
                aria-describedby={err ? 'wz-err' : undefined}
              />
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
                <KozyMap className="map-xs" label={`Peta lokasi ${lok.kawasan.nama}`} center={[lok.kawasan.lat, lok.kawasan.lng]} zoom={15} interactive={false} fitKey={lok.kawasan.id} markers={[{ kind: 'pin', lat: lok.kawasan.lat, lng: lok.kawasan.lng, label: lok.kawasan.nama }]} />
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
            {lok.status === 'belum-data' && <WaitlistBox nama={`Kec. ${lok.kawasan.kec}`} dikenal belumData />}
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
            <AmountInput id="harga" label="Harga sewa dari pemilik per bulan" prefix="Rp" value={harga} onChange={setHarga} placeholder="0" invalid={!!err} />
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
            <Question judul="Fasilitas apa saja yang ada?" sub="Pilih semua yang tersedia di kamar. Boleh dilewati." />
            <Tiles label="Fasilitas" values={fasilitas} options={FASILITAS} onToggle={(id) => setFasilitas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))} />
          </>
        )}

        {err && (
          <p className="err" id="wz-err" role="alert">
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
