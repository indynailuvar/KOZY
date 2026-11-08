// Kolom tanya berbentuk pil: isian, mikrofon (kalau browser mendukung),
// dan tombol kirim bulat gelap. Dipakai di beranda dan di halaman KOZY AI.
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { bisaDengar, dengar } from '../lib/dengar.js';

export default function AskBar({ value, onChange, onKirim, sibuk = false, placeholder = 'Tanya KOZY AI…', label = 'Pesan untuk KOZY AI', bolehKosong = false }) {
  const [rekam, setRekam] = useState(false);
  const [mic] = useState(bisaDengar);
  const henti = useRef(null);
  useEffect(() => () => henti.current?.(), []);

  const tombolMic = () => {
    if (rekam) {
      henti.current?.();
      setRekam(false);
      return;
    }
    setRekam(true);
    henti.current = dengar({
      onTeks: (t, final) => {
        onChange(t);
        if (final) setRekam(false);
      },
      onSelesai: () => setRekam(false),
      onGagal: () => setRekam(false),
    });
  };

  return (
    <form
      className={`ask ${rekam ? 'is-rekam' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!sibuk) onKirim(value);
      }}
    >
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={rekam ? 'Mendengarkan…' : placeholder} aria-label={label} />
      {mic && (
        <button type="button" className="ask-mic" aria-pressed={rekam} aria-label="Bicara" onClick={tombolMic}>
          <Icon name="mic" size={20} />
        </button>
      )}
      <button type="submit" className="ask-send" disabled={sibuk || (!bolehKosong && !value.trim())} aria-label="Kirim">
        <Icon name="arrowup" size={18} strokeWidth={2.4} />
      </button>
    </form>
  );
}
