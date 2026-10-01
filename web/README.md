# KOZY Web

Frontend KOZY untuk cek kewajaran harga sewa kos di Surabaya. Dibangun dengan React, Vite, dan Leaflet. Semua angka harga berasal dari hasil scraping, bukan angka karangan. Kalau suatu data memang tidak ada di sumbernya, aplikasinya bilang tidak ada — bukan menebak.

## Menjalankan

```bash
cd web
npm install      # sekali saja
npm run dev      # buka http://localhost:5173
```

## Data dan model

Empat sumber hasil scraping, dengan peran yang berbeda-beda. Tidak ada satu pun yang lengkap sendirian, jadi perannya dibagi dan tidak dicampur:

| Sumber | Jumlah | Harga sewa | Koordinat | Fasilitas | Dipakai untuk |
|---|---|---|---|---|---|
| Mamikos | 240 iklan | ada | – | 6 jenis | melatih model + KOZY Match |
| Papikost | 71 iklan | ada | ada | 10 jenis | melatih model + pin peta asli |
| Google Maps | 848 titik | – | ada | – | jangkauan lokasi, harga diperkirakan model |
| OLX | 20 iklan | harga **jual** | kasar | – | sisi pemilik saja, **tidak** untuk harga sewa |

```
data/mamikos_bersih.csv  ┐
../papikost_surabaya_71.json ┴→ scripts/build_pasar.py   → src/data/pasar.json   ┐
../gmaps_all_basic.json     → scripts/build_gmaps.py   → src/data/gmaps.json   ├→ src/api/kozy.js
../olx_data.json            → scripts/build_olx.py     → src/data/olx.json     │
pasar.json + gmaps.json     → scripts/build_kawasan.py → src/data/kawasan.json ┘
```

Urutan menjalankan ulang setelah ada hasil scraping baru:

```bash
python scripts/geocode_titik.py   # cari kelurahan/kecamatan dari koordinat (bisa dihentikan kapan saja)
python scripts/build_pasar.py     # latih model harga sewa
python scripts/build_gmaps.py     # perkirakan harga titik Google Maps
python scripts/build_olx.py       # hitung sisi pemilik dari iklan jual
python scripts/build_kawasan.py   # susun daftar kawasan dari koordinat
```

### Model harga sewa (Mamikos + Papikost)

Keduanya sama-sama iklan **sewa bulanan**, jadi boleh digabung: **307 iklan** (240 Mamikos + 67 Papikost) di **14 kecamatan**. Papikost menyumbang 67 dari 71 — 3 iklan ternyata di Sidoarjo dan 1 harganya Rp 125.000 (terlalu rendah untuk sewa sebulan, kemungkinan tarif harian).

Rumus yang dipakai frontend: `harga = exp(intercept + efek_kecamatan + Σ efek_fasilitas + efek_jenis)`.

Tiga keputusan penting, semuanya diuji uji silang 5 lipat dulu, bukan dikira-kira:

1. **Fasilitas yang ikut dihitung hanya 6 yang dicatat Mamikos.** Papikost memang juga mencatat lemari, meja belajar, dan parkir, tetapi hampir semua iklannya punya itu sehingga pengaruhnya tidak bisa dipisahkan. Ikut dihitung malah memperburuk tebakan (MAPE 21,7% → 22,7%), jadi datanya disimpan di `fasilitas_lain` untuk ditampilkan saja.
2. **Ada penanda situs** untuk menyerap beda tingkat harga antar situs (Papikost +9,0% dibanding Mamikos). Penanda ini sekaligus menggantikan penanda "fasilitas tidak tercatat" — keduanya bernilai sama persis, dan kalau dipasang dua-duanya kolomnya berlebih sehingga koefisiennya jadi ngawur.
3. **Kecamatan dengan iklan kurang dari 5 tidak diberi koefisien sendiri**, melainkan digabung jadi satu kelompok. Tebakan dari 1–4 iklan terlalu goyah.

Efek kecamatan **dipusatkan**: angka 0 berarti "rata-rata Surabaya", bukan "sama dengan kecamatan acuan". Penanda situs dilipat ke intercept pada proporsi sampelnya, jadi frontend tetap memakai satu rumus yang sama tanpa perlu tahu soal situs. Koefisien mentahnya tetap disimpan di `model_penuh` untuk diperiksa.

