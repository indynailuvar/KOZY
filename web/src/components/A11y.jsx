import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Switch } from './ui.jsx';
import { bicara, bisaBicara, diam } from '../lib/speech.js';
import { useStore } from '../store.jsx';

export function SpeakButton({ teks, label = 'Dengarkan', compact = false }) {
  const [aktif, setAktif] = useState(false);
  useEffect(() => () => aktif && diam(), [aktif]);
  if (!bisaBicara()) return null;
  const toggle = () => {
    if (aktif) {
      diam();
      setAktif(false);
    } else if (bicara(typeof teks === 'function' ? teks() : teks, { onEnd: () => setAktif(false) })) {
      setAktif(true);
    }
  };
  return (
    <button type="button" className={`speak ${compact ? 'is-compact' : ''} ${aktif ? 'is-on' : ''}`} onClick={toggle} aria-pressed={aktif} aria-label={aktif ? 'Hentikan suara' : label}>
      <Icon name={aktif ? 'stop' : 'volume'} size={compact ? 16 : 18} />
      {!compact && <span>{aktif ? 'Berhenti' : label}</span>}
    </button>
  );
}

// Bacakan otomatis saat mode suara aktif (sekali per kunci)
export function useBacaOtomatis(teks, kunci) {
  const { state } = useStore();
  const sudah = useRef(null);
  useEffect(() => {
    if (!state.pengaturan.suara || !teks || sudah.current === kunci) return;
    sudah.current = kunci;
    const t = setTimeout(() => bicara(teks), 400);
    return () => clearTimeout(t);
  }, [state.pengaturan.suara, teks, kunci]);
  useEffect(() => () => diam(), []);
}

export function PengaturanAkses({ onChange }) {
  const { state, aturPengaturan, toast } = useStore();
  const { suara, teksBesar } = state.pengaturan;
  return (
    <div className="a11y-panel">
      <Switch
        checked={suara}
        onChange={(v) => {
          aturPengaturan({ suara: v });
          if (v) bicara('Mode suara aktif. Hasil cek dan jawaban KOZY AI akan dibacakan.');
          else diam();
          if (v && !bisaBicara()) toast('Browser ini belum mendukung suara');
          onChange?.();
        }}
        label="Mode suara"
        sub="Bacakan hasil cek & jawaban KOZY AI"
      />
      <Switch
        checked={teksBesar}
        onChange={(v) => {
          aturPengaturan({ teksBesar: v });
          onChange?.();
        }}
        label="Teks lebih besar"
        sub="Perbesar tulisan di semua halaman"
      />
    </div>
  );
}

export function MenuAkses() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btn = useRef(null);
  const { state } = useStore();
  const aktif = state.pengaturan.suara || state.pengaturan.teksBesar;
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector('.a11y-pop input')?.focus();
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      btn.current?.focus();
    };
    const onFocus = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open]);
  return (
    <div className="a11y-menu" ref={ref}>
      <button
        ref={btn}
        type="button"
        className={`icon-btn ${aktif ? 'is-active' : ''}`}
        aria-label="Pengaturan aksesibilitas"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="menu-akses"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="access" size={22} />
      </button>
      {open && (
        <div className="a11y-pop" id="menu-akses" role="dialog" aria-label="Pengaturan aksesibilitas">
          <b>Aksesibilitas</b>
          <PengaturanAkses />
        </div>
      )}
    </div>
  );
}
