import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Button, ListRow, Sheet } from './ui.jsx';
import { useStore } from '../store.jsx';
import { rp } from '../lib/format.js';

// ---------- Proses analisis (4 baris progresif) ----------
export function ProcessSheet({ open, title, steps, active, error, onRetry, onEdit }) {
  return (
    <Sheet open={open} label={title} dismissable={!!error} onClose={onEdit}>
      {error ? (
        <div className="sheet-body center">
          <span className="ic-circle xl">
            <Icon name="cloudoff" size={28} strokeWidth={1.8} />
          </span>
          <h2 className="h2">Analisis gagal dimuat</h2>
          <p className="muted">{error} Isianmu tetap tersimpan.</p>
          <Button icon="refresh" block onClick={onRetry}>
            Coba Lagi
          </Button>
          <Button variant="ghost" block onClick={onEdit}>
            Ubah isian
          </Button>
        </div>
      ) : (
        <div className="sheet-body">
          <h2 className="h2">{title}</h2>
          <ol className="steps">
            {steps.map((s, i) => {
              const st = i < active ? 'done' : i === active ? 'run' : 'wait';
              return (
                <li key={i} className={`step step-${st}`}>
                  <span className="step-dot" aria-hidden="true">
                    {st === 'done' && <Icon name="check" size={13} strokeWidth={3} />}
                  </span>
                  <span>{s}</span>
                  <span className="sr-only">{st === 'done' ? 'selesai' : st === 'run' ? 'sedang berjalan' : 'menunggu'}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Sheet>
  );
}

// ---------- Masuk (Google one-tap + persetujuan UU PDP) ----------
// Catatan integrasi: ganti handler `masuk` dengan Google Identity Services saat backend auth siap.
export function LoginPanel({ judul = 'Masuk dulu, ya', alasan, onDone }) {
  const { set, toast } = useStore();
  const [setuju, setSetuju] = useState(false);
  const masuk = () => {
    const user = { nama: 'Pengguna KOZY', email: 'akun.google@gmail.com', consent_pdp_at: new Date().toISOString() };
    set({ user });
    toast('Berhasil masuk');
    onDone?.(user);
  };
  return (
    <div className="sheet-body">
      <span className="ic-circle lg">
        <Icon name="user" size={22} />
      </span>
      <div>
        <h2 className="h2">{judul}</h2>
        <p className="muted">{alasan}</p>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
        Saya setuju data saya diproses sesuai UU Pelindungan Data Pribadi.
      </label>
      <button type="button" className="btn btn-google btn-block" disabled={!setuju} onClick={masuk}>
        <span className="g-mark">G</span>
        <span>Lanjutkan dengan Google</span>
      </button>
    </div>
  );
}

// ---------- QRIS ----------
// Catatan integrasi: QR dan status pembayaran berasal dari payment gateway (mis. Midtrans/Xendit).
function QrPattern() {
  const cells = [];
  const finder = (r, c) => {
    for (const [r0, c0] of [[0, 0], [0, 18], [18, 0]]) {
      const y = r - r0, x = c - c0;
      if (y >= 0 && y < 7 && x >= 0 && x < 7) return { in: true, on: y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4) };
    }
    return { in: false };
  };
  let seed = 11;
  for (let r = 0; r < 25; r++)
    for (let c = 0; c < 25; c++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const f = finder(r, c);
      const on = f.in ? f.on : (seed >> 9) % 2 === 0;
      if (on) cells.push(<rect key={`${r}-${c}`} x={c} y={r} width="1.02" height="1.02" />);
    }
  return (
    <svg viewBox="-1 -1 27 27" className="qr" role="img" aria-label="Kode QRIS">
      <rect x="-1" y="-1" width="27" height="27" fill="#fff" />
      <g fill="#0F172A">{cells}</g>
    </svg>
  );
}

function useCountdown(active, detik = 15 * 60) {
  const [sisa, setSisa] = useState(detik);
  useEffect(() => {
    if (!active) return;
    setSisa(detik);
    const t = setInterval(() => setSisa((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [active, detik]);
  return `${String(Math.floor(sisa / 60)).padStart(2, '0')}:${String(sisa % 60).padStart(2, '0')}`;
}

// ---------- KOZY Verified (survei lapangan) ----------
export const HARGA_VERIFIED = 75_000;

export function VerifiedCard() {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="list-card">
        <ListRow icon="shieldc" title="Mau lebih yakin sebelum transfer?" sub="KOZY Verified · survei lapangan" onClick={() => setOpen(true)} />
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} label="KOZY Verified">
        <div className="sheet-body">
          <span className="ic-circle lg">
            <Icon name="shieldc" size={22} />
          </span>
          <h2 className="h2">KOZY Verified</h2>
          <p className="price-line">
            <b>{rp(HARGA_VERIFIED)}</b> per kos
          </p>
          <ul className="check-list">
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Foto kamar terbaru dari tim lapangan
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Pengecekan kepemilikan kos
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Laporan risiko penipuan
            </li>
          </ul>
          <Button
            block
            onClick={() => {
              setOpen(false);
              toast('Permintaan survei terkirim');
            }}
          >
            Ajukan survei
          </Button>
          <Button variant="ghost" block onClick={() => setOpen(false)}>
            Nanti saja
          </Button>
        </div>
      </Sheet>
    </>
  );
}

// ---------- Paywall KOZY Match ----------
export const HARGA_MATCH = 19_900;

export function Paywall({ open, onClose, onPaid, purchaseId }) {
  const { state, set } = useStore();
  const [tahap, setTahap] = useState('tawar');
  const [cek, setCek] = useState(false);
  const waktu = useCountdown(open && tahap === 'qris');
  useEffect(() => {
    if (open) setTahap('tawar');
  }, [open]);

  const lanjutBayar = () => setTahap(state.user ? 'qris' : 'login');
  const cekStatus = () => {
    setCek(true);
    setTimeout(() => {
      setCek(false);
      setTahap('sukses');
      set((s) => ({ paid: { ...s.paid, [purchaseId]: true } }));
      setTimeout(() => onPaid?.(), 900);
    }, 900);
  };

  return (
    <Sheet open={open} onClose={onClose} label="KOZY Match" dismissable={tahap !== 'sukses'}>
      {tahap === 'tawar' && (
        <div className="sheet-body">
          <span className="ic-circle lg">
            <Icon name="unlock" size={22} />
          </span>
          <h2 className="h2">Buka KOZY Match</h2>
          <p className="price-line">
            <b>{rp(HARGA_MATCH)}</b> sekali cek
          </p>
          <ul className="check-list">
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Peta 5 kos dengan harga wajar
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Kontak pemilik yang sudah diverifikasi
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.6} />
              Kartu Tawar untuk nego harga
            </li>
          </ul>
          <Button icon="qr" block onClick={lanjutBayar}>
            Bayar dengan QRIS
          </Button>
          <p className="note center">Kamu membayar untuk akses hasil, bukan untuk mengubah penilaian.</p>
        </div>
      )}
      {tahap === 'login' && <LoginPanel alasan="Supaya hasil yang kamu beli tersimpan di akunmu." onDone={() => setTahap('qris')} />}
      {tahap === 'qris' && (
        <div className="sheet-body center">
          <h2 className="h2">Scan untuk membayar</h2>
          <p className="price-line">
            <b>{rp(HARGA_MATCH)}</b>
          </p>
          <div className="qr-box">
            <QrPattern />
            <span className="qr-merchant">KOZY · QRIS</span>
          </div>
          <p className="timer">
            Selesaikan dalam <b>{waktu}</b>
          </p>
          <Button block icon={cek ? undefined : 'refresh'} disabled={cek} onClick={cekStatus}>
            {cek ? 'Memeriksa…' : 'Cek status pembayaran'}
          </Button>
          <p className="note">Bisa dibayar dari m-banking atau e-wallet apa pun.</p>
        </div>
      )}
      {tahap === 'sukses' && (
        <div className="sheet-body center">
          <div className="success-dot">
            <Icon name="check" size={32} strokeWidth={3} />
          </div>
          <h2 className="h2">Pembayaran berhasil</h2>
          <p className="muted">Membuka hasilmu…</p>
        </div>
      )}
    </Sheet>
  );
}