Hasilnya:

| Ukuran | Nilai |
|---|---|
| Iklan | 307 (240 Mamikos + 67 Papikost) |
| Kecamatan | 14, dengan 6 punya koefisien sendiri |
| Berkoordinat asli | 67 |
| Meleset rata-rata (uji silang 5 lipat, 5 kali ulang) | ± Rp 279.000 (21,0%) |
| R² log | 0,663 |

Pengaruh fasilitas: AC **+58%**, KM dalam **+28%**, kasur **+19%**, kloset duduk **+11%**, WiFi **+5%**, akses 24 jam **−1%** (praktis tidak berpengaruh). Jenis kos: campur **+17%**, putri **−5%** terhadap putra.

Menambah Papikost **tidak memperbaiki ketelitian** di kecamatan yang datanya sudah ada — diuji di 240 baris Mamikos yang sama persis, MAPE-nya 19,84% → 20,05%. Yang bertambah adalah **jangkauan**: 8 kecamatan yang dulu sama sekali tidak bisa dinilai, plus 67 koordinat asli untuk pin peta.

Isi `src/data/pasar.json`:

| Bagian | Isi |
|---|---|
| `meta` | sumber, tanggal ambil, jumlah per sumber, MAE, MAPE, R² |
| `model` | koefisien siap pakai: intercept, efek kecamatan (sudah dipusatkan), efek fasilitas, efek jenis |
| `model_penuh` | koefisien mentah sebelum diringkas, untuk pemeriksaan |
| `kecamatan` | sebaran harga asli (p10–p90), komposisi jenis, persentase fasilitas, jumlah per sumber, tingkat keyakinan |
| `kos` | daftar iklan asli untuk KOZY Match, lengkap dengan sumber dan koordinat bila ada |

Persentase fasilitas per kecamatan **hanya dihitung dari iklan yang situsnya memang mencatat fasilitas itu**. Papikost tidak mencatat kloset dan akses 24 jam, jadi kalau ikut dihitung sebagai 0, kecamatan yang datanya hanya dari Papikost akan terlihat "tidak punya kloset" padahal artinya "tidak diketahui". Angka ini juga dipakai untuk memperkirakan harga titik Google Maps, jadi salah di sini ikut menyeret harga.

### Google Maps: lokasi, bukan harga

```
../gmaps_all_basic.json  →  scripts/build_gmaps.py  →  src/data/gmaps.json
```

848 titik yang isinya cuma **nama dan link**. Tetapi koordinatnya sebenarnya sudah ikut tertulis di dalam link Google Maps (pola `!3d<lat>!4d<lng>`), jadi bisa dibaca semuanya tanpa membuka halaman satu per satu — 848 dari 848 berhasil.

**Fasilitasnya tidak bisa diambil dan tidak dikarang.** Halaman Google Maps-nya sudah diperiksa: dari 192 KB HTML, tidak ada satu pun kata WiFi, AC, kamar mandi, atau fasilitas. Google memang tidak menyimpan fasilitas kos.

Karena harga juga kosong, angkanya adalah **perkiraan model**, tidak pernah ditampilkan sebagai harga iklan:

```
perkiraan = exp(intercept + efek_kecamatan + Σ (peluang_fasilitas × efek_fasilitas) + efek_jenis)
```

Artinya "harga kos berfasilitas rata-rata di kecamatan itu" — jadi sesama titik di satu kecamatan angkanya memang sama. Di aplikasi, angka ini selalu tampil sebagai **rentang** dengan label "perkiraan" dan tautan ke Google Maps untuk menanyakan harga aslinya.

| Keyakinan | Kondisi | Rentang |
|---|---|---|
| sedang | kecamatannya punya koefisien sendiri | ± 21,0% (MAPE model) |
| rendah | kecamatannya masih ikut kelompok "lainnya" | ± 36,8% |

