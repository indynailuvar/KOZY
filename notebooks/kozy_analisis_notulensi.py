#!/usr/bin/env python3
# =============================================================================
# KOZY - ANALISIS DATA & PEMODELAN KOS SURABAYA BERDASARKAN NOTULENSI TERBARU
# =============================================================================
# Pembaruan Metode (Tanpa Regresi Linear):
# 1. Multivariate Analisis Gap (Membedakan gap terhadap harga dan fasilitas kos)
# 2. Forecasting Omzet Pemilik Kos (Proyeksi omzet dan tren harga kos ke depan)
# 3. Clustering Segmentasi Kos dengan K-Prototypes (Eksklusif, Menengah, Murah)
# 4. Generator Data Dummy Sesi Penjualan / Booking Transaksi Bulanan Kos
# 5. Struktur kode rapi, modular, dan terstandardisasi tanpa mengubah output valid
# =============================================================================

import os
import sys
import io
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
from scipy.optimize import minimize

warnings.filterwarnings("ignore")
np.set_printoptions(suppress=True)

# -----------------------------------------------------------------------------
# 1. KONFIGURASI TAMPILAN GRAFIK & FORMAT MATA UANG
# -----------------------------------------------------------------------------
BIRU = "#2a78d6"
JINGGA = "#eb6834"
HIJAU = "#1baf7a"
KUNING = "#eda100"
UNGU = "#8b5cf6"
MERAH = "#ef4444"
ABU = "#9a9a97"
TINTA = "#0b0b0b"

plt.rcParams.update({
    "figure.dpi": 115,
    "font.size": 9,
    "axes.titlesize": 10,
    "axes.titleweight": "bold",
    "axes.edgecolor": "#d8d8d4",
    "axes.linewidth": 0.8,
    "axes.grid": True,
    "grid.color": "#ececea",
    "grid.linewidth": 0.7,
    "axes.axisbelow": True,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "xtick.color": "#52514e",
    "ytick.color": "#52514e",
    "text.color": TINTA,
    "figure.facecolor": "white",
})

rp = lambda v: f"Rp {v:,.0f}".replace(",", ".")
rp_singkat = lambda v: f"Rp {v/1e6:.2f} jt" if v >= 1e6 else f"Rp {v/1e3:.0f} rb"


# -----------------------------------------------------------------------------
# 2. LOAD DATA PASAR & AUDIT KETERSEDIAAN VARIABEL
# -----------------------------------------------------------------------------
def cari_file_pasar():
    kandidat = [
        "web/src/data/pasar.json",
        "../web/src/data/pasar.json",
        "../../web/src/data/pasar.json",
        "src/data/pasar.json",
        os.path.join(os.path.dirname(__file__), "..", "web", "src", "data", "pasar.json") if "__file__" in locals() else "",
    ]
    for jalur in kandidat:
        if jalur and os.path.exists(jalur):
            return jalur
    raise FileNotFoundError("Berkas pasar.json tidak ditemukan. Periksa direktori kerja.")


def load_dataset():
    jalur = cari_file_pasar()
    with io.open(jalur, encoding="utf-8") as f:
        data_pasar = json.load(f)
    kos_list = data_pasar["kos"]
    meta = data_pasar.get("meta", {})
    return kos_list, meta


# -----------------------------------------------------------------------------
# 3. CLUSTERING K-PROTOTYPES (SEGMENTASI KOS: EKSKLUSIF, MENENGAH, MURAH)
# -----------------------------------------------------------------------------
FAS6 = ["km", "ac", "wifi", "kasur", "kloset", "akses24"]

def hitung_jarak_kprototypes(Xnum, Xcat, Cnum, Ccat, gamma):
    """Jarak campuran Huang (1997): Euclidean kuadrat untuk numerik + Simple Matching untuk kategorik."""
    dist_num = ((Xnum[:, None, :] - Cnum[None]) ** 2).sum(axis=2)
    dist_cat = gamma * (Xcat[:, None, :] != Ccat[None]).sum(axis=2)
    return dist_num + dist_cat

