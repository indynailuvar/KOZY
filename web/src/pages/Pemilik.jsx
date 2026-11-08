// Sisi pemilik kos (B2B).
//
// Satu kos hampir tidak pernah punya satu harga saja — biasanya ada beberapa tipe
// kamar dengan harga dan fasilitas berbeda. Karena itu klaim dan dashboardnya
// bekerja per tipe kamar, bukan per kos, dan tiap tipe punya foto 4 sisinya sendiri
// yang bisa diputar calon penyewa seperti di Google Maps.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Kamar360, { jumlahSisi } from '../components/Kamar360.jsx';
import { DaftarTipe, EditorTipe, galatTipe, tipeBaru } from '../components/TipeKamar.jsx';
import Lembar from '../components/Lembar.jsx';
import Belum from '../components/Belum.jsx';
import HeroHarga from '../components/HeroHarga.jsx';
import { Angka, BarH, Kartu } from '../components/Grafik.jsx';
import { fasilitasTertinggal, pencari, persaingan, saranTarget } from '../api/pemilik.js';
import { AmountInput, Banner, Button, InfoTip, Options, PageHead, Question, Segmented, Sheet, StatusBadge, Wizard } from '../components/ui.jsx';
import { LoginPanel } from '../components/Sheets.jsx';
import { OPSI_JENIS } from './CekWizard.jsx';
import { analisisPemilik, fasilitasById, jenisById, kawasanById, kenaliLokasi, saranLokasi } from '../api/kozy.js';
import { ringkasFoto } from '../lib/foto.js';
import { daftar, rp, rpRentang, rpSigned, rpSingkat, tanggal } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