Kecamatannya dicari dari koordinat lewat `scripts/geocode_titik.py` (Nominatim/OpenStreetMap). Layanannya gratis tetapi dibatasi 1 permintaan/detik, dan setelah beberapa ratus permintaan jawabannya melambat sampai ~19 detik per titik. Karena itu urutan permintaannya diatur supaya berhenti di tengah pun hasilnya sudah berguna: Papikost dulu, lalu satu wakil tiap klaster 500 m, baru sisanya. Titik yang belum sempat ditanyakan mengambil wilayah dari **tetangga berlabel terdekat dalam radius 400 m** — cara ini diuji pada titik yang sudah punya label dan **96,7% tepat**, dan tiap baris menyimpan `wilayah_dari` supaya ketahuan mana yang hasil geocoding dan mana yang dari tetangga. Titik yang tidak punya tetangga sedekat itu dibiarkan kosong, bukan ditebak asal.

Titik yang ternyata kos yang sama dengan iklan berharga asli (jarak < 60 m) ditandai `harga_asli` dan disembunyikan dari daftar "Kos lain di sekitar", supaya tidak terhitung dua kali.

### OLX: rumah kos dijual, bukan sewa

```
../olx_data.json  →  scripts/build_olx.py  →  src/data/olx.json
```

Sumber ini **bukan harga sewa bulanan**. Yang diiklankan adalah **rumah kos yang dijual**, harganya Rp 1,2–7,5 **miliar**. Memberi harga sewa dengan model untuk data ini tidak masuk akal — harganya sudah ada, cuma jenis harga yang berbeda. Mencampurnya ke model sewa akan merusak seluruh perhitungan harga wajar penyewa, jadi **harga jualnya tidak pernah ikut melatih model** dan tidak pernah muncul di halaman penyewa.

Yang dipakai justru kebalikannya: model sewa dipakai untuk memperkirakan **pendapatan** bangunan itu, lalu dibandingkan dengan harga jualnya.

```
perkiraan_sewa_kamar = exp(intercept + efek_kecamatan + Σ peluang_fasilitas + efek_jenis)
pendapatan_setahun   = jumlah_kamar × perkiraan_sewa_kamar × 12
imbal_hasil_kotor    = pendapatan_setahun / harga_jual
```

Hasilnya: median harga jual Rp 4,5 miliar, 20 kamar, **Rp 165 juta per kamar**, imbal hasil kotor **8,5% per tahun**, balik modal sekitar **12 tahun**.

**Batasannya besar dan selalu ikut ditampilkan:** hanya 20 iklan, dari **2 penjual saja**, diunggah pada **satu hari yang sama**, dan terpusat di kawasan kampus. Ini inventaris satu agen properti, bukan sampel pasar. Angkanya hanya gambaran kasar dan hanya tampil di dashboard admin.

### Kawasan: dari koordinat, bukan tulisan tangan

```
pasar.json + gmaps.json  →  scripts/build_kawasan.py  →  src/data/kawasan.json
```

Daftar kelurahan yang bisa dipilih pengguna dulu ditulis tangan lengkap dengan koordinat kira-kira. Sekarang dibuat dari data: tiap titik kos sudah punya kelurahan + kecamatan, jadi titik tengah kawasan memakai **median koordinat kos yang benar-benar ada di sana**, dan jaraknya ke pusat aktivitas dihitung dari koordinat itu, bukan ditaksir. Kelurahan dengan kurang dari 3 titik dibuang supaya tidak muncul kawasan yang isinya cuma satu kos nyasar. Nama id kawasan lama dipertahankan agar pilihan yang sudah tersimpan di browser pengguna tidak hilang.

### Yang masih kosong di semua sumber

- **Luas kamar** → langkah luas dihapus dari Cek Harga.
- **Nomor pemilik** → tombol kontak diganti tautan ke iklan aslinya.
- **Fasilitas untuk 848 titik Google Maps** → memang tidak ada di sumbernya, jadi titik itu hanya dipakai untuk lokasi.
- **Koordinat untuk 240 iklan Mamikos** → pinnya masih sebaran perkiraan di sekitar kawasan dan diberi keterangan. Iklan Papikost sudah pakai koordinat asli.
- **Kecamatan dengan data sangat sedikit** → tetap dinilai, tetapi ditandai keyakinan rendah plus keterangan bahwa kecamatan itu belum punya tingkat harganya sendiri.

