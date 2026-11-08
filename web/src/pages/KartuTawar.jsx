import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, EmptyState, ListRow, PageHead, StatusBadge } from '../components/ui.jsx';
import { Paywall } from '../components/Sheets.jsx';
import { kalimatTawar } from '../api/ai.js';
import { persen, rp, rpRentang, tanggal } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

const kode = (id) => `KZ-${Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36).toUpperCase().slice(0, 6)}`;

export default function KartuTawar() {
  const { state, toast } = useStore();
  const [bayar, setBayar] = useState(false);
  const t = state.tawar;
  const kembali = () => go(t?.dari === 'cari' ? '/match?dari=cari' : '/hasil');

  // kartu yang tersimpan dari versi lama belum punya median dan kisaran pembanding
  if (!t || t.median == null)
    return (
      <div className="page narrow">
        <PageHead judul="Kartu Tawar" onBack={() => go('/')} />
        <EmptyState icon="file" title="Belum ada Kartu Tawar" action={<Button onClick={() => go('/cek')}>Cek harga</Button>}>
          Cek harga kos incaranmu dulu. Kartu Tawar dibuat dari hasilnya.
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
              Buka paket
            </Button>
          }
        >
          Isinya data harga pasaran dan kalimat untuk menawar ke pemilik.
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
      toast('Gagal menyalin. Tahan teksnya untuk menyalin manual.');
    }
  };
  const bagikan = () => {
    const teks = `Kartu Tawar KOZY\n${t.nama} (${t.kawasan})\nHarga dari pemilik: ${rp(t.harga)}\nHarga pasaran: ${rp(t.median)}\nKisaran wajar: ${rp(t.kisaran[0])}–${rp(t.kisaran[1])}\n\n${kalimat.join('\n')}\n\nCek keaslian: kozy.id/v/${kode(t.purchaseId)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank', 'noopener');
  };

  return (
    <div className="page narrow">
      <div className="no-print">
        <PageHead judul="Kartu Tawar" sub="Tunjukkan ke pemilik saat menawar" onBack={kembali} />
      </div>

      <div className="printable">
        <article className="kartu">
          <header className="kartu-h">
            <span className="kartu-logo">KOZY</span>
            <span>{tanggal(new Date().toISOString())}</span>
          </header>
          <div className="kartu-top">
            <div>
              <b>{t.nama}</b>
              <span>{t.kawasan}, Surabaya</span>
            </div>
            <StatusBadge status={t.status} size="sm" />
          </div>
          <div className="kartu-hero">
            <span>Harga pasaran</span>
            <b>{rp(t.median)}</b>
            <small>
              Kisaran wajar {rpRentang(t.kisaran[0], t.kisaran[1])}
            </small>
          </div>
          <dl className="kartu-rows">
            <div>
              <dt>Harga dari pemilik</dt>
              <dd>{rp(t.harga)}</dd>
            </div>
            <div>
              <dt>Dibanding harga pasaran</dt>
              <dd className={t.selisih_rp > 0 ? 't-red' : 't-green'}>{persen(t.selisih_persen)}</dd>
            </div>
          </dl>
          <p className="kartu-diff">
            {t.n} iklan kos {t.jenisPembanding ? `${t.jenisPembanding} ` : ''}di Kec. {t.kec}
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
          Kirim lewat WA
        </Button>
      </div>
      <div className="list-card no-print">
        <ListRow icon="search" title={t.dari === 'cari' ? 'Kembali ke daftar kos' : 'Lihat 5 kos lain'} sub="Sudah termasuk dalam paket" href={`#/match?dari=${t.dari || 'cek'}`} />
      </div>
    </div>
  );
}
