import Kamar360 from '../components/Kamar360.jsx';
import { ListRow, PageHead } from '../components/ui.jsx';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

// Halaman internal untuk presentasi (tidak ditautkan di menu): buka lewat #/demo
const SKENARIO = [
  { label: 'Kos kemahalan', sub: 'Keputih · putri · Rp 1.900.000', draft: { lokasiTeks: 'Keputih', harga: 1_900_000, jenis: 'putri', fasilitas: ['km', 'ac', 'wifi', 'kasur'] } },
  { label: 'Kos wajar', sub: 'Semolowaru · putra · Rp 900.000', draft: { lokasiTeks: 'Semolowaru', harga: 900_000, jenis: 'putra', fasilitas: ['km', 'wifi', 'kasur'] } },
  { label: 'Jauh di bawah pasaran', sub: 'Keputih · putri · Rp 700.000', draft: { lokasiTeks: 'Keputih', harga: 700_000, jenis: 'putri', fasilitas: ['km', 'ac', 'wifi', 'kasur'] } },
  { label: 'Data sedikit', sub: 'Rungkut · campur · Rp 1.300.000', draft: { lokasiTeks: 'Rungkut', harga: 1_300_000, jenis: 'campur', fasilitas: ['km', 'wifi', 'kasur'] } },
  { label: 'Kecamatan belum ada data', sub: 'Babatan, Kec. Wiyung', draft: { lokasiTeks: 'Babatan' } },
  { label: 'Data kecamatan sedikit', sub: 'Ketintang, Kec. Gayungan · 3 iklan', draft: { lokasiTeks: 'Ketintang', jenis: 'putri', harga: 1_400_000 } },
  { label: 'Di luar cakupan', sub: 'Waru, Sidoarjo', draft: { lokasiTeks: 'Waru, Sidoarjo' } },
  { label: 'Gagal memuat', sub: 'Koneksi terputus', draft: { lokasiTeks: 'https://maps.app.goo.gl/error-demo', harga: 900_000, jenis: 'putra', fasilitas: ['km'] } },
];

// Contoh kos yang sudah diklaim pemiliknya, lengkap dengan foto 4 sisi.
// Foto kamar TIDAK ADA di keempat sumber scraping — Mamikos, Papikost, Google Maps,
// dan OLX sama-sama tidak membawanya. Di produk, foto hanya bisa datang dari
// pemilik yang mengunggahnya sendiri lewat halaman klaim. Skenario ini memakai
// berkas contoh di public/contoh-kamar/ supaya alur itu bisa dilihat tanpa
// harus mengunggah dulu, dan sengaja diberi nama "(contoh)" supaya tidak
// tertukar dengan kos betulan.
const FOTO_CONTOH = {
  depan: '/contoh-kamar/depan.webp',
  kanan: '/contoh-kamar/kanan.webp',
  belakang: '/contoh-kamar/belakang.webp',
  kiri: '/contoh-kamar/kiri.webp',
};

const KLAIM_CONTOH = {
  kawasanId: 'keputih',
  jenis: 'putri',
  bukti: 'sertifikat-contoh.pdf',
  tipe: [
    { id: 'demo-a', nama: 'Tipe AC (contoh)', harga: 1_250_000, kamar: 8, sisa: 2, fasilitas: ['km', 'ac', 'wifi', 'kasur'], foto: FOTO_CONTOH },
    { id: 'demo-b', nama: 'Tipe Standar (contoh)', harga: 750_000, kamar: 6, sisa: 5, fasilitas: ['wifi', 'kasur'], foto: {} },
  ],
};

const SKENARIO_CARI = [
  { label: 'Tenaga kesehatan dekat RS', sub: 'RSUD Dr. Soetomo · putri · maks. Rp 1,5 jt', draft: { persona: 'nakes', dekat: ['rs', 'pasar'], tujuanId: 'rs-soetomo', budgetMin: 600_000, budgetMax: 1_500_000, jenis: 'putri', fasilitas: ['km'], disabilitas: false } },
  { label: 'Mahasiswa ITS, budget terbatas', sub: 'ITS Sukolilo · Rp 500 – 900 rb', draft: { persona: 'mahasiswa', dekat: ['kampus'], tujuanId: 'its', budgetMin: 500_000, budgetMax: 900_000, jenis: null, fasilitas: ['wifi'], disabilitas: false } },
  { label: 'Pekerja butuh akses disabilitas', sub: 'MERR · maks. Rp 2 jt', draft: { persona: 'pekerja', dekat: ['kantor', 'transportasi'], tujuanId: 'merr-office', budgetMin: 700_000, budgetMax: 2_000_000, jenis: null, fasilitas: ['km'], disabilitas: true } },
];

export default function Demo({ query = {} }) {
  const { set, toast } = useStore();

  if (query.foto) {
    return (
      <div className="page narrow">
        <PageHead judul="Penampil kamar 4 sisi" sub="Foto contoh. Geser fotonya, atau pakai tombol di bawahnya." onBack={() => go('/demo')} />
        <Kamar360 foto={FOTO_CONTOH} nama="kamar contoh" tinggi="md" />
        <p className="note">
          Foto kamar tidak ada di satu pun sumber data hasil scraping. Di produk, foto hanya datang dari pemilik yang mengunggahnya sendiri lewat halaman klaim — berkas di sini
          cuma contoh untuk menguji tampilannya.
        </p>
      </div>
    );
  }

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
      <p className="sec-label">Sisi pemilik</p>
      <div className="list-card">
        <ListRow
          icon="camera"
          title="Kos sudah diklaim, dengan foto 4 sisi"
          sub="Keputih · 2 tipe kamar · Tipe AC punya foto lengkap"
          onClick={() => {
            set({ pemilik: KLAIM_CONTOH });
            go('/pemilik');
          }}
        />
        <ListRow
          icon="rotate"
          title="Lihat penampil 4 sisi saja"
          sub="Foto contoh, tanpa perlu klaim dulu"
          onClick={() => go('/demo?foto=1')}
        />
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
