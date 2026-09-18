import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { AmountInput, Button, InfoTip, Options, PageHead, Question, Sheet, StatusBadge, Switch, Tiles, Wizard } from '../components/ui.jsx';
import { LoginPanel } from '../components/Sheets.jsx';
import { OPSI_JENIS } from './CekWizard.jsx';
import { analisisPemilik, jenisById, kawasanById, kenaliLokasi, saranLokasi } from '../api/kozy.js';
import { BIAYA_FASILITAS, DATA_UPDATED, FASILITAS } from '../data/surabaya.js';
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

const TOTAL = 5;

function Klaim() {
  const { state, set, toast } = useStore();
  const [step, setStep] = useState(1);
  const [lokasi, setLokasi] = useState('');
  const [jenis, setJenis] = useState(null);
  const [harga, setHarga] = useState(0);
  const [fasilitas, setFasilitas] = useState([]);
  const [file, setFile] = useState(null);
  const [setuju, setSetuju] = useState(false);
  const [coba, setCoba] = useState(false);
  const [sheet, setSheet] = useState(null); // 'login' | 'verif'
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const lok = useMemo(() => kenaliLokasi(lokasi), [lokasi]);
  const saran = lok.status === 'ok' ? [] : saranLokasi(lokasi);
  const galat = {
    1: lok.status === 'ok' ? null : lok.status === 'luar' ? 'Saat ini KOZY baru mencakup Kota Surabaya.' : 'Pilih lokasi dari saran atau tempel link Google Maps.',
    2: jenis ? null : 'Pilih jenis kos.',
    3: harga >= 100_000 ? null : 'Masukkan harga minimal Rp 100.000.',
    4: null,
    5: !file ? 'Unggah bukti kepemilikan dulu.' : !setuju ? 'Centang persetujuan data pribadi.' : null,
  };

  const verifikasi = () => {
    setSheet('verif');
    timer.current = setTimeout(() => {
      set({ pemilik: { kawasanId: lok.kawasan.id, jenis, harga, fasilitas, luas: null, bukti: file.name } });
      setSheet(null);
      toast('Kos kamu berhasil diverifikasi');
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
            <Question judul="Di mana kos kamu?" sub="Lihat posisi harga kos kamu dan dapatkan badge harga wajar." />
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
            <Question judul="Berapa harga sewanya?" sub="Harga per bulan yang kamu pasang saat ini." />
            <AmountInput id="harga-pemilik" label="Harga sewa per bulan" prefix="Rp" value={harga} onChange={setHarga} placeholder="0" />
            <p className="amount-note">per bulan</p>
          </>
        )}
        {step === 4 && (
          <>
            <Question judul="Fasilitas apa saja yang ada?" sub="Pilih semua yang tersedia di kamar." />
            <Tiles label="Fasilitas" values={fasilitas} options={FASILITAS} onToggle={(id) => setFasilitas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))} />
          </>
        )}
        {step === 5 && (
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
          <p className="err" role="alert">
            {err}
          </p>
        )}
      </Wizard>

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

function Dashboard() {
  const { state, set, toast } = useStore();
  const p = state.pemilik;
  const k = kawasanById(p.kawasanId);
  const [ubah, setUbah] = useState(false);
  const [hargaBaru, setHargaBaru] = useState(p.harga);
  const [tambah, setTambah] = useState([]);
  const [semuaSim, setSemuaSim] = useState(false);
  const a = useMemo(() => analisisPemilik(p), [p]);
  const sim = a.simulasi.filter((s) => tambah.includes(s.id));
  const simTambah = sim.reduce((x, s) => x + s.tambah, 0);
  const simBiaya = sim.reduce((x, s) => x + BIAYA_FASILITAS[s.id], 0);
  const bolehBadge = a.status !== 'KEMAHALAN';
  const jenis = jenisById(p.jenis);

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
    <div className="page narrow">
      <PageHead judul="Kos kamu" sub={`${k.nama}, ${k.kec}${jenis ? ` · Kos ${jenis.label.toLowerCase()}` : ''}`} aksi={<span className="tag-ok">Terverifikasi</span>} />

      <section className="card owner-pos">
        <div className="card-row">
          <h2 className="card-t">Posisi harga di pasar</h2>
          <StatusBadge status={a.status} size="sm" />
        </div>
        <Gauge persentil={a.persentil} />
        <p className="center muted">
          Lebih mahal dari <b>{a.persentil} dari 100</b> kos serupa
        </p>
        <dl className="duo">
          <div>
            <dt>Harga kamu</dt>
            {ubah ? (
              <dd>
                <form
                  className="inline-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (hargaBaru >= 100_000) set({ pemilik: { ...p, harga: hargaBaru } });
                    setUbah(false);
                  }}
                >
                  <AmountInput id="harga-baru" label="Harga sewa baru" value={hargaBaru} onChange={setHargaBaru} />
                  <button type="submit" className="text-btn">
                    Simpan
                  </button>
                </form>
              </dd>
            ) : (
              <dd>
                {rp(p.harga)}
                <button type="button" className="text-btn sm" onClick={() => setUbah(true)}>
                  Ubah
                </button>
              </dd>
            )}
          </div>
          <div>
            <dt>Harga wajar</dt>
            <dd className="t-blue">{rp(a.harga_wajar)}</dd>
          </div>
        </dl>
        <p className="v-basis">
          {a.n} kos pembanding · data {tanggal(DATA_UPDATED)}
          <InfoTip label="Cara menghitung">Harga wajar dihitung dari kos serupa di kawasan yang sama, dengan jenis dan fasilitas yang sama.</InfoTip>
        </p>
      </section>

      {a.simulasi.length > 0 && (
        <section className="card">
          <h2 className="card-t">Kalau kamu menambah fasilitas</h2>
          <p className="card-s">Nyalakan untuk melihat perkiraan harga wajar yang baru.</p>
          <div className="switch-list">
            {(semuaSim ? a.simulasi : [...a.simulasi].sort((x, y) => y.tambah - x.tambah).slice(0, 4)).map((s) => (
              <Switch
                key={s.id}
                label={s.label}
                sub={`Harga wajar naik ± ${rpSingkat(s.tambah)}/bulan`}
                checked={tambah.includes(s.id)}
                onChange={() => setTambah((t) => (t.includes(s.id) ? t.filter((x) => x !== s.id) : [...t, s.id]))}
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
                Dengan {daftar(sim.map((s) => s.label))}, harga wajar menjadi <b>{rp(bulat10rb(a.harga_wajar + simTambah))}</b>.
              </p>
              <small>
                Perkiraan biaya {rp(simBiaya)} · balik modal ± {Math.ceil(simBiaya / simTambah)} bulan
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
                  Badge hanya untuk harga wajar. Turunkan harga ke maksimal <b>{rp(bulat10rb(a.harga_wajar * 1.1))}</b> untuk mendapatkannya.
                </>
              )}
            </p>
            <Button icon="download" size="sm" variant="secondary" disabled={!bolehBadge} onClick={unduh}>
              Unduh badge
            </Button>
          </div>
        </div>
      </section>

      <button type="button" className="text-btn center" onClick={() => set({ pemilik: null })}>
        Ganti kos
      </button>
    </div>
  );
}

export default function Pemilik() {
  const { state } = useStore();
  return state.pemilik ? <Dashboard /> : <Klaim />;
}
