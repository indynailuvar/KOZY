import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Button, Sheet } from './ui.jsx';
import { LoginPanel } from './Sheets.jsx';
import { MenuAkses, PengaturanAkses } from './A11y.jsx';
import { useStore } from '../store.jsx';

const NAV = [
  { href: '#/', label: 'Beranda', match: (p) => p === '/' },
  { href: '#/cek', label: 'Cek Harga', match: (p) => ['/cek', '/hasil', '/kartu-tawar'].includes(p) },
  { href: '#/cari', label: 'Cari Kos', match: (p) => ['/cari', '/kawasan', '/match', '/bandingkan'].includes(p) },
  { href: '#/ai', label: 'KOZY AI', match: (p) => p === '/ai' },
  { href: '#/edukasi', label: 'Edukasi', match: (p) => p === '/edukasi' },
];

export function Logo() {
  return (
    <a href="#/" className="logo" aria-label="KOZY beranda">
      <span className="logo-mark">
        <Icon name="home" size={16} strokeWidth={2.6} />
      </span>
      KOZY
    </a>
  );
}

export function Header({ path }) {
  const { state, set, toast } = useStore();
  const [menu, setMenu] = useState(false);
  const [akun, setAkun] = useState(false);
  const [login, setLogin] = useState(false);
  const akunRef = useRef(null);

  useEffect(() => {
    setMenu(false);
    setAkun(false);
  }, [path]);
  useEffect(() => {
    if (!akun) return;
    const close = (e) => !akunRef.current?.contains(e.target) && setAkun(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [akun]);

  const keluar = () => {
    set({ user: null });
    setAkun(false);
    setMenu(false);
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
          <MenuAkses />
          <div className="acct only-desk" ref={akunRef}>
            {state.user ? (
              <button type="button" className="avatar" aria-label="Akun" aria-expanded={akun} onClick={() => setAkun((a) => !a)}>
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
                <button type="button" onClick={keluar}>
                  Keluar
                </button>
              </div>
            )}
          </div>
          <button type="button" className="icon-btn only-mob" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((o) => !o)}>
            <Icon name={menu ? 'x' : 'menu'} size={22} />
          </button>
        </div>
      </div>
      {menu && (
        <nav className="drawer" aria-label="Menu">
          {[...NAV, { href: '#/riwayat', label: 'Riwayat cek' }, { href: '#/pemilik', label: 'Untuk pemilik kos' }, { href: '#/tentang', label: 'Tentang KOZY' }].map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
              <Icon name="right" size={18} />
            </a>
          ))}
          <div className="drawer-sec">
            <p className="sec-label">Aksesibilitas</p>
            <PengaturanAkses />
          </div>
          {state.user ? (
            <Button variant="secondary" block onClick={keluar}>
              Keluar
            </Button>
          ) : (
            <Button block onClick={() => setLogin(true)}>
              Masuk
            </Button>
          )}
        </nav>
      )}
      <Sheet open={login} onClose={() => setLogin(false)} label="Masuk">
        <LoginPanel judul="Masuk ke KOZY" alasan="Simpan riwayat cek dan hasil pembelianmu di akun." onDone={() => setLogin(false)} />
      </Sheet>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div className="footer-brand">
          <Logo />
          <p>Cek kewajaran harga kos di Surabaya. Netral, bukan platform iklan.</p>
        </div>
        <nav className="footer-links" aria-label="Tautan footer">
          <a href="#/cek">Cek harga</a>
          <a href="#/cari">Cari kos</a>
          <a href="#/bandingkan">Bandingkan kos</a>
          <a href="#/edukasi">Edukasi</a>
          <a href="#/tentang">Tentang</a>
          <a href="#/pemilik">Untuk pemilik</a>
        </nav>
      </div>
      <p className="footer-copy">© 2026 KOZY · Surabaya</p>
    </footer>
  );
}
