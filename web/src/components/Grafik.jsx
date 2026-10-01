// Komponen grafik untuk dashboard internal.
// Mengikuti aturan main "Storytelling with Data" bab 2:
// - judul memuat pesannya, bukan sekadar nama data
// - batang selalu mulai dari nol, nilainya dilabeli langsung (tanpa sumbu berlebih)
// - tidak ada pie, donut, 3D, atau sumbu y kedua
// - satu warna aksen (biru) untuk yang ditonjolkan, abu-abu untuk konteks
// - tiap grafik punya padanan teks agar bisa dibaca pembaca layar
import { rp } from '../lib/format.js';

export function Kartu({ judul, sub, catatan, lebar, children }) {
  return (
    <figure className={`chart ${lebar ? 'is-wide' : ''}`}>
      <figcaption>
        <b>{judul}</b>
        {sub && <span>{sub}</span>}
      </figcaption>
      {children}
      {catatan && <p className="note">{catatan}</p>}
    </figure>
  );
}

export function Angka({ items }) {
  return (
    <div className="metrik">
      {items.map((m) => (
        <div key={m.label}>
          <b>{m.nilai}</b>
          <span>{m.label}</span>
          {m.sub && <small>{m.sub}</small>}
        </div>
      ))}
    </div>
  );
}

// Batang horizontal. Mendukung nilai negatif (garis nol di tengah).
export function BarH({ data, format = (v) => v, label }) {
  const nilai = data.map((d) => d.nilai);
  const maks = Math.max(0, ...nilai);
  const min = Math.min(0, ...nilai);
  const rentang = maks - min || 1;
  const nolPct = (-min / rentang) * 100;
  return (
    <ul className="gbar" role="img" aria-label={`${label}. ${data.map((d) => `${d.label} ${format(d.nilai)}`).join(', ')}.`}>
      {data.map((d) => {
        const w = (Math.abs(d.nilai) / rentang) * 100;
        const left = d.nilai >= 0 ? nolPct : nolPct - w;
        return (
          <li key={d.label}>
            <span className="gbar-l">
              {d.label}
              {d.sub && <small>{d.sub}</small>}
            </span>
            <span className="gbar-t">
              {min < 0 && <i className="gbar-nol" style={{ left: `${nolPct}%` }} />}
              <i className={`gbar-b ${d.sorot ? 'is-on' : ''}`} style={{ left: `${left}%`, width: `${Math.max(w, 0.6)}%` }} />
            </span>
            <b className="gbar-v">{format(d.nilai)}</b>
          </li>
        );
      })}
    </ul>
  );
}

// Histogram (batang vertikal untuk sebaran harga).
export function Histogram({ bins, format, label }) {
  const maks = Math.max(...bins.map((b) => b.jumlah), 1);
  return (
    <div className="ghist" role="img" aria-label={`${label}. ${bins.map((b) => `${format(b.lo)} sampai ${format(b.hi)}: ${b.jumlah} kos`).join(', ')}.`}>
      <div className="ghist-bars">
        {bins.map((b) => (
          <span key={b.lo} className={b.sorot ? 'is-on' : ''} style={{ height: `${Math.max(2, (b.jumlah / maks) * 100)}%` }} title={`${format(b.lo)}–${format(b.hi)}: ${b.jumlah} kos`}>
            <em>{b.jumlah || ''}</em>
          </span>
        ))}
      </div>
      <div className="ghist-ax">
        {bins.map((b, i) => (
          <span key={b.lo}>{i % 2 === 0 ? format(b.lo) : ''}</span>
        ))}
      </div>
    </div>
  );
}

