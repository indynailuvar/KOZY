import { Component } from 'react';
import { useRoute, go } from './router.js';
import { useStore } from './store.jsx';
import { Footer, Header } from './components/Layout.jsx';
import { Button, EmptyState } from './components/ui.jsx';
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
import Demo from './pages/Demo.jsx';

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
  '/demo': Demo,
};

// Chat tampil layar penuh. Formulir langkah (Wizard) menyembunyikan header lewat kelas body `wz-mode`.
const FOKUS = ['/ai'];

function NotFound() {
  return (
    <div className="page narrow">
      <EmptyState icon="map" title="Halaman tidak ditemukan" action={<Button onClick={() => go('/')}>Ke beranda</Button>} />
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
        <EmptyState icon="cloudoff" title="Halaman ini gagal dimuat" action={<Button onClick={() => go('/')}>Ke beranda</Button>}>
          Coba muat ulang halaman. Data yang sudah kamu isi tetap tersimpan.
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
  return (
    <div className={`app ${fokus ? 'is-focus' : ''}`}>
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
      {!fokus && <Header path={path} />}
      <main className="main" id="main" tabIndex={-1}>
        <Pengaman key={path}>
          <Page query={query} />
        </Pengaman>
      </main>
      {!fokus && <Footer />}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
