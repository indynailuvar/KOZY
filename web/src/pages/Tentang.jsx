import Icon from '../components/Icon.jsx';
import { Button, PageHead } from '../components/ui.jsx';
import { PASAR } from '../data/surabaya.js';
import { go } from '../router.js';

const M = PASAR.meta;
const CARA = [
  `Harga kosmu dibandingkan dengan kos sejenis (putra, putri, atau campur) di kecamatan yang sama. Kalau kos sejenisnya kurang dari ${M.min_pembanding}, semua jenis kos di kecamatan itu ikut dibandingkan.`,
  'Harga pasaran adalah harga tengah (median), bukan rata-rata, jadi satu dua kos yang terlalu mahal atau murah tidak menggeser hasilnya.',
  'Disebut wajar kalau masuk separuh harga di tengah (kuartil 1 sampai 3). Di atasnya kemahalan, di bawahnya murah.',
  'Fasilitas tidak ikut dihitung karena datanya hanya mencatat ada atau tidaknya.',
  'Kalau data di suatu kecamatan belum cukup, KOZY bilang belum ada data. Kami tidak menebak.',
];

export default function Tentang() {
  return (
    <div className="page narrow">
      <PageHead judul="Cara kerja KOZY" onBack={() => (window.history.length > 1 ? window.history.back() : go('/'))} />
      <div className="prose">
        <p className="lead">Supaya kamu tidak membayar kos terlalu mahal.</p>
        <p>KOZY membandingkan harga kos incaranmu dengan kos sejenis di sekitarnya sebelum kamu transfer. Kami bukan tempat iklan, jadi penilaiannya netral.</p>

        <h2>Cara kami menghitung</h2>
        <ul className="check-list">
          {CARA.map((c) => (
            <li key={c}>
              <Icon name="check" size={16} strokeWidth={2.6} />
              {c}
            </li>
          ))}
        </ul>

        <h2>Batas data saat ini</h2>
        <p>
          Belum ada data luas kamar dan alamat persis, jadi titik di peta hanya perkiraan area. Baru {M.kecamatan} kecamatan yang datanya cukup untuk dinilai.
        </p>

        <h2>Netral</h2>
        <p>Kamu membayar untuk mengakses hasil analisis, bukan untuk memengaruhi penilaian. Pemilik kos tidak bisa membayar agar harganya dinilai wajar.</p>

        <Button onClick={() => go('/cek')} iconRight="arrowr">
          Cek harga kos
        </Button>
      </div>
    </div>
  );
}