def kprototypes(Xnum, Xcat, k, gamma, seed=42, iterasi=100):
    """
    Algoritma K-Prototypes (Huang, 1997) untuk segmentasi data campuran numerik & kategorikal.
    """
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(Xnum), k, replace=False)
    Cnum = Xnum[idx].copy()
    Ccat = Xcat[idx].copy()
    label = np.full(len(Xnum), -1)

    for _ in range(iterasi):
        dist = hitung_jarak_kprototypes(Xnum, Xcat, Cnum, Ccat, gamma)
        label_baru = dist.argmin(axis=1)
        if (label_baru == label).all():
            break
        label = label_baru

        for j in range(k):
            mask = (label == j)
            if not mask.any():
                continue
            Cnum[j] = Xnum[mask].mean(axis=0)  # Rata-rata untuk numerik
            for c in range(Xcat.shape[1]):
                vals, counts = np.unique(Xcat[mask, c], return_counts=True)
                Ccat[j, c] = vals[counts.argmax()]  # Modus untuk kategorik

    return label, Cnum, Ccat

def jalankan_segmentasi_kprototypes(kos_list, k=3, seed=42):
    """
    Melakukan segmentasi kos menjadi 3 kelas (Eksklusif, Menengah, Murah)
    menggunakan variabel harga, skor kelengkapan fasilitas, kecamatan, dan jenis kos.
    """
    Xn_raw = []
    Xc_raw = []
    for k_item in kos_list:
        fas_score = sum(1 for f in FAS6 if f in k_item["fasilitas"]) / len(FAS6) * 100
        Xn_raw.append([np.log(k_item["harga"]), fas_score])
        Xc_raw.append([k_item["kec"], k_item["jenis"]])

    Xn_raw = np.array(Xn_raw, dtype=float)
    Xc_raw = np.array(Xc_raw, dtype=object)

    # Standarisasi numerik Z-Score
    mu_num = Xn_raw.mean(axis=0)
    std_num = Xn_raw.std(axis=0)
    Xn_std = (Xn_raw - mu_num) / std_num
    gamma = 0.5 * float(Xn_std.std(axis=0).mean())

    label_raw, Cnum, Ccat = kprototypes(Xn_std, Xc_raw, k=k, gamma=gamma, seed=seed)

    # Urutkan klaster berdasarkan median harga tertinggi ke terendah
    harga_arr = np.array([k_item["harga"] for k_item in kos_list], dtype=float)
    median_harga_per_cluster = [np.median(harga_arr[label_raw == j]) for j in range(k)]
    urutan_idx = np.argsort(median_harga_per_cluster)[::-1]  # tertinggi = 0, terendah = 2

    mapping_urutan = {lama: baru for baru, lama in enumerate(urutan_idx)}
    label_final = np.array([mapping_urutan[l] for l in label_raw])

    nama_segmen = {
        0: "Kos Eksklusif / Premium",
        1: "Kos Menengah / Standar",
        2: "Kos Murah / Ekonomis"
    }

    profil_list = []
    for j in range(k):
        mask = (label_final == j)
        sub_kos = [k_item for idx, k_item in enumerate(kos_list) if mask[idx]]
        h_sub = harga_arr[mask]

        fas_mean = {}
        for f in FAS6:
            fas_mean[f] = round(float(np.mean([f in item["fasilitas"] for item in sub_kos])) * 100, 1)

        kec_mode = pd.Series([item["kec"] for item in sub_kos]).mode()[0]
        jenis_mode = pd.Series([item["jenis"] for item in sub_kos]).mode()[0]

        profil_list.append({
            "cluster_id": j,
            "nama_segmen": nama_segmen.get(j, f"Segmen {j+1}"),
            "jumlah_kos": int(mask.sum()),
            "persen_data": round(float(mask.mean()) * 100, 1),
            "median_harga": float(np.median(h_sub)),
            "p25_harga": float(np.percentile(h_sub, 25)),
            "p75_harga": float(np.percentile(h_sub, 75)),
            "min_harga": float(np.min(h_sub)),
            "max_harga": float(np.max(h_sub)),
            "rata_fasilitas_pct": round(float(np.mean([sum(1 for f in FAS6 if f in item["fasilitas"])/len(FAS6)*100 for item in sub_kos])), 1),
            "kecamatan_dominan": kec_mode,
            "jenis_dominan": jenis_mode,
            "detail_fasilitas": fas_mean
        })

    profil_df = pd.DataFrame(profil_list)
    return label_final, profil_df, Xn_raw, Xc_raw