### Status harga

| Status | Selisih terhadap harga wajar | Tampilan |
|---|---|---|
| Kemahalan | > +15% | merah, CTA Kartu Tawar |
| Wajar | −15% s.d. +15% | hijau |
| Murah | < −15% | biru, menampilkan "Lebih murah per bulan" dan "Hemat setahun" |

Ambang ±15% (`BATAS_WAJAR`) disamakan dengan ketelitian model: separuh iklan nyata meleset kurang dari 15% dari perkiraan, jadi selisih di bawah itu belum pantas disebut kemahalan.

Harga murah adalah kabar baik dan ditampilkan begitu. Kalau selisihnya sangat besar (≤ −30%, `BATAS_PERIKSA`), KOZY tetap menambahkan satu catatan "Harga bagus, pastikan dulu sebelum transfer" berisi hal yang perlu dicek langsung, bukan mengubah vonisnya jadi peringatan.

Angka yang diisi di Cek Harga adalah **harga dari pemilik**, bukan budget penyewa. Kalau ternyata itu budget, ada tautan ke Cari Kos. Sebaliknya, di halaman rekomendasi area, kalau budget lebih besar daripada harga pasaran, KOZY menghitung sisanya dan menawarkan ide belanja perabot lewat KOZY AI.

## Halaman

| Halaman | URL | Isi |
|---|---|---|
| Beranda | `#/` | 2 pilihan: sudah punya kos incaran / sedang mencari kos |
| Cek harga | `#/cek` → `#/hasil` | 4 langkah: lokasi, jenis kos, harga dari pemilik, fasilitas. Hasilnya status harga, kisaran wajar, faktor harga, posisi di pasar, dan peta kelurahan (pin terkunci) |
| KOZY Match | `#/match` | peta pin harga kos asli. Ketuk pin untuk detail, fasilitas, skor kecocokan, tautan ke iklan, Kartu Tawar, dan pilihan bandingkan |
| Kartu Tawar | `#/kartu-tawar` | ringkasan dan 3 kalimat tawar, bisa disimpan PDF atau dikirim lewat WA |
| Cari kos | `#/cari` → `#/kawasan` | 6 langkah: persona, dekat dengan, tujuan, budget, jenis kos, fasilitas. Hasilnya daftar/peta area dan saran KOZY AI |
| Bandingkan | `#/bandingkan` | 5 langkah (atau 1 langkah dari KOZY Match) → rekomendasi KOZY AI dan tabel perbandingan |
| KOZY AI | `#/ai` | chat: ide upgrade kamar, memilih kos, cara menawar, daftar cek sebelum bayar, tips keuangan |
| Edukasi | `#/edukasi` | tips keuangan anak kos dan kalkulator budget |
| Riwayat | `#/riwayat` | tersimpan di localStorage |
| Pemilik | `#/pemilik` | klaim 4 langkah (lokasi, jenis kos, tipe kamar, bukti) → posisi harga **per tipe kamar**, simulasi fasilitas, unduh badge |
| Tentang | `#/tentang` | metodologi, batas data, netralitas |
| **Dashboard data** | `#/admin` | halaman internal: kualitas data dan hasil model dalam bentuk grafik |
| Skenario presentasi | `#/demo` | halaman internal: pintasan skenario kemahalan, wajar, jauh di bawah pasaran, data sedikit, belum ada data, luar cakupan, gagal memuat |

### Dashboard `#/admin`

Halaman ini dipisah jadi dua bagian yang ditukar lewat tombol di atas, bukan satu halaman panjang:

- `#/admin` → **Data pasar & model**
- `#/admin?tab=aktivitas` → **Aktivitas pengguna**

Grafiknya mengikuti aturan *Storytelling with Data* bab 2: judul memuat pesannya, batang selalu mulai dari nol, nilai dilabeli langsung, satu warna aksen, dan tidak ada pie, donut, 3D, atau sumbu Y kedua.

