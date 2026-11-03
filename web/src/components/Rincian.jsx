// Daftar rincian: satu kartu berisi baris-baris yang bisa dibuka.
//
// Sebelumnya halaman hasil menumpuk 7-8 blok berbobot sama — dua akordeon,
// kartu peta, dua baris saran, kartu KOZY AI — sehingga di layar HP semuanya
// ikut terbaca sekaligus dan terasa penuh. Padahal yang dicari pengguna cuma
// satu: angkanya berapa. Sisanya baru dibuka kalau penasaran.
//
// Komponen ini menyatukan semua "sisanya" jadi satu daftar rapi bergaris tipis,
// seperti rincian pesanan di aplikasi ojek online. Hasilnya tinggi halaman
// turun drastis dan mata punya satu tempat berhenti.
//
// Dua macam baris:
//   { isi: <...> }      -> terbuka di tempat (akordeon)
//   { onClick | href }  -> berpindah / membuka sesuatu
//
// Aksesibilitas: baris yang bisa dibuka memakai aria-expanded + aria-controls,
// tinggi minimal 44 px, dan urutan Tab-nya alami karena semuanya <button>.
import { useId, useState } from 'react';
import Icon from './Icon.jsx';

export default function Rincian({ judul, baris = [], className = '' }) {
  const [buka, setBuka] = useState({});
  const id = useId();
  const isi = baris.filter(Boolean);
  if (!isi.length) return null;

  return (
    <section className={`rinci ${className}`} aria-label={judul || 'Rincian'}>
      {judul && <p className="sec-label">{judul}</p>}
      <div className="rinci-card">
        {isi.map((b, i) => {
          const bisaBuka = !!b.isi;
          const terbuka = !!buka[b.id ?? i];
          const panel = `${id}-${i}`;
          return (
            <div key={b.id ?? i} className={`rinci-item ${terbuka ? 'is-open' : ''}`}>
              <button
                type="button"
                className="rinci-h"
                aria-expanded={bisaBuka ? terbuka : undefined}
                aria-controls={bisaBuka ? panel : undefined}
                onClick={() => (bisaBuka ? setBuka((s) => ({ ...s, [b.id ?? i]: !terbuka })) : b.onClick?.())}
              >
                {b.icon && (
                  <span className="rinci-ic">
                    <Icon name={b.icon} size={17} />
                  </span>
                )}
                <span className="rinci-t">
                  <b>{b.judul}</b>
                  {b.sub && <small>{b.sub}</small>}
                </span>
                {b.nilai && <em className="rinci-n">{b.nilai}</em>}
                <Icon name={bisaBuka ? 'down' : 'right'} size={18} className={bisaBuka ? 'rinci-chev' : 'rinci-go'} />
              </button>
              {bisaBuka && terbuka && (
                <div className="rinci-b" id={panel}>
                  {b.isi}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
