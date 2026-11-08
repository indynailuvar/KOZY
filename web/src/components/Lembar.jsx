// Lembar: hasil dipecah per tab di HP, ditumpuk biasa di layar lebar.
//
// Halaman hasil dulu menumpuk ke bawah sampai 2,3 layar di HP. Dipecah per
// lembar, tiap layar cuma mengurus satu pertanyaan. Navigasinya berupa tab yang
// selalu terlihat di atas isi (menempel di bawah topbar), bukan titik dan panah
// di bawah: dengan tab, orang langsung tahu ada apa saja tanpa harus menebak.
//
// Menggeser kiri-kanan tetap bisa, tetapi bukan satu-satunya cara. Polanya
// ARIA tabs: tombol = tab, isi = tabpanel, panah kiri/kanan/Home/End pindah tab.
//
// Di layar >= 960 px tidak ada tab sama sekali; semua lembar ditumpuk.
import { useEffect, useId, useRef, useState } from 'react';

const GESER_MIN = 48; // di bawah ini dianggap ketukan, bukan geseran

const tinggiTopbar = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--top'), 10) || 56;

export default function Lembar({ lembar = [], awal = 0, onGanti, label = 'Hasil' }) {
  const isi = lembar.filter(Boolean);
  const [i, setI] = useState(Math.min(awal, Math.max(0, isi.length - 1)));
  const [geser, setGeser] = useState(0);
  // Di layar lebar semua lembar ditumpuk, jadi penandaan "lembar tak aktif"
  // harus ikut mati — kalau tidak, lembar yang terlihat jelas di layar justru
  // tersembunyi dari pembaca layar.
  const [memaging, setMemaging] = useState(() => (typeof matchMedia === 'function' ? matchMedia('(max-width: 959px)').matches : true));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(max-width: 959px)');
    const periksa = () => setMemaging(mq.matches);
    // dua sinyal: 'change' kadang tidak terpicu saat ukuran layar diemulasi
    mq.addEventListener('change', periksa);
    window.addEventListener('resize', periksa);
    periksa();
    return () => {
      mq.removeEventListener('change', periksa);
      window.removeEventListener('resize', periksa);
    };
  }, []);
  const tarik = useRef(null);
  const el = useRef(null);
  const halaman = useRef([]);
  const tab = useRef([]);
  const [tinggi, setTinggi] = useState(null);
  const id = useId();

  // Semua lembar tetap ada di DOM supaya bisa digeser mulus, tetapi track-nya
  // flex sehingga tingginya ikut lembar tertinggi. Tinggi wadah dikunci ke
  // lembar aktif dan diperbarui kalau isinya berubah (mis. rincian dibuka).
  useEffect(() => {
    if (!memaging) {
      setTinggi(null);
      return;
    }
    const n = halaman.current[i];
    if (!n) return;
    const ukur = () => setTinggi(n.scrollHeight);
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(n);
    return () => ro.disconnect();
  }, [i, memaging, isi.length]);

  useEffect(() => {
    if (i > isi.length - 1) setI(0);
  }, [isi.length, i]);

  const pertama = useRef(true);
  useEffect(() => {
    onGanti?.(i);
    if (pertama.current) {
      pertama.current = false;
      return;
    }
    // tab yang aktif selalu terlihat walau deretan tabnya digulir ke samping
    tab.current[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // lembar baru dimulai dari atasnya, dengan tab tetap terlihat
    if (memaging && el.current) {
      const y = el.current.getBoundingClientRect().top + window.scrollY - tinggiTopbar();
      if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'auto' });
    }
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isi.length) return null;
  const ke = (n) => setI(Math.max(0, Math.min(isi.length - 1, n)));

  const turun = (e) => {
    if (e.button > 0 || isi.length < 2 || !memaging) return;
    tarik.current = { x: e.clientX, y: e.clientY, kunci: null, dx: 0 };
  };
  const gerak = (e) => {
    const t = tarik.current;
    if (!t) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    // tentukan sekali: geseran mendatar atau pengguna sedang menggulir
    if (t.kunci === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) t.kunci = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (t.kunci !== 'x') return;
    // disimpan di ref juga: pointerup bisa datang sebelum React merender ulang
    t.dx = dx;
    const mentok = (dx > 0 && i === 0) || (dx < 0 && i === isi.length - 1);
    setGeser(mentok ? dx * 0.25 : dx);
  };
  const naik = () => {
    const t = tarik.current;
    tarik.current = null;
    if (t?.kunci === 'x' && Math.abs(t.dx) >= GESER_MIN) ke(i + (t.dx < 0 ? 1 : -1));
    setGeser(0);
  };

  const tombolTab = (e) => {
    const tujuan = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: isi.length - 1 }[e.key];
    if (tujuan === undefined) return;
    e.preventDefault();
    const n = Math.max(0, Math.min(isi.length - 1, tujuan));
    ke(n);
    tab.current[n]?.focus();
  };

  const pakaiTab = memaging && isi.length > 1;
  return (
    <div className="lembar" ref={el}>
      {pakaiTab && (
        <div className="tabs" role="tablist" aria-label={label}>
          {isi.map((l, n) => (
            <button
              key={l.id ?? n}
              ref={(e) => (tab.current[n] = e)}
              type="button"
              role="tab"
              id={`${id}-tab-${n}`}
              aria-selected={n === i}
              aria-controls={`${id}-${n}`}
              tabIndex={n === i ? 0 : -1}
              className="tab"
              onClick={() => ke(n)}
              onKeyDown={tombolTab}
            >
              {l.judul}
            </button>
          ))}
        </div>
      )}

      <div
        className={`lembar-wrap ${tarik.current?.kunci === 'x' ? 'is-drag' : ''}`}
        style={tinggi ? { height: tinggi } : undefined}
        onPointerDown={turun}
        onPointerMove={gerak}
        onPointerUp={naik}
        onPointerCancel={naik}
      >
        {/* 24px = jarak antarlembar di CSS (.lembar-track gap) */}
        <div className="lembar-track" style={{ transform: `translateX(calc(${-i} * (100% + 24px) + ${geser}px))` }}>
          {isi.map((l, n) => (
            <section
              key={l.id ?? n}
              ref={(e) => (halaman.current[n] = e)}
              id={`${id}-${n}`}
              role={pakaiTab ? 'tabpanel' : undefined}
              aria-labelledby={pakaiTab ? `${id}-tab-${n}` : undefined}
              aria-label={pakaiTab ? undefined : l.judul}
              className="lembar-page"
              // hanya saat memaging: lembar yang tidak tampil disembunyikan dari
              // pembaca layar dan urutan Tab. Di desktop semuanya memang terlihat.
              aria-hidden={memaging && n !== i ? 'true' : undefined}
              inert={memaging && n !== i ? '' : undefined}
            >
              {l.isi}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
