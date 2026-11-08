import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import RangeSlider from '../components/RangeSlider.jsx';
import { Button, LineInput, Options, Question, Switch, Tiles, Wizard } from '../components/ui.jsx';
import { ProcessSheet } from '../components/Sheets.jsx';
import { OPSI_JENIS } from './CekWizard.jsx';
import { BUDGET_RANGE, FASILITAS, KEBUTUHAN, PERSONA } from '../data/surabaya.js';
import { analisisPasar, LANGKAH_CARI, personaById, saranTujuan, tujuanById } from '../api/kozy.js';
import { angkaDariTeks, rp, rpSingkat } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const OPSI_PERSONA = PERSONA.map((p) => ({
  ...p,
  sub: { mahasiswa: 'Dekat kampus', pekerja: 'Dekat kantor dan angkutan umum', nakes: 'Dekat rumah sakit', guru: 'Dekat sekolah', lainnya: 'Pilih sendiri tempat tujuannya' }[p.id],
}));
const OPSI_JENIS_CARI = [{ id: 'semua', label: 'Semua jenis', sub: 'Putra, putri, dan campur', icon: 'home' }, ...OPSI_JENIS];
const BUDGET_CEPAT = [
  { label: '< 700 rb', v: [300_000, 700_000] },
  { label: '700 rb – 1 jt', v: [700_000, 1_000_000] },
  { label: '1 – 1,5 jt', v: [1_000_000, 1_500_000] },
  { label: '> 1,5 jt', v: [1_500_000, 3_000_000] },
];
const TOTAL = 6;

