\# KOZY



\*\*Sistem penilaian kewajaran harga sewa kamar kos berbasis data untuk Kota Surabaya.\*\*

\_"Kos ini kemahalan atau tidak, dan berapa selisihnya?" — KOZY menjawab dengan angka, bukan opini.\_



\##  Masalah

Harga kos ditentukan sepihak oleh pemilik. Perantau (mahasiswa \& pekerja) tidak punya

pembanding, sehingga sering membayar di atas harga pasar. Selisih Rp 200.000/bulan

= Rp 2.400.000/tahun.



\## 💡 Solusi \& Kebaruan

KOZY \*\*bukan platform listing\*\*. KOZY menilai kewajaran harga dengan model

\*hedonic pricing\* + deteksi anomali yang belajar dari ribuan iklan kos Surabaya,

lalu menyajikan: putusan (murah/wajar/mahal), selisih rupiah \& persen,

rincian kontribusi tiap atribut, dan posisi harga di pasar radius terdekat.



\## 🧩 Pipeline Proyek

scraping (GMaps/Mamikos/OLX) → pembersihan \& penyatuan → feature engineering

→ model hedonic (OLS vs Random Forest vs XGBoost vs SVR) → deteksi anomali

→ aplikasi web (penilaian + kartu tawar).



\## 📁 Struktur Repository

| Folder | Isi |

|---|---|

| `docs/` | Proposal, SWOT, bisnis proses, metodologi, notulen rapat |

| `scrapers/` | Script pengumpulan \& penyatuan data |

| `notebooks/` | EDA dan pemodelan |

| `app/` | Aplikasi web (frontend \& backend) |

| `data/sample/` | Data contoh ter-anonim untuk demo |



\## 📊 Status Proyek

| Minggu | Pekerjaan | Penanggung Jawab | Status |

|---|---|---|---|

| 1–2 | Analisis kebutuhan \& SWOT | Tim | ✅ Selesai |

| 2–3 | Desain bisnis proses | Tim | 🔄 Berjalan |

| 2–4 | Scraping data kos Surabaya | Data Engineering | 🔄 Berjalan (848 record dasar) |

| 3–4 | Desain UI/UX | Frontend | ⏳ Menunggu |

| 5–7 | Pemodelan \& deteksi anomali | Modeling | ⏳ Menunggu |



\## 👥 Tim

| Nama | Peran |

|---|---|

| Egyanta Bareka Sebayang | Data Engineering \*(sesuaikan)\* |

| Indy Nailuvar Hamro' Faqi | Frontend \& UI/UX |

| I Gede Arjuna Danendra | Machine Learning \*(sesuaikan)\* |

| Fatih Itsbatul Haq | Backend \& API \*(sesuaikan)\* |

| Dailatul Arofah | Analisis Bisnis \& Dokumentasi \*(sesuaikan)\* |



\## 🔒 Catatan Privasi

Data mentah hasil scraping (termasuk nomor telepon pemilik kos) \*\*tidak disimpan

di repository ini\*\* sesuai UU No. 27/2022 tentang Perlindungan Data Pribadi.

Repository hanya berisi kode, dokumentasi, dan data contoh ter-anonim.



\## 📄 Lisensi

Proprietary — Project Akademik, Politeknik Elektronika Negeri Surabaya.

