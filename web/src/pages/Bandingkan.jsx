import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { SpeakButton } from '../components/A11y.jsx';
import { Accordion, Button, LineInput, Options, PageHead, Question, StatusBadge, Tiles, Wizard } from '../components/ui.jsx';
import { labelYakin, putuskan } from '../api/ai.js';
import { FASILITAS } from '../data/surabaya.js';
import { labelFasilitas } from '../api/kozy.js';
import { angkaDariTeks, jarak, rp, rpSingkat, rpSuara } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';
import { analyzePriceGap, getModelingSummary } from '../api/modeling.js';

// posisi terhadap Q1–Q3 dari backend, dibaca dengan status yang sama seperti Cek Harga
const STATUS_GAP = { di_bawah_q1: 'MURAH', dalam_iqr: 'WAJAR', di_atas_q3: 'KEMAHALAN' };

const OPSI_PRIORITAS = [
  { id: 'seimbang', label: 'Seimbang', sub: 'Harga, jarak, dan fasilitas sama penting', icon: 'sliders' },
  { id: 'hemat', label: 'Paling hemat', sub: 'Sewa paling murah', icon: 'wallet' },
  { id: 'dekat', label: 'Paling dekat', sub: 'Paling dekat ke tujuan', icon: 'pin' },
  { id: 'fasilitas', label: 'Fasilitas lengkap', sub: 'Kamar paling nyaman', icon: 'sofa' },
];

const kosong = () => ({ nama: '', harga: '', jarak: '', kecamatan: '', jenis: '', fasilitas: [] });
const namaAtau = (k, cadangan) => k.nama.trim() || cadangan;

function keKos(k, cadangan) {
  const km = parseFloat(String(k.jarak).replace(',', '.'));
  return { id: cadangan, nama: namaAtau(k, cadangan), harga: angkaDariTeks(k.harga), jarak: Number.isFinite(km) ? km : null, kec: k.kec || k.kecamatan || null, jenis: k.jenis || null, fasilitas: k.fasilitas };
}

