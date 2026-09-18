import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { SpeakButton } from '../components/A11y.jsx';
import { KeputusanKartu, PilihKos, ProdukKartu, TipsKartu, teksSuara } from '../components/ChatCards.jsx';
import { tanyaAI } from '../api/ai.js';
import { bicara } from '../lib/speech.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const TOPIK = [
  { icon: 'sofa', judul: 'Upgrade kamar', sub: 'Ide perabot dari uang hemat', tanya: 'Ide upgrade kamar dari uang hemat' },
  { icon: 'scale', judul: 'Pilih kos', sub: 'Bingung antara kos A dan B', tanya: 'Bantu pilih kos A atau B' },
  { icon: 'wallet', judul: 'Tips keuangan', sub: 'Tanggal tua & budget kos', tanya: 'Tips bertahan di tanggal tua' },
  { icon: 'calc', judul: 'Cek harga kos', sub: 'Apakah harganya wajar?', ke: '/cek' },
];

function Avatar({ kecil }) {
  return (
    <span className={`chat-ava ${kecil ? 'sm' : ''}`} aria-hidden="true">
      <Icon name="sparkles" size={kecil ? 14 : 30} />
      {!kecil && <i className="chat-online" />}
    </span>
  );
}

function PesanAI({ m, terakhir, onKirim }) {
  return (
    <div className="msg-ai">
      <Avatar kecil />
      <div className="msg-col">
        <div className="bubble">
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
            <Icon name="arrowr" size={15} />
          </a>
        ))}
        {terakhir && m.saran?.length > 0 && (
          <div className="msg-saran">
            {m.saran.map((s) => (
              <button key={s} type="button" onClick={() => onKirim(s)}>
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
          <button type="button" className="circle-btn" onClick={kembali} aria-label="Kembali">
            <Icon name="left" size={20} />
          </button>
          {pesan.length > 0 && (
            <button type="button" className="pill-btn" onClick={() => set({ chat: [] })}>
              <Icon name="refresh" size={16} />
              Mulai baru
            </button>
          )}
        </div>

        <div className="chat-scroll" ref={listRef} aria-live="polite">
          <div className="chat-hero">
            <Avatar />
            <h1>KOZY AI</h1>
            <p>Asisten virtual KOZY</p>
            <small>Online · biasanya membalas dalam hitungan detik</small>
          </div>

          <div className="msg-ai">
            <Avatar kecil />
            <div className="msg-col">
              <div className="bubble">
                <p>Halo! 👋 Aku bisa bantu ide upgrade kamar, memilih kos, dan tips keuangan anak kos. Pilih topik di bawah atau tulis pertanyaanmu.</p>
              </div>
            </div>
          </div>

          {pesan.length === 0 && (
            <section className="topics">
              <p className="sec-label">Topik populer</p>
              <div className="topic-grid">
                {TOPIK.map((t) => (
                  <button key={t.judul} type="button" className="topic" onClick={() => (t.ke ? go(t.ke) : kirim(t.tanya))}>
                    <span className="ic-circle">
                      <Icon name={t.icon} size={19} />
                    </span>
                    <b>{t.judul}</b>
                    <small>{t.sub}</small>
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
              <Avatar kecil />
              <div className="bubble typing" aria-label="KOZY AI sedang mengetik">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (!sibuk) kirim(teks);
          }}
        >
          <input value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="Tulis pertanyaan…" aria-label="Pesan untuk KOZY AI" />
          <button type="submit" disabled={!teks.trim() || sibuk} aria-label="Kirim">
            <Icon name="arrowup" size={18} strokeWidth={2.4} />
          </button>
        </form>
        <p className="chat-note">KOZY AI adalah AI dan bisa keliru. Cek ulang sebelum memutuskan.</p>
      </div>
    </div>
  );
}