# -----------------------------------------------------------------------------
# 4. MULTIVARIATE ANALISIS GAP (HARGA VS FASILITAS KOS - TANPA REGRESI LINEAR)
# -----------------------------------------------------------------------------
def analisis_gap_multivariat(kos_list, cluster_labels, profil_df):
    """
    Multivariate Gap Analysis (Non-Regresi Linear):
    Membandingkan kesenjangan simultan antara Skor Kelengkapan Fasilitas Multivariat
    dengan Beban Harga Sewa terhadap standar pasar.
    """
    n = len(kos_list)
    harga_arr = np.array([k["harga"] for k in kos_list], dtype=float)
    fas_skor = np.array([sum(1 for f in FAS6 if f in k["fasilitas"]) / len(FAS6) * 100 for k in kos_list], dtype=float)

    # 1. Normalisasi Z-Score untuk dimensi Fasilitas dan Harga
    z_fasilitas = (fas_skor - fas_skor.mean()) / fas_skor.std()
    log_harga = np.log(harga_arr)
    z_harga = (log_harga - log_harga.mean()) / log_harga.std()

    # 2. Value Gap Score = Fasilitas Standar - Harga Standar
    # Positif: Nilai fasilitas melebihi harga (Best Value / Murah)
    # Dekat 0: Nilai fasilitas seimbang dengan harga (Wajar)
    # Negatif: Harga jauh lebih tinggi dari fasilitas (Overpriced / Kemahalan)
    gap_score = z_fasilitas - z_harga

    # 3. Benchmark Harga berdasarkan Profil Fasilitas (Non-Regresi Linear)
    # Menggunakan median harga kos di pasar pada tingkat kelengkapan fasilitas yang sama
    df_temp = pd.DataFrame({"fas_cnt": [sum(1 for f in FAS6 if f in k["fasilitas"]) for k in kos_list], "harga": harga_arr})
    benchmark_fasilitas_map = df_temp.groupby("fas_cnt")["harga"].median().to_dict()

    gap_nominal = []
    gap_persen = []
    kategori_gap = []
    kuadran_gap = []

    for i in range(n):
        f_cnt = sum(1 for f in FAS6 if f in kos_list[i]["fasilitas"])
        bench = benchmark_fasilitas_map.get(f_cnt, np.median(harga_arr))
        diff_rp = harga_arr[i] - bench
        diff_pct = (diff_rp / bench) * 100

        gap_nominal.append(diff_rp)
        gap_persen.append(round(diff_pct, 1))

        # Klasifikasi Status Kewajaran berdasarkan Gap
        if gap_score[i] >= 0.45:
            kategori_gap.append("Best Value / Murah")
        elif gap_score[i] <= -0.45:
            kategori_gap.append("Overpriced / Kemahalan")
        else:
            kategori_gap.append("Wajar / Seimbang")

        # Klasifikasi 4 Kuadran Multivariat Gap (Fasilitas vs Harga)
        if z_fasilitas[i] >= 0 and z_harga[i] < 0:
            kuadran_gap.append("Kuadran I: Best Value (Fasilitas Tinggi, Harga Rendah)")
        elif z_fasilitas[i] >= 0 and z_harga[i] >= 0:
            kuadran_gap.append("Kuadran II: Eksklusif Wajar (Fasilitas Tinggi, Harga Tinggi)")
        elif z_fasilitas[i] < 0 and z_harga[i] < 0:
            kuadran_gap.append("Kuadran III: Ekonomis Wajar (Fasilitas Dasar, Harga Rendah)")
        else:
            kuadran_gap.append("Kuadran IV: Overpriced (Fasilitas Dasar, Harga Tinggi)")

    df_gap = pd.DataFrame({
        "nama": [k["nama"] for k in kos_list],
        "kec": [k["kec"] for k in kos_list],
        "jenis": [k["jenis"] for k in kos_list],
        "sumber": [k["sumber"] for k in kos_list],
        "cluster_segmen": [profil_df.loc[profil_df.cluster_id == cl, "nama_segmen"].values[0] for cl in cluster_labels],
        "harga": harga_arr,
        "skor_fasilitas": np.round(fas_skor, 1),
        "z_fasilitas": np.round(z_fasilitas, 2),
        "z_harga": np.round(z_harga, 2),
        "gap_score": np.round(gap_score, 2),
        "gap_nominal_rp": np.round(gap_nominal, 0),
        "gap_persen": gap_persen,
        "status_gap": kategori_gap,
        "kuadran_gap": kuadran_gap,
    })

    # Analisis Gap Parsial per Fasilitas (Perbedaan Median Harga Pasar Ada vs Tidak Ada Fasilitas)
    gap_fasilitas_individual = []
    for f in FAS6:
        punya = [k["harga"] for k in kos_list if f in k["fasilitas"]]
        tidak = [k["harga"] for k in kos_list if f not in k["fasilitas"]]
        med_punya = np.median(punya) if len(punya) else 0
        med_tidak = np.median(tidak) if len(tidak) else 0
        gap_fasilitas_individual.append({
            "fasilitas": f.upper(),
            "n_punya": len(punya),
            "n_tidak": len(tidak),
            "median_dengan_fasilitas": med_punya,
            "median_tanpa_fasilitas": med_tidak,
            "gap_nominal": med_punya - med_tidak,
            "gap_persen": round(((med_punya - med_tidak) / med_tidak) * 100, 1) if med_tidak > 0 else 0
        })
    df_gap_fasilitas = pd.DataFrame(gap_fasilitas_individual).sort_values("gap_nominal", ascending=False)

    return df_gap, df_gap_fasilitas


