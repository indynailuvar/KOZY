import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { SpeakButton } from '../components/A11y.jsx';
import { Accordion, AmountInput, ListRow } from '../components/ui.jsx';
import { TIPS } from '../data/konten.js';
import { bulat10rb, bulat50rb, rp } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const POS = [
  { id: 'kos', label: 'Kos, listrik & air', pct: 30 },
  { id: 'makan', label: 'Makan & kebutuhan harian', pct: 40 },
  { id: 'lain', label: 'Transportasi & pulsa', pct: 15 },
  { id: 'tabung', label: 'Tabungan & dana darurat', pct: 15 },
];

function Kalkulator() {
  const { set } = useStore();
  const [uang, setUang] = useState(0);
  const ideal = bulat10rb(uang * 0.3);
  return (
    <section className="card calc" aria-labelledby="calc-h">
      <h2 id="calc-h" className="card-t">
        Hitung budget kos idealmu
      </h2>
      <p className="card-s">Masukkan penghasilan atau uang saku per bulan.</p>
      <AmountInput id="uang" label="Penghasilan per bulan" prefix="Rp" value={uang} onChange={setUang} placeholder="0" />
      {uang >= 100_000 ? (
        <>
          <div className="calc-res">
            <span>Budget kos maksimal</span>
            <b>
              {rp(ideal)}
              <small>/bulan</small>
            </b>
          </div>
          <div className="calc-bar" aria-hidden="true">
            {POS.map((p) => (
              <i key={p.id} className={`cb-${p.id}`} style={{ flexBasis: `${p.pct}%` }} />
            ))}
          </div>
          <ul className="calc-list">
            {POS.map((p) => (
              <li key={p.id}>
                <i className={`cb-${p.id}`} />
                <span>{p.label}</span>
                <b>{rp(Math.round((uang * p.pct) / 100 / 1000) * 1000)}</b>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              set({ draftCari: { budgetMin: 300_000, budgetMax: Math.min(3_000_000, Math.max(400_000, bulat50rb(ideal))) } });
              go('/cari');
            }}
          >
            Cari kos sesuai budget ini <Icon name="arrowr" size={15} />
          </button>
        </>
      ) : (
        <p className="note">Aturan 30%: biaya kos sebaiknya tidak lebih dari 30% pemasukan.</p>
      )}
    </section>
  );
}

export default function Edukasi() {
  const { bukaAI } = useStore();
  return (
    <div className="page edu">
      <header className="intro">
        <h1>Edukasi keuangan</h1>
        <p>Tips singkat untuk anak kos, dari tanggal tua sampai dana darurat.</p>
      </header>

      <div className="edu-grid">
        <div className="edu-main">
          <p className="sec-label">Tips pilihan</p>
          <div className="stack">
            {TIPS.map((t, i) => (
              <Accordion key={t.id} title={t.judul} icon={t.icon} defaultOpen={i === 0}>
                <p className="acc-lead">{t.ringkas}</p>
                <ol className="num-list">
                  {t.poin.map((p, n) => (
                    <li key={p}>
                      <span>{n + 1}</span>
                      {p}
                    </li>
                  ))}
                </ol>
                <div className="acc-act">
                  <SpeakButton teks={`${t.judul}. ${t.poin.join(' ')}`} label="Dengarkan" />
                  <button type="button" className="text-btn" onClick={() => bukaAI({ teks: t.judul })}>
                    Tanya KOZY AI <Icon name="arrowr" size={15} />
                  </button>
                </div>
              </Accordion>
            ))}
          </div>
        </div>

        <aside className="edu-side">
          <Kalkulator />
          <div className="list-card">
            <ListRow icon="sofa" title="Punya uang hemat dari kos?" sub="Minta ide upgrade kamar ke KOZY AI" onClick={() => bukaAI({ teks: 'Ide upgrade kamar dari uang hemat' })} />
          </div>
        </aside>
      </div>
    </div>
  );
}
