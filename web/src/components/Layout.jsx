import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { KozyMark } from './Brand.jsx';
import { Button, Sheet } from './ui.jsx';
import { LoginPanel } from './Sheets.jsx';
import { MenuAkses } from './A11y.jsx';
import { useStore } from '../store.jsx';

const NAV = [
  { href: '#/', label: 'Beranda', match: (p) => p === '/' },
  { href: '#/cek', label: 'Cek Harga', match: (p) => ['/cek', '/hasil', '/kartu-tawar'].includes(p) },
  { href: '#/cari', label: 'Cari Kos', match: (p) => ['/cari', '/kawasan', '/match', '/bandingkan'].includes(p) },
  { href: '#/edukasi', label: 'Tips Hemat', match: (p) => p === '/edukasi' },
];

// Halaman yang menampilkan nav bawah di HP. Halaman lain punya app bar
// sendiri dengan panah kembali, seperti halaman produk di aplikasi belanja.
export const RUTE_NAV_BAWAH = ['/', '/riwayat', '/akun'];

export function Logo() {
  return (
    <a href="#/" className="logo" aria-label="KOZY beranda">
      <KozyMark className="logo-mark" />
      KOZY
    </a>
  );
}

export function Header({ path }) {
  const { state, set, toast } = useStore();
  const [akun, setAkun] = useState(false);
  const [login, setLogin] = useState(false);
  const akunRef = useRef(null);

  useEffect(() => setAkun(false), [path]);
  useEffect(() => {
    if (!akun) return;
    const close = (e) => !akunRef.current?.contains(e.target) && setAkun(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [akun]);

  const keluar = () => {
    set({ user: null });
    setAkun(false);
    toast('Kamu sudah keluar');
  };

  return (
    <header className="topbar">
      <div className="topbar-in">
        <Logo />
        <nav className="nav-desk" aria-label="Menu utama">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={n.match(path) ? 'on' : ''} aria-current={n.match(path) ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="topbar-r">
          <a href="#/ai" className={`ai-btn ${path === '/ai' ? 'on' : ''}`} aria-current={path === '/ai' ? 'page' : undefined}>
            <Icon name="sparkles" size={16} />
            KOZY AI
          </a>
          <MenuAkses />
          <div className="acct only-desk" ref={akunRef}>
            {state.user ? (
              <button type="button" className="avatar" aria-label={`Akun ${state.user.nama}`} aria-expanded={akun} onClick={() => setAkun((a) => !a)}>
                {state.user.nama[0]}
              </button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setLogin(true)}>
                Masuk
              </Button>
            )}
            {akun && (
              <div className="pop-menu">
                <div className="pop-user">
                  <b>{state.user.nama}</b>
                  <small>{state.user.email}</small>
                </div>
                <a href="#/riwayat">Riwayat cek</a>
                <a href="#/pemilik">Untuk pemilik kos</a>
                <a href="#/akun">Pengaturan akun</a>
                <button type="button" onClick={keluar}>
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Sheet open={login} onClose={() => setLogin(false)} label="Masuk">
        <LoginPanel judul="Masuk ke KOZY" alasan="Riwayat cek dan paket yang kamu beli tersimpan di akunmu." onDone={() => setLogin(false)} />
      </Sheet>
    </header>
  );
}

const MENU_BAWAH = [
  { href: '#/', path: '/', icon: 'home', label: 'Beranda' },
  { href: '#/riwayat', path: '/riwayat', icon: 'history', label: 'Riwayat' },
  { href: '#/ai', path: '/ai', icon: 'sparkles', label: 'KOZY AI' },
  { href: '#/akun', path: '/akun', icon: 'user', label: 'Akun' },
];

// Nav bawah di HP: melayang seperti tab bar Instagram, isinya seperti Beranda/Transaksi/Akun di Tokopedia.
export function NavBawah({ path }) {
  useEffect(() => {
    document.body.classList.add('has-bnav');
    return () => document.body.classList.remove('has-bnav');
  }, []);
  return (
    <nav className="bnav" aria-label="Menu utama">
      {MENU_BAWAH.map((m) => (
        <a key={m.href} href={m.href} aria-current={path === m.path ? 'page' : undefined}>
          <span className="bnav-ic">
            <Icon name={m.icon} size={22} strokeWidth={path === m.path ? 2.4 : 2} />
          </span>
          {m.label}
        </a>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div className="footer-brand">
          <Logo />
          <p>Cek harga wajar kos di Surabaya. Netral, bukan tempat iklan.</p>
        </div>
        <nav className="footer-links" aria-label="Tautan footer">
          <a href="#/cek">Cek harga</a>
          <a href="#/cari">Cari kos</a>
          <a href="#/bandingkan">Bandingkan kos</a>
          <a href="#/edukasi">Tips hemat</a>
          <a href="#/tentang">Cara kerja KOZY</a>
          <a href="#/pemilik">Untuk pemilik kos</a>
        </nav>
      </div>
      <p className="footer-copy">© 2026 KOZY · Surabaya</p>
    </footer>
  );
}
