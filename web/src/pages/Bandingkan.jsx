import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { SpeakButton } from '../components/A11y.jsx';
import { Accordion, Button, LineInput, Options, PageHead, Question, Tiles, Wizard } from '../components/ui.jsx';
import { Paywall, aksesEksklusif } from '../components/Sheets.jsx';
import { KartuAB, KunciEksklusif } from '../components/Eksklusif.jsx';
import { CEK_SEBELUM_BAYAR } from '../api/ai.js';
import { PRIORITAS_GAP, gapAB } from '../api/premium.js';
import { FASILITAS } from '../data/surabaya.js';
import { angkaDariTeks, jarak, rp, rpSuara } from '../lib/format.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const API = import.meta.env.VITE_API_URL;
const kosong = () => ({ nama: '', harga: '', jarak: '', fasilitas: [] });
const namaAtau = (k, cadangan) => k.nama.trim() || cadangan;

function keKos(k, cadangan) {
  const km = parseFloat(String(k.jarak).replace(',', '.'));
  return { id: cadangan, nama: namaAtau(k, cadangan), harga: angkaDariTeks(k.harga), jarak: Number.isFinite(km) ? km : null, fasilitas: k.fasilitas };
}

// Gap A vs B: lewat FastAPI kalau tersedia, selain itu dihitung di peramban dengan logika yang sama.
async function hitungGap(a, b, prioritas) {
  if (API) {
    try {
      const pilih = (k) => ({ nama: k.nama, harga: k.harga, jarak: k.jarak, kec: k.kec || null, jenis: k.jenis || null });
      const res = await fetch(`${API}/gap-ab`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: pilih(a), b: pilih(b), prioritas }) });
      if (res.ok) {
        const h = await res.json();
        return { ...h, a: { ...a, ...h.a }, b: { ...b, ...h.b } };
      }
    } catch {
      /* server mati: hitung di peramban */
    }
  }
  return gapAB(a, b, prioritas);
}