# -----------------------------------------------------------------------------
# 5. DATA DUMMY SESI PENJUALAN & TRANSAKSI BULANAN KOS
# -----------------------------------------------------------------------------
def generate_data_dummy_sesi_penjualan(output_path="data/dummy_sesi_penjualan_kos.csv", n_bulan=24, seed=42):
    """
    Menghasilkan data dummy longitudinal sesi transaksi & penjualan bulanan kos (24 bulan)
    untuk 3 properti representatif (Eksklusif, Menengah, Ekonomis) di Surabaya.
    Data ini mencakup tren harga berkala dan seasonality kalender akademik perguruan tinggi.
    """
    np.random.seed(seed)
    dates = pd.date_range("2024-01-01", periods=n_bulan, freq="MS")

    properti_kos = [
        {
            "id": "KOS-EKS-01",
            "nama": "Kost Grand Gubeng Heritage",
            "segmen": "Kos Eksklusif / Premium",
            "kecamatan": "Gubeng",
            "total_kamar": 20,
            "harga_base": 2200000,
            "biaya_tetap": 4500000,
            "biaya_per_kamar": 250000,
            "target_occ_base": 0.88,
        },
        {
            "id": "KOS-MED-02",
            "nama": "Kost Griya Rungkut Asri",
            "segmen": "Kos Menengah / Standar",
            "kecamatan": "Rungkut",
            "total_kamar": 16,
            "harga_base": 1350000,
            "biaya_tetap": 2800000,
            "biaya_per_kamar": 180000,
            "target_occ_base": 0.85,
        },
        {
            "id": "KOS-ECO-03",
            "nama": "Kost Barokah Sukolilo Indah",
            "segmen": "Kos Murah / Ekonomis",
            "kecamatan": "Sukolilo",
            "total_kamar": 12,
            "harga_base": 750000,
            "biaya_tetap": 1200000,
            "biaya_per_kamar": 100000,
            "target_occ_base": 0.90,
        },
    ]

    # Faktor musiman akademis Surabaya (mahasiswa baru ITS, UNAIR, UNESA, UPN)
    season_factor = {
        1: 0.86,  # Libur semester ganjil
        2: 0.90,  # Mulai semester genap
        3: 0.98,  # Berjalan perkuliahan
        4: 1.00,  # Berjalan normal
        5: 0.96,  # Ujian akhir
        6: 1.06,  # Mulai pencarian kos mahasiswa baru
        7: 1.20,  # Pengumuman kelulusan & registrasi
        8: 1.28,  # Puncak kedatangan maba (Peak Season)
        9: 1.22,  # Awal perkuliahan ganjil
        10: 1.04, # Stabil semester ganjil
        11: 1.00, # Stabil semester ganjil
        12: 0.92, # Libur akhir tahun
    }

    records = []
    for prop in properti_kos:
        for idx, dt in enumerate(dates):
            thn_ke = idx // 12
            bln = dt.month
            s_val = season_factor[bln]

            # Kenaikan tarif inflasi tahunan ~5.5%
            inflasi_faktor = (1.0 + 0.055) ** thn_ke
            harga_kamar = int(round(prop["harga_base"] * inflasi_faktor, -4))

            # Okupansi realistis dengan variasi acak
            occ_rate = min(1.0, max(0.60, prop["target_occ_base"] * s_val + np.random.normal(0, 0.02)))
            kamar_terisi = int(round(prop["total_kamar"] * occ_rate))
            kamar_terisi = min(prop["total_kamar"], max(2, kamar_terisi))

            # Sesi transaksi / penjualan
            sesi_booking = max(0, int(round((kamar_terisi * 0.35 * s_val) + np.random.normal(0, 0.8))))
            sesi_checkout = max(0, int(round(sesi_booking * (0.82 / s_val))))

            omzet = kamar_terisi * harga_kamar
            biaya = prop["biaya_tetap"] + (kamar_terisi * prop["biaya_per_kamar"])
            laba = omzet - biaya

            records.append({
                "periode": dt.strftime("%Y-%m"),
                "bulan": bln,
                "tahun": dt.year,
                "id_kos": prop["id"],
                "nama_kost": prop["nama"],
                "segmen": prop["segmen"],
                "kecamatan": prop["kecamatan"],
                "total_kamar": prop["total_kamar"],
                "kamar_terisi": kamar_terisi,
                "okupansi_pct": round((kamar_terisi / prop["total_kamar"]) * 100, 1),
                "harga_sewa": harga_kamar,
                "sesi_booking_baru": sesi_booking,
                "sesi_checkout": sesi_checkout,
                "omzet": omzet,
                "biaya_operasional": biaya,
                "laba_bersih": laba,
            })

    df_dummy = pd.DataFrame(records)

    # Simpan ke CSV
    out_dir = Path(output_path).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    df_dummy.to_csv(output_path, index=False)
    return df_dummy


