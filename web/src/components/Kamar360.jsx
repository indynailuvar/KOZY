// Penampil kamar 4 sisi dengan putaran menerus, seperti Street View di Google Maps.
//
// Cara kerjanya: keempat foto dipasang sebagai empat dinding sebuah kubus
// (skybox), lalu kameranya ditaruh tepat di tengah kubus dan diputar. Jadi
// pandangannya bergerak mulus, bukan berganti gambar — di sudut ruangan dua
// dinding terlihat sekaligus, persis seperti berdiri di tengah kamar lalu menoleh.
//
// Rumus kubusnya: kalau lebar penampil W, tiap dinding didorong sejauh W/2 dari
// pusat dan perspektifnya juga diset W/2. Dengan begitu satu dinding tepat
// mengisi 90 derajat pandangan dan keempatnya menutup 360 derajat tanpa celah.
//
// Geometrinya sudah diperiksa dengan memproyeksikan tiap dinding memakai
// matriksnya sendiri, lalu menghitung berapa persen layar yang tertutup:
//   menghadap dinding (0 derajat) : depan 100%
//   menoleh 20 derajat            : depan 74% + kanan 26%
//   tepat di pojok (45 derajat)   : depan 50% + kanan 50%
// Layar selalu terisi penuh, jadi tidak ada celah kosong di antara dinding.
// Pojok dinding yang jauh memang memproyeksi ke tak hingga, tetapi letaknya
// persis 90 derajat dari arah pandang sehingga selalu di luar layar.
//
// Kalau fotonya belum lengkap empat, kubusnya akan bolong. Untuk keadaan itu
// penampilnya otomatis turun ke mode sederhana: berganti foto satu per satu.
//
// Batasnya jujur: ini bukan panorama 360 jahitan. Kamera HP menangkap sekitar
// 70 derajat, sedangkan tiap dinding harus mengisi 90 derajat, jadi fotonya
// sedikit teregang dan sambungan di pojok tidak selalu pas. Memutar ke atas dan
// ke bawah juga tidak bisa, karena tidak ada foto langit-langit dan lantai.
//
// Aksesibilitas (wajib, bukan tambahan):
//   - Menggeser BUKAN satu-satunya cara: ada tombol panah 44 px, tombol tiap
//     sisi, dan panah papan ketik saat penampilnya difokus.
//   - Sisi yang sedang dihadapi diumumkan lewat aria-live.
//   - Tiap dinding punya alt yang menyebut sisinya.
//   - Kalau pengguna memilih "kurangi gerak", putarannya langsung tanpa animasi
//     dan tanpa efek lempar.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Urutannya seperti orang berdiri di tengah kamar lalu menoleh ke kanan.
export const SISI = [
  { id: 'depan', label: 'Depan' },
  { id: 'kanan', label: 'Kanan' },
  { id: 'belakang', label: 'Belakang' },
  { id: 'kiri', label: 'Kiri' },
];

export const SISI_KOSONG = { depan: null, kanan: null, belakang: null, kiri: null };
export const jumlahSisi = (foto) => SISI.filter((s) => foto?.[s.id]).length;

const GESER_MIN = 45; // piksel; di bawah ini dianggap ketukan biasa
const PEREDAM = 0.94; // peluruhan efek lempar
const DIAM = 0.08; // di bawah ini lemparannya dianggap berhenti

const modulo = (a, n) => ((a % n) + n) % n;
const kurangGerak = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Kamar360({ foto, nama = 'kamar', tinggi = 'md', awal = 'depan', onGanti }) {
  const ada = SISI.filter((s) => foto?.[s.id]);
  const penuh = ada.length === 4; // kubus hanya utuh kalau keempat dindingnya ada
  return penuh ? <Panorama foto={foto} nama={nama} tinggi={tinggi} awal={awal} onGanti={onGanti} /> : <Sederhana ada={ada} foto={foto} nama={nama} tinggi={tinggi} awal={awal} onGanti={onGanti} />;
}