function badgeSvg(kawasan) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">
<rect x="4" y="4" width="192" height="192" rx="24" fill="#fff" stroke="#0A7585" stroke-width="4"/>
<text x="100" y="40" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" font-weight="800" font-size="16" fill="#0A7585" letter-spacing="4">KOZY</text>
<circle cx="100" cy="86" r="26" fill="#E9F6F7"/><path d="M100 67l14 5v10c0 10-14 17-14 17s-14-7-14-17V72z" fill="none" stroke="#0A7585" stroke-width="3" stroke-linejoin="round"/><path d="M93 84l5 5 9-9" fill="none" stroke="#0A7585" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<text x="100" y="136" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" font-weight="800" font-size="17" fill="#0F172A" letter-spacing="1">Harga Wajar</text>
<text x="100" y="156" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" font-weight="600" font-size="10" fill="#64748B">Terverifikasi KOZY</text>
<text x="100" y="180" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" font-weight="600" font-size="9" fill="#94A3B8">${kawasan} · ${tanggal(new Date().toISOString())}</text>
</svg>`;
}

// Klaim versi lama hanya menyimpan satu harga. Dibungkus jadi satu tipe supaya
// pemilik yang sudah terlanjur klaim tidak kehilangan datanya.
export function rapikanPemilik(p) {
  if (!p) return null;
  if (Array.isArray(p.tipe)) return p;
  return { ...p, tipe: [{ ...tipeBaru(0), nama: 'Tipe A', harga: p.harga || 0, fasilitas: p.fasilitas || [], kamar: 1, sisa: 1 }], harga: undefined, fasilitas: undefined };
}

const TOTAL = 4;

function Klaim() {
  const { state, set, toast } = useStore();
  const [step, setStep] = useState(1);
  const [lokasi, setLokasi] = useState('');
  const [jenis, setJenis] = useState(null);
  const [tipe, setTipe] = useState([]);
  const [edit, setEdit] = useState(null);
  const [file, setFile] = useState(null);
  const [setuju, setSetuju] = useState(false);
  const [coba, setCoba] = useState(false);
  const [sheet, setSheet] = useState(null); // 'login' | 'verif'
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const lok = useMemo(() => kenaliLokasi(lokasi), [lokasi]);
  const saran = lok.status === 'ok' ? [] : saranLokasi(lokasi);
  const galat = {
    1:
      lok.status === 'ok'
        ? null
        : lok.status === 'luar'
          ? 'KOZY baru mencakup Kota Surabaya.'
          : lok.status === 'belum-data'
            ? `Data kos di Kec. ${lok.kawasan.kec} belum cukup, jadi harganya belum bisa dinilai.`
            : 'Pilih dari saran di bawah atau tempel link Google Maps.',
    2: jenis ? null : 'Pilih jenis kos.',
    3: !tipe.length ? 'Tambah minimal satu tipe kamar.' : (tipe.map(galatTipe).find(Boolean) ?? null),
    4: !file ? 'Unggah bukti kepemilikan dulu.' : !setuju ? 'Centang persetujuan data dulu.' : null,
  };

  const verifikasi = () => {
    setSheet('verif');
    timer.current = setTimeout(() => {
      set({ pemilik: { kawasanId: lok.kawasan.id, jenis, tipe, bukti: file.name } });
      setSheet(null);
      toast(`Kosmu sudah terverifikasi, ${tipe.length} tipe kamar`);
    }, 1400);
  };
  const lanjut = () => {
    setCoba(true);
    if (galat[step]) return;
    setCoba(false);
    if (step < TOTAL) setStep(step + 1);
    else if (state.user) verifikasi();
    else setSheet('login');
  };
  const kembali = () => {
    setCoba(false);
    if (step > 1) setStep(step - 1);
    else go('/');
  };
  const err = coba ? galat[step] : null;

  const simpanTipe = (t) => {
    setTipe((a) => (a.some((x) => x.id === t.id) ? a.map((x) => (x.id === t.id ? t : x)) : [...a, t]));
    setEdit(null);
  };

  return (
    <>
      <Wizard
        judul="Daftarkan kosmu"
        langkah={step}
        total={TOTAL}
        onBack={kembali}
        footer={
          <Button block iconRight={step < TOTAL ? 'arrowr' : undefined} onClick={lanjut}>
            {step < TOTAL ? 'Lanjut' : 'Kirim'}
          </Button>
        }
      >
        {step === 1 && (
          <>
            <Question judul="Di mana kosmu?" sub="Kami bandingkan harga tiap tipe kamarmu dengan kos sejenis di sekitarnya." />
            <label className={`field lg ${err ? 'is-err' : ''}`}>
              <Icon name="search" size={20} />
              <input value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="Nama daerah atau link Google Maps" aria-label="Lokasi kos" autoComplete="off" />
            </label>
            {saran.length > 0 && (
              <ul className="pick-rows" aria-label="Saran lokasi">
                {saran.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setLokasi(s.label)}>
                      <Icon name="pin" size={18} />
                      <span>
                        <b>{s.label}</b>
                        <small>{s.sub}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {lok.status === 'ok' && (
              <p className="picked">
                <Icon name="checkc" size={16} /> <b>{lok.kawasan.nama}</b>, Kec. {lok.kawasan.kec}
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <Question judul="Kosmu untuk siapa?" />
            <Options label="Jenis kos" kolom={3} value={jenis} onChange={setJenis} options={OPSI_JENIS} />
          </>
        )}
        {step === 3 && (
          <>
            <Question judul="Ada tipe kamar apa saja?" sub="Kalau semua kamar sama, cukup satu tipe." />
            <DaftarTipe tipe={tipe} onUbah={setEdit} onTambah={() => setEdit({ ...tipeBaru(tipe.length), baru: true })} />
          </>
        )}
        {step === 4 && (
          <>
            <Question judul="Unggah bukti kepemilikan" sub="Foto sertifikat atau PBB, izin usaha kos, atau fotomu di depan papan nama kos." />
            <label className={`drop ${file ? 'has-file' : ''}`}>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <span className="ic-circle">
                <Icon name={file ? 'file' : 'upload'} size={20} />
              </span>
              <span className="drop-t">
                <b>{file ? file.name : 'Pilih foto atau PDF'}</b>
                <small>{file ? 'Ketuk untuk ganti' : 'Maksimal 5 MB'}</small>
              </span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
              Saya setuju data saya diproses sesuai UU Pelindungan Data Pribadi.
            </label>
          </>
        )}
        {err && (
          <p className="err" id="wz-err" role="alert">
            {err}
          </p>
        )}
      </Wizard>

      <EditorTipe
        open={!!edit}
        awal={edit || tipeBaru(0)}
        onSimpan={simpanTipe}
        onBatal={() => setEdit(null)}
        onHapus={
          edit && !edit.baru
            ? () => {
                setTipe((a) => a.filter((x) => x.id !== edit.id));
                setEdit(null);
              }
            : null
        }
      />
      <Sheet open={sheet === 'login'} onClose={() => setSheet(null)} label="Masuk">
        <LoginPanel alasan="Kos yang kamu daftarkan tersimpan di akunmu." onDone={verifikasi} />
      </Sheet>
      <Sheet open={sheet === 'verif'} dismissable={false} label="Memverifikasi">
        <div className="sheet-body center">
          <span className="spinner lg" />
          <h2 className="h2">Memeriksa bukti…</h2>
          <p className="muted">Sebentar, ya.</p>
        </div>
      </Sheet>
    </>
  );
}

// ───────────────────────────────── Siapa yang mencari kos di daerah ini
// Datanya berasal dari pencarian pengguna di aplikasi, jadi awalnya kosong dan
// terisi sendiri seiring pemakaian. Umur, gaji, dan jumlah kendaraan TIDAK
// pernah dikumpulkan — itu disebutkan terus terang, bukan dikarang.
function ProfilPencari({ kec }) {
  const u = useMemo(() => pencari(kec), [kec]);
  return (
    <>
      <Angka
        items={[
          { nilai: u.nPencarian, label: 'orang mencari kos' },
          { nilai: u.nCek, label: 'cek harga di sini' },
          { nilai: u.butuhAkses, label: 'butuh akses kursi roda' },
        ]}
      />
      {u.kosong ? (
        <Belum keadaan="kosong" judul="Belum ada yang mencari kos di sini">
          Akan terisi saat ada orang memakai Cari Kos atau Cek Harga di daerah ini.
        </Belum>
      ) : (
        <>
          {u.persona.length > 0 && (
            <Kartu judul="Siapa yang mencari" sub="Dari pilihan mereka saat mencari kos">
              <BarH data={u.persona} format={(v) => `${v} orang`} label="Kalangan pencari kos" />
            </Kartu>
          )}
          {u.budget && (
            <Kartu judul={`Budget umum pencari ${rp(u.budget.p50)}`} sub={`Dari ${u.budget.n} pencarian`}>
              <dl className="trio">
                <div>
                  <dt>Hemat</dt>
                  <dd>{rpSingkat(u.budget.p25)}</dd>
                </div>
                <div>
                  <dt>Umum</dt>
                  <dd>{rpSingkat(u.budget.p50)}</dd>
                </div>
                <div>
                  <dt>Longgar</dt>
                  <dd>{rpSingkat(u.budget.p75)}</dd>
                </div>
              </dl>
            </Kartu>
          )}
          {u.jenisDicari.length > 0 && (
            <Kartu judul="Jenis kos yang dicari" sub="Putra, putri, atau campur">
              <BarH data={u.jenisDicari} format={(v) => `${v}`} label="Jenis kos yang dicari" />
            </Kartu>
          )}
        </>
      )}

      <p className="note">KOZY tidak menanyakan umur, gaji, atau kendaraan pencari.</p>
    </>
  );
}

// ───────────────────────────────── Persaingan di kecamatan yang sama
function Persaingan({ kec, jenis, semua }) {
  const c = useMemo(() => persaingan(kec, jenis), [kec, jenis]);
  if (!c) return <Belum keadaan="kosong" judul={`Belum ada data kos di Kec. ${kec}`} />;
  const labelJenis = jenisById(jenis)?.label.toLowerCase() || 'sejenis';
  const fas = Object.entries(c.fasilitas).map(([id, v]) => ({ label: fasilitasById(id)?.label || id, nilai: v }))
    .sort((a, b) => b.nilai - a.nilai);
  fas[0].sorot = true;
  return (
    <>
      <Angka
        items={[
          { nilai: c.nSejenis, label: `pesaing kos ${labelJenis}` },
          { nilai: c.hargaSejenis ? rpSingkat(c.hargaSejenis.p50) : '–', label: 'harga pasaran' },
        ]}
      />
      {/* Daftar, bukan grafik batang: satu tipe yang harganya salah ketik
          (mis. 20 jt) membuat batang lain menyusut jadi garis tipis. */}
      {semua.length > 0 && (
        <section className="kelompok">
          <p className="sec-label">
            Posisi tipe kamarmu
          </p>
          <div className="list-card">
            {semua.map((x) => (
              <div className="tipe-pos" key={x.id}>
                <span className="lr-t">
                  <b>{x.nama}</b>
                  <small>{rp(x.harga)}</small>
                </span>
                <StatusBadge status={x.a.status} size="sm" />
              </div>
            ))}
          </div>
        </section>
      )}
      <Kartu judul={`${fas[0].nilai}% pesaing punya ${fas[0].label}`}>
        <BarH data={fas} format={(v) => `${v}%`} label="Fasilitas yang dimiliki pesaing" />
      </Kartu>
    </>
  );
}

// ───────────────────────────────── Saran penargetan
function SaranTarget({ kec, tipe, jenis, semua }) {
  const saran = useMemo(() => saranTarget(kec, tipe, jenis, semua), [kec, tipe, jenis, semua]);
  const tertinggal = useMemo(() => fasilitasTertinggal(kec, tipe), [kec, tipe]);
  if (!saran.length && !tertinggal.length) return <Belum keadaan="kosong" judul="Belum ada saran" syarat="lengkapi tipe kamar dan harganya dulu." />;
  return (
    <>
      {saran.length > 0 && (
        <div className="list-card">
          {saran.map((x, i) => (
            <div className="saran-row" key={i}>
              <span className="ic-circle sm">
                <Icon name={x.icon} size={16} />
              </span>
              <span>
                <b>{x.judul}</b>
                <small>{x.isi}</small>
              </span>
            </div>
          ))}
        </div>
      )}
      {tertinggal.length > 0 && (
        <Kartu judul={`${tertinggal[0].pasar}% pesaing punya ${tertinggal[0].label}, kamu belum`}>
          <BarH data={tertinggal.map((t) => ({ label: t.label, nilai: t.pasar }))} format={(v) => `${v}%`} label="Fasilitas yang tertinggal" />
        </Kartu>
      )}
    </>
  );
}

function Dashboard() {
  const { state, set, toast } = useStore();
  const p = state.pemilik;
  const k = kawasanById(p.kawasanId);
  const jenis = jenisById(p.jenis);
  const [pilih, setPilih] = useState(p.tipe[0]?.id);
  const [edit, setEdit] = useState(null);

  const t = p.tipe.find((x) => x.id === pilih) || p.tipe[0];
  const a = useMemo(() => analisisPemilik({ kawasanId: p.kawasanId, jenis: p.jenis, harga: t.harga }), [p.kawasanId, p.jenis, t]);
  // tiap tipe dinilai sendiri; badge baru boleh kalau tidak ada satu pun yang kemahalan
  const semua = useMemo(
    () => p.tipe.map((x) => ({ ...x, a: analisisPemilik({ kawasanId: p.kawasanId, jenis: p.jenis, harga: x.harga }) })),
    [p.kawasanId, p.jenis, p.tipe],
  );
  const kemahalan = semua.filter((x) => x.a.status === 'KEMAHALAN');
  const bolehBadge = kemahalan.length === 0;
  // kotak angka kedua di bawah gauge: yang perlu dilakukan pemilik
  const saranHarga =
    a.status === 'KEMAHALAN'
      ? { label: 'Turunkan', nilai: rp(t.harga - a.kisaran[1]), nada: 't-red' }
      : a.status === 'MURAH'
        ? { label: 'Bisa naik ke', nilai: rp(a.kisaran[1]), nada: 't-green' }
        : { label: 'Selisih', nilai: Math.abs(t.harga - a.median) < 10_000 ? 'Sama' : rpSigned(t.harga - a.median) };

  const totalKamar = p.tipe.reduce((x, y) => x + (y.kamar || 0), 0);
  const totalSisa = p.tipe.reduce((x, y) => x + (y.sisa || 0), 0);
  const harga = p.tipe.map((x) => x.harga).filter(Boolean);
  const foto = ringkasFoto(p.tipe);

  const simpanTipe = (baru) => {
    set({ pemilik: { ...p, tipe: p.tipe.some((x) => x.id === baru.id) ? p.tipe.map((x) => (x.id === baru.id ? baru : x)) : [...p.tipe, baru] } });
    setPilih(baru.id);
    setEdit(null);
    toast(`${baru.nama} tersimpan`);
  };
  const hapusTipe = () => {
    if (p.tipe.length < 2) return toast('Minimal harus ada satu tipe kamar');
    const sisa = p.tipe.filter((x) => x.id !== edit.id);
    set({ pemilik: { ...p, tipe: sisa } });
    setPilih(sisa[0].id);
    setEdit(null);
  };
  const unduh = () => {
    const url = URL.createObjectURL(new Blob([badgeSvg(k.nama)], { type: 'image/svg+xml' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = 'kozy-badge-harga-wajar.svg';
    el.click();
    URL.revokeObjectURL(url);
    toast('Badge diunduh');
  };

  return (
    <div className="page">
      <PageHead judul="Kosku" sub={`${k.nama}, ${k.kec}${jenis ? ` · Kos ${jenis.label.toLowerCase()}` : ''}`} onBack={() => go('/akun')} aksi={<span className="tag-ok">Terverifikasi</span>} />

      {/* Halaman ini TIDAK pernah menaut ke dashboard internal KOZY di
          #/internal, dan tidak memuat satu pun angka dari sana. Yang dibaca
          pemilik hanyalah pasarnya sendiri: siapa yang mencari kos di
          daerahnya dan dia bersaing dengan siapa. */}
      <Lembar
        label="Dashboard pemilik"
        lembar={[
          {
            id: 'kos',
            judul: 'Ringkasan',
            isi: (
              <>
        <dl className="trio angka-dulu">
          <div>
            <dt>tipe kamar</dt>
            <dd>{p.tipe.length}</dd>
          </div>
          <div>
            <dt>kamar kosong</dt>
            <dd>
              {totalSisa}
              <small>/{totalKamar}</small>
            </dd>
          </div>
          <div>
            <dt>rentang harga</dt>
            <dd>{harga.length ? rpRentang(Math.min(...harga), Math.max(...harga)) : '–'}</dd>
          </div>
        </dl>
        {kemahalan.length > 0 && (
          <Banner tone="warn" icon="alert" title={`${daftar(kemahalan.map((x) => x.nama))} kemahalan`}>
            Turunkan harganya agar badge Harga Wajar bisa diunduh.
          </Banner>
        )}
        <section className="card">
          <div className="card-row">
            <h2 className="card-t">Tipe kamar</h2>
            {foto.jumlah > 0 && <span className="muted small">{foto.jumlah} foto</span>}
          </div>
          <DaftarTipe tipe={p.tipe} onUbah={setEdit} onTambah={() => setEdit({ ...tipeBaru(p.tipe.length), baru: true })} />
        </section>
              </>
            ),
          },
          {
            id: 'harga',
            judul: 'Harga',
            isi: (
              <>
        {p.tipe.length > 1 && (
          <div className="tipe-pick">
            <Segmented label="Lihat analisis tipe" value={t.id} onChange={setPilih} options={p.tipe.map((x) => ({ id: x.id, label: x.nama }))} />
          </div>
        )}
        {jumlahSisi(t.foto) > 0 && (
          <section className="card">
            <h2 className="card-t">Foto {t.nama}</h2>
            <p className="card-s">Begini calon penyewa melihat kamarnya. Bisa diputar ke empat sisi.</p>
            <Kamar360 foto={t.foto} nama={t.nama} tinggi="sm" />
          </section>
        )}
        <HeroHarga
          status={a.status}
          nilai={a.median}
          rentang={a.kisaran}
          harga={t.harga}
          labelHarga={t.nama}
          selisih={saranHarga}
          ringkas={`${t.nama}: harga ${a.status.toLowerCase()}. Harga pasaran ${rp(a.median)}.`}
        />
        <p className="owner-basis">
          {a.n} kos {a.pembanding.jenis ? `${jenis.label.toLowerCase()} ` : ''}di Kec. {a.kec}
          <InfoTip label="Cara menghitung">
            Harga pasaran adalah harga tengah iklan kos sejenis di kecamatan yang sama. Kisaran wajar adalah separuh harga di tengahnya (kuartil 1 sampai 3). Fasilitas tidak ikut dihitung karena iklan hanya mencatat ada atau tidaknya.
          </InfoTip>
          <button type="button" className="text-btn" onClick={() => setEdit(t)}>
            Ubah harga
          </button>
        </p>
              </>
            ),
          },
          {
            id: 'badge',
            judul: 'Badge',
            isi: (
              <>
        <section className="card">
          <h2 className="card-t">Badge Harga Wajar</h2>
          <div className="badge-row">
            <div className="fpb" dangerouslySetInnerHTML={{ __html: badgeSvg(k.nama) }} aria-hidden="true" />
            <div>
              <p className="muted small">
                {bolehBadge ? (
                  'Pasang di iklan atau pintu kos. Diperbarui tiap bulan dan tidak bisa dibeli.'
                ) : (
                  <>
                    Turunkan {daftar(kemahalan.map((x) => x.nama))} ke <b>{rpSingkat(kemahalan[0].a.kisaran[1])}</b> agar bisa mendapatkannya.
                  </>
                )}
              </p>
              <Button icon="download" size="sm" variant="secondary" disabled={!bolehBadge} onClick={unduh}>
                Unduh badge
              </Button>
            </div>
          </div>
        </section>
              </>
            ),
          },
          {
            id: 'pencari',
            judul: 'Pencari',
            isi: (
              <>
                <ProfilPencari kec={k.kec} />
              </>
            ),
          },
          {
            id: 'saing',
            judul: 'Pesaing',
            isi: (
              <>
                <Persaingan kec={k.kec} jenis={p.jenis} semua={semua} />
              </>
            ),
          },
          {
            id: 'target',
            judul: 'Saran',
            isi: (
              <>
                <SaranTarget kec={k.kec} tipe={p.tipe} jenis={p.jenis} semua={semua} />
              </>
            ),
          },
        ]}
      />

      <EditorTipe open={!!edit} awal={edit || tipeBaru(0)} onSimpan={simpanTipe} onBatal={() => setEdit(null)} onHapus={edit && !edit.baru ? hapusTipe : null} />

      <button type="button" className="text-btn center" onClick={() => set({ pemilik: null })}>
        Ganti kos
      </button>
    </div>
  );
}

export default function Pemilik() {
  const { state, set } = useStore();
  // klaim lama (satu harga) dibungkus jadi satu tipe sekali saat halaman dibuka
  useEffect(() => {
    if (state.pemilik && !Array.isArray(state.pemilik.tipe)) set({ pemilik: rapikanPemilik(state.pemilik) });
  }, [state.pemilik, set]);
  if (!state.pemilik) return <Klaim />;
  if (!Array.isArray(state.pemilik.tipe)) return null;
  return <Dashboard />;
}
