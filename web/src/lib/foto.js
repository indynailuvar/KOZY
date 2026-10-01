// Menyiapkan foto kamar yang diunggah pemilik.
//
// Foto dari kamera HP biasanya 3–8 MB. Tanpa backend, satu-satunya tempat simpan
// adalah localStorage yang jatahnya hanya sekitar 5 MB untuk seluruh aplikasi.
// Empat sisi dikali beberapa tipe kamar akan langsung melewati batas itu, dan
// localStorage yang penuh gagal diam-diam — datanya hilang tanpa pesan apa pun.
//
// Karena itu tiap foto dikecilkan dulu di browser sebelum disimpan: sisi terpanjang
// dipotong ke 1200 px dan dijadikan JPEG mutu 0,72, sehingga satu foto turun ke
// kisaran 80–150 KB. Cukup tajam untuk dilihat di layar, cukup kecil untuk disimpan.
//
// Kalau nanti backend-nya jadi, fungsi ini tinggal diganti unggahan ke server dan
// yang disimpan cukup URL-nya.

export const SISI_MAKS = 1200;
export const MUTU = 0.72;
export const BATAS_BERKAS = 12 * 1024 * 1024; // tolak lebih awal, sebelum dibaca ke memori

const bacaGambar = (file) =>
  new Promise((selesai, gagal) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      selesai(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      gagal(new Error('Berkasnya bukan gambar yang bisa dibaca.'));
    };
    img.src = url;
  });

/**
 * Mengubah File menjadi data URL yang sudah dikecilkan.
 * @returns {Promise<{dataUrl: string, lebar: number, tinggi: number, kb: number}>}
 */
export async function siapkanFoto(file) {
  if (!file) throw new Error('Tidak ada berkas yang dipilih.');
  if (!file.type.startsWith('image/')) throw new Error('Pilih berkas gambar (JPG, PNG, atau WEBP).');
  if (file.size > BATAS_BERKAS) throw new Error('Fotonya terlalu besar. Maksimal 12 MB.');

  const img = await bacaGambar(file);
  const skala = Math.min(1, SISI_MAKS / Math.max(img.naturalWidth, img.naturalHeight));
  const lebar = Math.round(img.naturalWidth * skala);
  const tinggi = Math.round(img.naturalHeight * skala);

  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ctx = kanvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, lebar, tinggi);

  const dataUrl = kanvas.toDataURL('image/jpeg', MUTU);
  return { dataUrl, lebar, tinggi, kb: Math.round((dataUrl.length * 0.75) / 1024) };
}

/**
 * Jumlah foto dan perkiraan besar penyimpanannya.
 * Hanya foto yang benar-benar tersimpan sebagai data URL yang dihitung ukurannya;
 * foto contoh yang berupa alamat berkas tidak memakan jatah localStorage sama sekali.
 */
export function ringkasFoto(tipe = []) {
  let kb = 0;
  let jumlah = 0;
  for (const t of tipe) {
    for (const url of Object.values(t.foto || {})) {
      if (!url) continue;
      jumlah += 1;
      if (url.startsWith('data:')) kb += (url.length * 0.75) / 1024;
    }
  }
  return { jumlah, kb: Math.round(kb) };
}
