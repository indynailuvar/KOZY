// Halaman Akun di nav bawah: profil, semua fitur lain, dan pengaturan.
// Menggantikan laci menu hamburger; isinya sama, tapi berupa halaman biasa
// seperti tab Akun di Tokopedia, jadi tidak ada lapisan yang bisa macet.
import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PengaturanAkses } from '../components/A11y.jsx';
import { LoginPanel } from '../components/Sheets.jsx';
import { Button, ListRow, PageHead, Sheet } from '../components/ui.jsx';
import { useStore } from '../store.jsx';

export default function Akun() {
  const { state, set, toast } = useStore();
  const [login, setLogin] = useState(false);
  const u = state.user;

  return (
    <div className="page narrow akun">
      <PageHead judul="Akun" />

      <section className="card akun-head">
        <span className="avatar lg" aria-hidden="true">
          {u ? u.nama[0] : <Icon name="user" size={22} />}
        </span>
        <div className="akun-t">
          <b>{u ? u.nama : 'Kamu belum masuk'}</b>
          <small>{u ? u.email : 'Masuk untuk membeli paket KOZY.'}</small>
        </div>
        {!u && (
          <Button size="sm" onClick={() => setLogin(true)}>
            Masuk
          </Button>
        )}
      </section>

      <p className="sec-label">Fitur</p>
      <div className="list-card">
        <ListRow icon="history" title="Riwayat cek" href="#/riwayat" />
        <ListRow icon="scale" title="Bandingkan 2 kos" href="#/bandingkan" />
        <ListRow icon="wallet" title="Tips hemat anak kos" href="#/edukasi" />
        <ListRow icon="store" title="Untuk pemilik kos" href="#/pemilik" />
      </div>

      <p className="sec-label">Tampilan</p>
      <section className="card">
        <PengaturanAkses />
      </section>

      <p className="sec-label">Lainnya</p>
      <div className="list-card">
        <ListRow icon="info" title="Cara kerja KOZY" href="#/tentang" />
      </div>

      {u && (
        <Button
          variant="secondary"
          block
          onClick={() => {
            set({ user: null });
            toast('Kamu sudah keluar');
          }}
        >
          Keluar
        </Button>
      )}

      <Sheet open={login} onClose={() => setLogin(false)} label="Masuk">
        <LoginPanel judul="Masuk ke KOZY" alasan="Riwayat cek dan paket yang kamu beli tersimpan di akunmu." onDone={() => setLogin(false)} />
      </Sheet>
    </div>
  );
}
