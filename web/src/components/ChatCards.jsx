import { useState } from 'react';
import Icon from './Icon.jsx';
import { ProductArt } from './Art.jsx';
import { StatusBadge } from './ui.jsx';
import { labelYakin } from '../api/ai.js';
import { jarak, rp, rpSuara } from '../lib/format.js';

export function teksSuara(m) {
  const bagian = [m.teks];
  const k = m.kartu;
  if (k?.jenis === 'produk') {
    bagian.push(k.items.map((p) => `${p.nama}, ${rpSuara(p.harga)}`).join('. '));
    bagian.push(`Totalnya ${rpSuara(k.total)}.`);
  }
  if (k?.jenis === 'keputusan') bagian.push(`Alasannya: ${k.alasan.join('. ')}.`, k.alternatif || '');
  if (k?.jenis === 'tips') bagian.push(k.topik.poin.join(' '));
  return bagian.join(' ');
}

export function ProdukKartu({ k }) {
  return (
    <div className="c-card">
      <ul className="prod-list">
        {k.items.map((p) => (
          <li key={p.id}>
            <a className="prod" href={p.link} target="_blank" rel="noopener noreferrer">
              {p.image_url ? <img src={p.image_url} alt="" className="prod-img" /> : <ProductArt kategori={p.kategori} />}
              <span className="prod-t">
                <span className="prod-n">{p.nama}</span>
                <b>{rp(p.harga)}</b>
                <small>
                  <Icon name="star" size={12} /> {p.rating} · {p.terjual} terjual
                </small>
              </span>
              <span className="prod-go">
                Shopee <Icon name="external" size={13} />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div className="prod-total">
        <span>
          Total <b>{rp(k.total)}</b>
        </span>
        <span>Sisa {rp(k.sisa)}</span>
      </div>
      <p className="c-note">Harga bisa berubah, cek lagi di toko sebelum membeli.</p>
    </div>
  );
}

export function KeputusanKartu({ k }) {
  return (
    <div className="c-card">
      <p className="c-label">Rekomendasi · prioritas {k.prioritas}</p>
      <div className="dec-win">
        <span className="ic-circle">
          <Icon name="checkc" size={20} />
        </span>
        <div>
          <b>{k.menang.nama}</b>
          <small>
            {rp(k.menang.harga)}/bulan
            {k.menang.jarak != null && ` · ${jarak(k.menang.jarak)}`}
          </small>
        </div>
      </div>
      <span className="dec-conf">{labelYakin(k.yakin)}</span>
      <ul className="c-list">
        {k.alasan.map((a) => (
          <li key={a}>
            <Icon name="check" size={15} strokeWidth={2.6} />
            {a}
          </li>
        ))}
      </ul>
      {k.alternatif && <p className="c-muted">{k.alternatif}</p>}
      <details className="c-more">
        <summary>Cek juga saat survei</summary>
        <ul>
          {k.cek.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function TipsKartu({ k }) {
  return (
    <div className="c-card">
      <ol className="c-steps">
        {k.topik.poin.map((p, i) => (
          <li key={p}>
            <span>{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PilihKos({ k, onPilih, aktif }) {
  const [pilih, setPilih] = useState([]);
  const toggle = (id) => setPilih((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 2 ? [...p, id] : [p[1], id]));
  return (
    <div className="c-card">
      <ul className="pick-list">
        {k.kos.map((x) => (
          <li key={x.id}>
            <button type="button" disabled={!aktif} className={pilih.includes(x.id) ? 'is-on' : ''} onClick={() => toggle(x.id)} aria-pressed={pilih.includes(x.id)}>
              <span className="pick-box">{pilih.includes(x.id) && <Icon name="check" size={12} strokeWidth={3.2} />}</span>
              <span className="pick-t">
                <b>{x.nama}</b>
                <small>
                  {rp(x.harga)} · {jarak(x.jarak)}
                </small>
              </span>
              <StatusBadge status={x.status} size="sm" />
            </button>
          </li>
        ))}
      </ul>
      {aktif && (
        <button type="button" className="btn btn-primary btn-sm btn-block" disabled={pilih.length !== 2} onClick={() => onPilih(...pilih.map((id) => k.kos.find((x) => x.id === id)))}>
          <span>Bandingkan ({pilih.length}/2)</span>
        </button>
      )}
    </div>
  );
}
