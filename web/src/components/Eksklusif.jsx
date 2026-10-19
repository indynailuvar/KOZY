// Tampilan fitur eksklusif KOZY (paket Rp19.900 sekali bayar):
//   KelasTangga   kelas harga murah/menengah/mahal hasil K-Prototypes
//   KartuAB       kartu timbul kos A vs B + baris gap + skor TOPSIS
//   KunciEksklusif penutup fitur untuk yang belum membeli paket
import Icon from './Icon.jsx';
import { Button, InfoTip } from './ui.jsx';
import { KELAS, GAP_AB } from '../api/premium.js';
import { labelFasilitas } from '../api/kozy.js';
import { HARGA_MATCH } from './Sheets.jsx';
import { jarak, rp, rpSingkat } from '../lib/format.js';

const angka = (x, d = 1) => x.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const bertanda = (x, f) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${f(Math.abs(x))}`;

export function KunciEksklusif({ judul, sub, poin = [], onBuka }) {
  return (
    <div className="eks-kunci">
      <span className="ic-circle">
        <Icon name="lock" size={18} />
      </span>
      <div>
        <p className="eks-kunci-t">{judul}</p>
        {sub && <p className="eks-kunci-s">{sub}</p>}
        {poin.length > 0 && (
          <ul className="dot-list">
            {poin.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <Button size="sm" icon="unlock" onClick={onBuka}>
          Buka paket eksklusif · {rp(HARGA_MATCH)}
        </Button>
      </div>
    </div>
  );
}

export function KelasTangga({ kelas, harga }) {
  const m = KELAS.meta;
  return (
    <div className="kelas">
      <ol className="kelas-tangga" aria-label="Tiga kelas harga kos">
        {KELAS.kelas.map((k) => (
          <li key={k.id} className={k.id === kelas.id ? 'is-on' : ''} aria-current={k.id === kelas.id ? 'true' : undefined}>
            <b>{k.label}</b>
            <small>
              {rpSingkat(k.harga.min)} – {rpSingkat(k.harga.max)}
            </small>
          </li>
        ))}
      </ol>
      <p className="kelas-t">
        {rp(harga)} masuk kelas <b>{kelas.label.toLowerCase()}</b>
      </p>
      <div className="kelas-pos" aria-hidden="true">
        <i style={{ left: `${kelas.persentil}%` }} />
      </div>
      <p className="note">
        Lebih mahal dari {kelas.persentil}% kos di kelas ini ({kelas.n} iklan, median {rp(kelas.median)}).
        {kelas.margin != null && kelas.margin < 0.15 && ' Harganya dekat batas kelas tetangga, jadi kelasnya bisa bergeser kalau harganya sedikit berubah.'}
      </p>
      <p className="v-basis">
        K-Prototypes · {m.n} iklan · harga, kecamatan, dan jenis kos
        <InfoTip label="Cara KOZY menentukan kelas">
          Kelas dibentuk dengan K-Prototypes (Huang, 1997) dari {m.n} iklan Mamikos + Papikost. Variabelnya: log harga (angka), kecamatan, dan jenis kos (kategori).
          Fasilitas tidak dipakai karena hanya berupa ada/tidak ada. Kos ini dimasukkan ke pusat kelas yang jaraknya paling dekat. Stabilitas kelas (ARI bootstrap):{' '}
          {angka(m.stabilitas.rata, 2)}.
        </InfoTip>
      </p>
    </div>
  );
}

function KartuKos({ huruf, k, menang, skor }) {
  return (
    <div className={`ab-kartu ${menang ? 'is-menang' : ''}`}>
      {menang && <span className="ab-pita">Disarankan</span>}
      <span className="vs-letter">{huruf}</span>
      <b className="ab-nama">{k.nama}</b>
      <p className="ab-harga">
        {rp(k.harga)}
        <small>/bulan</small>
      </p>
      <p className="ab-jarak">{k.jarak != null ? jarak(k.jarak) : 'Jarak belum diisi'}</p>
      <span className={`ab-kelas kelas-${k.kelas.id}`}>Kelas {k.kelas.label.toLowerCase()}</span>
      <p className="ab-pos">Persentil {k.kelas.persentil} di kelasnya</p>
      <p className="ab-skor">
        Skor TOPSIS <b>{angka(skor, 2)}</b>
      </p>
    </div>
  );
}

export function KartuAB({ hasil }) {
  const { a, b, gap, topsis, uji_pasar: uji } = hasil;
  const s = GAP_AB.skala;
  const lebihMahal = gap.harga.selisih_rp > 0 ? b : a;
  const baris = [
    {
      label: 'Harga',
      nilai: gap.harga.selisih_rp === 0 ? 'Sama' : `${lebihMahal.nama} ${rp(Math.abs(gap.harga.selisih_rp))} lebih mahal`,
      sub:
        gap.harga.selisih_rp === 0
          ? null
          : `${angka(Math.abs(gap.harga.selisih_persen))}% · ${angka(Math.abs(gap.harga.selisih_iqr), 2)} IQR pasar · ${rp(Math.abs(gap.harga.setahun_rp))} setahun`,
    },
    gap.jarak && {
      label: 'Jarak',
      nilai: Math.abs(gap.jarak.selisih_km) < 0.05 ? 'Sama' : `${gap.jarak.selisih_km > 0 ? a.nama : b.nama} ${jarak(Math.abs(gap.jarak.selisih_km))} lebih dekat`,
      sub: Math.abs(gap.jarak.selisih_km) < 0.05 ? null : `${angka(Math.abs(gap.jarak.selisih_iqr), 2)} IQR pasar`,
    },
    {
      label: 'Posisi di kelas',
      nilai: a.kelas.id === b.kelas.id ? `Sama-sama kelas ${a.kelas.label.toLowerCase()}` : `${a.kelas.label} vs ${b.kelas.label.toLowerCase()}`,
      sub: `Persentil ${a.kelas.persentil} vs ${b.kelas.persentil} (${bertanda(gap.persentil_poin, (x) => x)} poin)`,
    },
  ].filter(Boolean);

  return (
    <div className="ab">
      <div className="ab-grid">
        <KartuKos huruf="A" k={a} menang={topsis.menang === 'a'} skor={topsis.skor.a} />
        <span className="ab-vs" aria-hidden="true">
          VS
        </span>
        <KartuKos huruf="B" k={b} menang={topsis.menang === 'b'} skor={topsis.skor.b} />
      </div>

      <section className="card ab-gap" aria-label="Gap kos A dan B">
        <h3 className="card-t">Gap A vs B</h3>
        <dl className="facts">
          {baris.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>
                {r.nilai}
                {r.sub && (
                  <>
                    <br />
                    <small>{r.sub}</small>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="v-basis">
          IQR pasar: harga {rp(s.harga.iqr)} ({s.harga.n} iklan), jarak {angka(s.jarak.iqr, 2)} km ({s.jarak.n} kos berkoordinat)
          <InfoTip label="Arti satuan IQR">
            Selisih dibagi rentang antarkuartil (IQR) pasar supaya harga dan jarak bisa dibandingkan dalam satuan yang sama. 1 IQR = selisih antara kos di kuartil bawah dan kuartil atas.
          </InfoTip>
        </p>
      </section>

      <section className="card">
        <h3 className="card-t">Kenapa {topsis.menang === 'a' ? a.nama : b.nama} disarankan</h3>
        <p className="note">
          TOPSIS menimbang harga ({Math.round((topsis.bobot.harga / (topsis.bobot.harga + (topsis.pakai_jarak ? topsis.bobot.jarak : 0))) * 100)}%)
          {topsis.pakai_jarak ? ` dan jarak (${Math.round(topsis.bobot.jarak * 100)}%)` : ' saja, karena jarak salah satu kos belum diisi'}. Skor 1 berarti paling dekat ke pilihan ideal (termurah dan terdekat).
        </p>
        <div className="ab-skor-bar">
          {[
            ['A', a, topsis.skor.a],
            ['B', b, topsis.skor.b],
          ].map(([h, k, v]) => (
            <div key={h}>
              <span>{k.nama}</span>
              <i>
                <i style={{ width: `${Math.max(2, v * 100)}%` }} className={(h === 'A') === (topsis.menang === 'a') ? 'is-on' : ''} />
              </i>
              <b>{angka(v, 2)}</b>
            </div>
          ))}
        </div>
        <p className="note">{uji.kesimpulan} Jadi kos yang lebih dekat kampus belum tentu pantas lebih mahal.</p>
      </section>

      {(a.fasilitas?.length > 0 || b.fasilitas?.length > 0) && (
        <section className="card">
          <h3 className="card-t">Fasilitas (informasi, tidak dihitung)</h3>
          <dl className="facts">
            {[
              ['A', a],
              ['B', b],
            ].map(([h, k]) => (
              <div key={h}>
                <dt>{k.nama}</dt>
                <dd>
                  <small>{labelFasilitas(k.fasilitas || []).join(', ') || '–'}</small>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
