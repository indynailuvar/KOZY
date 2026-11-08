// Kartu harga utama.
//
// Jawabannya harus terbaca dalam satu lirikan, tanpa kalimat: indikator
// setengah lingkaran seperti skor kredit di aplikasi dompet digital. Zona
// murah, wajar, mahal; titik menunjuk harga kos yang dicek; di tengahnya
// satu kata status. Di bawahnya dua angka berlabel jelas: harga pasaran
// dan selisihnya.
import { Banner } from './ui.jsx';
import { rp, rpSingkat } from '../lib/format.js';

const KATA = { WAJAR: 'Wajar', MURAH: 'Murah', KEMAHALAN: 'Kemahalan' };
const NADA = { WAJAR: 't-green', MURAH: 't-blue', KEMAHALAN: 't-red' };
const ZONA = { MURAH: 'murah', WAJAR: 'wajar', KEMAHALAN: 'mahal' };

// geometri busur (satuan viewBox)
const CX = 120;
const CY = 126;
const R = 100;
const titik = (a, r = R) => [CX + r * Math.cos(a), CY - r * Math.sin(a)];
function busur(a1, a2) {
  if (a1 <= a2) return null;
  const [x1, y1] = titik(a1);
  const [x2, y2] = titik(a2);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function GaugeHarga({ q1, q3, harga, status, labelHarga = 'Kos ini' }) {
  const iqr = Math.max(q3 - q1, q3 * 0.1);
  let lo = Math.min(q1 - iqr * 0.9, harga);
  let hi = Math.max(q3 + iqr * 0.9, harga);
  const pad = (hi - lo) * 0.04;
  lo -= pad;
  hi += pad;
  const sudut = (v) => Math.PI * (1 - Math.max(0, Math.min(1, (v - lo) / (hi - lo))));
  const a1 = sudut(q1);
  const a3 = sudut(q3);
  const ah = sudut(harga);
  const celah = 0.022;
  const [mx, my] = titik(ah);
  const posLabel = (a) => {
    const [x, y] = titik(a, R + 22);
    return { left: `${(x / 240) * 100}%`, top: `${(y / 140) * 100}%` };
  };
  const aktif = ZONA[status];
  const zona = [
    ['murah', busur(Math.PI, a1 + celah)],
    ['wajar', busur(a1 - celah, a3 + celah)],
    ['mahal', busur(a3 - celah, 0)],
  ];
  return (
    <div className="gauge">
      <svg viewBox="0 0 240 140" aria-hidden="true" focusable="false">
        {zona.map(([z, d]) => d && <path key={z} d={d} className={`g-z g-${z} ${z === aktif ? 'is-on' : ''}`} />)}
        <circle cx={mx} cy={my} r="11" className={`g-titik g-t-${aktif}`} />
      </svg>
      <span className="g-lab" style={posLabel(a1)} aria-hidden="true">
        {rpSingkat(q1)}
      </span>
      <span className="g-lab" style={posLabel(a3)} aria-hidden="true">
        {rpSingkat(q3)}
      </span>
      <span className="g-ujung g-kiri" aria-hidden="true">
        Murah
      </span>
      <span className="g-ujung g-kanan" aria-hidden="true">
        Mahal
      </span>
      <div className="g-tengah">
        <b className={NADA[status]}>{KATA[status]}</b>
        <span>
          {labelHarga} <b>{rp(harga)}</b>
        </span>
      </div>
    </div>
  );
}

// selisih = { label, nilai, nada } untuk kotak angka kedua
export default function HeroHarga({ status, nilai, harga, rentang, labelHarga, selisih, tanda = [], ringkas, label, teks, satuan = '/bulan', children }) {
  // Varian sederhana (mis. rekomendasi area): label + satu angka besar
  if (harga == null || !rentang || !status)
    return (
      <section className="hero hero-polos" aria-label={ringkas}>
        <p className="hero-label">{label}</p>
        <p className="hero-price">
          {teks ?? rp(nilai)}
          {satuan && <small>{satuan}</small>}
        </p>
        {children}
      </section>
    );

  return (
    <section className={`hero hero-${status.toLowerCase()}`} aria-label={ringkas}>
      <GaugeHarga q1={rentang[0]} q3={rentang[1]} harga={harga} status={status} labelHarga={labelHarga} />
      <dl className="hero-stats">
        <div>
          <dt>Harga pasaran</dt>
          <dd>{rp(nilai)}</dd>
        </div>
        {selisih && (
          <div>
            <dt>{selisih.label}</dt>
            <dd className={selisih.nada || ''}>{selisih.nilai}</dd>
          </div>
        )}
      </dl>
      {tanda.map((t) => (
        <Banner key={t} tone="warn" icon="alert">
          {t}
        </Banner>
      ))}
      {children}
    </section>
  );
}
