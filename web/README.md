# KOZY Web

Frontend KOZY untuk cek kewajaran harga sewa kos di Surabaya. Dibangun dengan React, Vite, dan Leaflet. Semua angka harga berasal dari hasil scraping, bukan angka karangan. Kalau suatu data memang tidak ada di sumbernya, aplikasinya bilang tidak ada — bukan menebak.

## Menjalankan

```bash
cd web
npm install      # sekali saja
npm run dev      # buka http://localhost:5173
```

## Data dan pembanding harga

Empat sumber hasil scraping, dengan peran yang berbeda-beda. Tidak ada satu pun yang lengkap sendirian, jadi perannya dibagi dan tidak dicampur:

| Sumber | Jumlah | Harga sewa | Koordinat | Fasilitas | Dipakai untuk |
|---|---|---|---|---|---|
| Mamikos | 240 iklan | ada | – | 6 jenis | pembanding harga + KOZY Match |
| Papikost | 71 iklan | ada | ada | 10 jenis | pembanding harga + pin peta asli |
| Google Maps | 848 titik | – | ada | – | jangkauan lokasi, harga = kisaran kecamatan |
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
python scripts/build_pasar.py     # gabung iklan sewa, hitung median & kuartil tiap kelompok
python scripts/build_gmaps.py     # beri kisaran harga titik Google Maps
python scripts/build_olx.py       # hitung sisi pemilik dari iklan jual
python scripts/build_kawasan.py   # susun daftar kawasan dari koordinat
```

### Pembanding harga sewa (Mamikos + Papikost)

Keduanya sama-sama iklan **sewa bulanan**, jadi boleh digabung: **307 iklan** (240 Mamikos + 67 Papikost) di **14 kecamatan**. Papikost menyumbang 67 dari 71 — 3 iklan ternyata di Sidoarjo dan 1 harganya Rp 125.000 (terlalu rendah untuk sewa sebulan, kemungkinan tarif harian).

Kewajaran harga dinilai dengan **Robust Statistical Benchmarking, tanpa regresi**. Harga kos dibandingkan dengan sebaran harga iklan asli yang sebanding, yaitu kos sejenis (putra/putri/campur) di kecamatan yang sama:

```
acuan          = median harga pembanding
kisaran wajar  = Q1 – Q3 (separuh tengah harga pembanding)
gap            = (harga − median) / IQR
```

Tiga keputusan penting:

1. **Tidak ada regresi, dan fasilitas tidak ikut menghitung harga.** Di iklan, fasilitas hanya tercatat ada/tidak (0/1) dan sering tidak ditulis pemiliknya, jadi "0" belum tentu berarti tidak ada. Koefisien fasilitas dari data seperti itu tidak cukup andal untuk menggeser harga acuan. Persentase fasilitas tetap disimpan per kecamatan, tetapi hanya untuk dideskripsikan.
2. **Pembandingnya kecamatan × jenis kos, minimal 10 iklan.** Putra, putri, dan campur dipisah karena tingkat harganya berbeda jauh (di Sukolilo median putri Rp 1 jt, campur Rp 1,8 jt). Kelompok di bawah 10 iklan dianggap eksploratif, dan kos di sana dibandingkan dengan seluruh kos di kecamatannya. Ambang 10 sama dengan status "Prioritas (n≥10)" di bundle modeling.
3. **Median dan IQR, bukan rata-rata dan simpangan baku.** Satu-dua iklan yang harganya ekstrem tidak menyeret acuannya. Kuartil memakai interpolasi linear (sama dengan pandas), sehingga 32 kelompok di `pasar.json` identik dengan `price_gap_analysis` di bundle modeling backend — `cek_data.py` menghitungnya ulang dari daftar iklan setiap kali dijalankan.

Hasilnya: **11 kelompok** kecamatan × jenis punya minimal 10 iklan dan mencakup **247 dari 307 iklan** (80%).

| Kelompok | Iklan | Median | Kisaran wajar (Q1–Q3) |
|---|---|---|---|
| Sukolilo · putri | 76 | Rp 1.000.000 | Rp 750.000 – 1.500.000 |
| Wonokromo · putri | 26 | Rp 1.050.000 | Rp 820.875 – 1.500.000 |
| Gubeng · putri | 19 | Rp 1.100.000 | Rp 750.000 – 1.300.000 |
| Wonokromo · putra | 19 | Rp 1.000.000 | Rp 675.000 – 1.300.000 |
| Gubeng · campur | 18 | Rp 1.400.000 | Rp 1.037.500 – 1.787.500 |
| Gubeng · putra | 17 | Rp 1.500.000 | Rp 1.000.000 – 1.850.000 |
| Sukolilo · campur | 17 | Rp 1.800.000 | Rp 1.550.000 – 2.300.000 |
| Wonocolo · campur | 15 | Rp 1.775.000 | Rp 1.612.500 – 2.012.500 |
| Wonokromo · campur | 15 | Rp 1.700.000 | Rp 1.450.000 – 1.900.000 |
| Sukolilo · putra | 14 | Rp 900.000 | Rp 725.000 – 1.187.500 |
| Tenggilis Mejoyo · putri | 11 | Rp 950.000 | Rp 625.000 – 1.250.000 |

Isi `src/data/pasar.json`:

| Bagian | Isi |
|---|---|
| `meta` | sumber, tanggal ambil, jumlah per sumber, metode, `min_pembanding` |
| `kecamatan` | sebaran harga asli (p10–p90), `benchmark` per jenis kos dan `semua` (n, median, q1, q3, iqr, min, max), komposisi jenis, persentase fasilitas, jumlah per sumber, tingkat keyakinan |
| `kos` | daftar iklan asli untuk KOZY Match, lengkap dengan sumber dan koordinat bila ada |

Persentase fasilitas per kecamatan **hanya dihitung dari iklan yang situsnya memang mencatat fasilitas itu**. Papikost tidak mencatat kloset dan akses 24 jam, jadi kalau ikut dihitung sebagai 0, kecamatan yang datanya hanya dari Papikost akan terlihat "tidak punya kloset" padahal artinya "tidak diketahui".

### Google Maps: lokasi, bukan harga

```
../gmaps_all_basic.json  →  scripts/build_gmaps.py  →  src/data/gmaps.json
```

848 titik yang isinya cuma **nama dan link**. Tetapi koordinatnya sebenarnya sudah ikut tertulis di dalam link Google Maps (pola `!3d<lat>!4d<lng>`), jadi bisa dibaca semuanya tanpa membuka halaman satu per satu — 848 dari 848 berhasil.

**Fasilitasnya tidak bisa diambil dan tidak dikarang.** Halaman Google Maps-nya sudah diperiksa: dari 192 KB HTML, tidak ada satu pun kata WiFi, AC, kamar mandi, atau fasilitas. Google memang tidak menyimpan fasilitas kos.

Karena harga juga kosong, angkanya diambil dari **pembanding**, tidak pernah ditampilkan sebagai harga iklan:

```
estimasi = median, rendah = Q1, tinggi = Q3
dari kos sejenis di kecamatan itu (jenis dibaca dari nama, mis. "kost putri")
```

Artinya "kisaran harga iklan kos di sekitar titik ini" — jadi sesama titik di satu kecamatan angkanya memang sama. Di aplikasi, angka ini selalu tampil sebagai **rentang** dengan label "perkiraan" dan tautan ke Google Maps untuk menanyakan harga aslinya.

| Keyakinan | Kondisi |
|---|---|
| sedang | pembandingnya minimal 10 iklan di kecamatan itu (321 titik) |
| rendah | pembandingnya lebih sedikit, atau kecamatannya punya kurang dari 5 iklan berharga sehingga dipakai sebaran seluruh kota |

Kecamatannya dicari dari koordinat lewat `scripts/geocode_titik.py` (Nominatim/OpenStreetMap). Layanannya gratis tetapi dibatasi 1 permintaan/detik, dan setelah beberapa ratus permintaan jawabannya melambat sampai ~19 detik per titik. Karena itu urutan permintaannya diatur supaya berhenti di tengah pun hasilnya sudah berguna: Papikost dulu, lalu satu wakil tiap klaster 500 m, baru sisanya. Titik yang belum sempat ditanyakan mengambil wilayah dari **tetangga berlabel terdekat dalam radius 400 m** — cara ini diuji pada titik yang sudah punya label dan **96,7% tepat**, dan tiap baris menyimpan `wilayah_dari` supaya ketahuan mana yang hasil geocoding dan mana yang dari tetangga. Titik yang tidak punya tetangga sedekat itu dibiarkan kosong, bukan ditebak asal.

Titik yang ternyata kos yang sama dengan iklan berharga asli (jarak < 60 m) ditandai `harga_asli` dan disembunyikan dari daftar "Kos lain di sekitar", supaya tidak terhitung dua kali.

### OLX: rumah kos dijual, bukan sewa

```
../olx_data.json  →  scripts/build_olx.py  →  src/data/olx.json
```

Sumber ini **bukan harga sewa bulanan**. Yang diiklankan adalah **rumah kos yang dijual**, harganya Rp 1,2–7,5 **miliar**. Mencampurnya ke data sewa akan merusak seluruh penilaian kewajaran harga untuk penyewa, jadi **harga jualnya tidak pernah ikut pembanding harga sewa** dan tidak pernah muncul di halaman penyewa.

Yang dipakai justru kebalikannya: median sewa iklan di kecamatan yang sama dipakai untuk memperkirakan **pendapatan** bangunan itu, lalu dibandingkan dengan harga jualnya.

```
sewa_kamar          = median harga sewa iklan di kecamatan itu (kota, kalau kecamatannya < 5 iklan)
pendapatan_setahun  = jumlah_kamar × sewa_kamar × 12
imbal_hasil_kotor   = pendapatan_setahun / harga_jual
```

Hasilnya: median harga jual Rp 4,5 miliar, 20 kamar, **Rp 165 juta per kamar**, imbal hasil kotor **8,8% per tahun**, balik modal sekitar **11 tahun**.

**Batasannya besar dan selalu ikut ditampilkan:** hanya 20 iklan, dari **2 penjual saja**, diunggah pada **satu hari yang sama**, dan terpusat di kawasan kampus. Ini inventaris satu agen properti, bukan sampel pasar. Angkanya hanya gambaran kasar dan hanya tampil di dashboard internal.

### Kawasan: dari koordinat, bukan tulisan tangan

```
pasar.json + gmaps.json  →  scripts/build_kawasan.py  →  src/data/kawasan.json
```

Daftar kelurahan yang bisa dipilih pengguna dulu ditulis tangan lengkap dengan koordinat kira-kira. Sekarang dibuat dari data: tiap titik kos sudah punya kelurahan + kecamatan, jadi titik tengah kawasan memakai **median koordinat kos yang benar-benar ada di sana**, dan jaraknya ke pusat aktivitas dihitung dari koordinat itu, bukan ditaksir. Kelurahan dengan kurang dari 3 titik dibuang supaya tidak muncul kawasan yang isinya cuma satu kos nyasar. Nama id kawasan lama dipertahankan agar pilihan yang sudah tersimpan di browser pengguna tidak hilang.

### Arsitektur metode — keputusan yang sudah diuji

Datanya dianggap final: 15 situs dicoba, hanya Mamikos dan Papikost yang bisa diambil.

| Keputusan | Alasan |
|---|---|
| **Tanpa regresi: harga dinilai dengan median & IQR** | Variabel fasilitas di iklan hanya ada/tidak dan sering tidak ditulis, luas kamar dan jarak ke kampus tidak ada di sumber mana pun, dan baru 6 dari 14 kecamatan yang datanya cukup. Pembanding nonparametrik tidak menuntut variabel-variabel itu lengkap. |
| **Pembanding = kecamatan × jenis, minimal 10 iklan** | Jenis kos menggeser harga paling jauh dan tercatat lengkap di kedua sumber. Di bawah 10 iklan kuartilnya terlalu goyah, jadi dipakai seluruh kecamatan. |
| **Wajar = Q1–Q3, ekstrem = pagar Tukey** | Status hanya dari posisi terhadap kuartil. Harga di luar Q1 − 1,5·IQR … Q3 + 1,5·IQR (atau di luar harga termurah–termahal) diberi catatan untuk dipastikan, bukan otomatis dicap salah. |
| **Segmentasi: K-Prototypes, bukan K-Means** | Datanya campuran angka dan kategori. Selisih silhouette dengan K-Means **+0,000** — benar-benar imbang; dipilih karena centroid-nya punya modus kategorikal yang bisa dibaca. |
| **Harga TIDAK ikut membentuk cluster di `segmen.json`** | Kalau harga dipakai membentuk cluster lalu cluster itu dipakai menilai harga, penilaiannya melingkar. Cluster **melabeli**, pembanding median–IQR **menilai**. |
| **k dipilih dengan syarat ukuran** | Cluster beranggota 7 tidak berguna sebagai label. Syarat minimal 15 anggota; di antara yang lolos, silhouette tertinggi menang → **k = 2**. |

```
data mentah (scrapers/)
   └─ geocode_titik.py      koordinat -> kelurahan + kecamatan
        └─ build_pasar.py   GABUNG + saring + median & kuartil + periksaGabungan() ← satu-satunya tempat penggabungan
             ├─ build_segmen.py      K-Prototypes tanpa harga   -> segmen.json
             ├─ build_gmaps.py       kisaran harga 844 titik    -> gmaps.json
             ├─ build_olx.py         sisi pemilik               -> olx.json
             ├─ build_kawasan.py     daftar kelurahan           -> kawasan.json
             ├─ export_dataset.py    CSV datar (notebook)       -> analysis/kozy_dataset_final.csv
             └─ cek_data.py          32 pemeriksaan dari berkas mentah
