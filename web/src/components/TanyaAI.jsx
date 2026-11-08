// Ajakan bertanya ke KOZY AI di bagian bawah halaman hasil.
//
// Orang sering tidak tahu KOZY AI bisa ditanya apa, jadi kartu ini langsung
// menyodorkan beberapa pertanyaan sesuai isi halaman. Sekali ketuk,
// pertanyaannya terkirim. Bentuknya daftar berpanah seperti "Pertanyaan
// populer" di pusat bantuan aplikasi belanja.
import Icon from './Icon.jsx';
import { AiAvatar } from './Brand.jsx';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';

export default function TanyaAI({ judul = 'Tanya KOZY AI', sub = 'Jawabannya memakai data di halaman ini.', saran = [], konteks = null, dari = '' }) {
  const { bukaAI } = useStore();
  if (!saran.length) return null;
  return (
    <section className="tanya-ai" aria-labelledby="ta-judul">
      <div className="ta-head">
        <AiAvatar />
        <div className="ta-isi">
          <b id="ta-judul">{judul}</b>
          <p>{sub}</p>
        </div>
      </div>
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
              <span>{s}</span>
              <span className="ta-go" aria-hidden="true">
                <Icon name="right" size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
