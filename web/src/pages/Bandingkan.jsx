import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { SpeakButton } from '../components/A11y.jsx';
import { Accordion, Button, LineInput, Options, PageHead, Question, StatusBadge, Tiles, Wizard } from '../components/ui.jsx';
import { labelYakin, putuskan } from '../api/ai.js';
import { FASILITAS } from '../data/surabaya.js';
import { angkaDariTeks, jarak, rp, rpSuara } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const OPSI_PRIORITAS = [
  { id: 'seimbang', label: 'Seimbang', sub: 'Harga, jarak, dan fasilitas sama penting', icon: 'sliders' },
  { id: 'hemat', label: 'Paling hemat', sub: 'Harga sewa paling ringan', icon: 'wallet' },
  { id: 'dekat', label: 'Paling dekat', sub: 'Jarak ke tujuan paling pendek', icon: 'pin' },
  { id: 'fasilitas', label: 'Fasilitas lengkap', sub: 'Kamar paling nyaman', icon: 'sofa' },
  { id: 'aman', label: 'Paling aman', sub: 'Lingkungan yang dinilai aman', icon: 'shieldc' },
];

const kosong = () => ({ nama: '', harga: '', jarak: '', fasilitas: [] });
const namaAtau = (k, cadangan) => k.nama.trim() || cadangan;

function keKos(k, cadangan) {
  const km = parseFloat(String(k.jarak).replace(',', '.'));
  return { id: cadangan, nama: namaAtau(k, cadangan), harga: angkaDariTeks(k.harga), jarak: Number.isFinite(km) ? km : null, fasilitas: k.fasilitas, aman: 3 };
}

function IsiKos({ k, huruf, onChange }) {
  const ubah = (patch) => onChange({ ...k, ...patch });
  return (
    <div className="line-stack">
      <LineInput id={`nama-${huruf}`} label="Nama kos" value={k.nama} onChange={(v) => ubah({ nama: v.slice(0, 40) })} placeholder={`Kos ${huruf}`} />
      <LineInput
        id={`harga-${huruf}`}
        label="Harga per bulan"
        prefix="Rp"
        inputMode="numeric"
        value={k.harga ? angkaDariTeks(k.harga).toLocaleString('id-ID') : ''}
        onChange={(v) => ubah({ harga: String(Math.min(20_000_000, angkaDariTeks(v))) })}
        placeholder="0"
      />
      <LineInput
        id={`jarak-${huruf}`}
        label="Jarak ke tujuan"
        hint="(opsional)"
        suffix="km"
        inputMode="decimal"
        value={k.jarak}
        onChange={(v) => ubah({ jarak: v.replace(/[^\d.,]/g, '').slice(0, 4) })}
        placeholder="0"
      />
    </div>
  );
}

