import { Component, useEffect, useRef, useState } from 'react';
import { useRoute, go } from './router.js';
import { useStore } from './store.jsx';
import { Footer, Header, NavBawah, RUTE_NAV_BAWAH } from './components/Layout.jsx';
import { Button, EmptyState, PageHead, Sheet } from './components/ui.jsx';
import { PengaturanAkses } from './components/A11y.jsx';
import { catat } from './lib/jejak.js';
import Home from './pages/Home.jsx';
import CekWizard from './pages/CekWizard.jsx';
import Hasil from './pages/Hasil.jsx';
import KartuTawar from './pages/KartuTawar.jsx';
import Match from './pages/Match.jsx';
import CariWizard from './pages/CariWizard.jsx';
import Insight from './pages/Insight.jsx';
import Bandingkan from './pages/Bandingkan.jsx';
import Chat from './pages/Chat.jsx';
import Edukasi from './pages/Edukasi.jsx';
import Riwayat from './pages/Riwayat.jsx';
import Pemilik from './pages/Pemilik.jsx';
import Tentang from './pages/Tentang.jsx';
import Akun from './pages/Akun.jsx';
import Demo from './pages/Demo.jsx';
import Internal from './pages/Internal.jsx';

const ROUTES = {
  '/': Home,
  '/cek': CekWizard,
  '/hasil': Hasil,
  '/kartu-tawar': KartuTawar,
  '/match': Match,
  '/cari': CariWizard,
  '/kawasan': Insight,
  '/bandingkan': Bandingkan,
  '/ai': Chat,
  '/edukasi': Edukasi,
  '/riwayat': Riwayat,
  '/pemilik': Pemilik,
  '/tentang': Tentang,
  '/akun': Akun,
  '/demo': Demo,
  '/internal': Internal,
  '/admin': Internal,
};

// Judul tab browser tiap halaman (juga dibacakan pembaca layar saat pindah halaman)
const JUDUL = {
  '/': 'Cek harga wajar kos di Surabaya',
  '/cek': 'Cek harga kos',
  '/hasil': 'Hasil cek harga',
  '/kartu-tawar': 'Kartu Tawar',
  '/match': 'Kos alternatif',
  '/cari': 'Cari kos',
  '/kawasan': 'Rekomendasi area',
  '/bandingkan': 'Bandingkan kos',
  '/ai': 'KOZY AI',
  '/edukasi': 'Tips hemat anak kos',
  '/riwayat': 'Riwayat',
  '/akun': 'Akun',
  '/pemilik': 'Untuk pemilik kos',
  '/tentang': 'Cara kerja KOZY',
  '/demo': 'Skenario',
  '/internal': 'Dashboard internal',
  '/admin': 'Dashboard internal',
};

// Chat tampil layar penuh. Formulir langkah (Wizard) menyembunyikan header lewat kelas body `wz-mode`.
const FOKUS = ['/ai'];

function NotFound() {
  return (
    <div className="page narrow">
      <PageHead judul="KOZY" onBack={() => go('/')} />
      <EmptyState icon="map" title="Halaman tidak ketemu" action={<Button onClick={() => go('/')}>Ke beranda</Button>}>
        Tautannya mungkin salah atau halamannya sudah dipindah.
      </EmptyState>
    </div>
  );
}

// Jika satu halaman error, tampilkan pesan ramah (bukan layar kosong)
class Pengaman extends Component {
  state = { galat: null };
  static getDerivedStateFromError(galat) {
    return { galat };
  }
  componentDidCatch(galat) {
    console.error(galat);
  }
  render() {
    if (!this.state.galat) return this.props.children;
    return (
      <div className="page narrow">
        <PageHead judul="KOZY" onBack={() => go('/')} />
        <EmptyState icon="cloudoff" title="Halaman gagal dimuat" action={<Button onClick={() => go('/')}>Ke beranda</Button>}>
          Coba muat ulang. Isian kamu tetap tersimpan.
        </EmptyState>
      </div>
    );
  }
}

export default function App() {
  const { path, query } = useRoute();
  const { toastMsg } = useStore();
  const Page = ROUTES[path] || NotFound;
  const fokus = FOKUS.includes(path);
  const [akses, setAkses] = useState(false);
  const halamanSebelum = useRef(path);
  const jejakTerakhir = useRef(null);

  // Saat pindah halaman: perbarui judul tab dan pindahkan fokus ke judul halaman,
  // supaya pengguna pembaca layar tahu halamannya sudah berganti.
  useEffect(() => {
    document.title = `${JUDUL[path] || 'Halaman tidak ditemukan'} · KOZY`;
    if (jejakTerakhir.current !== path) {
      jejakTerakhir.current = path;
      if (!['/internal', '/admin'].includes(path)) catat('halaman', { path });
    }
    // lewati muat pertama (dan efek ganda StrictMode): fokus hanya dipindah saat halaman benar-benar berganti
    if (halamanSebelum.current === path) return;
    halamanSebelum.current = path;
    const id = requestAnimationFrame(() => {
      const main = document.getElementById('main');
      if (!main || main.contains(document.activeElement)) return;
      const h1 = main.querySelector('h1');
      if (h1) {
        h1.tabIndex = -1;
        h1.focus({ preventScroll: true });
      } else main.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [path]);

  return (
    <div className={`app ${fokus ? 'is-focus' : ''} ${path === '/' ? 'is-home' : ''}`}>
      <div className="skip-links">
        <button
          type="button"
          className="skip"
          onClick={() => {
            const m = document.getElementById('main');
            m.focus();
            m.scrollIntoView();
          }}
        >
          Langsung ke konten
        </button>
        <button type="button" className="skip" onClick={() => setAkses(true)}>
          Pengaturan aksesibilitas
        </button>
      </div>
      {!fokus && <Header path={path} />}
      <main className="main" id="main" tabIndex={-1}>
        <Pengaman key={path}>
          <Page query={query} />
        </Pengaman>
      </main>
      {!fokus && <Footer />}
      {RUTE_NAV_BAWAH.includes(path) && <NavBawah path={path} />}
      <Sheet open={akses} onClose={() => setAkses(false)} label="Pengaturan aksesibilitas">
        <div className="sheet-body">
          <h2 className="h2">Pengaturan aksesibilitas</h2>
          <PengaturanAkses />
        </div>
      </Sheet>
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