# -----------------------------------------------------------------------------
# 6. FORECASTING OMZET & HARGA KOS (TIME SERIES MODELING NON-REGRESI LINEAR)
# -----------------------------------------------------------------------------
def holt_winters_forecast(series, slen=12, alpha=0.3, beta=0.1, gamma=0.3, n_preds=12):
    """
    Triple Exponential Smoothing (Holt-Winters Non-Linear Additive Model)
    Memodelkan Level, Trend, dan Musiman (Seasonality) secara tepat tanpa regresi linear.
    """
    series = np.array(series, dtype=float)
    n_seasons = int(len(series) / slen)

    season_averages = []
    for j in range(n_seasons):
        season_averages.append(sum(series[slen * j : slen * j + slen]) / float(slen))

    seasonals = {}
    for i in range(slen):
        sum_of_vals_over_avg = 0.0
        for j in range(n_seasons):
            sum_of_vals_over_avg += series[slen * j + i] - season_averages[j]
        seasonals[i] = sum_of_vals_over_avg / n_seasons

    result = []
    smooth = series[0]
    trend = sum((series[slen + i] - series[i]) / slen for i in range(slen)) / slen

    for i in range(len(series) + n_preds):
        if i == 0:
            result.append(series[0])
            continue
        if i >= len(series):
            m = i - len(series) + 1
            result.append((smooth + m * trend) + seasonals[i % slen])
        else:
            val = series[i]
            last_smooth = smooth
            smooth = alpha * (val - seasonals[i % slen]) + (1 - alpha) * (smooth + trend)
            trend = beta * (smooth - last_smooth) + (1 - beta) * trend
            seasonals[i % slen] = gamma * (val - smooth) + (1 - gamma) * seasonals[i % slen]
            result.append(smooth + trend + seasonals[i % slen])

    return np.array(result)

def optimasi_dan_forecast(series_historis, slen=12, n_forecast=12):
    """
    Optimasi parameter smoothing (alpha, beta, gamma) dengan meminimalkan MSE,
    lalu menghasilkan proyeksi masa depan beserta rentang estimasi (Confidence Interval 95%).
    """
    ts = np.array(series_historis, dtype=float)

    def obj_func(params):
        a, b, g = params
        pred = holt_winters_forecast(ts, slen=slen, alpha=a, beta=b, gamma=g, n_preds=0)
        return np.mean((ts - pred) ** 2)

    res = minimize(obj_func, [0.3, 0.1, 0.3], bounds=[(0.01, 0.99), (0.01, 0.99), (0.01, 0.99)])
    a_opt, b_opt, g_opt = res.x

    pred_full = holt_winters_forecast(ts, slen=slen, alpha=a_opt, beta=b_opt, gamma=g_opt, n_preds=n_forecast)
    fitted_vals = pred_full[:len(ts)]
    forecast_vals = pred_full[len(ts):]

    # Evaluasi akurasi
    residuals = ts - fitted_vals
    mae = np.mean(np.abs(residuals))
    rmse = np.sqrt(np.mean(residuals ** 2))
    mape = np.mean(np.abs(residuals) / ts) * 100
    sigma_res = np.std(residuals)

    # Confidence Interval 95% (+/- 1.96 * sigma)
    ci_lower = forecast_vals - (1.96 * sigma_res)
    ci_upper = forecast_vals + (1.96 * sigma_res)

    return {
        "params": (a_opt, b_opt, g_opt),
        "fitted": fitted_vals,
        "forecast": forecast_vals,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "mae": mae,
        "rmse": rmse,
        "mape": mape
    }

