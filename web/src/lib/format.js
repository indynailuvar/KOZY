const nf = new Intl.NumberFormat('id-ID');

// Ditulis menempel seperti di Tokopedia dan Mamikos: "Rp1.300.000".
export const rp = (n) => `Rp${nf.format(Math.round(Math.abs(n)))}`;
export const rpSigned = (n) => `${n < 0 ? '−' : '+'}${rp(n)}`;

// "Rp1,3 jt", "Rp750 rb"; spasi tak terputus agar satuannya tidak terpisah
export function rpSingkat(n) {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `Rp${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  }
  return `Rp${Math.round(n / 1000)} rb`;
}

// "Rp550 rb–1,4 jt"; kalau kedua ujung sama cukup satu angka
export const rpRentang = (a, b) => (Math.round(a / 1000) === Math.round(b / 1000) ? rpSingkat(a) : `${rpSingkat(a)}–${rpSingkat(b).slice(2)}`);

export const persen = (x, signed = true) =>
  `${signed && x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export function jarak(km) {
  if (km < 1) return `${Math.round((km * 1000) / 50) * 50} m`;
  return `${km.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
}

export const tanggal = (iso) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export const bulat10rb = (n) => Math.round(n / 10_000) * 10_000;
export const bulat50rb = (n) => Math.round(n / 50_000) * 50_000;

// Rupiah untuk dibacakan: 1.100.000 -> "1 juta 100 ribu rupiah"
export function rpSuara(n) {
  const v = Math.round(Math.abs(n));
  const jt = Math.floor(v / 1_000_000);
  const rb = Math.round((v % 1_000_000) / 1000);
  const bagian = [];
  if (jt) bagian.push(`${jt} juta`);
  if (rb) bagian.push(`${rb} ribu`);
  return `${bagian.join(' ') || '0'} rupiah`;
}

// "300rb", "1,5 jt", "Rp 250.000", "200000" -> angka rupiah (null jika tidak ada angka)
const POLA_RUPIAH = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(jt|juta|rb|ribu|k)?\b/;
export function angkaRupiah(teks) {
  const m = String(teks).toLowerCase().match(POLA_RUPIAH);
  if (!m) return null;
  const [, angka, satuan] = m;
  if (satuan === 'jt' || satuan === 'juta') return Math.round(parseFloat(angka.replace(',', '.')) * 1_000_000);
  if (satuan === 'rb' || satuan === 'ribu' || satuan === 'k') return Math.round(parseFloat(angka.replace(',', '.')) * 1000);
  const bulat = /[.,]\d{3}/.test(angka) ? Number(angka.replace(/[.,]/g, '')) : Number(angka.replace(',', '.'));
  return bulat < 5000 ? Math.round(bulat * 1000) : Math.round(bulat);
}

export const angkaDariTeks = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;

export const daftar = (arr) =>
  arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} & ${arr[arr.length - 1]}`;
