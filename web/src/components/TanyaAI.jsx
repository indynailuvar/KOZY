// Ajakan bertanya ke KOZY AI, dipasang di bagian bawah halaman-halaman hasil.
//
// Masalah sebelumnya bukan cuma tombolnya susah dicari, tapi orang tidak tahu
// KOZY AI itu bisa ditanya apa. Karena itu kartu ini tidak berbunyi "Tanya AI"
// saja, melainkan langsung menyodorkan beberapa pertanyaan nyata sesuai isi
// halaman yang sedang dibuka. Sekali diketuk, pertanyaannya langsung terkirim.
//
// Letaknya sengaja sama di semua halaman supaya cepat dikenali.
import Icon from './Icon.jsx';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';

export default function TanyaAI({ judul = 'Masih bingung?', sub = 'Tanya KOZY AI. Jawabannya memakai data kos yang sama dengan halaman ini.', saran = [], konteks = null, dari = '' }) {
  const { bukaAI } = useStore();
  if (!saran.length) return null;
  return (
    <section className="tanya-ai" aria-labelledby="ta-judul">
      <span className="ta-ava" aria-hidden="true">
        <Icon name="sparkles" size={18} />
      </span>
      <div className="ta-isi">
        <b id="ta-judul">{judul}</b>
        <p>{sub}</p>
        <ul className="ta-chips">
          {saran.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  catat('ai_dibuka', { dari, saran: s });
                  bukaAI({ teks: s, ...(konteks || {}) });
                }}
              >
                {s}
                <Icon name="arrowr" size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