def jalankan_forecasting_pemilik(df_dummy, n_forecast=12):
    """
    Melakukan forecasting omzet dan harga sewa untuk pemilik kos (per segmen kos dan total)
    untuk 12 bulan ke depan.
    """
    hasil_per_kos = {}
    periode_terakhir = pd.to_datetime(df_dummy["periode"].max() + "-01")
    future_dates = pd.date_range(periode_terakhir + pd.DateOffset(months=1), periods=n_forecast, freq="MS")
    future_labels = [d.strftime("%Y-%m") for d in future_dates]

    for nama_kos in df_dummy["nama_kost"].unique():
        sub_df = df_dummy[df_dummy.nama_kost == nama_kos].sort_values("periode").reset_index(drop=True)

        # Forecast Omzet
        omzet_hist = sub_df["omzet"].values
        fc_omzet = optimasi_dan_forecast(omzet_hist, slen=12, n_forecast=n_forecast)

        # Forecast Tren Harga Sewa
        harga_hist = sub_df["harga_sewa"].values
        fc_harga = optimasi_dan_forecast(harga_hist, slen=12, n_forecast=n_forecast)

        # Forecast Okupansi
        occ_hist = sub_df["okupansi_pct"].values
        fc_occ = optimasi_dan_forecast(occ_hist, slen=12, n_forecast=n_forecast)

        hasil_per_kos[nama_kos] = {
            "segmen": sub_df["segmen"].iloc[0],
            "total_kamar": sub_df["total_kamar"].iloc[0],
            "periode_hist": sub_df["periode"].tolist(),
            "omzet_hist": omzet_hist,
            "harga_hist": harga_hist,
            "occ_hist": occ_hist,
            "future_labels": future_labels,
            "omzet_fc": fc_omzet,
            "harga_fc": fc_harga,
            "occ_fc": fc_occ,
        }

    return hasil_per_kos