```

**Penggabungan hanya boleh ada di satu tempat.** Sebelumnya ada dua jalur yang hidup berdampingan, dan yang satu diam-diam mengosongkan seluruh fasilitas Mamikos karena nama kolomnya tidak dipetakan (`ada_ac` vs `ac`) — hasilnya melenceng jauh tanpa pesan error, bahkan tetap mencetak "BERHASIL". Karena itu `build_pasar.py` sekarang punya `periksaGabungan()` yang **menghentikan pipeline** kalau:

- ada fasilitas yang kosong di seluruh baris satu sumber (pemetaan kolom putus),
- `jenis` bukan persis 3 kategori (huruf besar-kecil antar sumber),
- kecamatan masih membawa sufiks kota (satuan wilayah belum disamakan),
- ada harga di luar rentang sewa bulanan yang wajar.

Keempatnya sudah diuji benar-benar menolak, bukan sekadar ditulis.

### Memakai pembandingnya di luar aplikasi web

Semua angka pembanding sudah tersimpan apa adanya di `src/data/pasar.json`, jadi cukup Python bawaan:

```python
import json
p = json.load(open("src/data/pasar.json", encoding="utf-8"))
b = p["kecamatan"]["Sukolilo"]["benchmark"]["putri"]
# {'n': 76, 'median': 1000000, 'q1': 750000, 'q3': 1500000, 'iqr': 750000, 'min': 450000, 'max': 2500000}
gap_iqr = (1_300_000 - b["median"]) / b["iqr"]   # 0.4 -> masih di dalam Q1–Q3
```

Backend menyajikan angka yang sama lewat `POST /modeling/price-gap` (dari bundle modeling), jadi hasil Python, aplikasi web, dan API tidak pernah berbeda.

### Arti sel kosong di `analysis/kozy_dataset_final.csv`

| Nilai | Artinya |
|---|---|
| kosong | situs sumbernya **tidak mencatat** kolom itu |
| `0` | tercatat, dan memang tidak ada |
| `1` | tercatat, dan ada |

Mengisi "tidak tercatat" dengan `0` akan membuat situs yang tidak mencatat terlihat seolah semua kosnya tanpa fasilitas itu — persis kesalahan yang dulu merusak analisisnya. Mamikos tidak mencatat lemari/meja/parkir/TV; Papikost tidak mencatat kloset duduk/akses 24 jam.

### Yang masih kosong di semua sumber

- **Luas kamar** → langkah luas dihapus dari Cek Harga.
- **Nomor pemilik** → tombol kontak diganti tautan ke iklan aslinya.
- **Fasilitas untuk 848 titik Google Maps** → memang tidak ada di sumbernya, jadi titik itu hanya dipakai untuk lokasi.
- **Koordinat untuk 240 iklan Mamikos** → pinnya masih sebaran perkiraan di sekitar kawasan dan diberi keterangan. Iklan Papikost sudah pakai koordinat asli.
- **Kecamatan dengan data sangat sedikit** → tetap dibandingkan dengan iklan yang ada, tetapi ditandai keyakinan rendah plus keterangan jumlah iklannya.

### Status harga

| Status | Posisi terhadap pembanding | Tampilan |
|---|---|---|
| Kemahalan | di atas Q3 (lebih mahal dari 3 dari 4 kos sejenis) | merah, CTA Kartu Tawar |
| Wajar | Q1 s.d. Q3 | hijau |
| Murah | di bawah Q1 | biru, menampilkan "Kamu hemat" dan "Hemat setahun" |

Angka besar di hasil adalah **harga tengah (median)** pembanding, dan selisih dihitung terhadap median itu. Kartu "Posisi di pasar" menampilkan box plot sederhana: harga termurah–termahal pembanding, pita Q1–Q3, titik median, dan harga dari pemilik.

Harga murah adalah kabar baik dan ditampilkan begitu. Kalau harganya **ekstrem** — di luar pagar 1,5 × IQR atau lebih murah dari semua pembanding — KOZY menambahkan satu catatan "Harga bagus, pastikan dulu sebelum transfer" berisi hal yang perlu dicek langsung, bukan mengubah vonisnya jadi peringatan. Harga ekstrem di sisi mahal memunculkan banner "Harga ini tidak biasa".

Angka yang diisi di Cek Harga adalah **harga dari pemilik**, bukan budget penyewa. Kalau ternyata itu budget, ada tautan ke Cari Kos. Sebaliknya, di halaman rekomendasi area, kalau budget lebih besar daripada harga pasaran, KOZY menghitung sisanya dan menawarkan ide belanja perabot lewat KOZY AI.

## Halaman

| Halaman | URL | Isi |
|---|---|---|
| Beranda | `#/` | 2 pilihan: sudah punya kos incaran / sedang mencari kos |
| Cek harga | `#/cek` → `#/hasil` | 4 langkah: lokasi, jenis kos, harga dari pemilik, fasilitas. Hasilnya status harga, harga tengah dan kisaran wajar kos sejenis, segmen K-Prototypes, posisi di pasar, dan peta kelurahan (pin terkunci) |
| KOZY Match | `#/match` | peta pin harga kos asli. Ketuk pin untuk detail, fasilitas, skor kecocokan, tautan ke iklan, Kartu Tawar, dan pilihan bandingkan |
| Kartu Tawar | `#/kartu-tawar` | ringkasan dan 3 kalimat tawar, bisa disimpan PDF atau dikirim lewat WA |
| Cari kos | `#/cari` → `#/kawasan` | 6 langkah: persona, dekat dengan, tujuan, budget, jenis kos, fasilitas. Hasilnya daftar/peta area dan saran KOZY AI |
| Bandingkan | `#/bandingkan` | 5 langkah (atau 1 langkah dari KOZY Match) → rekomendasi KOZY AI dan tabel perbandingan |
| KOZY AI | `#/ai` | chat: ide upgrade kamar, memilih kos, cara menawar, daftar cek sebelum bayar, tips keuangan |
| Edukasi | `#/edukasi` | tips keuangan anak kos dan kalkulator budget |
| Riwayat | `#/riwayat` | tersimpan di localStorage |
| **Dashboard pemilik kos** | `#/pemilik` | klaim 4 langkah (lokasi, jenis kos, tipe kamar, bukti) → 6 lembar: ringkasan kos, posisi harga per tipe, badge, siapa yang mencari kos di daerahnya, persaingan, saran penargetan |
| Tentang | `#/tentang` | metodologi, batas data, netralitas |
| **Dashboard internal KOZY** | `#/internal` | halaman tim KOZY, berkode akses: mutu dataset, aktivitas pengguna, metode pembanding harga, ramalan |
| Skenario presentasi | `#/demo` | halaman internal: pintasan skenario kemahalan, wajar, jauh di bawah pasaran, data sedikit, belum ada data, luar cakupan, gagal memuat |

