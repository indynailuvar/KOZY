import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, EmptyState, ListRow, PageHead, StatusBadge } from '../components/ui.jsx';
import { Paywall } from '../components/Sheets.jsx';
import { bulat10rb, persen, rp, tanggal } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

function kalimatTawar(t) {
  const data = `Menurut data KOZY dari ${t.n} kos serupa dalam ${t.radius}, harga wajar kamar ini sekitar ${rp(t.harga_wajar)}/bulan.`;
  if (t.status === 'KEMAHALAN') {
    const target = bulat10rb(t.harga_wajar + (t.harga - t.harga_wajar) * 0.15);
    return [data, `Harga ${rp(t.harga)} lebih mahal dari ${t.persentil}% kos sejenis di sekitar sini.`, `Apakah bisa ${rp(target)}/bulan kalau saya langsung bayar 6 bulan?`];
  }
  if (t.status === 'CEK') {
    return [data, 'Harganya jauh di bawah kos serupa, jadi saya ingin memastikan dulu.', 'Apakah harga ini sudah termasuk listrik, air, dan WiFi? Boleh saya lihat kamarnya sebelum membayar?'];
  }
  if (t.status === 'WAJAR') {
    const target = bulat10rb(Math.min(t.harga, t.harga_wajar) * 0.97);
    return [data, 'Harganya sudah wajar dan saya serius ingin menyewa.', `Apakah bisa ${rp(target)}/bulan kalau saya bayar 6 bulan di depan?`];
  }
  return [data, 'Harganya sudah bagus, saya ingin segera booking.', 'Apakah ada biaya tambahan di luar sewa, seperti listrik, air, atau parkir?'];
}

const kode = (id) => `KZ-${Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36).toUpperCase().slice(0, 6)}`;

export default function KartuTawar() {
  const { state, toast } = useStore();
  const [bayar, setBayar] = useState(false);
  const t = state.tawar;
  const kembali = () => go(t?.dari === 'cari' ? '/match?dari=cari' : '/hasil');

  if (!t)
    return (
      <div className="page narrow">
        <EmptyState icon="file" title="Belum ada Kartu Tawar" action={<Button onClick={() => go('/cek')}>Cek Harga</Button>}>
          Cek harga kos incaranmu dulu, lalu buat Kartu Tawar dari hasilnya.
        </EmptyState>
      </div>
    );

  if (!state.paid[t.purchaseId])
    return (
      <div className="page narrow">
        <PageHead judul="Kartu Tawar" onBack={kembali} />
        <EmptyState
          icon="lock"
          title="Kartu Tawar terkunci"
          action={
            <Button icon="lock" onClick={() => setBayar(true)}>
              Buka dengan KOZY Match
            </Button>
          }
        >
          Buka untuk mendapatkan kartu berisi data harga dan kalimat untuk menawar.
        </EmptyState>
        <Paywall open={bayar} purchaseId={t.purchaseId} onClose={() => setBayar(false)} onPaid={() => setBayar(false)} />
      </div>
    );

  const kalimat = kalimatTawar(t);
  const salin = async (teks) => {
    try {
      await navigator.clipboard.writeText(teks);
      toast('Kalimat disalin');
    } catch {
      toast('Tidak bisa menyalin otomatis. Tahan teks untuk menyalin.');
    }
  };
  const bagikan = () => {
    const teks = `Kartu Tawar KOZY\n${t.nama} (${t.kawasan})\nHarga dari pemilik: ${rp(t.harga)}\nHarga wajar: ${rp(t.harga_wajar)}\n\n${kalimat.join('\n')}\n\nCek: kozy.id/v/${kode(t.purchaseId)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank', 'noopener');
  };

  return (
    <div className="page narrow">
      <div className="no-print">
        <PageHead judul="Kartu Tawar" sub="Tunjukkan kartu ini ke pemilik saat menawar." onBack={kembali} />
      </div>

      <div className="printable">
        <article className="kartu">
          <header className="kartu-h">
            <span className="kartu-logo">KOZY</span>
            <span>{tanggal(t.updated_at)}</span>
          </header>
          <div className="kartu-top">
            <div>
              <b>{t.nama}</b>
              <span>{t.kawasan}, Surabaya</span>
            </div>
            <StatusBadge status={t.status} size="sm" />
          </div>
          <dl className="duo">
            <div>
              <dt>Harga dari pemilik</dt>
              <dd>{rp(t.harga)}</dd>
            </div>
            <div>
              <dt>Harga wajar</dt>
              <dd className="t-blue">{rp(t.harga_wajar)}</dd>
            </div>
          </dl>
          <p className="kartu-diff">
            Selisih {t.selisih_rp < 0 ? '−' : '+'}
            {rp(t.selisih_rp)} ({persen(t.selisih_persen)}) · dari {t.n} kos serupa
          </p>
          <footer className="kartu-f">
            <Icon name="qr" size={16} />
            Cek keaslian: kozy.id/v/{kode(t.purchaseId)}
          </footer>
        </article>

        <p className="sec-label">Kalimat untuk menawar</p>
        <ol className="phrases">
          {kalimat.map((k, i) => (
            <li key={i}>
              <span className="phrase-n">{i + 1}</span>
              <p>{k}</p>
              <button type="button" className="icon-btn sm no-print" aria-label={`Salin kalimat ${i + 1}`} onClick={() => salin(k)}>
                <Icon name="copy" size={17} />
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="btn-pair no-print">
        <Button variant="secondary" icon="download" onClick={() => window.print()}>
          Simpan PDF
        </Button>
        <Button icon="chat" onClick={bagikan}>
          Kirim via WA
        </Button>
      </div>
      <div className="list-card no-print">
        <ListRow icon="search" title={t.dari === 'cari' ? 'Kembali ke daftar kos' : 'Lihat 5 kos alternatif'} sub="Sudah termasuk di KOZY Match" href={`#/match?dari=${t.dari || 'cek'}`} />
      </div>
    </div>
  );
}
