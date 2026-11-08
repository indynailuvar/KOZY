// Beranda, disusun seperti aplikasi sewa dan belanja yang sudah akrab.
//
// Orang datang dengan salah satu dari dua kondisi: sudah punya kos incaran
// (dan tahu harganya), atau belum. Dua kondisi itu jadi dua kartu besar
// berwarna di paling atas, ditulis dari sudut pandang pengguna, supaya
// langsung tahu harus mengetuk yang mana. Fitur lain cukup jadi deret ikon.
import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PASAR_KEC } from '../api/kozy.js';
import { rpSingkat } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const PINTU = [
  { href: '#/cek', icon: 'calc', kondisi: 'Sudah tahu harganya', aksi: 'Cek wajar atau mahal', warna: 'tosca' },
  { href: '#/cari', icon: 'search', kondisi: 'Belum ada incaran', aksi: 'Cari kos', warna: 'biru' },
];

// Cek Harga dan Cari Kos sudah jadi kartu besar, Pemilik jadi banner,
// Riwayat dan KOZY AI ada di nav bawah.
const MENU = [
  { href: '#/bandingkan', icon: 'scale', label: 'Bandingkan' },
  { href: '#/edukasi', icon: 'wallet', label: 'Tips Hemat' },
  { href: '#/tentang', icon: 'info', label: 'Cara Kerja' },
];

export default function Home() {
  const { set } = useStore();
  const [semua, setSemua] = useState(false);
  const daftar = semua ? PASAR_KEC : PASAR_KEC.slice(0, 4);

  const cekDi = (kec) => {
    set({ draftCek: { lokasiTeks: kec } });
    go('/cek');
  };

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-judul">
        <h1 id="home-judul">Sewa kos tanpa kemahalan</h1>
        <p>Mulai dari kondisimu sekarang.</p>
      </section>

      <nav className="home-pintu" aria-label="Mulai">
        {PINTU.map((p) => (
          <a key={p.href} href={p.href} className={`pintu pintu-${p.warna}`}>
            <span className="pintu-ic">
              <Icon name={p.icon} size={22} />
            </span>
            <span className="pintu-t">
              <small>{p.kondisi}</small>
              <b>{p.aksi}</b>
            </span>
            <Icon name="arrowr" size={20} className="pintu-go" />
          </a>
        ))}
      </nav>

      <nav className="home-menu" aria-label="Fitur lain">
        {MENU.map((m) => (
          <a key={m.href} href={m.href} className="menu-item">
            <span className="menu-ic">
              <Icon name={m.icon} size={24} />
            </span>
            <span className="menu-t">{m.label}</span>
          </a>
        ))}
      </nav>

      <a className="home-owner" href="#/pemilik">
        <span className="home-owner-t">
          <b>Punya kos di Surabaya?</b>
          <small>Lihat apakah harganya sudah bersaing.</small>
        </span>
        <span className="home-owner-btn">Cek kosku</span>
      </a>

      <section className="home-pasar" aria-labelledby="pasar-judul">
        <div className="sec-head">
          <h2 className="sec-label" id="pasar-judul">
            Harga pasaran kos
          </h2>
          {PASAR_KEC.length > 4 && (
            <button type="button" className="text-btn" onClick={() => setSemua((v) => !v)} aria-expanded={semua}>
              {semua ? 'Ringkas' : 'Lihat semua'}
            </button>
          )}
        </div>
        <div className="list-card">
          {daftar.map((k) => (
            <button key={k.kec} type="button" className="pasar-row" onClick={() => cekDi(k.kec)} aria-label={`Cek harga kos di ${k.kec}, harga pasaran ${rpSingkat(k.median)} per bulan`}>
              <span className="pasar-t">
                <b>{k.kec}</b>
                <small>{k.n} kos</small>
              </span>
              <span className="pasar-h">
                <b>{rpSingkat(k.median)}</b>
                <small>/bulan</small>
              </span>
              <Icon name="right" size={18} className="lr-go" />
            </button>
          ))}
        </div>
      </section>

      <p className="home-trust">
        <Icon name="shieldc" size={18} />
        KOZY netral. Pemilik kos tidak bisa membayar untuk mengubah penilaian.
      </p>
    </div>
  );
}
