import { ListRow, PageHead } from '../components/ui.jsx';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

// Halaman internal untuk presentasi (tidak ditautkan di menu): buka lewat #/demo
const SKENARIO = [
  { label: 'Kos kemahalan', sub: 'Keputih · putri · Rp 1.100.000', draft: { lokasiTeks: 'Keputih', harga: 1_100_000, jenis: 'putri', fasilitas: ['km', 'ac'], luas: 12 } },
  { label: 'Kos wajar', sub: 'Ketintang · putra · Rp 700.000', draft: { lokasiTeks: 'Ketintang', harga: 700_000, jenis: 'putra', fasilitas: ['km', 'wifi'], luas: 9 } },
  { label: 'Jauh di bawah pasaran', sub: 'Keputih · putri · Rp 500.000', draft: { lokasiTeks: 'Keputih', harga: 500_000, jenis: 'putri', fasilitas: ['km', 'ac', 'wifi'], luas: 12 } },
  { label: 'Data sedikit', sub: 'Pakal · campur · Rp 750.000', draft: { lokasiTeks: 'Pakal', harga: 750_000, jenis: 'campur', fasilitas: ['km', 'ac', 'wifi'], luas: 12 } },
  { label: 'Di luar cakupan', sub: 'Waru, Sidoarjo', draft: { lokasiTeks: 'Waru, Sidoarjo' } },
  { label: 'Gagal memuat', sub: 'Koneksi terputus', draft: { lokasiTeks: 'https://maps.app.goo.gl/error-demo', harga: 900_000, jenis: 'putra', fasilitas: ['km'] } },
];

const SKENARIO_CARI = [
  { label: 'Tenaga kesehatan dekat RS', sub: 'RSUD Dr. Soetomo · putri', draft: { persona: 'nakes', dekat: ['rs', 'pasar'], tujuanId: 'rs-soetomo', budgetMin: 600_000, budgetMax: 1_200_000, jenis: 'putri', fasilitas: ['km', 'ac'], disabilitas: false } },
  { label: 'Mahasiswa ITS, budget terbatas', sub: 'ITS Sukolilo · Rp 500 – 800 rb', draft: { persona: 'mahasiswa', dekat: ['kampus'], tujuanId: 'its', budgetMin: 500_000, budgetMax: 800_000, jenis: null, fasilitas: ['km', 'ac'], disabilitas: false } },
  { label: 'Pekerja ramah disabilitas', sub: 'Tunjungan · transportasi umum', draft: { persona: 'pekerja', dekat: ['kantor', 'transportasi'], tujuanId: 'tunjungan', budgetMin: 700_000, budgetMax: 1_500_000, jenis: null, fasilitas: ['km'], disabilitas: true } },
];

export default function Demo() {
  const { set, toast } = useStore();
  return (
    <div className="page narrow">
      <PageHead judul="Skenario" sub="Formulir terisi otomatis, tinggal tekan Lanjut." />
      <p className="sec-label">Cek harga</p>
      <div className="list-card">
        {SKENARIO.map((s) => (
          <ListRow
            key={s.label}
            icon="calc"
            title={s.label}
            sub={s.sub}
            onClick={() => {
              set({ draftCek: s.draft });
              go('/cek');
            }}
          />
        ))}
      </div>
      <p className="sec-label">Cari kos</p>
      <div className="list-card">
        {SKENARIO_CARI.map((s) => (
          <ListRow
            key={s.label}
            icon="search"
            title={s.label}
            sub={s.sub}
            onClick={() => {
              set({ draftCari: s.draft });
              go('/cari');
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="text-btn center"
        onClick={() => {
          try {
            localStorage.removeItem('kozy:v2');
          } catch {
            /* abaikan */
          }
          toast('Data lokal dihapus');
          setTimeout(() => window.location.reload(), 400);
        }}
      >
        Reset semua data lokal
      </button>
    </div>
  );
}
