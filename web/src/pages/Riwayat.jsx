import Icon from '../components/Icon.jsx';
import { Button, EmptyState, PageHead, StatusBadge } from '../components/ui.jsx';
import { tanggal } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

export default function Riwayat() {
  const { state, set, toast } = useStore();
  const items = state.riwayat;

  const buka = (it) => {
    if (it.jenis === 'cek') {
      set({ cek: it.data });
      go('/hasil');
    } else {
      set({ cari: it.data });
      go('/kawasan');
    }
  };

  if (items.length === 0)
    return (
      <div className="page narrow">
        <PageHead judul="Riwayat" />
        <EmptyState icon="history" title="Belum ada riwayat" action={<Button onClick={() => go('/cek')}>Cek Harga</Button>}>
          Hasil cek harga dan pencarian kosmu akan muncul di sini.
        </EmptyState>
      </div>
    );

  return (
    <div className="page narrow">
      <PageHead
        judul="Riwayat"
        sub={`${items.length} hasil tersimpan`}
        aksi={
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              set({ riwayat: [] });
              toast('Riwayat dihapus');
            }}
          >
            Hapus semua
          </button>
        }
      />
      <div className="list-card">
        {items.map((it) => (
          <button key={it.id} type="button" className="lr" onClick={() => buka(it)}>
            <span className="ic-circle">
              <Icon name={it.jenis === 'cek' ? 'calc' : 'search'} size={19} />
            </span>
            <span className="lr-t">
              <b>{it.judul}</b>
              <small>
                {it.jenis === 'cek' ? 'Cek harga' : 'Cari kos'} · {tanggal(it.dibuat)}
              </small>
            </span>
            {it.status ? <StatusBadge status={it.status} size="sm" /> : <Icon name="right" size={18} className="lr-go" />}
          </button>
        ))}
      </div>
      {!state.user && <p className="note center">Riwayat tersimpan di perangkat ini.</p>}
    </div>
  );
}
