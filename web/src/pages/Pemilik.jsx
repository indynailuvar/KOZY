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
import { Angka, BarH, Kartu } from '../components/Grafik.jsx';
import { TIDAK_DIKUMPULKAN, fasilitasTertinggal, pencari, persaingan, saranTarget } from '../api/pemilik.js';
import { AmountInput, Banner, Button, InfoTip, Options, PageHead, Question, Segmented, Sheet, StatusBadge, Switch, Wizard } from '../components/ui.jsx';
import { LoginPanel } from '../components/Sheets.jsx';
import { OPSI_JENIS } from './CekWizard.jsx';
import { analisisPemilik, fasilitasById, jenisById, kawasanById, kenaliLokasi, saranLokasi } from '../api/kozy.js';
import { BIAYA_FASILITAS, DATA_UPDATED } from '../data/surabaya.js';
import { ringkasFoto } from '../lib/foto.js';
import { bulat10rb, daftar, rp, rpSingkat, tanggal } from '../lib/format.js';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

function Gauge({ persentil }) {
  const r = 80;
  const panjang = Math.PI * r;
  const a = Math.PI * (1 - persentil / 100);
  const x = 100 + r * Math.cos(a);
  const y = 100 - r * Math.sin(a);
  return (
    <svg viewBox="0 0 200 128" className="gauge" role="img" aria-label={`Lebih mahal dari ${persentil} dari 100 kos serupa`}>
      <path d="M20 100 A80 80 0 0 1 180 100" className="g-bg" pathLength={panjang} />
      <path d="M20 100 A80 80 0 0 1 180 100" className="g-fg" strokeDasharray={`${(panjang * persentil) / 100} ${panjang}`} />
      <circle cx={x} cy={y} r="9" className="g-knob" />
      <text x="100" y="92" textAnchor="middle" className="g-num">
        {persentil}
      </text>
      <text x="20" y="124" textAnchor="middle" className="g-lab">
        Murah
      </text>
      <text x="180" y="124" textAnchor="middle" className="g-lab">
        Mahal
      </text>
    </svg>
  );
}