function IsiKos({ k, huruf, onChange, invalid, kategori }) {
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
      <label className="compare-select">
        Kecamatan <span>(opsional)</span>
        <select value={k.kecamatan} onChange={(e) => ubah({ kecamatan: e.target.value })}>
          <option value="">Tidak dipilih</option>
          {kategori.kecamatan.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="compare-select">
        Jenis kos <span>(opsional)</span>
        <select value={k.jenis} onChange={(e) => ubah({ jenis: e.target.value })}>
          <option value="">Tidak dipilih</option>
          {kategori.jenis.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
        </select>
      </label>
    </div>
  );
}

// Hasil perbandingan: satu kartu pemenang dengan alasan berupa chip pendek,
// lalu tabel A lawan B yang menandai nilai lebih baik dengan centang.
function Hasil({ hasil, pasangan, onUlang, onUbah }) {
  const { bukaAI } = useStore();
  const [gapPasar, setGapPasar] = useState({ loading: false, hasil: [] });
  const { menang, kalah } = hasil;
  const suara = `Saran KOZY AI: ${menang.nama}, ${rpSuara(menang.harga)} per bulan. Alasannya: ${hasil.alasan.join('. ')}.`;

  useEffect(() => {
    let aktif = true;
    const permintaan = pasangan.map((kos) =>
      kos.kec && kos.jenis ? analyzePriceGap({ harga: kos.harga, kecamatan: kos.kec, jenis: kos.jenis }).catch(() => null) : Promise.resolve(null),
    );
    if (!pasangan.some((k) => k.kec && k.jenis)) {
      setGapPasar({ loading: false, hasil: [] });
      return () => {
        aktif = false;
      };
    }
    setGapPasar({ loading: true, hasil: [] });
    Promise.all(permintaan).then((data) => aktif && setGapPasar({ loading: false, hasil: data }));
    return () => {
      aktif = false;
    };
  }, [pasangan]);

  // alasan singkat untuk chip
  const chip = [];
  const dh = kalah.harga - menang.harga;
  if (dh > 0) chip.push(`Hemat ${rpSingkat(dh)}/bln`);
  if (menang.jarak != null && kalah.jarak != null && kalah.jarak - menang.jarak >= 0.15) chip.push(`${jarak(kalah.jarak - menang.jarak)} lebih dekat`);
  const lebih = labelFasilitas(menang.fasilitas.filter((f) => !kalah.fasilitas.includes(f)));
  if (lebih.length) chip.push(`Ada ${lebih.slice(0, 2).join(', ')}`);
  if (!chip.length) chip.push('Hampir setara');

  const status = (k, i) => (gapPasar.hasil[i] ? STATUS_GAP[gapPasar.hasil[i].posisi_q1_q3] : k.status || null);
  const baris = [
    { l: 'Harga', isi: (k) => rp(k.harga), unggul: (k, l) => k.harga < l.harga },
    { l: 'Jarak', isi: (k) => (k.jarak != null ? jarak(k.jarak) : '–'), unggul: (k, l) => k.jarak != null && l.jarak != null && k.jarak + 0.15 <= l.jarak },
    { l: 'Fasilitas', isi: (k) => `${k.fasilitas.length} dari ${FASILITAS.length}`, unggul: (k, l) => k.fasilitas.length > l.fasilitas.length },
  ];

  return (
    <div className="page narrow">
      <PageHead judul="Hasil perbandingan" sub={`Prioritas ${hasil.prioritas}`} onBack={onUbah} aksi={<SpeakButton compact teks={suara} label="Dengarkan hasil" />} />

      <section className="card win-card" aria-live="polite">
        <div className="win-top">
          <span className="win-badge">
            <Icon name="award" size={16} />
            Pilihan KOZY AI
          </span>
          <span className="conf">{labelYakin(hasil.yakin)}</span>
        </div>
        <h2>{menang.nama}</h2>
        <p className="win-price">
          {rp(menang.harga)}
          <small>/bulan</small>
        </p>
        <ul className="win-chips" aria-label="Alasan">
          {chip.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <table className="cmp-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Aspek</span>
              </th>
              {pasangan.map((k, i) => (
                <th key={k.id} scope="col" className={k.id === menang.id ? 'is-win' : ''}>
                  <span className="vs-letter">{i === 0 ? 'A' : 'B'}</span>
                  <span className="cmp-n">{k.nama}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((r) => (
              <tr key={r.l}>
                <th scope="row">{r.l}</th>
                {pasangan.map((k, i) => {
                  const ok = r.unggul(k, pasangan[1 - i]);
                  return (
                    <td key={k.id} className={ok ? 'is-ok' : ''}>
                      {r.isi(k)}
                      {ok && (
                        <>
                          <Icon name="check" size={14} strokeWidth={3} className="cmp-ok" />
                          <span className="sr-only"> (lebih baik)</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {(gapPasar.loading || pasangan.some((k, i) => status(k, i))) && (
              <tr>
                <th scope="row">Harga pasar</th>
                {pasangan.map((k, i) => (
                  <td key={k.id}>{gapPasar.loading ? '…' : status(k, i) ? <StatusBadge status={status(k, i)} size="sm" /> : '–'}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Accordion title="Cek saat datang ke kos" icon="list">
        <ul className="dot-list">
          {hasil.cek.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Accordion>

      <div className="btn-col">
        <Button variant="secondary" block icon="sparkles" onClick={() => bukaAI({ teks: `Bandingkan ${pasangan[0].nama} dan ${pasangan[1].nama}`, bandingkan: pasangan })}>
          Tanya KOZY AI
        </Button>
        <Button variant="ghost" block onClick={onUlang}>
          Bandingkan kos lain
        </Button>
      </div>
    </div>
  );
}

export default function Bandingkan({ query = {} }) {
  const { state, set } = useStore();
  // Dua kos dari daftar alternatif hanya dipakai kalau memang datang dari sana.
  // Dari beranda selalu mulai baru: isi sendiri dua kos yang mau dibandingkan.
  const dariMatch = query.dari === 'match' && state.bandingkan.length === 2;
  const [a, setA] = useState(kosong);
  const [b, setB] = useState(kosong);
  const [prioritas, setPrioritas] = useState('seimbang');
  const [step, setStep] = useState(1);
  const [hasil, setHasil] = useState(null);
  const [coba, setCoba] = useState(false);
  const [kategori, setKategori] = useState({ kecamatan: [], jenis: [] });

  useEffect(() => {
    let aktif = true;
    getModelingSummary().then((data) => aktif && setKategori(data.segmentasi.kategori)).catch(() => {});
    return () => {
      aktif = false;
    };
  }, []);

  const total = dariMatch ? 1 : 5;
  const pasangan = useMemo(() => (dariMatch ? state.bandingkan : [keKos(a, 'Kos A'), keKos(b, 'Kos B')]), [dariMatch, state.bandingkan, a, b]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hasil]);

  const galat = dariMatch
    ? {}
    : {
        1: pasangan[0].harga >= 100_000 ? null : 'Isi harga minimal Rp100.000.',
        3: pasangan[1].harga >= 100_000 ? null : 'Isi harga minimal Rp100.000.',
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
  const opsi = OPSI_PRIORITAS;
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
          {step < langkahPrioritas ? 'Lanjut' : 'Bandingkan'}
        </Button>
      }
    >
      {!dariMatch && step === 1 && (
        <>
          <Question judul="Kos pertama" />
          <IsiKos k={a} huruf="A" onChange={setA} invalid={!!err} kategori={kategori} />
          <p className="hint-link">
            Belum punya pilihan?{' '}
            <a href="#/cari" className="text-btn sm">
              Cari kos dulu
            </a>
          </p>
        </>
      )}
      {!dariMatch && step === 2 && (
        <>
          <Question judul={`Fasilitas di ${namaA}`} />
          <Tiles label={`Fasilitas ${namaA}`} values={a.fasilitas} options={FASILITAS} onToggle={(id) => setA((k) => ({ ...k, fasilitas: k.fasilitas.includes(id) ? k.fasilitas.filter((x) => x !== id) : [...k.fasilitas, id] }))} />
        </>
      )}
      {!dariMatch && step === 3 && (
        <>
          <Question judul="Kos kedua" />
          <IsiKos k={b} huruf="B" onChange={setB} invalid={!!err} kategori={kategori} />
        </>
      )}
      {!dariMatch && step === 4 && (
        <>
          <Question judul={`Fasilitas di ${namaB}`} />
          <Tiles label={`Fasilitas ${namaB}`} values={b.fasilitas} options={FASILITAS} onToggle={(id) => setB((k) => ({ ...k, fasilitas: k.fasilitas.includes(id) ? k.fasilitas.filter((x) => x !== id) : [...k.fasilitas, id] }))} />
        </>
      )}
      {step === langkahPrioritas && (
        <>
          <Question judul="Mana yang paling penting?" />
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
          <Options label="Prioritas" kolom={2} value={prioritas} onChange={setPrioritas} options={opsi} />
        </>
      )}
      {err && (
        <p className="err" id="wz-err" role="alert">
          {err}
        </p>
      )}
    </Wizard>
  );
}
