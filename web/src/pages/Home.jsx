import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { HeroArt } from '../components/Art.jsx';
import { PengaturanAkses } from '../components/A11y.jsx';
import { ListRow, Sheet } from '../components/ui.jsx';

export default function Home() {
  const [akses, setAkses] = useState(false);
  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-t">
          <span className="eyebrow">
            <Icon name="pin" size={13} />
            Kota Surabaya
          </span>
          <h1>Kos-mu kemahalan?</h1>
          <p>Cek harga wajar kos, temukan area yang pas, lalu nego dengan data.</p>
        </div>
        <div className="home-art" aria-hidden="true">
          <HeroArt />
        </div>
      </section>

      <section className="home-start" aria-label="Mulai">
        <a className="start-card" href="#/cek">
          <span className="ic-circle lg">
            <Icon name="link" size={22} />
          </span>
          <span className="start-t">
            <b>Sudah punya kos incaran</b>
            <small>Cek apakah harganya wajar</small>
          </span>
          <Icon name="right" size={20} className="start-go" />
        </a>
        <a className="start-card" href="#/cari">
          <span className="ic-circle lg">
            <Icon name="search" size={22} />
          </span>
          <span className="start-t">
            <b>Sedang mencari kos</b>
            <small>Temukan area sesuai kebutuhan</small>
          </span>
          <Icon name="right" size={20} className="start-go" />
        </a>
      </section>

      <p className="home-trust">
        <Icon name="shieldc" size={16} />
        Netral: pemilik kos tidak bisa membayar untuk mengubah penilaian.
      </p>

      <section className="home-more">
        <p className="sec-label">Fitur lainnya</p>
        <div className="list-card">
          <ListRow icon="sparkles" title="Tanya KOZY AI" sub="Ide upgrade kamar & bantu pilih kos" href="#/ai" />
          <ListRow icon="scale" title="Bandingkan 2 kos" sub="Timbang harga, jarak, dan fasilitas" href="#/bandingkan" />
          <ListRow icon="wallet" title="Tips keuangan anak kos" sub="Tanggal tua, budget, dana darurat" href="#/edukasi" />
          <ListRow icon="access" title="Aksesibilitas" sub="Mode suara dan teks besar" onClick={() => setAkses(true)} />
        </div>
      </section>

      <Sheet open={akses} onClose={() => setAkses(false)} label="Aksesibilitas">
        <div className="sheet-body">
          <h2 className="h2">Aksesibilitas</h2>
          <PengaturanAkses />
        </div>
      </Sheet>
    </div>
  );
}