# -----------------------------------------------------------------------------
# 7. GENERATOR GRAFIK & VISUALISASI INTEGRATIF
# -----------------------------------------------------------------------------
def plot_hasil_komprehensif(df_gap, profil_df, hasil_forecast, df_gap_fasilitas, output_img="output/analisis_notulensi_kozy.png"):
    """
    Menghasilkan figure multi-panel yang menyajikan:
    1. Clustering K-Prototypes Segmentasi Kos
    2. Multivariate Analisis Gap (Fasilitas vs Harga)
    3. Analisis Gap per Fasilitas Utama
    4. Forecasting Omzet Pemilik Kos 12 Bulan ke Depan
    """
    os.makedirs(Path(output_img).parent, exist_ok=True)
    fig = plt.figure(figsize=(15, 12))
    gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.22)

    # Panel 1: Clustering K-Prototypes
    ax1 = fig.add_subplot(gs[0, 0])
    warna_cluster = [UNGU, BIRU, HIJAU]
    for idx, row in profil_df.iterrows():
        c_id = row["cluster_id"]
        sub = df_gap[df_gap.cluster_segmen == row["nama_segmen"]]
        ax1.scatter(sub["skor_fasilitas"], sub["harga"] / 1e6,
                    label=f"{row['nama_segmen']} (n={row['jumlah_kos']})",
                    color=warna_cluster[idx % len(warna_cluster)], alpha=0.75, edgecolors="none", s=38)
    ax1.set_title("1. Segmentasi Kos K-Prototypes (Eksklusif, Menengah, Murah)")
    ax1.set_xlabel("Kelengkapan Fasilitas (%)")
    ax1.set_ylabel("Harga Sewa (Juta Rp)")
    ax1.legend(frameon=True, fontsize=8, loc="upper left")

    # Panel 2: Multivariate Gap Analysis (Kuadran Gap)
    ax2 = fig.add_subplot(gs[0, 1])
    scatter = ax2.scatter(df_gap["z_fasilitas"], df_gap["z_harga"],
                          c=df_gap["gap_score"], cmap="coolwarm", s=40, alpha=0.85, edgecolors="white", linewidth=0.5)
    cbar = plt.colorbar(scatter, ax=ax2)
    cbar.set_label("Value Gap Score (Fasilitas - Harga)")
    ax2.axvline(0, color=ABU, linestyle="--", linewidth=0.9)
    ax2.axhline(0, color=ABU, linestyle="--", linewidth=0.9)
    ax2.text(1.2, -1.5, "Best Value\n(Fasilitas > Harga)", color=HIJAU, fontweight="bold", fontsize=8, ha="center")
    ax2.text(-1.2, 1.8, "Overpriced\n(Harga > Fasilitas)", color=MERAH, fontweight="bold", fontsize=8, ha="center")
    ax2.set_title("2. Multivariate Analisis Gap (Fasilitas vs Harga)")
    ax2.set_xlabel("Z-Score Fasilitas (Kualitas)")
    ax2.set_ylabel("Z-Score Log Harga (Tarif)")

    # Panel 3: Analisis Gap per Fasilitas Utama
    ax3 = fig.add_subplot(gs[1, 0])
    y_pos = np.arange(len(df_gap_fasilitas))
    bars = ax3.barh(y_pos, df_gap_fasilitas["gap_nominal"] / 1e3, color=BIRU, height=0.58)
    ax3.set_yticks(y_pos)
    ax3.set_yticklabels(df_gap_fasilitas["fasilitas"])
    ax3.invert_yaxis()
    for i, bar in enumerate(bars):
        val = df_gap_fasilitas["gap_nominal"].iloc[i]
        pct = df_gap_fasilitas["gap_persen"].iloc[i]
        ax3.text(bar.get_width() + 15, bar.get_y() + bar.get_height()/2,
                 f"+{rp(val)} (+{pct}%)", va="center", fontsize=8, fontweight="bold")
    ax3.set_title("3. Gap Harga Pasar per Fasilitas (Median Ada vs Tanpa Fasilitas)")
    ax3.set_xlabel("Selisih Harga Pasar (Ribu Rp)")

    # Panel 4: Forecasting Omzet Pemilik Kos (12 Bulan ke Depan)
    ax4 = fig.add_subplot(gs[1, 1])
    contoh_kos = "Kost Grand Gubeng Heritage"
    if contoh_kos in hasil_forecast:
        d_fc = hasil_forecast[contoh_kos]
        n_hist = len(d_fc["omzet_hist"])
        x_hist = np.arange(n_hist)
        x_fore = np.arange(n_hist, n_hist + len(d_fc["omzet_fc"]["forecast"]))

        ax4.plot(x_hist, d_fc["omzet_hist"] / 1e6, label="Omzet Historis (2024-2025)", color=TINTA, marker="o", markersize=3.5, linewidth=1.5)
        ax4.plot(x_fore, d_fc["omzet_fc"]["forecast"] / 1e6, label="Forecast Omzet (2026)", color=JINGGA, marker="s", markersize=3.5, linestyle="--", linewidth=1.8)
        ax4.fill_between(x_fore, d_fc["omzet_fc"]["ci_lower"] / 1e6, d_fc["omzet_fc"]["ci_upper"] / 1e6, color=JINGGA, alpha=0.18, label="95% Confidence Interval")

        ax4.axvline(n_hist - 0.5, color=ABU, linestyle=":", linewidth=1)
        ax4.text(n_hist + 1, (d_fc["omzet_fc"]["forecast"].max()/1e6)*0.97, "Puncak Seasonality Maba (Juli-Sep)", color=JINGGA, fontsize=8, fontweight="bold")
        ax4.set_title(f"4. Proyeksi Omzet Pemilik Kos ({contoh_kos})")
        ax4.set_xlabel("Bulan (Hist: 0-23, Proyeksi: 24-35)")
        ax4.set_ylabel("Omzet Bulanan (Juta Rp)")
        ax4.legend(frameon=True, fontsize=8, loc="lower left")

    plt.tight_layout()
    plt.savefig(output_img, dpi=120)
    plt.close()
    print(f"Visualisasi disimpan di: {output_img}")


