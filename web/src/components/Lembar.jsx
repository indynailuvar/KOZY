// Lembar: hasil dipecah jadi beberapa halaman yang digeser kiri-kanan.
//
// Alasannya padat. Halaman hasil sebelumnya menumpuk ke bawah sampai 2,3 layar
// di HP, dan pengguna harus menggulir jauh untuk tahu ada apa saja. Dipecah
// per lembar, tiap layar cuma mengurus satu pertanyaan: berapa harganya,
// kenapa segitu, di mana posisinya, lalu apa langkah berikutnya.
//
// Menggeser BUKAN satu-satunya cara berpindah — sama seperti penampil kamar.
// Ada tombol panah, titik penanda yang bisa diketuk, dan panah papan ketik.
// Carousel yang hanya bisa digeser praktis tidak bisa dipakai pengguna papan
// ketik maupun pembaca layar.
//
// Pola ARIA-nya memakai tab: titik penanda = tablist, isi lembar = tabpanel.
// Untuk jumlah lembar sedikit dan berjudul, itu pola yang paling dikenali
// pembaca layar, lebih baik daripada carousel generik.
//
// Di layar >= 960 px komponen ini tidak memaging apa pun: semua lembar
// ditumpuk biasa (lihat .lembar di styles.css), karena menggeser horizontal
// di layar lebar justru menyulitkan.
import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const GESER_MIN = 48; // di bawah ini dianggap ketukan, bukan geseran

export default function Lembar({ lembar = [], awal = 0, onGanti, label = 'Hasil' }) {
  const isi = lembar.filter(Boolean);
  const [i, setI] = useState(Math.min(awal, Math.max(0, isi.length - 1)));
  const [geser, setGeser] = useState(0);
  // Di layar lebar semua lembar ditumpuk (lihat styles.css), jadi penandaan
  // "lembar tak aktif" harus ikut mati — kalau tidak, tiga dari empat lembar
  // akan tersembunyi dari pembaca layar padahal terlihat jelas di layar.
  const [memaging, setMemaging] = useState(() => (typeof matchMedia === 'function' ? matchMedia('(max-width: 959px)').matches : true));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(max-width: 959px)');
    const periksa = () => setMemaging(mq.matches);
    // Dua sinyal, bukan satu: peristiwa 'change' pada media query kadang tidak
    // terpicu (mis. saat ukuran layar diemulasi alat uji), dan kalau terlewat
    // lembar yang terlihat di desktop tetap bertanda inert sehingga tak bisa
    // dibaca pembaca layar maupun dicapai Tab.
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
  const [tinggi, setTinggi] = useState(null);
  const id = useId();

  // Keempat lembar tetap ada di DOM supaya bisa digeser mulus, tetapi track-nya
  // flex sehingga tingginya mengikuti lembar TERTINGGI. Akibatnya lembar pendek
  // pun menyisakan ruang kosong panjang — justru masalah yang mau dihilangkan.
  // Jadi tinggi wadah dikunci ke lembar yang sedang aktif, dan diperbarui kalau
  // isinya berubah (mis. baris rincian dibuka).
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

  useEffect(() => {
    onGanti?.(i);
    if (memaging) window.scrollTo({ top: 0, behavior: 'auto' }); // mulai lembar baru dari atas
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
    // tentukan sekali: ini geseran mendatar atau pengguna sedang menggulir ke bawah
    if (t.kunci === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) t.kunci = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (t.kunci !== 'x') return;
    // Jaraknya disimpan di ref, bukan hanya di state: pointerup bisa datang
    // sebelum React sempat merender ulang, sehingga pembacaan dari state
    // masih bernilai lama dan geserannya terabaikan.
    t.dx = dx;
    // di ujung, tahanannya diperberat supaya terasa mentok
    const mentok = (dx > 0 && i === 0) || (dx < 0 && i === isi.length - 1);
    setGeser(mentok ? dx * 0.25 : dx);
  };
  const naik = () => {
    const t = tarik.current;
    tarik.current = null;
    if (t?.kunci === 'x' && Math.abs(t.dx) >= GESER_MIN) ke(i + (t.dx < 0 ? 1 : -1));
    setGeser(0);
  };

  const tombol = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      ke(i + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      ke(i - 1);
    }
  };

  const kini = isi[i];
  return (
    <div className="lembar" ref={el}>
      <p className="sr-only" aria-live="polite">
        {kini.judul}, lembar {i + 1} dari {isi.length}
      </p>

      <div
        className={`lembar-wrap ${tarik.current?.kunci === 'x' ? 'is-drag' : ''}`}
        style={tinggi ? { height: tinggi } : undefined}
        tabIndex={0}
        role="group"
        aria-roledescription="Lembar hasil"
        aria-label={`${label}. Gunakan panah kiri dan kanan untuk berpindah lembar.`}
        onKeyDown={tombol}
        onPointerDown={turun}
        onPointerMove={gerak}
        onPointerUp={naik}
        onPointerCancel={naik}
      >
        <div className="lembar-track" style={{ transform: `translateX(calc(${-i * 100}% + ${geser}px))` }}>
          {isi.map((l, n) => (
            <section
              key={l.id ?? n}
              ref={(e) => (halaman.current[n] = e)}
              id={`${id}-${n}`}
              role="tabpanel"
              aria-label={l.judul}
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

      {i < isi.length - 1 && (
        <button type="button" className="lembar-next only-mob-flex" onClick={() => ke(i + 1)}>
          {isi[i + 1].judul}
          <Icon name="arrowr" size={16} />
        </button>
      )}

      {/* Navigasi ditaruh DI BAWAH isi, bukan di atas. Waktu di atas, panah
          kirinya persis berada di bawah tombol kembali halaman — dua chevron
          kiri bertumpuk dan pengguna tidak tahu mana yang mundur ke halaman
          sebelumnya. Di layar lebar seluruh navigasi disembunyikan karena
          lembarnya memang ditumpuk. */}
      <div className="lembar-nav only-mob-flex">
        <button type="button" className="lembar-arrow" onClick={() => ke(i - 1)} disabled={i === 0} aria-label="Lembar sebelumnya">
          <Icon name="left" size={20} />
        </button>
        <div className="lembar-dots" role="tablist" aria-label={`${label}: ${isi.length} lembar`}>
          {isi.map((l, n) => (
            <button
              key={l.id ?? n}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-controls={`${id}-${n}`}
              className={n === i ? 'is-on' : ''}
              onClick={() => ke(n)}
            >
              <span className="sr-only">{l.judul}</span>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
        <button type="button" className="lembar-arrow" onClick={() => ke(i + 1)} disabled={i === isi.length - 1} aria-label="Lembar berikutnya">
          <Icon name="right" size={20} />
        </button>
      </div>
    </div>
  );
}