function badgeSvg(kawasan) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">
<rect x="4" y="4" width="192" height="192" rx="24" fill="#fff" stroke="#2563EB" stroke-width="4"/>
<text x="100" y="40" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" font-weight="800" font-size="16" fill="#2563EB" letter-spacing="4">KOZY</text>
<circle cx="100" cy="86" r="26" fill="#EFF4FF"/><path d="M100 67l14 5v10c0 10-14 17-14 17s-14-7-14-17V72z" fill="none" stroke="#2563EB" stroke-width="3" stroke-linejoin="round"/><path d="M93 84l5 5 9-9" fill="none" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<text x="100" y="136" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" font-weight="800" font-size="17" fill="#0F172A" letter-spacing="1">Harga Wajar</text>
<text x="100" y="156" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" font-weight="600" font-size="10" fill="#64748B">Terverifikasi KOZY</text>
<text x="100" y="180" text-anchor="middle" font-family="Plus Jakarta Sans, Arial" font-weight="600" font-size="9" fill="#94A3B8">${kawasan} · ${tanggal(DATA_UPDATED)}</text>
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
          ? 'Saat ini KOZY baru mencakup Kota Surabaya.'
          : lok.status === 'belum-data'
            ? `Data kos di Kec. ${lok.kawasan.kec} belum terkumpul, jadi harganya belum bisa dinilai.`
            : 'Pilih lokasi dari saran atau tempel link Google Maps.',
    2: jenis ? null : 'Pilih jenis kos.',
    3: !tipe.length ? 'Tambah minimal satu tipe kamar.' : (tipe.map(galatTipe).find(Boolean) ?? null),
    4: !file ? 'Unggah bukti kepemilikan dulu.' : !setuju ? 'Centang persetujuan data pribadi.' : null,
  };

  const verifikasi = () => {
    setSheet('verif');
    timer.current = setTimeout(() => {
      set({ pemilik: { kawasanId: lok.kawasan.id, jenis, tipe, bukti: file.name } });
      setSheet(null);
      toast(`Kos kamu berhasil diverifikasi · ${tipe.length} tipe kamar`);
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
        judul="Klaim kos kamu"
        langkah={step}
        total={TOTAL}
        onBack={kembali}
        footer={
          <Button block iconRight={step < TOTAL ? 'arrowr' : undefined} onClick={lanjut}>
            {step < TOTAL ? 'Lanjut' : 'Kirim klaim'}
          </Button>
        }
      >
        {step === 1 && (
          <>
            <Question judul="Di mana kos kamu?" sub="Lihat posisi harga tiap tipe kamar dan dapatkan badge harga wajar." />
            <label className={`field lg ${err ? 'is-err' : ''}`}>
              <Icon name="search" size={20} />
              <input value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="Link Google Maps atau nama daerah" aria-label="Lokasi kos" autoComplete="off" />
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
            <Question judul="Kos kamu untuk siapa?" />
            <Options label="Jenis kos" value={jenis} onChange={setJenis} options={OPSI_JENIS} />
          </>
        )}
        {step === 3 && (
          <>
            <Question judul="Ada tipe kamar apa saja?" sub="Tiap tipe punya harga, fasilitas, dan fotonya sendiri. Kalau kosmu seragam, satu tipe saja cukup." />
            <DaftarTipe tipe={tipe} onUbah={setEdit} onTambah={() => setEdit({ ...tipeBaru(tipe.length), baru: true })} />
          </>
        )}
        {step === 4 && (
          <>
            <Question judul="Unggah bukti kepemilikan" sub="Foto sertifikat/PBB, izin usaha kos, atau foto papan nama kos bersama kamu." />
            <label className={`drop ${file ? 'has-file' : ''}`}>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <span className="ic-circle">
                <Icon name={file ? 'file' : 'upload'} size={20} />
              </span>
              <span className="drop-t">
                <b>{file ? file.name : 'Pilih foto atau PDF'}</b>
                <small>{file ? 'Ketuk untuk mengganti' : 'Maksimal 5 MB'}</small>
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
        <LoginPanel alasan="Klaim kos terhubung ke akunmu." onDone={verifikasi} />
      </Sheet>
      <Sheet open={sheet === 'verif'} dismissable={false} label="Memverifikasi">
        <div className="sheet-body center">
          <span className="spinner lg" />
          <h2 className="h2">Memeriksa bukti…</h2>
          <p className="muted">Mohon tunggu sebentar.</p>
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
          { nilai: u.nPencarian, label: 'orang mencari kos', sub: 'lewat Cari Kos' },
          { nilai: u.nCek, label: `cek harga di Kec. ${kec}`, sub: 'kos incaran dinilai' },
          { nilai: u.butuhAkses, label: 'butuh akses disabilitas', sub: 'dari yang mencari' },
        ]}
      />
      {u.kosong ? (
        <Belum keadaan="kosong" judul="Belum ada yang mencari kos di sini" syarat="satu orang saja memakai Cari Kos atau Cek Harga, angkanya langsung muncul di sini.">
          Profil pencari dihitung dari pemakaian aplikasi, bukan dari survei. Jadi angkanya nol sampai ada yang memakainya — bukan karena tidak ada peminat.
        </Belum>
      ) : (
        <>
          {u.persona.length > 0 && (
            <Kartu judul="Kalangan yang mencari" sub="Dari persona yang dipilih saat mencari kos">
              <BarH data={u.persona} format={(v) => `${v} orang`} label="Kalangan pencari kos" />
            </Kartu>
          )}
          {u.budget && (
            <Kartu judul={`Budget tengah pencari ${rp(u.budget.p50)}`} sub={`Dari ${u.budget.n} pencarian. Ini gambaran kemampuan bayar yang paling dekat yang dimiliki aplikasi`}>
              <dl className="trio">
                <div>
                  <dt>Hemat (p25)</dt>
                  <dd>{rpSingkat(u.budget.p25)}</dd>
                </div>
                <div>
                  <dt>Tengah</dt>
                  <dd>{rpSingkat(u.budget.p50)}</dd>
                </div>
                <div>
                  <dt>Longgar (p75)</dt>
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

      <Belum keadaan="mustahil" judul="Umur, gaji, dan jumlah kendaraan tidak tersedia" syarat="ketiganya harus ditanyakan dulu di aplikasi, dan itu menambah langkah bagi pencari kos.">
        {TIDAK_DIKUMPULKAN.map((x) => x.label).join(', ')} tidak pernah dikumpulkan KOZY. Yang paling mendekati gambaran kemampuan bayar adalah <b>budget</b> yang dipasang pencari.
      </Belum>
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
          { nilai: c.nSejenis, label: `kos ${labelJenis} jadi pesaing langsung`, sub: `dari ${c.n} kos yang harganya terdata` },
          { nilai: c.hargaSejenis ? rpSingkat(c.hargaSejenis.p50) : '–', label: 'harga tengah pesaing', sub: c.hargaSejenis ? `${rpSingkat(c.hargaSejenis.p25)} – ${rpSingkat(c.hargaSejenis.p75)}` : 'belum ada harganya' },
        ]}
      />
      {semua.length > 0 && (
        <Kartu
          judul="Harga kamu dibanding harga wajarnya, semua tipe sekaligus"
          sub="Harga wajar dihitung dengan menahan kecamatan, jenis kos, dan fasilitas tiap tipe tetap sama"
        >
          <BarH
            data={semua.map((x) => ({ label: x.nama, nilai: Math.round(x.a.selisih_persen), sub: `wajarnya ${rpSingkat(x.a.harga_wajar)}`, sorot: x.a.status === 'KEMAHALAN' }))}
            format={(v) => (v > 0 ? `${v}% di atas wajar` : `${Math.abs(v)}% di bawah wajar`)}
            label="Selisih harga tiap tipe terhadap harga wajarnya"
          />
        </Kartu>
      )}
      <Kartu judul={`${fas[0].nilai}% pesaing punya ${fas[0].label}`} sub="Fasilitas yang sudah jadi standar di kecamatan ini">
        <BarH data={fas} format={(v) => `${v}%`} label="Fasilitas yang dimiliki pesaing" />
      </Kartu>
    </>
  );
}

// ───────────────────────────────── Saran penargetan
function SaranTarget({ kec, tipe, jenis, semua }) {
  const saran = useMemo(() => saranTarget(kec, tipe, jenis, semua), [kec, tipe, jenis, semua]);
  const tertinggal = useMemo(() => fasilitasTertinggal(kec, tipe), [kec, tipe]);
  if (!saran.length) return <Belum keadaan="kosong" judul="Belum ada saran" syarat="lengkapi tipe kamar dan harga dulu." />;
  return (
    <>
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
      {tertinggal.length > 0 && (
        <Kartu judul="Fasilitas yang sudah umum di sini tapi belum kamu punya" sub="Persentase pesaing yang sudah menyediakannya">
          <BarH data={tertinggal.map((t) => ({ label: t.label, nilai: t.pasar, sub: `harga wajar ${t.efek > 0 ? '+' : ''}${t.efek}%` }))} format={(v) => `${v}%`} label="Fasilitas yang tertinggal" />
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
  const [tambah, setTambah] = useState([]);
  const [semuaSim, setSemuaSim] = useState(false);

  const t = p.tipe.find((x) => x.id === pilih) || p.tipe[0];
  const a = useMemo(() => analisisPemilik({ kawasanId: p.kawasanId, jenis: p.jenis, fasilitas: t.fasilitas, harga: t.harga }), [p.kawasanId, p.jenis, t]);
  // tiap tipe dinilai sendiri; badge baru boleh kalau tidak ada satu pun yang kemahalan
  const semua = useMemo(
    () => p.tipe.map((x) => ({ ...x, a: analisisPemilik({ kawasanId: p.kawasanId, jenis: p.jenis, fasilitas: x.fasilitas, harga: x.harga }) })),
    [p.kawasanId, p.jenis, p.tipe],
  );
  const kemahalan = semua.filter((x) => x.a.status === 'KEMAHALAN');
  const bolehBadge = kemahalan.length === 0;

  const sim = a.simulasi.filter((s) => tambah.includes(s.id));
  const simTambah = sim.reduce((x, s) => x + s.tambah, 0);
  const simBiaya = sim.reduce((x, s) => x + BIAYA_FASILITAS[s.id], 0);

  const totalKamar = p.tipe.reduce((x, y) => x + (y.kamar || 0), 0);
  const totalSisa = p.tipe.reduce((x, y) => x + (y.sisa || 0), 0);
  const harga = p.tipe.map((x) => x.harga).filter(Boolean);
  const foto = ringkasFoto(p.tipe);

  useEffect(() => setTambah([]), [pilih]);

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
      <PageHead judul="Kos kamu" sub={`${k.nama}, ${k.kec}${jenis ? ` · Kos ${jenis.label.toLowerCase()}` : ''}`} aksi={<span className="tag-ok">Terverifikasi</span>} />

      {/* Halaman ini TIDAK pernah menaut ke dashboard internal KOZY di
          #/internal, dan tidak memuat satu pun angka dari sana. Yang dibaca
          pemilik hanyalah pasarnya sendiri: siapa yang mencari kos di
          daerahnya dan dia bersaing dengan siapa. */}
      <Lembar
        label="Dashboard pemilik"
        lembar={[
          {
            id: 'kos',
            judul: 'Kos kamu',
            isi: (
              <>
        <section className="card">
          <h2 className="card-t">Ringkasan kos</h2>
          <dl className="trio">
            <div>
              <dt>Tipe kamar</dt>
              <dd>{p.tipe.length}</dd>
            </div>
            <div>
              <dt>Kamar kosong</dt>
              <dd>
                {totalSisa}
                <small>dari {totalKamar}</small>
              </dd>
            </div>
            <div>
              <dt>Rentang harga</dt>
              <dd>{harga.length ? (Math.min(...harga) === Math.max(...harga) ? rpSingkat(harga[0]) : `${rpSingkat(Math.min(...harga))}–${rpSingkat(Math.max(...harga))}`) : '–'}</dd>
            </div>
          </dl>
        </section>
        {kemahalan.length > 0 && (
          <Banner tone="warn" icon="alert" title={`${kemahalan.length} tipe kamar di atas harga pasaran`}>
            {daftar(kemahalan.map((x) => x.nama))} harganya di atas kewajaran kecamatan ini. Badge Harga Wajar baru bisa diunduh kalau semua tipe sudah wajar.
          </Banner>
        )}
        <section className="card">
          <div className="card-row">
            <h2 className="card-t">Tipe kamar</h2>
            <span className="muted small">{foto.jumlah ? `${foto.jumlah} foto${foto.kb ? ` · ${foto.kb} KB` : ''}` : 'belum ada foto'}</span>
          </div>
          <DaftarTipe tipe={p.tipe} onUbah={setEdit} onTambah={() => setEdit({ ...tipeBaru(p.tipe.length), baru: true })} />
        </section>
              </>
            ),
          },
          {
            id: 'harga',
            judul: 'Posisi harga',
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
            <p className="card-s">Beginilah calon penyewa melihat kamarnya — bisa diputar ke empat sisi.</p>
            <Kamar360 foto={t.foto} nama={t.nama} tinggi="sm" />
          </section>
        )}
        <section className="card owner-pos">
          <div className="card-row">
            <h2 className="card-t">Posisi harga {t.nama}</h2>
            <StatusBadge status={a.status} size="sm" />
          </div>
          <Gauge persentil={a.persentil} />
          <p className="center muted">
            Lebih mahal dari <b>{a.persentil} dari 100</b> kos serupa
          </p>
          <dl className="duo">
            <div>
              <dt>Harga kamu</dt>
              <dd>
                {rp(t.harga)}
                <button type="button" className="text-btn sm" onClick={() => setEdit(t)}>
                  Ubah
                </button>
              </dd>
            </div>
            <div>
              <dt>Harga wajar</dt>
              <dd className="t-blue">{rp(a.harga_wajar)}</dd>
            </div>
          </dl>
          <p className="v-basis">
            {a.n} iklan kos di Kec. {a.kec} · data {tanggal(DATA_UPDATED)}
            <InfoTip label="Cara menghitung">Dihitung dari iklan kos di kecamatan yang sama, dengan jenis kos dan fasilitas tipe ini.</InfoTip>
          </p>
        </section>
              </>
            ),
          },
          {
            id: 'naik',
            judul: 'Menaikkan harga',
            isi: (
              <>
        {a.simulasi.length > 0 && (
          <section className="card">
            <h2 className="card-t">Kalau {t.nama} ditambah fasilitas</h2>
            <p className="card-s">Nyalakan untuk melihat perkiraan harga wajar yang baru.</p>
            <div className="switch-list">
              {(semuaSim ? a.simulasi : [...a.simulasi].sort((x, y) => y.tambah - x.tambah).slice(0, 4)).map((s) => (
                <Switch
                  key={s.id}
                  label={s.label}
                  sub={`Harga wajar naik ± ${rpSingkat(s.tambah)}/bulan · ${s.punya_pct}% kos di kecamatan ini punya`}
                  checked={tambah.includes(s.id)}
                  onChange={() => setTambah((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id]))}
                />
              ))}
            </div>
            {a.simulasi.length > 4 && (
              <button type="button" className="text-btn" onClick={() => setSemuaSim((v) => !v)}>
                {semuaSim ? 'Tampilkan lebih sedikit' : `Lihat semua ${a.simulasi.length} fasilitas`}
              </button>
            )}
            {sim.length > 0 && (
              <div className="sim-res">
                <p>
                  Dengan {daftar(sim.map((s) => s.label))}, harga wajar {t.nama} menjadi <b>{rp(bulat10rb(a.harga_wajar + simTambah))}</b>.
                </p>
                <small>
                  Perkiraan biaya {rp(simBiaya)} per kamar · balik modal ± {Math.ceil(simBiaya / simTambah)} bulan
                </small>
              </div>
            )}
          </section>
        )}
        <section className="card">
          <h2 className="card-t">Badge Harga Wajar</h2>
          <div className="badge-row">
            <div className="fpb" dangerouslySetInnerHTML={{ __html: badgeSvg(k.nama) }} aria-hidden="true" />
            <div>
              <p className="muted small">
                {bolehBadge ? (
                  'Pasang di iklan atau pintu kos. Badge tidak bisa dibeli dan diperbarui tiap bulan.'
                ) : (
                  <>
                    Turunkan {daftar(kemahalan.map((x) => x.nama))} ke maksimal <b>{rp(bulat10rb(kemahalan[0].a.harga_wajar * 1.1))}</b> untuk mendapatkannya.
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
            judul: 'Siapa yang cari',
            isi: (
              <>
                <ProfilPencari kec={k.kec} />
              </>
            ),
          },
          {
            id: 'saing',
            judul: 'Persaingan',
            isi: (
              <>
                <Persaingan kec={k.kec} jenis={p.jenis} semua={semua} />
              </>
            ),
          },
          {
            id: 'target',
            judul: 'Saran penargetan',
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