function Hasil({ hasil, pasangan, onUlang, onUbah }) {
  const { bukaAI } = useStore();
  const { menang, kalah } = hasil;
  const suara = `Rekomendasi KOZY AI: ${menang.nama}, ${rpSuara(menang.harga)} per bulan. Alasannya: ${hasil.alasan.join('. ')}. ${hasil.alternatif || ''}`;
  const baris = [
    ['Harga', (k) => rp(k.harga)],
    ['Jarak', (k) => (k.jarak != null ? jarak(k.jarak) : '–')],
    ['Fasilitas', (k) => `${k.fasilitas.length} dari ${FASILITAS.length}`],
  ];
  const kolom = [menang, kalah];

  return (
    <div className="page narrow">
      <PageHead judul="Hasil perbandingan" sub={`Prioritas: ${hasil.prioritas}`} onBack={onUbah} aksi={<SpeakButton compact teks={suara} label="Dengarkan hasil" />} />

      <section className="card win-card" aria-live="polite">
        <p className="v-label">KOZY AI menyarankan</p>
        <h2>{menang.nama}</h2>
        <p className="win-sub">
          {rp(menang.harga)}/bulan{menang.jarak != null && ` · ${jarak(menang.jarak)}`}
          {menang.status && <StatusBadge status={menang.status} size="sm" />}
        </p>
        <span className="conf">{labelYakin(hasil.yakin)}</span>
        <ul className="check-list">
          {hasil.alasan.map((a) => (
            <li key={a}>
              <Icon name="check" size={16} strokeWidth={2.6} />
              {a}
            </li>
          ))}
        </ul>
        {hasil.alternatif && <p className="note">{hasil.alternatif}</p>}
      </section>

      <section className="card">
        <table className="cmp-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Aspek</span>
              </th>
              {kolom.map((k, i) => (
                <th key={k.id} scope="col" className={i === 0 ? 'is-win' : ''}>
                  {k.nama}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map(([l, f]) => (
              <tr key={l}>
                <th scope="row">{l}</th>
                {kolom.map((k, i) => (
                  <td key={k.id} className={i === 0 ? 'is-win' : ''}>
                    {f(k)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="stack">
        <Accordion title="Cek juga saat survei" icon="list">
          <ul className="dot-list">
            {hasil.cek.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Accordion>
      </div>

      <div className="btn-col">
        <Button variant="secondary" block icon="sparkles" onClick={() => bukaAI({ teks: `Bandingkan ${pasangan[0].nama} dan ${pasangan[1].nama}`, bandingkan: pasangan })}>
          Tanya lanjut di KOZY AI
        </Button>
        <Button variant="ghost" block onClick={onUlang}>
          Bandingkan kos lain
        </Button>
      </div>
    </div>
  );
}

export default function Bandingkan() {
  const { state, set } = useStore();
  const dariMatch = state.bandingkan.length === 2;
  const [a, setA] = useState(kosong);
  const [b, setB] = useState(kosong);
  const [prioritas, setPrioritas] = useState('seimbang');
  const [step, setStep] = useState(1);
  const [hasil, setHasil] = useState(null);
  const [coba, setCoba] = useState(false);

  const total = dariMatch ? 1 : 5;
  const pasangan = useMemo(() => (dariMatch ? state.bandingkan : [keKos(a, 'Kos A'), keKos(b, 'Kos B')]), [dariMatch, state.bandingkan, a, b]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hasil]);

  const galat = dariMatch
    ? {}
    : {
        1: pasangan[0].harga >= 100_000 ? null : 'Isi harga minimal Rp 100.000.',
        3: pasangan[1].harga >= 100_000 ? null : 'Isi harga minimal Rp 100.000.',
      };

  const lanjut = () => {
    setCoba(true);
    if (galat[step]) return;
    setCoba(false);
    if (step < total) setStep(step + 1);
    else setHasil(putuskan(pasangan[0], pasangan[1], prioritas));
  };
  const kembali = () => {
    setCoba(false);
    if (step > 1) setStep(step - 1);
    else if (dariMatch) go(`/match?dari=${state.cari?.pilih ? 'cari' : 'cek'}`);
    else if (window.history.length > 1) window.history.back();
    else go('/');
  };
  const ulang = () => {
    set({ bandingkan: [] });
    setA(kosong());
    setB(kosong());
    setHasil(null);
    setStep(1);
  };

  if (hasil) return <Hasil hasil={hasil} pasangan={pasangan} onUlang={ulang} onUbah={() => setHasil(null)} />;

  const langkahPrioritas = dariMatch ? 1 : 5;
  const opsi = dariMatch ? OPSI_PRIORITAS : OPSI_PRIORITAS.filter((o) => o.id !== 'aman');
  const err = coba ? galat[step] : null;
  const namaA = namaAtau(a, 'Kos A');
  const namaB = namaAtau(b, 'Kos B');

  return (
    <Wizard
      judul="Bandingkan kos"
      langkah={step}
      total={total}
      onBack={kembali}
      footer={
        <Button block icon={step === langkahPrioritas ? 'sparkles' : undefined} iconRight={step < langkahPrioritas ? 'arrowr' : undefined} onClick={lanjut}>
          {step < langkahPrioritas ? 'Lanjut' : 'Bandingkan sekarang'}
        </Button>
      }
    >
      {!dariMatch && step === 1 && (
        <>
          <Question judul="Kos pertama" sub="Isi nama dan harga sewanya." />
          <IsiKos k={a} huruf="A" onChange={setA} />
        </>
      )}
      {!dariMatch && step === 2 && (
        <>
          <Question judul={`Fasilitas di ${namaA}`} sub="Pilih semua yang tersedia." />
          <Tiles label={`Fasilitas ${namaA}`} values={a.fasilitas} options={FASILITAS} onToggle={(id) => setA((k) => ({ ...k, fasilitas: k.fasilitas.includes(id) ? k.fasilitas.filter((x) => x !== id) : [...k.fasilitas, id] }))} />
        </>
      )}
      {!dariMatch && step === 3 && (
        <>
          <Question judul="Kos kedua" sub="Isi nama dan harga sewanya." />
          <IsiKos k={b} huruf="B" onChange={setB} />
        </>
      )}
      {!dariMatch && step === 4 && (
        <>
          <Question judul={`Fasilitas di ${namaB}`} sub="Pilih semua yang tersedia." />
          <Tiles label={`Fasilitas ${namaB}`} values={b.fasilitas} options={FASILITAS} onToggle={(id) => setB((k) => ({ ...k, fasilitas: k.fasilitas.includes(id) ? k.fasilitas.filter((x) => x !== id) : [...k.fasilitas, id] }))} />
        </>
      )}
      {step === langkahPrioritas && (
        <>
          <Question judul="Apa yang paling penting buatmu?" sub="KOZY AI menimbang kedua kos sesuai pilihan ini." />
          {dariMatch && (
            <div className="vs-card">
              {pasangan.map((k, i) => (
                <div key={k.id}>
                  <span className="vs-letter">{i === 0 ? 'A' : 'B'}</span>
                  <span>
                    <b>{k.nama}</b>
                    <small>
                      {rp(k.harga)} · {jarak(k.jarak)}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          )}
          <Options label="Prioritas" value={prioritas} onChange={setPrioritas} options={opsi} />
        </>
      )}
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
    </Wizard>
  );
}
