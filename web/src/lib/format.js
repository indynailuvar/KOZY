const nf = new Intl.NumberFormat('id-ID');

// spasi tak terputus agar "Rp" tidak terpisah dari angkanya saat teks turun baris
export const rp = (n) => `Rp\u00a0${nf.format(Math.round(Math.abs(n)))}`;
export const rpSigned = (n) => `${n < 0 ? '−' : '+'}${rp(n)}`;

export function rpSingkat(n) {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `Rp\u00a0${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })}\u00a0jt`;
  }
  return `Rp\u00a0${Math.round(n / 1000)}\u00a0rb`;
}

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