export default function CariWizard() {
  const { state, set, addRiwayat } = useStore();
  const awal = useMemo(() => state.draftCari || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState(1);
  const [persona, setPersona] = useState(awal.persona || null);
  const [dekat, setDekat] = useState(awal.dekat || []);
  const [dekatDiubah, setDekatDiubah] = useState(!!awal.dekat?.length);
  const [tujuanId, setTujuanId] = useState(awal.tujuanId || null);
  const [cariTeks, setCariTeks] = useState('');
  const [budget, setBudget] = useState([awal.budgetMin ?? 500_000, awal.budgetMax ?? 1_200_000]);
  const [jenis, setJenis] = useState(awal.jenis === undefined ? null : awal.jenis || 'semua');
  const [fasilitas, setFasilitas] = useState(awal.fasilitas || []);
  const [disabilitas, setDisabilitas] = useState(!!awal.disabilitas);
  const [coba, setCoba] = useState(false);
  const [proses, setProses] = useState({ open: false, active: 0 });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (state.draftCari) set({ draftCari: null });
    return () => {
      alive.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saran = useMemo(() => saranTujuan(cariTeks, dekat), [cariTeks, dekat]);
  const tujuan = tujuanById(tujuanId);

  const galat = {
    1: persona ? null : 'Pilih salah satu.',
    2: null,
    3: tujuanId ? null : 'Pilih tujuan dari daftar.',
    4:
      budget[1] < BUDGET_RANGE.min
        ? `Budget paling sedikit ${rp(BUDGET_RANGE.min)}.`
        : budget[0] >= budget[1]
          ? 'Batas atas harus lebih besar dari batas bawah.'
          : null,
    5: jenis ? null : 'Pilih jenis kos.',
    6: null,
  };

  const jalankan = async () => {
    const input = { persona, dekat, tujuanId, budgetMin: budget[0], budgetMax: budget[1], jenis: jenis === 'semua' ? null : jenis, fasilitas, disabilitas };
    set({ draftCari: null });
    setProses({ open: true, active: 0 });
    const hasil = await analisisPasar(input, (i) => alive.current && setProses({ open: true, active: i }));
    if (!alive.current) return;
    set({ cari: { ...hasil, pilih: null }, match: null });
    catat('cari_selesai', { persona, tujuan: tujuan.singkat, budget: budget[1], tipe: input.jenis || 'semua', fasilitas: fasilitas.length, disabilitas });
    addRiwayat({ id: hasil.id, jenis: 'cari', dibuat: hasil.dibuat, judul: `Dekat ${tujuan.singkat} · maks. ${rpSingkat(budget[1])}`, data: { ...hasil, pilih: null } });
    setProses({ open: true, active: 4 });
    setTimeout(() => go('/kawasan'), 250);
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

  const err = coba ? galat[step] : null;

  return (
    <>
      <Wizard
        judul="Cari kos"
        langkah={step}
        total={TOTAL}
        onBack={kembali}
        footer={
          <Button block iconRight={step < TOTAL ? 'arrowr' : undefined} onClick={lanjut}>
            {step < TOTAL ? 'Lanjut' : 'Lihat rekomendasi'}
          </Button>
        }
      >
        {step === 1 && (
          <>
            <Question judul="Kamu cari kos sebagai?" />
            <Options
              label="Mencari kos untuk"
              kolom={2}
              value={persona}
              options={OPSI_PERSONA}
              onChange={(id) => {
                setPersona(id);
                if (!dekatDiubah) setDekat(personaById(id).dekat);
              }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Question judul="Mau dekat dengan apa?" sub="Boleh pilih lebih dari satu." />
            <Tiles
              label="Dekat dengan"
              values={dekat}
              options={KEBUTUHAN}
              onToggle={(id) => {
                setDekatDiubah(true);
                setDekat((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
              }}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Question judul="Tujuan harianmu di mana?" />
            <label className={`field lg ${err ? 'is-err' : ''}`}>
              <Icon name="search" size={20} />
              <input value={cariTeks} onChange={(e) => setCariTeks(e.target.value)} placeholder="Contoh: ITS atau RSUD Dr. Soetomo" aria-label="Cari lokasi tujuan" autoComplete="off" data-noauto="" />
            </label>
            {tujuan && !cariTeks && (
              <p className="picked">
                <Icon name="checkc" size={16} /> Dipilih: <b>{tujuan.nama}</b>
              </p>
            )}
            <p className="sec-label">{cariTeks ? 'Hasil pencarian' : 'Saran tujuan'}</p>
            <ul className="pick-rows" role="radiogroup" aria-label="Lokasi tujuan">
              {saran.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={tujuanId === s.id}
                    className={tujuanId === s.id ? 'is-on' : ''}
                    onClick={() => {
                      setTujuanId(s.id);
                      setCariTeks('');
                    }}
                  >
                    <Icon name={s.icon} size={18} />
                    <span>
                      <b>{s.label}</b>
                      <small>{s.sub}</small>
                    </span>
                    {tujuanId === s.id && <Icon name="checkc" size={18} className="pick-ok" />}
                  </button>
                </li>
              ))}
              {saran.length === 0 && <li className="muted small">Tidak ketemu. Coba kata lain.</li>}
            </ul>
          </>
        )}

        {step === 4 && (
          <>
            <Question judul="Budget per bulan berapa?" />
            <p className="budget-show" aria-live="polite">
              <b>{rp(budget[0])}</b>
              <span>–</span>
              <b>{rp(budget[1])}</b>
            </p>
            <RangeSlider min={BUDGET_RANGE.min} max={BUDGET_RANGE.max} step={BUDGET_RANGE.step} value={budget} onChange={setBudget} format={rp} label="Budget" />
            <div className="budget-inputs">
              <LineInput
                id="budget-min"
                label="Dari"
                prefix="Rp"
                inputMode="numeric"
                value={budget[0] ? budget[0].toLocaleString('id-ID') : ''}
                onChange={(v) => setBudget([Math.min(BUDGET_RANGE.max, angkaDariTeks(v)), budget[1]])}
                placeholder="0"
                invalid={!!err}
                noAuto
              />
              <LineInput
                id="budget-max"
                label="Sampai"
                prefix="Rp"
                inputMode="numeric"
                value={budget[1] ? budget[1].toLocaleString('id-ID') : ''}
                onChange={(v) => setBudget([budget[0], Math.min(BUDGET_RANGE.max, angkaDariTeks(v))])}
                placeholder="0"
                invalid={!!err}
                noAuto
              />
            </div>
            <div className="quick">
              {BUDGET_CEPAT.map((b) => (
                <button key={b.label} type="button" className={budget[0] === b.v[0] && budget[1] === b.v[1] ? 'is-on' : ''} onClick={() => setBudget(b.v)}>
                  {b.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <Question judul="Cari kos jenis apa?" />
            <Options label="Jenis kos" kolom={2} value={jenis} onChange={setJenis} options={OPSI_JENIS_CARI} />
          </>
        )}

        {step === 6 && (
          <>
            <Question judul="Fasilitas yang wajib ada?" sub="Boleh dilewati." />
            <Tiles label="Fasilitas" values={fasilitas} options={FASILITAS} onToggle={(id) => setFasilitas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))} />
            <div className="access-card">
              <span className="ic-circle">
                <Icon name="access" size={20} />
              </span>
              <Switch
                checked={disabilitas}
                onChange={setDisabilitas}
                label="Butuh kos ramah kursi roda"
                sub="Iklan kos belum mencantumkan akses ini. Tanyakan langsung ke pemilik sebelum sewa."
              />
            </div>
          </>
        )}

        {err && (
          <p className="err" id="wz-err" role="alert">
            {err}
          </p>
        )}
      </Wizard>

      <ProcessSheet open={proses.open} title="Mencari area yang cocok…" steps={LANGKAH_CARI} active={proses.active} />
    </>
  );
}
