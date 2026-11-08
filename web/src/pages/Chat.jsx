import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import AskBar from '../components/AskBar.jsx';
import { AiAvatar } from '../components/Brand.jsx';
import { SpeakButton } from '../components/A11y.jsx';
import { KeputusanKartu, PilihKos, ProdukKartu, TipsKartu, teksSuara } from '../components/ChatCards.jsx';
import { kenaliNiat, tanyaAI } from '../api/ai.js';
import { bicara } from '../lib/speech.js';
import { catat } from '../lib/jejak.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const TOPIK = [
  { judul: 'Cara menawar harga kos', tanya: 'Cara nawar harga kos' },
  { judul: 'Pilih kos A atau B', tanya: 'Bantu pilih kos A atau B' },
  { judul: 'Tips tanggal tua', tanya: 'Tips bertahan di tanggal tua' },
  { judul: 'Ide upgrade kamar', tanya: 'Ide upgrade kamar dari uang hemat' },
];

// Gaya aplikasi chat: jawaban KOZY AI di gelembung putih kiri, pesanmu di
// gelembung tosca muda kanan. Kartu data muncul di bawah gelembung jawaban.
function PesanAI({ m, terakhir, onKirim }) {
  return (
    <div className="msg-ai">
      <div className="msg-col">
        <div className="msg-teks">
          <p>{m.teks}</p>
          {m.kartu && <SpeakButton compact teks={() => teksSuara(m)} label="Bacakan jawaban" />}
        </div>
        {m.kartu?.jenis === 'produk' && <ProdukKartu k={m.kartu} />}
        {m.kartu?.jenis === 'keputusan' && <KeputusanKartu k={m.kartu} />}
        {m.kartu?.jenis === 'tips' && <TipsKartu k={m.kartu} />}
        {m.kartu?.jenis === 'pilihKos' && <PilihKos k={m.kartu} aktif={terakhir} onPilih={(a, b) => onKirim(`Bandingkan ${a.nama} dan ${b.nama}`, { bandingkan: [a, b] })} />}
        {m.aksi?.map((a) => (
          <a key={a.ke} className="msg-link" href={`#${a.ke}`}>
            {a.label}
            <Icon name="right" size={16} />
          </a>
        ))}
        {terakhir && m.saran?.length > 0 && (
          <div className="msg-saran">
            {m.saran.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => onKirim(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const { state, set } = useStore();
  const pesan = state.chat;
  const [teks, setTeks] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const pasangan = useRef(null);
  const listRef = useRef(null);
  const latest = useRef(state);
  latest.current = state;

  const awalTerkirim = useRef(false);
  const tambah = (m) => set((s) => ({ chat: [...s.chat, m] }));

  const kirim = async (isi, ktxTambahan = {}) => {
    const t = isi.trim();
    if (!t) return;
    if (ktxTambahan.bandingkan) pasangan.current = ktxTambahan.bandingkan;
    const s = latest.current;
    const ktx = {
      cek: s.cek,
      daftarKos: s.match?.list || [],
      bandingkan: s.bandingkan.length === 2 ? s.bandingkan : pasangan.current,
      ...ktxTambahan,
    };
    tambah({ dari: 'user', teks: t });
    catat('ai_tanya', { niat: kenaliNiat(t) });
    setTeks('');
    setSibuk(true);
    try {
      const j = await tanyaAI(t, ktx);
      tambah({ dari: 'ai', ...j });
      if (latest.current.pengaturan.suara) bicara(teksSuara(j));
    } catch (e) {
      tambah({ dari: 'ai', teks: e.message });
    } finally {
      setSibuk(false);
    }
  };

  useEffect(() => {
    const awal = state.ai.kirim;
    // StrictMode menjalankan efek dua kali saat pengembangan; pesan awal cukup dikirim sekali
    if (!awal || awalTerkirim.current) return;
    awalTerkirim.current = true;
    set({ ai: { kirim: null } });
    kirim(awal.teks, awal.bandingkan ? { bandingkan: awal.bandingkan } : {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [pesan.length, sibuk]);

  const kembali = () => (window.history.length > 1 ? window.history.back() : go('/'));

  return (
    <div className="chat">
      <div className="chat-in">
        <div className="chat-top">
          <button type="button" className="back-btn" onClick={kembali} aria-label="Kembali">
            <Icon name="arrowl" size={22} strokeWidth={2.2} />
          </button>
          <div className="chat-id">
            <AiAvatar size="sm" />
            <span>
              <b>KOZY AI</b>
              <small>Asisten kos kamu</small>
            </span>
          </div>
          {pesan.length > 0 && (
            <button type="button" className="text-btn" onClick={() => set({ chat: [] })}>
              Mulai baru
            </button>
          )}
        </div>

        <div className="chat-scroll" ref={listRef} aria-live="polite">
          {pesan.length === 0 && (
            <section className="chat-hero" aria-labelledby="chat-salam">
              <AiAvatar size="lg" />
              <h1 id="chat-salam">Halo, aku KOZY AI</h1>
              <p>Tanya soal memilih kos, cara menawar, atau mengatur uang bulanan.</p>
              <p className="chat-topik-l">Coba tanya:</p>
              <div className="chat-topik">
                {TOPIK.map((t) => (
                  <button key={t.judul} type="button" className="chip" onClick={() => kirim(t.tanya)}>
                    {t.judul}
                  </button>
                ))}
              </div>
            </section>
          )}

          {pesan.map((m, i) =>
            m.dari === 'user' ? (
              <div key={i} className="msg-user">
                {m.teks}
              </div>
            ) : (
              <PesanAI key={i} m={m} terakhir={i === pesan.length - 1 && !sibuk} onKirim={kirim} />
            ),
          )}
          {sibuk && (
            <div className="msg-ai">
              <div className="msg-teks typing" role="status" aria-label="KOZY AI sedang mengetik">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>

        <div className="chat-bar">
          <AskBar value={teks} onChange={setTeks} sibuk={sibuk} placeholder="Tulis pertanyaan…" onKirim={kirim} />
          <p className="chat-note">KOZY AI bisa keliru. Cek lagi sebelum memutuskan.</p>
        </div>
      </div>
    </div>
  );
}