### Dua dashboard yang sengaja dipisah

Keduanya halaman berbeda, tidak pernah saling menaut, dan tidak berbagi satu angka pun.

| | Dashboard internal KOZY | Dashboard pemilik kos |
|---|---|---|
| Alamat | `#/internal` (berkode akses) | `#/pemilik` |
| Pembacanya | tim KOZY, investor, dosen penguji | pemilik kos |
| Isinya | mutu dan cakupan dataset, aktivitas seluruh pengguna, metode pembanding harga, apa yang belum bisa diramalkan | pasar di sekitar kosnya sendiri: posisi harga tiap tipe, siapa yang mencari kos di daerahnya, pesaing, saran penargetan |

Kode aksesnya diatur lewat `VITE_KOZY_PIN` (lihat `.env.example`); bawaannya `kozysukses`.
Karena KOZY berjalan sepenuhnya di peramban, kode ini menghalangi orang yang
mengetik alamatnya langsung, bukan orang yang membuka peralatan pengembang.
Pengamanan sungguhan menuntut datanya pindah ke server.

#### Isi `#/internal`

- `#/internal` → **Data pasar**
- `#/internal?tab=aktivitas` → **Aktivitas**
- `#/internal?tab=model` → **Metode & ramalan** (cara menilai harga, ramalan harga, kebutuhan pasar)
- `#/internal?tab=omzet` → **Omzet paket** (forecast Chronos-2 dari histori dummy)

