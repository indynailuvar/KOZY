import Icon from '../components/Icon.jsx';
import { Button, PageHead } from '../components/ui.jsx';
import { PASAR } from '../data/surabaya.js';
import { rp, tanggal } from '../lib/format.js';
import { go } from '../router.js';

const M = PASAR.meta;
const CARA = [
  `Kami mengumpulkan iklan kos di Surabaya. Saat ini terkumpul ${M.n} iklan dari ${M.sumber}, diambil ${tanggal(M.diambil)}.`,
  'Model hedonic memperkirakan pengaruh kecamatan, jenis kos, dan tiap fasilitas terhadap harga.',
  `Saat diuji ulang dengan data yang tidak dipakai melatih, perkiraan model meleset rata-rata ± ${rp(M.mae)} (${M.mape}%). Angka itu kami tampilkan apa adanya.`,
  'Harga disebut wajar kalau selisihnya di bawah 15% dari perkiraan, seukuran meleset khas model. Di luar itu baru ditandai kemahalan atau murah.',
  'Kalau data di suatu kecamatan belum terkumpul, KOZY bilang belum ada data. Kami tidak menebak.',
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

        <h2>Batas data saat ini</h2>
        <p>
          Sumber data belum memuat luas kamar, alamat persis, dan nomor pemilik. Karena itu KOZY tidak menghitung luas kamar, titik di peta hanya perkiraan area, dan kami
          mengarahkan kamu ke iklan aslinya. Fasilitas yang dihitung baru {PASAR.model && Object.keys(PASAR.model.fasilitas).length} jenis, yaitu yang memang tercatat di iklan.
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