// Batang bertumpuk 100% (komposisi, baseline kiri dan kanan konsisten).
export function Tumpuk100({ baris, seri, label }) {
  return (
    <div className="gstack" role="img" aria-label={`${label}. ${baris.map((b) => `${b.label}: ${seri.map((s) => `${s.label} ${b.nilai[s.id]}%`).join(', ')}`).join('. ')}.`}>
      <ul className="gstack-leg">
        {seri.map((s) => (
          <li key={s.id}>
            <i className={`sw-${s.id}`} />
            {s.label}
          </li>
        ))}
      </ul>
      {baris.map((b) => (
        <div key={b.label} className="gstack-row">
          <span className="gstack-l">{b.label}</span>
          <span className="gstack-t">
            {seri.map((s) => (
              <i key={s.id} className={`sw-${s.id}`} style={{ width: `${b.nilai[s.id]}%` }}>
                {b.nilai[s.id] >= 12 ? `${b.nilai[s.id]}%` : ''}
              </i>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

// Heatmap = tabel dengan saturasi warna. Selalu disertai legenda rendah–tinggi.
export function Heatmap({ kolom, baris, satuan = '%', label }) {
  return (
    <div className="gheat">
      <table>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col">Kecamatan</th>
            {kolom.map((k) => (
              <th key={k.id} scope="col">
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              {kolom.map((k) => {
                const v = b.nilai[k.id] ?? 0;
                return (
                  <td key={k.id} style={{ background: `rgba(37, 99, 235, ${(v / 100) * 0.85})`, color: v > 55 ? '#fff' : 'inherit' }}>
                    {v}
                    {satuan}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="gheat-leg" aria-hidden="true">
        <span>rendah</span>
        <i />
        <span>tinggi</span>
      </p>
    </div>
  );
}

// Scatterplot: hubungan dua hal, plus garis rata-rata sebagai acuan.
export function Sebar({ titik, xMax, yMax, xLabel, yLabel, rata, label }) {
  const W = 620;
  const H = 300;
  const P = { l: 56, r: 14, t: 34, b: 48 };
  const px = (x) => P.l + (x / xMax) * (W - P.l - P.r);
  const py = (y) => H - P.b - (y / yMax) * (H - P.t - P.b);
  return (
    <div className="gscatter">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} className="ax" />
        <line x1={P.l} y1={P.t} x2={P.l} y2={H - P.b} className="ax" />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={P.l - 8} y={py(yMax * f) + 4} textAnchor="end" className="tick">
            {f === 0 ? '0' : `${Math.round((yMax * f) / 100000) / 10} jt`}
          </text>
        ))}
        {Array.from({ length: xMax + 1 }, (_, i) => (
          <text key={i} x={px(i)} y={H - P.b + 18} textAnchor="middle" className="tick">
            {i}
          </text>
        ))}
        <text x={W / 2} y={H - 6} textAnchor="middle" className="tick lbl">
          {xLabel}
        </text>
        <text x="0" y={P.t - 14} className="tick lbl">
          {yLabel}
        </text>
        {titik.map((t, i) => (
          <circle key={i} cx={px(t.x)} cy={py(Math.min(t.y, yMax))} r="4" className="dot" />
        ))}
        {rata && (
          <>
            <polyline points={rata.map((r) => `${px(r.x)},${py(r.y)}`).join(' ')} className="rata" />
            {rata.map((r) => (
              <circle key={r.x} cx={px(r.x)} cy={py(r.y)} r="4.5" className="rata-dot" />
            ))}
          </>
        )}
      </svg>
    </div>
  );
}

// Garis: untuk data berurut waktu (bab 2: garis untuk data kontinu).
export function Garis({ titik, format = (v) => v, label, kosong = 'Belum ada aktivitas' }) {
  const W = 620;
  const H = 220;
  const P = { l: 34, r: 12, t: 16, b: 30 };
  const maks = Math.max(...titik.map((t) => t.nilai), 1);
  const adaIsi = titik.some((t) => t.nilai > 0);
  const px = (i) => P.l + (i / Math.max(1, titik.length - 1)) * (W - P.l - P.r);
  const py = (v) => H - P.b - (v / maks) * (H - P.t - P.b);
  return (
    <div className={`gline ${adaIsi ? '' : 'is-kosong'}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}. ${titik.map((t) => `${t.label}: ${t.nilai}`).join(', ')}.`}>
        {[...new Set([0, Math.round(maks / 2), maks])].map((v) => (
          <g key={v}>
            <line x1={P.l} y1={py(v)} x2={W - P.r} y2={py(v)} className="grid" />
            <text x={P.l - 8} y={py(v) + 4} textAnchor="end" className="tick">
              {v}
            </text>
          </g>
        ))}
        <polyline points={titik.map((t, i) => `${px(i)},${py(t.nilai)}`).join(' ')} className="garis" />
        {titik.map((t, i) => (
          <circle key={t.kunci || t.label} cx={px(i)} cy={py(t.nilai)} r={t.nilai ? 4 : 2.5} className={t.nilai ? 'dot-on' : 'dot-off'} />
        ))}
        {titik.map((t, i) =>
          i % 3 === 0 || i === titik.length - 1 ? (
            <text key={`l${t.kunci || t.label}`} x={px(i)} y={H - 8} textAnchor="middle" className="tick">
              {t.label}
            </text>
          ) : null,
        )}
      </svg>
      {!adaIsi && <p className="g-kosong">{kosong}</p>}
    </div>
  );
}

// Slopegraph: dua titik waktu, menonjolkan arah perubahan tiap kategori.
export function Slope({ baris, kiri, kanan, label, kosong = 'Belum ada aktivitas' }) {
  const W = 420;
  const H = 56 + baris.length * 36;
  const maks = Math.max(...baris.flatMap((b) => [b.a, b.b]), 1);
  const adaIsi = baris.some((b) => b.a || b.b);
  const x1 = 118;
  const x2 = W - 118;
  // kalau semuanya masih nol, baris disebar merata supaya labelnya tidak bertumpuk
  const slot = (i) => 44 + i * ((H - 74) / Math.max(1, baris.length - 1 || 1));
  const dasar = (v, i) => (adaIsi ? H - 30 - (v / maks) * (H - 74) : slot(i));
  // nilai yang sama akan menempati titik yang sama, jadi labelnya diberi jarak
  const renggang = (vals) => {
    const out = vals.slice();
    const grup = {};
    vals.forEach((y, i) => {
      const k = Math.round(y);
      grup[k] = [...(grup[k] || []), i];
    });
    for (const idx of Object.values(grup)) {
      if (idx.length < 2) continue;
      idx.forEach((i, n) => (out[i] = vals[i] + (n - (idx.length - 1) / 2) * 15));
    }
    return out;
  };
  const yKiri = renggang(baris.map((b, i) => dasar(b.a, i)));
  const yKanan = renggang(baris.map((b, i) => dasar(b.b, i)));
  const py = (v, i, kanan) => (kanan ? yKanan[i] : yKiri[i]);
  return (
    <div className={`gslope ${adaIsi ? '' : 'is-kosong'}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}. ${baris.map((b) => `${b.label}: ${b.a} lalu ${b.b}`).join(', ')}.`}>
        <text x={x1} y="12" textAnchor="middle" className="tick lbl">
          {kiri}
        </text>
        <text x={x2} y="12" textAnchor="middle" className="tick lbl">
          {kanan}
        </text>
        {baris.map((b, i) => {
          const naik = b.b >= b.a;
          return (
            <g key={b.label} className={naik ? 'naik' : 'turun'}>
              <line x1={x1} y1={py(b.a, i)} x2={x2} y2={py(b.b, i, true)} className="slope-line" />
              <circle cx={x1} cy={py(b.a, i)} r="4" />
              <circle cx={x2} cy={py(b.b, i, true)} r="4" />
              <text x={x1 - 10} y={py(b.a, i) + 4} textAnchor="end" className="tick">
                {b.label} {b.a}
              </text>
              <text x={x2 + 10} y={py(b.b, i, true) + 4} className="tick">
                {b.b}
              </text>
            </g>
          );
        })}
      </svg>
      {!adaIsi && <p className="g-kosong">{kosong}</p>}
    </div>
  );
}

// Corong: batang horizontal bertingkat, sekaligus menampilkan konversi tiap tahap.
export function Corong({ tahap, label }) {
  const awal = tahap[0]?.nilai || 0;
  return (
    <ul className="gcorong" role="img" aria-label={`${label}. ${tahap.map((t) => `${t.label}: ${t.nilai}`).join(', ')}.`}>
      {tahap.map((t, i) => (
        <li key={t.label}>
          <span className="gbar-l">{t.label}</span>
          <span className="gbar-t">
            <i className={`gbar-b ${i === 0 ? 'is-on' : ''}`} style={{ width: `${awal ? Math.max((t.nilai / awal) * 100, t.nilai ? 1 : 0) : 0}%` }} />
          </span>
          <b className="gbar-v">
            {t.nilai}
            {i > 0 && awal > 0 && <em>{Math.round((t.nilai / awal) * 100)}%</em>}
          </b>
        </li>
      ))}
    </ul>
  );
}

// Tabel ringkas: border minimal, angka rata kanan.
export function Tabel({ kolom, baris, label }) {
  return (
    <div className="gtabel">
      <table>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {kolom.map((k, i) => (
              <th key={k} scope="col" className={i ? 'num' : ''}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b, i) => (
            <tr key={`${b[0]}-${i}`}>
              {b.map((sel, i) => (i === 0 ? <th key={i} scope="row">{sel}</th> : <td key={i} className="num">{sel}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const rpJuta = (v) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : `${Math.round(v / 1000)} rb`);
export const rpPenuh = rp;
