// Gerbang dashboard internal KOZY.
//
// Dashboard pengembang dan dashboard pemilik kos adalah dua halaman yang
// berbeda sama sekali:
//
//   #/pemilik    dibaca pemilik kos. Isinya pasar di sekitar kosnya sendiri.
//   #/internal   dibaca tim KOZY. Isinya mutu dataset, metode pembanding harga, dan
//                aktivitas seluruh pengguna.
//
// Keduanya tidak pernah saling menaut, dan #/internal tidak muncul di menu
// mana pun. Gerbang ini menambah satu lapis lagi supaya pemilik kos yang
// kebetulan menebak alamatnya tidak langsung melihat angka internal.
//
// PERLU DIKETAHUI: KOZY berjalan sepenuhnya di sisi pengguna, jadi seluruh
// datanya ikut terunduh bersama aplikasinya. Gerbang ini menghalangi orang
// yang sekadar mengetik alamat; ia TIDAK menghalangi orang yang membuka
// peralatan pengembang di peramban. Untuk itu datanya harus dipindah ke
// server dan diminta lewat API yang memeriksa login.
import { useState } from 'react';
import Admin from './Admin.jsx';
import Icon from '../components/Icon.jsx';
import { Button, Field, PageHead } from '../components/ui.jsx';

const KODE = import.meta.env.VITE_KOZY_PIN || 'kozysukses';
const KUNCI = 'kozy:internal';

// sessionStorage, bukan localStorage: terkunci lagi begitu tabnya ditutup
const sudahMasuk = () => {
  try {
    return sessionStorage.getItem(KUNCI) === '1';
  } catch {
    return false;
  }
};

export default function Internal({ query }) {
  const [buka, setBuka] = useState(sudahMasuk);
  const [isi, setIsi] = useState('');
  const [galat, setGalat] = useState('');

  if (buka) return <Admin query={query} prefix={window.location.hash.startsWith('#/admin') ? '/admin' : '/internal'} />;

  const kirim = (e) => {
    e.preventDefault();
    if (isi.trim() !== KODE) return setGalat('Kode akses salah.');
    try {
      sessionStorage.setItem(KUNCI, '1');
    } catch {
      /* mode penyamaran: tetap boleh masuk, hanya tidak tersimpan */
    }
    setBuka(true);
  };

  return (
    <div className="page narrow">
      <PageHead judul="Dashboard internal" sub="Halaman tim KOZY" />
      <form className="card gerbang" onSubmit={kirim}>
        <span className="ic-circle lg">
          <Icon name="lock" size={22} />
        </span>
        <h2 className="card-t">Halaman ini untuk tim KOZY</h2>
        <p>
          Isinya mutu dataset, metode pembanding harga, dan aktivitas seluruh pengguna. Kalau kamu pemilik kos, yang kamu cari ada di halaman{' '}
          <a href="#/pemilik">Untuk pemilik kos</a>.
        </p>
        <Field label="Kode akses" error={galat} htmlFor="kode">
          <input
            id="kode"
            type="password"
            className="gerbang-in"
            value={isi}
            autoComplete="off"
            onChange={(e) => {
              setIsi(e.target.value);
              setGalat('');
            }}
            aria-invalid={galat ? true : undefined}
          />
        </Field>
        <Button type="submit">Masuk</Button>
      </form>
    </div>
  );
}
