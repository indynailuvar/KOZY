KOZY
Data-Driven Kos Price Fairness Assessment Platform for Surabaya
"Kos ini kemahalan atau tidak, dan berapa selisihnya?"
KOZY membantu pengguna mengambil keputusan hunian berdasarkan data, bukan sekadar perkiraan.

📌 Overview
KOZY (Kos Price Analysis System) adalah platform berbasis data yang dirancang untuk menilai kewajaran harga sewa kamar kos di Kota Surabaya.
KOZY menggunakan pendekatan data analytics, hedonic pricing model, machine learning, dan anomaly detection untuk memperkirakan harga wajar sebuah kos berdasarkan karakteristiknya, seperti:
- lokasi
- jarak terhadap pusat aktivitas
- fasilitas kamar
- tipe kos
- kondisi pasar
- karakteristik kawasan
Hasil analisis KOZY memberikan informasi apakah harga suatu kos berada pada kategori:
- 🟦 Murah
- 🟩 Wajar
- 🟥 Kemahalan
beserta informasi pendukung seperti:
- estimasi harga wajar
- selisih harga dalam rupiah dan persentase
- posisi harga terhadap pasar sekitar
- faktor yang mempengaruhi harga
🎯 Background & Problem
Pasar kos di kota besar seperti Surabaya berkembang sangat cepat, terutama di sekitar:
- kampus
- kawasan industri
- pusat bisnis
- rumah sakit
- fasilitas publik
Namun, sebagian besar pengguna kos masih mengalami kesulitan dalam menentukan apakah harga yang ditawarkan sudah sesuai dengan kondisi pasar.
Permasalahan utama:
- Harga kos sering ditentukan secara subjektif oleh pemilik.
- Pengguna tidak memiliki acuan harga yang objektif.
- Perbedaan harga antar kos dengan fasilitas serupa dapat cukup besar.
- Perantau sering mengambil keputusan hanya berdasarkan informasi terbatas.
Sebagai contoh:
Selisih harga Rp200.000/bulan dapat menyebabkan perbedaan biaya hingga Rp2.400.000 dalam satu tahun.

KOZY hadir untuk memberikan transparansi harga melalui pendekatan berbasis data.
💡 Solution & Innovation
KOZY bukan marketplace kos
KOZY tidak menyediakan sistem listing berbayar atau promosi pemilik kos.
KOZY berfungsi sebagai decision support platform yang membantu pengguna memahami kondisi pasar sebelum mengambil keputusan.
Pendekatan utama:
1. Hedonic Pricing Model
Model ini mempelajari hubungan antara harga kos dengan karakteristik yang dimiliki.
Contoh faktor:
- lokasi
- fasilitas AC
- kamar mandi dalam
- luas kamar
- aksesibilitas
- jarak ke pusat aktivitas
2. Machine Learning Prediction
Beberapa model dibandingkan untuk mendapatkan estimasi harga terbaik:
- Linear Regression (OLS)
- Random Forest Regression
- XGBoost Regression
- Support Vector Regression (SVR)
3. Anomaly Detection
Digunakan untuk menemukan harga yang tidak sesuai dengan pola pasar.
Contoh:
Sebuah kos memiliki karakteristik serupa dengan kos Rp900.000, tetapi ditawarkan Rp1.500.000.
Sistem akan mendeteksi adanya penyimpangan harga.
🏗️ System Pipeline
Alur pengembangan KOZY:
Data Collection
(Scraping GMaps, Mamikos, OLX)
          ↓
Data Cleaning & Data Integration
          ↓
Feature Engineering
          ↓
Exploratory Data Analysis
          ↓
Hedonic Pricing Model
(OLS, RF, XGBoost, SVR)
          ↓
Price Prediction
          ↓
Anomaly Detection
          ↓
Explainable AI
          ↓
KOZY Web Application

🚀 Main Features
1. KOZY Price Check
Fitur utama untuk mengevaluasi harga kos.
Pengguna dapat memasukkan informasi kos dan mendapatkan:
- prediksi harga wajar
- status harga
- selisih harga
- tingkat keyakinan analisis
Contoh hasil:
Harga Kos:
Rp1.300.000

Estimasi Harga Wajar:
Rp1.050.000

Status:
Kemahalan

Selisih:
+Rp250.000 (23%)

2. Market Insight
Memberikan gambaran kondisi pasar kos berdasarkan wilayah.
Informasi:
- median harga kawasan
- rentang harga
- distribusi harga
- jumlah pembanding
- tren pasar
3. Explainable AI
KOZY tidak hanya memberikan hasil, tetapi menjelaskan alasan di balik keputusan.
Contoh:
Faktor utama yang mempengaruhi harga:

Lokasi kawasan        50%
Fasilitas             25%
Ukuran kamar          15%
Kondisi pasar         10%

Tujuannya meningkatkan transparansi dan kepercayaan pengguna terhadap sistem.
4. KOZY Match
Fitur rekomendasi untuk membantu pengguna menemukan pilihan kos yang sesuai.
Perhitungan berdasarkan:
- kesesuaian harga
- lokasi
- fasilitas
- tingkat keyakinan data
KOZY tidak mencari kos termurah, tetapi kos yang paling sesuai dengan kebutuhan pengguna.
5. AI Companion
Asisten AI tambahan untuk membantu pengambilan keputusan.
Fungsi:
- menjelaskan hasil analisis
- membantu membandingkan beberapa kos
- memberikan rekomendasi penggunaan budget
- memberikan insight kebutuhan kamar
📊 Analytics Dashboard
KOZY memiliki dashboard analitik untuk memahami perkembangan pasar dan penggunaan platform.
Platform Analytics Dashboard
Digunakan oleh tim KOZY untuk melihat:
- pertumbuhan pengguna
- aktivitas pencarian
- area yang paling banyak dicari
- tren pasar kos
- segmentasi wilayah
- pola kebutuhan pengguna
Metode analisis:
- Descriptive Analytics
- Time Series Analysis
- Spatial Analysis
- Clustering
- Preference Analysis
Owner Insight Dashboard
Dashboard untuk pemilik kos yang telah terverifikasi.
Informasi:
- posisi harga kos terhadap pasar
- median harga kawasan
- tren harga area
- fasilitas yang diminati pengguna
- peluang peningkatan fasilitas
Tujuan:
Membantu pemilik kos memahami kondisi pasar secara objektif.
📁 Repository Structure
KOZY
│
├── docs/
│   ├── Proposal
│   ├── Business Process
│   ├── Research Documentation
│   └── Meeting Notes
│
├── scrapers/
│   ├── Data Collection Script
│   └── Data Integration
│
├── notebooks/
│   ├── Exploratory Data Analysis
│   ├── Feature Engineering
│   └── Machine Learning Model
│
├── app/
│   ├── Frontend
│   ├── Backend API
│   └── Dashboard
│
├── data/
│   └── sample/
│       └── Anonymous Dataset
│
└── README.md

📌 Project Development Status
Timeline	Activity	PIC	Status
Week 1–2	Requirement Analysis & Problem Identification	Team	✅ Completed
Week 2–3	Business Process Design	Team	🔄 In Progress
Week 2–4	Data Collection & Scraping	Data Engineering	🔄 In Progress (848+ records)
Week 3–4	UI/UX Design & Prototype	Frontend Team	⏳ Planned
Week 5–7	Machine Learning Modeling	ML Team	⏳ Planned
Week 7–8	System Integration & Testing	Team	⏳ Planned


👥 Team
Name	Responsibility
Egyanta Bareka Sebayang	Data Engineering & Data Collection
Indy Nailuvar Hamro' Faqi	Frontend Development & UI/UX Design
I Gede Arjuna Danendra	Machine Learning & Data Modeling
Fatih Itsbatul Haq	Backend Development & API Integration
Dailatul Arofah	Business Analysis & Documentation


🔒 Data Privacy & Security
KOZY menerapkan prinsip perlindungan data sesuai:
UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)
Data hasil scraping yang bersifat sensitif seperti:
- nomor telepon pemilik kos
- informasi kontak pribadi
- data identitas individu
tidak disimpan dalam repository.
Repository hanya berisi:
- source code
- dokumentasi
- data contoh anonim
- konfigurasi sistem
📄 License
Proprietary License
Project akademik
Politeknik Elektronika Negeri Surabaya (PENS)
Hak penggunaan dan pengembangan mengikuti aturan internal project.
🌱 Future Development
Pengembangan lanjutan KOZY:
- Integrasi LLM AI Assistant
- Accessibility support untuk pengguna disabilitas
- Prediksi tren harga kawasan
- Mobile application
- KOZY Verified Survey
- Integrasi data kawasan secara real-time
KOZY Vision
Membuat keputusan hunian menjadi lebih transparan, objektif, dan berbasis data.

KOZY tidak menentukan pengguna harus memilih kos mana.
KOZY membantu pengguna memahami pilihan mereka dengan lebih baik.
