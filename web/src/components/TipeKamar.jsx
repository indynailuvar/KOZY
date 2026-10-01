// Tipe kamar untuk sisi pemilik (B2B).
//
// Satu kos jarang hanya punya satu harga: biasanya ada beberapa tipe kamar dengan
// harga dan fasilitas yang berbeda. Di sini pemilik mengelola tiap tipe secara
// terpisah — nama, harga, jumlah kamar, fasilitas, dan foto 4 sisinya sendiri.
//
// Layar utamanya sengaja dibuat ringkas: hanya daftar tipe dan satu tombol tambah.
// Semua isian yang banyak itu masuk ke lembar terpisah, jadi tidak menumpuk.
import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Kamar360, { SISI, jumlahSisi } from './Kamar360.jsx';
import { AmountInput, Button, LineInput, Sheet, Tiles } from './ui.jsx';
import { FASILITAS } from '../data/surabaya.js';
import { siapkanFoto } from '../lib/foto.js';
import { rp } from '../lib/format.js';

export const tipeBaru = (n = 0) => ({
  id: `t${Date.now().toString(36)}${n}`,
  nama: `Tipe ${String.fromCharCode(65 + n)}`,
  harga: 0,
  kamar: 1,
  sisa: 1,
  fasilitas: [],
  foto: {},
});

export const galatTipe = (t) => {
  if (!t.nama.trim()) return 'Beri nama tipe kamarnya.';
  if (t.harga < 100_000) return 'Harga minimal Rp 100.000.';
  if (t.kamar < 1) return 'Jumlah kamar minimal 1.';
  if (t.sisa > t.kamar) return 'Kamar kosong tidak boleh lebih banyak daripada jumlah kamar.';
  return null;
};

