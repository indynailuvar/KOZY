# KOZY Web

Frontend KOZY untuk cek kewajaran harga sewa kos di Surabaya. Dibangun dengan React, Vite, dan Leaflet.

## Menjalankan

```bash
cd web
npm install      # sekali saja
npm run dev      # buka http://localhost:5173
```

## Halaman

| Halaman | URL | Isi |
|---|---|---|
| Beranda | `#/` | 2 pilihan: sudah punya kos incaran / sedang mencari kos, plus fitur lain |
| Cek harga | `#/cek` → `#/hasil` | 5 langkah: lokasi, jenis kos, harga dari pemilik, fasilitas, luas. Hasilnya berupa status harga, faktor harga, posisi pasar, dan peta kelurahan (pin terkunci) |
| KOZY Match | `#/match` | peta pin harga tiap kos. Ketuk pin untuk melihat detail, fasilitas, akses disabilitas, Buka Nomor, Kartu Tawar, dan pilihan bandingkan |
| Kartu Tawar | `#/kartu-tawar` | ringkasan dan 3 kalimat tawar, bisa disimpan sebagai PDF atau dikirim lewat WA |
| Cari kos | `#/cari` → `#/kawasan` | 6 langkah: persona, dekat dengan, tujuan, budget, jenis kos, fasilitas & ramah disabilitas. Hasilnya daftar/peta area dan saran KOZY AI |
| Bandingkan | `#/bandingkan` | 5 langkah (atau 1 langkah dari KOZY Match) → rekomendasi KOZY AI dan tabel perbandingan |
| KOZY AI | `#/ai` | chat: ide upgrade kamar (produk + link Shopee), bantu memilih kos, tips keuangan |
| Edukasi | `#/edukasi` | tips keuangan anak kos dan kalkulator budget kos |
| Riwayat | `#/riwayat` | tersimpan di localStorage |
| Pemilik | `#/pemilik` | klaim 5 langkah → posisi pasar, simulasi fasilitas, unduh badge |
| Tentang | `#/tentang` | metodologi & netralitas |
| Skenario presentasi | `#/demo` | tidak ditautkan di menu. Berisi pintasan skenario kemahalan, wajar, jauh di bawah pasaran, keyakinan rendah, di luar cakupan, dan gagal memuat |

### Status harga

| Status | Kondisi (selisih terhadap harga wajar) | Tampilan |
|---|---|---|
| Kemahalan | > +10% | merah, CTA Kartu Tawar |
| Wajar | −10% s.d. +10% | hijau |
| Murah | −10% s.d. −25% | biru, menampilkan "Hemat setahun" |
| Perlu dicek | ≤ −25% (`BATAS_TERLALU_MURAH`) | peringatan: harga jauh di bawah pasaran, tanpa angka "hemat". Muncul juga tautan "Rp X itu budget kamu?" yang menunjukkan kekurangan budget dan mengarah ke Cari Kos |

Angka yang diisi di Cek Harga adalah **harga dari pemilik**, bukan budget penyewa. Budget diisi di Cari Kos.

## Konfigurasi (`.env.local`)

| Variabel | Fungsi |
|---|---|
| `VITE_API_URL` | Alamat FastAPI. Jika diisi, `cekHarga()` memanggil `POST /vonis` dan mengharapkan `{status, harga_wajar, selisih_rp, selisih_persen, persentil, faktor[], komposisi, pasar{p10,p50,p90,n_pembanding}, meta{confidence, updated_at}}` |
| `VITE_AI_URL` | Endpoint chatbot. Menerima `POST {pesan, konteks}` dan mengembalikan `{teks, kartu?, saran?, aksi?}`. Tanpa variabel ini, KOZY AI memakai jawaban berbasis aturan di `src/api/ai.js` |
| `VITE_MAP_TILE_URL` | URL tile peta. Default: tile publik OpenStreetMap (cukup untuk pengembangan, **bukan** untuk trafik produksi) |
| `VITE_MAP_ATTRIBUTION` | Teks atribusi penyedia tile |

## Yang masih perlu disambungkan ke backend

- Angka harga, kawasan, dan daftar kos saat ini dihitung di `src/api/kozy.js` dari data acuan `src/data/surabaya.js` (koordinat kawasan = perkiraan titik tengah).
- Produk upgrade kamar ada di `src/data/konten.js`. Hasil scraping Shopee cukup mengikuti bentuk `{id, nama, kategori, harga, rating, terjual, image_url, url}`. Jika `image_url` ada, foto produk langsung dipakai.
- Login Google, pembayaran QRIS, verifikasi klaim pemilik, dan nomor pemilik belum terhubung ke layanan asli. Titik integrasinya ditandai komentar di `src/components/Sheets.jsx` dan `src/pages/Match.jsx`.

## Prinsip tampilan

- Latar putih dengan satu warna aksen (biru). Merah, hijau, dan kuning hanya dipakai untuk status harga.
- Isian dibuat langkah demi langkah: satu pertanyaan per layar, satu tombol utama.
- Hasil menampilkan satu angka besar. Detail seperti faktor harga, posisi pasar, dan skor disembunyikan sampai dibuka.
- Komponen dasar ada di `src/components/ui.jsx` (Wizard, Options, Tiles, AmountInput, ListRow, Accordion, dan lainnya) dan gaya ada di `src/styles.css`.
