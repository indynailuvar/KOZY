import Icon from '../components/Icon.jsx';
import { Button, PageHead } from '../components/ui.jsx';
import { go } from '../router.js';

const CARA = [
  'Kami mengumpulkan ribuan iklan kos di Surabaya, lalu membersihkan data ganda.',
  'Model hedonic memperkirakan pengaruh kawasan, jenis kos, fasilitas, luas kamar, dan akses ke tempat penting.',
  'Harga dibandingkan dengan minimal 15 kos serupa dalam radius 800 m. Jika kurang, area diperluas dan hasilnya diberi tanda keyakinan rendah.',
  'Harga yang janggal disaring sebelum dipakai sebagai pembanding.',
];

export default function Tentang() {
  return (
    <div className="page narrow">
      <PageHead judul="Tentang KOZY" />
      <div className="prose">
        <p className="lead">Supaya kamu tidak membayar kos terlalu mahal.</p>
        <p>
          KOZY membantu siapa pun yang mencari kos di Surabaya, dari mahasiswa, pekerja, tenaga kesehatan, guru, hingga penyewa dengan kebutuhan akses khusus, menilai apakah harga sewa
          masuk akal sebelum transfer uang. KOZY bukan tempat iklan kos. Kami menilai harganya dan membantu kamu memilih.
        </p>

        <h2>Cara kami menghitung</h2>
        <ul className="check-list">
          {CARA.map((c) => (
            <li key={c}>
              <Icon name="check" size={16} strokeWidth={2.6} />
              {c}
            </li>
          ))}
        </ul>

        <h2>Netral</h2>
        <p>Kamu membayar untuk mengakses hasil analisis, bukan untuk memengaruhi penilaian. Pemilik kos tidak bisa membayar agar harganya dinilai wajar.</p>

        <Button onClick={() => go('/cek')} iconRight="arrowr">
          Cek harga kos
        </Button>
      </div>
    </div>
  );
}