# -----------------------------------------------------------------------------
# 8. FUNGSI UTAMA (MAIN PIPELINE)
# -----------------------------------------------------------------------------
def main():
    print("=" * 80)
    print("KOZY - PIPELINE PEMODELAN DATA BERDASARKAN NOTULENSI")
    print("=" * 80)

    # 1. Load data
    kos_list, meta = load_dataset()
    print(f"\n[STEP 1] Data Pasar Terload: {len(kos_list)} kos dari {meta.get('sumber', 'Mamikos + Papikost')}")

    # 2. Clustering K-Prototypes
    print("\n[STEP 2] Menjalankan Segmentasi Kos K-Prototypes (k=3)...")
    cluster_labels, profil_df, Xn_raw, Xc_raw = jalankan_segmentasi_kprototypes(kos_list, k=3)
    print("\nProfil Segmen K-Prototypes:")
    print(profil_df[["nama_segmen", "jumlah_kos", "persen_data", "median_harga", "rata_fasilitas_pct", "kecamatan_dominan", "jenis_dominan"]].to_string(index=False))

    # 3. Multivariate Gap Analysis
    print("\n[STEP 3] Menjalankan Multivariate Analisis Gap (Fasilitas vs Harga)...")
    df_gap, df_gap_fasilitas = analisis_gap_multivariat(kos_list, cluster_labels, profil_df)
    print("\nDistribusi Status Kewajaran (Multivariate Gap):")
    print(df_gap["status_gap"].value_counts().to_string())

    print("\nDistribusi Kuadran Gap:")
    print(df_gap["kuadran_gap"].value_counts().to_string())

    print("\nGap Harga Pasar per Fasilitas:")
    print(df_gap_fasilitas[["fasilitas", "n_punya", "median_dengan_fasilitas", "median_tanpa_fasilitas", "gap_nominal", "gap_persen"]].to_string(index=False))

    # 4. Generate Data Dummy Sesi Penjualan
    dummy_csv = "data/dummy_sesi_penjualan_kos.csv"
    print(f"\n[STEP 4] Membuat Data Dummy Sesi Penjualan & Transaksi Bulanan Kos -> {dummy_csv}...")
    df_dummy = generate_data_dummy_sesi_penjualan(output_path=dummy_csv, n_bulan=24)
    print(f"Berhasil membuat {len(df_dummy)} baris data transaksi 24 bulan untuk 3 kos.")

    # 5. Forecasting Omzet Pemilik Kos
    print("\n[STEP 5] Menjalankan Forecasting Omzet & Harga Pemilik Kos (Holt-Winters)...")
    hasil_forecast = jalankan_forecasting_pemilik(df_dummy, n_forecast=12)

    for nama_kos, res_fc in hasil_forecast.items():
        print(f"\n--- {nama_kos} ({res_fc['segmen']}) ---")
        fc_o = res_fc["omzet_fc"]
        print(f"Akurasi Model: MAE=Rp{fc_o['mae']:,.0f} | MAPE={fc_o['mape']:.2f}%")
        print("Proyeksi 3 Bulan Pertama 2026:")
        for bln, val in zip(res_fc["future_labels"][:3], fc_o["forecast"][:3]):
            print(f"  {bln}: {rp(val)} / bulan")
        puncak_idx = np.argmax(fc_o["forecast"])
        print(f"Puncak Omzet 2026: {res_fc['future_labels'][puncak_idx]} ({rp(fc_o['forecast'][puncak_idx])})")

    # 6. Plot dan Ekspor
    print("\n[STEP 6] Membuat Visualisasi Komprehensif...")
    plot_hasil_komprehensif(df_gap, profil_df, hasil_forecast, df_gap_fasilitas, output_img="output/analisis_notulensi_kozy.png")

    # Simpan hasil analisis gap ke CSV
    out_gap_csv = "output/hasil_multivariate_analisis_gap.csv"
    df_gap.to_csv(out_gap_csv, index=False)
    print(f"Hasil Multivariate Gap Analysis tersimpan di: {out_gap_csv}")

    print("\n" + "=" * 80)
    print("SELURUH POIN NOTULENSI TELAH BERHASIL DIIMPLEMENTASIKAN SECARA TEPAT!")
    print("=" * 80)


if __name__ == "__main__":
    main()