Grafiknya mengikuti aturan *Storytelling with Data* bab 2: judul memuat pesannya, batang selalu mulai dari nol, nilai dilabeli langsung, satu warna aksen, dan tidak ada pie, donut, 3D, atau sumbu Y kedua.

| Visual | Isi |
|---|---|
| Teks angka besar | jumlah iklan, median harga, kelompok pembanding siap pakai, cakupannya |
| Batang horizontal | median harga atau jumlah iklan per kecamatan (bisa ditukar) |
| Tabel border minimal | median dan kisaran wajar (Q1–Q3) tiap kelompok kecamatan × jenis |
| Batang horizontal | lebar kisaran wajar (IQR) tiap kelompok |
| Histogram | sebaran 307 harga iklan per Rp 250 rb |
| Heatmap | persentase kepemilikan fasilitas per kecamatan |
| Batang bertumpuk 100% | komposisi jenis kos per kecamatan |
| Scatterplot | hubungan jumlah fasilitas dengan harga, plus garis median |
| Tabel border minimal | peran tiap sumber: apa yang dibawa, apa yang kosong |
| Batang horizontal | sebaran titik Google Maps per kecamatan |
| Batang horizontal | harga jual rumah kos per kamar tiap kecamatan (OLX, sisi pemilik) |
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