// ---------------------------------------------------------------- kubus 360
function Panorama({ foto, nama, tinggi, awal, onGanti }) {
  const mulai = Math.max(0, SISI.findIndex((s) => s.id === awal));
  const [sudut, setSudut] = useState(-mulai * 90); // derajat, boleh terus bertambah
  const [halus, setHalus] = useState(true); // animasi dimatikan selama menggeser
  const [lebar, setLebar] = useState(0);
  const el = useRef(null);
  const tarik = useRef(null);
  const lempar = useRef(0);
  const rafId = useRef(0);
  const id = useId();

  // lebar penampil menentukan ukuran kubus, jadi harus ikut kalau layoutnya berubah
  useLayoutEffect(() => {
    if (!el.current) return;
    const ro = new ResizeObserver(([e]) => setLebar(e.contentRect.width));
    ro.observe(el.current);
    setLebar(el.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const hadap = modulo(Math.round(-sudut / 90), 4);
  const sisiKini = SISI[hadap];

  useEffect(() => {
    onGanti?.(sisiKini.id);
  }, [sisiKini.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const keSudut = useCallback((target) => {
    setHalus(!kurangGerak());
    setSudut(target);
  }, []);
  const putar = useCallback((langkah) => keSudut(Math.round(sudut / 90) * 90 - langkah * 90), [sudut, keSudut]);
  const keSisi = useCallback(
    (i) => {
      // cari putaran terpendek ke sisi itu, jadi dari Kiri ke Depan tidak memutar balik
      const sekarang = -sudut / 90;
      keSudut(-(Math.round((sekarang - i) / 4) * 4 + i) * 90);
    },
    [sudut, keSudut],
  );

  // --- menggeser + efek lempar ---
  const berhenti = () => cancelAnimationFrame(rafId.current);
  const jalanLempar = useCallback(() => {
    berhenti();
    if (kurangGerak()) return;
    const langkah = () => {
      lempar.current *= PEREDAM;
      if (Math.abs(lempar.current) < DIAM) {
        setHalus(true);
        setSudut((s) => Math.round(s / 90) * 90); // berhenti rapi menghadap satu sisi
        return;
      }
      setSudut((s) => s + lempar.current);
      rafId.current = requestAnimationFrame(langkah);
    };
    rafId.current = requestAnimationFrame(langkah);
  }, []);
  useEffect(() => berhenti, []);

  const turun = (e) => {
    if (e.button > 0) return;
    berhenti();
    setHalus(false);
    tarik.current = { x: e.clientX, sudut, gerak: 0, waktu: performance.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const gerak = (e) => {
    const t = tarik.current;
    if (!t || !lebar) return;
    const d = e.clientX - t.x;
    // satu lebar penampil = 90 derajat, supaya jari mengikuti dinding
    const baru = t.sudut + (d / lebar) * 90;
    lempar.current = baru - sudut;
    t.gerak = d;
    setSudut(baru);
  };
  const naik = (e) => {
    const t = tarik.current;
    if (!t) return;
    tarik.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (Math.abs(t.gerak) < GESER_MIN && Math.abs(lempar.current) < 1) {
      setHalus(true);
      setSudut(Math.round(sudut / 90) * 90);
      return;
    }
    jalanLempar();
  };

  const tombol = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      putar(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      putar(-1);
    }
  };

  const p = lebar / 2;
  return (
    <div className={`k360 k360-${tinggi}`}>
      <div
        ref={el}
        className="k360-view k360-pano"
        style={{ perspective: p ? `${p}px` : undefined }}
        role="group"
        aria-roledescription="Penampil kamar berputar 360 derajat"
        aria-label={`Foto ${nama}. Geser untuk memutar pandangan, atau gunakan tombol panah kiri dan kanan.`}
        tabIndex={0}
        onKeyDown={tombol}
        onPointerDown={turun}
        onPointerMove={gerak}
        onPointerUp={naik}
        onPointerCancel={naik}
      >
        {p > 0 && (
          <div className={`k360-box ${halus ? 'is-halus' : ''}`} style={{ transform: `translateZ(${p}px) rotateY(${sudut}deg)` }}>
            {SISI.map((s, i) => (
              <div key={s.id} className="k360-face" style={{ transform: `rotateY(${i * 90}deg) translateZ(${-p}px)` }}>
                <img src={foto[s.id]} alt={`Sisi ${s.label.toLowerCase()} ${nama}`} draggable="false" />
              </div>
            ))}
          </div>
        )}
        <span className="k360-kabut" aria-hidden="true" />
        <span className="k360-kini" aria-hidden="true">
          <Icon name="compass" size={14} />
          {sisiKini.label}
        </span>
        <button type="button" className="k360-nav is-kiri" onClick={() => putar(-1)} aria-label="Putar pandangan ke kiri">
          <Icon name="left" size={22} />
        </button>
        <button type="button" className="k360-nav is-kanan" onClick={() => putar(1)} aria-label="Putar pandangan ke kanan">
          <Icon name="right" size={22} />
        </button>
      </div>

      <p className="sr-only" aria-live="polite" id={`${id}-kini`}>
        Sedang menghadap sisi {sisiKini.label.toLowerCase()}.
      </p>

      <div className="k360-sisi" role="tablist" aria-label="Hadapkan ke sisi">
        {SISI.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={i === hadap} className={i === hadap ? 'is-on' : ''} onClick={() => keSisi(i)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="k360-tip">Geser fotonya untuk memutar pandangan, seperti di Google Maps.</p>
    </div>
  );
}

// ------------------------------------------------- cadangan: foto belum lengkap
// Kubusnya akan bolong kalau ada dinding yang hilang, jadi di sini fotonya
// berganti satu per satu saja — tanpa putaran menerus.
function Sederhana({ ada, foto, nama, tinggi, awal, onGanti }) {
  const mulai = Math.max(0, ada.findIndex((s) => s.id === awal));
  const [i, setI] = useState(mulai);
  const [arah, setArah] = useState(0);
  const el = useRef(null);
  const tarik = useRef(null);
  const id = useId();

  useEffect(() => {
    if (i > ada.length - 1) setI(0);
  }, [ada.length, i]);

  if (!ada.length) return null;
  const kini = ada[i];
  const ke = (langkah) => {
    const baru = modulo(i + langkah, ada.length);
    setArah(langkah);
    setI(baru);
    onGanti?.(ada[baru].id);
  };

  const turun = (e) => {
    if (ada.length < 2 || e.button > 0) return;
    tarik.current = e.clientX;
    el.current?.setPointerCapture?.(e.pointerId);
  };
  const naik = (e) => {
    if (tarik.current == null) return;
    const d = e.clientX - tarik.current;
    tarik.current = null;
    el.current?.releasePointerCapture?.(e.pointerId);
    if (Math.abs(d) >= GESER_MIN) ke(d < 0 ? 1 : -1);
  };
  const tombol = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      ke(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      ke(-1);
    }
  };

  return (
    <div className={`k360 k360-${tinggi}`}>
      <div
        ref={el}
        className="k360-view"
        role="group"
        aria-roledescription="Penampil foto kamar"
        aria-label={`Foto ${nama}. Gunakan tombol panah kiri dan kanan untuk berpindah foto.`}
        tabIndex={0}
        onKeyDown={tombol}
        onPointerDown={turun}
        onPointerUp={naik}
        onPointerCancel={naik}
      >
        <img key={kini.id} src={foto[kini.id]} alt={`Sisi ${kini.label.toLowerCase()} ${nama}`} className="k360-img" data-arah={arah} draggable="false" />
        <span className="k360-kabut" aria-hidden="true" />
        <span className="k360-kini" aria-hidden="true">
          <Icon name="compass" size={14} />
          {kini.label}
        </span>
        {ada.length > 1 && (
          <>
            <button type="button" className="k360-nav is-kiri" onClick={() => ke(-1)} aria-label="Foto sebelumnya">
              <Icon name="left" size={22} />
            </button>
            <button type="button" className="k360-nav is-kanan" onClick={() => ke(1)} aria-label="Foto berikutnya">
              <Icon name="right" size={22} />
            </button>
          </>
        )}
      </div>

      <p className="sr-only" aria-live="polite" id={`${id}-kini`}>
        Menampilkan sisi {kini.label.toLowerCase()}, foto ke-{i + 1} dari {ada.length}.
      </p>

      {ada.length > 1 && (
        <div className="k360-sisi" role="tablist" aria-label="Pilih sisi kamar">
          {ada.map((s, n) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={n === i}
              className={n === i ? 'is-on' : ''}
              onClick={() => {
                setArah(n > i ? 1 : -1);
                setI(n);
                onGanti?.(s.id);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <p className="k360-tip">Baru {ada.length} dari 4 sisi yang ada fotonya, jadi pandangannya belum bisa diputar penuh.</p>
    </div>
  );
}
