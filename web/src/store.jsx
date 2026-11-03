import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { go } from './router.js';

// State aplikasi. Sebagian besar disimpan di localStorage agar refresh tidak menghapus hasil.
const KEY = 'kozy:v2';
const TIDAK_DISIMPAN = ['ai', 'chat'];
const initial = {
  cek: null, //        hasil cek kos incaran terakhir
  cari: null, //       hasil cari kos (analisis pasar) terakhir
  draftCek: null, //   isian awal formulir cek (skenario / "Ubah isian")
  draftCari: null,
  tawar: null, //      target Kartu Tawar
  match: null, //      { key, list }
  bandingkan: [], //   kos yang dipilih untuk dibandingkan (maks. 2)
  user: null,
  paid: {},
  kontakDibuka: {},
  riwayat: [],
  pemilik: null,
  pengaturan: { suara: false, teksBesar: false },
  ai: { kirim: null }, // pesan yang otomatis dikirim saat halaman KOZY AI dibuka
  chat: [], //         percakapan KOZY AI (hanya selama sesi)
};

function load() {
  try {
    const simpan = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...initial, ...simpan, ai: initial.ai, chat: [] };
  } catch {
    return initial;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [toastMsg, setToastMsg] = useState(null);
  const timer = useRef();

  useEffect(() => {
    try {
      const simpan = { ...state };
      for (const k of TIDAK_DISIMPAN) delete simpan[k];
      localStorage.setItem(KEY, JSON.stringify(simpan));
    } catch {
      /* mode privat: abaikan */
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle('a11y-besar', !!state.pengaturan.teksBesar);
  }, [state.pengaturan.teksBesar]);

  const set = useCallback((patch) => setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const addRiwayat = useCallback(
    (item) => set((s) => ({ riwayat: [item, ...s.riwayat.filter((r) => r.id !== item.id)].slice(0, 20) })),
    [set],
  );

  const bukaAI = useCallback(
    (kirim = null) => {
      set({ ai: { kirim } });
      go('/ai');
    },
    [set],
  );
  const aturPengaturan = useCallback((patch) => set((s) => ({ pengaturan: { ...s.pengaturan, ...patch } })), [set]);

  return <Ctx.Provider value={{ state, set, toast, toastMsg, addRiwayat, bukaAI, aturPengaturan }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