Dashboard-nya menilai **tiap tipe secara terpisah** terhadap pembanding yang sama (kos sejenis di kecamatannya), jadi yang membedakan hasilnya hanya harga tiap tipe. Badge Harga Wajar baru bisa diunduh kalau **tidak ada satu pun tipe** yang di atas pasaran; kalau ada, tipe mana yang bermasalah disebutkan namanya.

Klaim versi lama yang cuma menyimpan satu harga otomatis dibungkus jadi satu tipe (`rapikanPemilik`), jadi pemilik yang sudah terlanjur klaim tidak kehilangan datanya.

**Foto diperkecil dulu di browser** (`src/lib/foto.js`) sebelum disimpan: sisi terpanjang dipotong ke 1200 px dan dijadikan JPEG mutu 0,72, sehingga satu foto turun ke kisaran 20–60 KB. Tanpa itu, empat sisi dikali beberapa tipe akan melewati jatah localStorage yang cuma ~5 MB — dan localStorage yang penuh gagal diam-diam, datanya hilang tanpa pesan. Diukur pada 4 foto contoh: 156 KB total, seluruh state 209 KB.

## KOZY AI: supaya ketemu dan tahu mau tanya apa

Dua masalah yang diperbaiki sekaligus:

1. **Susah ditemukan.** Di HP, KOZY AI dulu tenggelam di dalam menu hamburger. Sekarang dia **tombol tetap di topbar**, terlihat di HP maupun desktop, dan dikeluarkan dari daftar menu biasa supaya tidak dobel. Bukan tombol melayang (FAB) — itu menutupi isi halaman.
2. **Tidak tahu bisa ditanya apa.** Komponen `src/components/TanyaAI.jsx` dipasang di posisi yang sama di tiap halaman hasil, dan tidak sekadar berbunyi "Tanya AI": isinya langsung 3 pertanyaan nyata sesuai isi halaman, memakai angka yang sedang dilihat pengguna. Misalnya di hasil cek kos kemahalan: *"Cara nawar harga kos dari Rp 1.900.000 ke Rp 1.500.000"* (batas atas kisaran wajar).