| Visual | Isi |
|---|---|
| Teks angka besar | jumlah iklan, median harga, meleset rata-rata, R² |
| Batang horizontal | median harga atau jumlah iklan per kecamatan (bisa ditukar) |
| Batang horizontal | pengaruh tiap fasilitas terhadap harga, dari koefisien model |
| Histogram | sebaran 307 harga iklan per Rp 250 rb |
| Heatmap | persentase kepemilikan fasilitas per kecamatan |
| Batang bertumpuk 100% | komposisi jenis kos per kecamatan |
| Scatterplot | hubungan jumlah fasilitas dengan harga, plus garis median |
| Tabel border minimal | peran tiap sumber: apa yang dibawa, apa yang kosong |
| Batang horizontal | sebaran titik Google Maps per kecamatan |
| Batang horizontal | harga jual rumah kos per kamar tiap kecamatan (OLX, sisi pemilik) |
| Tabel border minimal | p10, median, p90, dan efek kecamatan |
| Daftar celah data | apa yang masih kosong dan akibatnya ke fitur |

Komponen grafiknya ada di `src/components/Grafik.jsx` dan tiap grafik punya padanan teks untuk pembaca layar.

Bagian kedua halaman ini adalah **aktivitas pengguna**, dicatat oleh `src/lib/jejak.js`:

| Visual | Isi |
|---|---|
| Teks angka besar | sesi, cek harga selesai, KOZY Match dibuka, permintaan area tanpa data |
| Garis | aktivitas 14 hari terakhir (data berurut waktu) |
| Corong batang horizontal | beranda → mulai cek → lihat hasil → buka paywall → bayar, plus konversinya |
| Slopegraph | pekan lalu dibanding pekan ini |
| Batang horizontal | area paling sering dicek, permintaan area tanpa data, sebaran vonis harga, topik KOZY AI |
| Tabel border minimal | 8 kejadian terakhir |

Kejadian yang dicatat: `halaman`, `cek_mulai`, `cek_selesai`, `area_belum_data`, `luar_cakupan`, `cari_selesai`, `area_dipilih`, `match_dikunci`, `bayar`, `kartu_tawar`, `iklan_dibuka`, `ai_tanya`. Isinya hanya pilihan di aplikasi (kecamatan, status harga, persona, dan sejenisnya), tanpa nama, email, atau nomor.

Saat belum ada aktivitas, grafiknya tetap tampil dengan angka nol dan keterangan bahwa datanya akan terisi sendiri. Tombol "Hapus data aktivitas" ada di kartu paling bawah.

`area_belum_data` dan `luar_cakupan` sengaja dicatat, karena itu daftar prioritas untuk scraping berikutnya: area yang paling sering dicari pengguna tapi datanya belum ada.

## Kamar 4 sisi

Komponen `src/components/Kamar360.jsx`. Putarannya **menerus seperti Street View**, bukan berganti gambar: keempat foto dipasang sebagai empat dinding sebuah kubus (skybox), kameranya ditaruh tepat di tengah kubus, lalu diputar. Di pojok ruangan dua dinding terlihat sekaligus, persis seperti berdiri di tengah kamar lalu menoleh.

Rumusnya: kalau lebar penampil `W`, tiap dinding didorong `W/2` dari pusat dan `perspective` juga diset `W/2`. Satu dinding lalu tepat mengisi 90° pandangan dan keempatnya menutup 360° tanpa celah. Geometrinya diperiksa dengan memproyeksikan tiap dinding memakai matriksnya sendiri:

| Arah pandang | Yang terlihat | Layar terisi |
|---|---|---|
| 0° (menghadap dinding) | depan 100% | 100% |
| 20° | depan 74% + kanan 26% | 100% |
| 45° (tepat di pojok) | depan 50% + kanan 50% | 100% |
| 135° | kanan 50% + belakang 50% | 100% |

Menggeser bukan satu-satunya cara memutarnya:

| Cara | Keterangan |
|---|---|
| Geser foto | menerus; satu lebar penampil = 90°, dengan efek lempar yang meluruh lalu berhenti menghadap dinding terdekat |
| Tombol panah kiri/kanan | 44 px, memutar tepat 90° dengan animasi |
| Tombol tiap sisi | Depan / Kanan / Belakang / Kiri, 44 px, memilih jalur putaran terpendek |
| Papan ketik | panah kiri/kanan saat penampilnya difokus |