// ---------- satu petak unggah foto ----------
function PetakFoto({ sisi, url, onPilih, onHapus }) {
  const id = useId();
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState(null);

  const ambil = async (file) => {
    if (!file) return;
    setSibuk(true);
    setGalat(null);
    try {
      const { dataUrl } = await siapkanFoto(file);
      onPilih(dataUrl);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className={`fslot ${url ? 'has-foto' : ''}`}>
      <label htmlFor={id}>
        {url ? <img src={url} alt={`Foto sisi ${sisi.label.toLowerCase()} yang sudah diunggah`} /> : <Icon name={sibuk ? 'refresh' : 'camera'} size={20} />}
        <b>{sisi.label}</b>
        <input id={id} type="file" accept="image/*" capture="environment" onChange={(e) => ambil(e.target.files?.[0])} />
      </label>
      {url && (
        <button type="button" className="fslot-x" onClick={onHapus} aria-label={`Hapus foto sisi ${sisi.label.toLowerCase()}`}>
          <Icon name="x" size={14} />
        </button>
      )}
      {galat && (
        <p className="fslot-err" role="alert">
          {galat}
        </p>
      )}
    </div>
  );
}

// ---------- lembar isian satu tipe ----------
export function EditorTipe({ open, awal, onSimpan, onBatal, onHapus }) {
  const [t, setT] = useState(awal);
  const [coba, setCoba] = useState(false);
  const galat = galatTipe(t);
  const isi = (patch) => setT((x) => ({ ...x, ...patch }));
  const terisi = jumlahSisi(t.foto);

  useEffect(() => {
    if (open) {
      setT(awal);
      setCoba(false);
    }
  }, [open, awal]);

  return (
    <Sheet open={open} onClose={onBatal} label={`Ubah ${t.nama || 'tipe kamar'}`} className="sheet-tall">
      <div className="sheet-body left">
        <h2 className="h2">{awal.baru ? 'Tambah tipe kamar' : 'Ubah tipe kamar'}</h2>

        <LineInput id="tipe-nama" label="Nama tipe" hint="misal Tipe A, Kamar AC, Lantai 2" value={t.nama} onChange={(v) => isi({ nama: v })} placeholder="Tipe A" />

        <div className="line-f">
          <label htmlFor="tipe-harga">Harga sewa per bulan</label>
          <AmountInput id="tipe-harga" label="Harga sewa per bulan" prefix="Rp" value={t.harga} onChange={(v) => isi({ harga: v })} placeholder="0" />
        </div>

        <div className="duo-in">
          <LineInput id="tipe-kamar" label="Jumlah kamar" value={String(t.kamar)} inputMode="numeric" onChange={(v) => isi({ kamar: Math.max(0, Number(v.replace(/\D/g, '')) || 0) })} suffix="kamar" />
          <LineInput
            id="tipe-sisa"
            label="Masih kosong"
            value={String(t.sisa)}
            inputMode="numeric"
            onChange={(v) => isi({ sisa: Math.max(0, Number(v.replace(/\D/g, '')) || 0) })}
            suffix="kamar"
          />
        </div>
        <p className="note">Angka kamar kosong ini yang dilihat calon penyewa, jadi perbarui kalau ada yang masuk atau keluar.</p>

        <p className="kd-label">Fasilitas tipe ini</p>
        <Tiles
          label="Fasilitas tipe kamar"
          values={t.fasilitas}
          options={FASILITAS}
          onToggle={(id) => isi({ fasilitas: t.fasilitas.includes(id) ? t.fasilitas.filter((x) => x !== id) : [...t.fasilitas, id] })}
        />

        <p className="kd-label">
          Foto 4 sisi kamar <span className="kd-count">{terisi}/4</span>
        </p>
        <p className="note">Berdiri di tengah kamar, lalu foto ke empat arah. Calon penyewa bisa memutar pandangannya seperti di Google Maps.</p>
        <div className="fslots">
          {SISI.map((s) => (
            <PetakFoto key={s.id} sisi={s} url={t.foto[s.id]} onPilih={(url) => isi({ foto: { ...t.foto, [s.id]: url } })} onHapus={() => isi({ foto: { ...t.foto, [s.id]: null } })} />
          ))}
        </div>
        {terisi > 0 && terisi < 4 && <p className="note">Boleh disimpan sekarang, tapi pandangan berputarnya baru lengkap kalau keempat sisinya ada.</p>}
        {terisi > 0 && (
          <>
            <p className="kd-label">Pratinjau</p>
            <Kamar360 foto={t.foto} nama={t.nama || 'kamar'} tinggi="sm" />
          </>
        )}

        {coba && galat && (
          <p className="err" role="alert">
            {galat}
          </p>
        )}
        <Button
          block
          onClick={() => {
            setCoba(true);
            if (!galat) onSimpan({ ...t, baru: undefined });
          }}
        >
          Simpan tipe
        </Button>
        {onHapus && (
          <Button variant="ghost" block onClick={onHapus}>
            Hapus tipe ini
          </Button>
        )}
        <Button variant="ghost" block onClick={onBatal}>
          Batal
        </Button>
      </div>
    </Sheet>
  );
}

// ---------- daftar tipe di layar wizard / dashboard ----------
export function DaftarTipe({ tipe, onUbah, onTambah, batas = 8 }) {
  return (
    <div className="tipe-list">
      {tipe.map((t) => {
        const n = jumlahSisi(t.foto);
        return (
          <button key={t.id} type="button" className="tipe-card" onClick={() => onUbah(t)}>
            <span className="tipe-thumb">
              {t.foto?.depan || t.foto?.kanan || t.foto?.belakang || t.foto?.kiri ? (
                <img src={t.foto.depan || t.foto.kanan || t.foto.belakang || t.foto.kiri} alt="" />
              ) : (
                <Icon name="camera" size={18} />
              )}
            </span>
            <span className="tipe-t">
              <b>{t.nama}</b>
              <small>
                {t.harga ? rp(t.harga) : 'Harga belum diisi'} · {t.sisa}/{t.kamar} kamar kosong · {n}/4 foto
              </small>
            </span>
            <Icon name="right" size={18} />
          </button>
        );
      })}
      {tipe.length < batas && (
        <button type="button" className="tipe-add" onClick={onTambah}>
          <Icon name="plus" size={18} />
          Tambah tipe kamar
        </button>
      )}
    </div>
  );
}