function IsiKos({ k, huruf, onChange, invalid }) {
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
        invalid={invalid}
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

function Hasil({ pasangan, prioritas, onUlang, onUbah }) {
  const { state, bukaAI } = useStore();
  const [bayar, setBayar] = useState(false);
  const [hasil, setHasil] = useState(null);
  const akses = aksesEksklusif(state);
  const [a, b] = pasangan;

  useEffect(() => {
    if (!akses) return;
    let hidup = true;
    hitungGap(a, b, prioritas).then((h) => hidup && setHasil(h));
    return () => {
      hidup = false;
    };
  }, [akses, a, b, prioritas]);

  const menang = hasil && (hasil.topsis.menang === 'a' ? hasil.a : hasil.b);
  const suara = menang
    ? `Rekomendasi KOZY untuk prioritas ${PRIORITAS_GAP.find((p) => p.id === prioritas).label}: ${menang.nama}, ${rpSuara(menang.harga)} per bulan, kelas ${menang.kelas.label}.`
    : `${a.nama} ${rpSuara(a.harga)} per bulan. ${b.nama} ${rpSuara(b.harga)} per bulan.`;

  return (
    <div className="page narrow">
      <PageHead judul="Hasil perbandingan" sub={`Prioritas: ${PRIORITAS_GAP.find((p) => p.id === prioritas).label.toLowerCase()}`} onBack={onUbah} aksi={<SpeakButton compact teks={suara} label="Dengarkan hasil" />} />

      {akses ? (
        hasil ? (
          <KartuAB hasil={hasil} />
        ) : (
          <p className="note">Menghitung gap…</p>
        )
      ) : (
        <>
          <section className="card">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Aspek</span>
                  </th>
                  {pasangan.map((k) => (
                    <th key={k.id} scope="col">
                      {k.nama}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Harga</th>
                  {pasangan.map((k) => (
                    <td key={k.id}>{rp(k.harga)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Jarak</th>
                  {pasangan.map((k) => (
                    <td key={k.id}>{k.jarak != null ? jarak(k.jarak) : '–'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
          <KunciEksklusif
            judul="Mana yang lebih masuk akal?"
            sub="Paket eksklusif membandingkan kedua kos secara apple to apple:"
            poin={['Gap harga dan jarak dalam satuan sebaran pasar', 'Kelas harga tiap kos (murah, menengah, mahal) dan posisinya di kelas', 'Rekomendasi TOPSIS sesuai prioritasmu']}
            onBuka={() => {
              catat('eksklusif_dikunci', { fitur: 'gap_ab' });
              setBayar(true);
            }}
          />
        </>
      )}

      <div className="stack">
        <Accordion title="Cek sendiri saat lihat kosnya" icon="list">
          <ul className="dot-list">
            {CEK_SEBELUM_BAYAR.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Accordion>
      </div>

      <div className="btn-col">
        <Button variant="secondary" block icon="sparkles" onClick={() => bukaAI({ teks: `Bandingkan ${a.nama} dan ${b.nama}`, bandingkan: pasangan })}>
          Tanya lanjut di KOZY AI
        </Button>
        <Button variant="ghost" block onClick={onUlang}>
          Bandingkan kos lain
        </Button>
      </div>

      <Paywall open={bayar} fitur="gap_ab" onClose={() => setBayar(false)} onPaid={() => setBayar(false)} />
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
  const [selesai, setSelesai] = useState(false);
  const [coba, setCoba] = useState(false);

  const total = dariMatch ? 1 : 5;
  const pasangan = useMemo(() => (dariMatch ? state.bandingkan : [keKos(a, 'Kos A'), keKos(b, 'Kos B')]), [dariMatch, state.bandingkan, a, b]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selesai]);

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
    else setSelesai(true);
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
    setSelesai(false);
    setStep(1);
  };

  if (selesai) return <Hasil pasangan={pasangan} prioritas={prioritas} onUlang={ulang} onUbah={() => setSelesai(false)} />;

  const langkahPrioritas = dariMatch ? 1 : 5;
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
          <Question judul="Kos pertama" sub="Isi nama, harga sewa, dan jaraknya ke tujuanmu." />
          <IsiKos k={a} huruf="A" onChange={setA} invalid={!!err} />
        </>
      )}
      {!dariMatch && step === 2 && (
        <>
          <Question judul={`Fasilitas di ${namaA}`} sub="Hanya untuk catatanmu — fasilitas tidak ikut dihitung." />
          <Tiles label={`Fasilitas ${namaA}`} values={a.fasilitas} options={FASILITAS} onToggle={(id) => setA((k) => ({ ...k, fasilitas: k.fasilitas.includes(id) ? k.fasilitas.filter((x) => x !== id) : [...k.fasilitas, id] }))} />
        </>
      )}
      {!dariMatch && step === 3 && (
        <>
          <Question judul="Kos kedua" sub="Isi nama, harga sewa, dan jaraknya ke tujuanmu." />
          <IsiKos k={b} huruf="B" onChange={setB} invalid={!!err} />
        </>
      )}
      {!dariMatch && step === 4 && (
        <>
          <Question judul={`Fasilitas di ${namaB}`} sub="Hanya untuk catatanmu — fasilitas tidak ikut dihitung." />
          <Tiles label={`Fasilitas ${namaB}`} values={b.fasilitas} options={FASILITAS} onToggle={(id) => setB((k) => ({ ...k, fasilitas: k.fasilitas.includes(id) ? k.fasilitas.filter((x) => x !== id) : [...k.fasilitas, id] }))} />
        </>
      )}
      {step === langkahPrioritas && (
        <>
          <Question judul="Apa yang paling penting buatmu?" sub="KOZY menimbang harga dan jarak kedua kos sesuai pilihan ini." />
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
          <Options label="Prioritas" value={prioritas} onChange={setPrioritas} options={PRIORITAS_GAP} />
        </>
      )}
      {err && (
        <p className="err" id="wz-err" role="alert">
          {err}
        </p>
      )}
      {!err && step === langkahPrioritas && !aksesEksklusif(state) && (
        <p className="note">
          <Icon name="lock" size={14} /> Analisis gap dan rekomendasi termasuk paket eksklusif.
        </p>
      )}
    </Wizard>
  );
}