**Batasnya, jujur:** ini bukan panorama 360 jahitan. Kamera HP menangkap sekitar 70° sedangkan tiap dinding harus mengisi 90°, jadi fotonya sedikit teregang dan sambungan di pojok tidak selalu pas. Memutar ke atas dan ke bawah juga tidak bisa karena tidak ada foto langit-langit dan lantai.

Kalau fotonya **belum lengkap empat**, kubusnya akan bolong — penampilnya otomatis turun ke mode sederhana (berganti foto satu per satu) dan memberi tahu bahwa pandangannya belum bisa diputar penuh.

Sisi yang sedang tampil diumumkan lewat `aria-live`, tiap foto punya alt yang menyebut sisinya, dan animasinya mati kalau pengguna memilih "kurangi gerak" di sistemnya.

Di sisi penyewa, penampil ini muncul di detail kos KOZY Match kalau kosnya punya foto, bersama **jumlah kamar yang masih kosong**. Ketersediaan kamar hanya tercatat di iklan Papikost (67 dari 307 iklan), jadi kalau sumbernya tidak punya, angkanya tidak ditampilkan dan tidak dikarang.

## Sisi pemilik: banyak tipe kamar

Satu kos hampir tidak pernah punya satu harga saja. Klaim dan dashboard pemilik karena itu bekerja **per tipe kamar**, bukan per kos:

```
pemilik: {
  kawasanId, jenis, bukti,
  tipe: [ { id, nama, harga, kamar, sisa, fasilitas[], foto{depan,kanan,belakang,kiri} } ]
}
```

Tiap tipe punya harga, jumlah kamar, jumlah kamar kosong, fasilitas, dan foto 4 sisinya sendiri. Layar wizard-nya sengaja tetap ringkas — hanya daftar tipe dan satu tombol tambah; semua isiannya masuk ke lembar terpisah.

Dashboard-nya menilai **tiap tipe secara terpisah** terhadap harga pasaran kecamatannya, lengkap dengan simulasi fasilitas per tipe. Badge Harga Wajar baru bisa diunduh kalau **tidak ada satu pun tipe** yang di atas pasaran; kalau ada, tipe mana yang bermasalah disebutkan namanya.

Klaim versi lama yang cuma menyimpan satu harga otomatis dibungkus jadi satu tipe (`rapikanPemilik`), jadi pemilik yang sudah terlanjur klaim tidak kehilangan datanya.

**Foto diperkecil dulu di browser** (`src/lib/foto.js`) sebelum disimpan: sisi terpanjang dipotong ke 1200 px dan dijadikan JPEG mutu 0,72, sehingga satu foto turun ke kisaran 20–60 KB. Tanpa itu, empat sisi dikali beberapa tipe akan melewati jatah localStorage yang cuma ~5 MB — dan localStorage yang penuh gagal diam-diam, datanya hilang tanpa pesan. Diukur pada 4 foto contoh: 156 KB total, seluruh state 209 KB.

## KOZY AI: supaya ketemu dan tahu mau tanya apa

Dua masalah yang diperbaiki sekaligus:

1. **Susah ditemukan.** Di HP, KOZY AI dulu tenggelam di dalam menu hamburger. Sekarang dia **tombol tetap di topbar**, terlihat di HP maupun desktop, dan dikeluarkan dari daftar menu biasa supaya tidak dobel. Bukan tombol melayang (FAB) — itu menutupi isi halaman.
2. **Tidak tahu bisa ditanya apa.** Komponen `src/components/TanyaAI.jsx` dipasang di posisi yang sama di tiap halaman hasil, dan tidak sekadar berbunyi "Tanya AI": isinya langsung 3 pertanyaan nyata sesuai isi halaman, memakai angka yang sedang dilihat pengguna. Misalnya di hasil cek kos kemahalan: *"Cara nawar harga kos dari Rp 1.900.000 ke Rp 1.430.000"*.

Supaya tidak ada saran yang diketuk lalu dijawab "aku belum paham", ditambahkan dua niat baru di `src/api/ai.js`:

| Niat | Contoh pertanyaan | Jawaban |
|---|---|---|
| `nawar` | "Cara nawar harga kos" | 3 kalimat menawar yang memakai angka hasil cek, plus tautan ke Kartu Tawar |
| `cek` | "Apa saja yang wajib dicek sebelum bayar kos?" | daftar hal yang cuma ketahuan kalau datang sendiri |