Supaya tidak ada saran yang diketuk lalu dijawab "aku belum paham", ditambahkan dua niat baru di `src/api/ai.js`:

| Niat | Contoh pertanyaan | Jawaban |
|---|---|---|
| `nawar` | "Cara nawar harga kos" | 3 kalimat menawar yang memakai angka hasil cek, plus tautan ke Kartu Tawar |
| `cek` | "Apa saja yang wajib dicek sebelum bayar kos?" | daftar hal yang cuma ketahuan kalau datang sendiri |

Kalimat menawar sekarang punya **satu sumber** (`kalimatTawar` di `api/ai.js`) yang dipakai halaman Kartu Tawar sekaligus jawaban KOZY AI, jadi angkanya tidak pernah berbeda antara keduanya. Seluruh saran yang ditampilkan di aplikasi diuji memang menghasilkan jawaban, bukan "belum paham".

## Konfigurasi (`.env.local`)

| Variabel | Fungsi |
|---|---|
| `VITE_API_URL` | Alamat FastAPI untuk segmen K-Prototypes (`/modeling/segment`), gap median & IQR di Bandingkan (`/modeling/price-gap`), dan forecast Chronos-2 (`/forecast/omzet-paket`). Cek Harga tidak membutuhkannya: pembandingnya dihitung di perangkat dari `pasar.json` |
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