Kalimat menawar sekarang punya **satu sumber** (`kalimatTawar` di `api/ai.js`) yang dipakai halaman Kartu Tawar sekaligus jawaban KOZY AI, jadi angkanya tidak pernah berbeda antara keduanya. Seluruh saran yang ditampilkan di aplikasi diuji memang menghasilkan jawaban, bukan "belum paham".

## Konfigurasi (`.env.local`)

| Variabel | Fungsi |
|---|---|
| `VITE_API_URL` | Alamat FastAPI. Jika diisi, `cekHarga()` memanggil `POST /vonis` dan mengharapkan `{status, harga_wajar, selisih_rp, selisih_persen, persentil, faktor[], komposisi, pasar{p10,p50,p90,n_pembanding}, meta{confidence, kecamatan, updated_at, sumber, mae}}` |
| `VITE_AI_URL` | Endpoint chatbot. `POST {pesan, konteks}` → `{teks, kartu?, saran?, aksi?}`. Tanpa ini, KOZY AI memakai jawaban berbasis aturan di `src/api/ai.js` |
| `VITE_ANALYTICS_URL` | Endpoint pencatat aktivitas. Kalau diisi, tiap kejadian juga dikirim `POST { jenis, waktu, sesi, ... }`. Tanpa ini, aktivitas hanya tersimpan di perangkat pemakai (localStorage) |
| `VITE_MAP_TILE_URL` | URL tile peta. Default tile publik OpenStreetMap (cukup untuk pengembangan, **bukan** untuk trafik produksi) |
| `VITE_MAP_ATTRIBUTION` | Teks atribusi penyedia tile |

## Yang masih perlu disambungkan

- Login Google, pembayaran QRIS, dan verifikasi klaim pemilik masih disimulasikan. Titik integrasinya ditandai komentar di `src/components/Sheets.jsx`.
- Foto kamar masih tersimpan di perangkat pemilik (localStorage), belum diunggah ke server. `src/lib/foto.js` tinggal diganti unggahan, lalu yang disimpan cukup URL-nya.
- **Foto pemilik belum sampai ke penyewa.** Detail kos di KOZY Match sudah siap menampilkannya (`k.foto` -> `Kamar360`), tetapi belum ada yang menghubungkan satu klaim pemilik ke satu iklan hasil scraping: klaim hanya menyebut kawasan, bukan iklan tertentu. Mencocokkannya dengan tebakan (kecamatan + harga + fasilitas yang mirip) berisiko menempelkan foto ke kos yang salah, jadi sengaja tidak dilakukan. Perlu id kos bersama dari backend. Sementara itu alurnya bisa dilihat lewat `#/demo` -> "Sisi pemilik".
- Layanan survei lapangan berbayar (dulu "KOZY Verified") **sudah dihapus**: sifatnya konvensional dan membuat produknya tidak sepenuhnya digital. Daftar cek yang tersisa di aplikasi adalah panduan untuk penyewa memeriksa sendiri, bukan jasa yang dijual.
- Produk upgrade kamar di `src/data/konten.js` masih daftar contoh dengan tautan pencarian Shopee. Hasil scraping Shopee cukup mengikuti bentuk `{id, nama, kategori, harga, rating, terjual, image_url, url}`.

## Prinsip tampilan dan aksesibilitas

- Latar putih, satu warna aksen biru. Merah, hijau, dan kuning hanya untuk status harga.
- Isian langkah demi langkah: satu pertanyaan per layar, satu tombol utama. Detail disembunyikan sampai dibuka.
- Kontras teks minimal 4,5:1 dan batas kontrol 3:1, target sentuh minimal 44 px, cincin fokus biru 2 px.
- Tautan lompat "Langsung ke konten" dan "Pengaturan aksesibilitas" ada di urutan Tab pertama.
- Peta bersifat visual saja (`aria-hidden`, di luar urutan Tab) dan selalu berpasangan dengan daftar teks.
- Pindah halaman memperbarui judul tab dan memindahkan fokus ke judul halaman.
