#!/usr/bin/env python3
# =============================================================================
# Mengintegrasikan hasil pemodelan branch 'Modelling' ke backend & frontend KOZY:
# 1. output/hasil_multivariate_analisis_gap.csv -> web/src/data/gap.json
# 2. data/dummy_sesi_penjualan_kos.csv + forecasting -> web/src/data/forecasting.json
# 3. Enrich web/src/data/pasar.json dengan klaster segmen dan gap status per kos
# 4. Enrich web/src/data/segmen.json dengan profil 3 klaster K-Prototypes
# =============================================================================
import io
import json
import os
import sys
from pathlib import Path
import numpy as np
import pandas as pd

# Root paths
SCRIPT_DIR = Path(__file__).resolve().parent
WEB_DIR = SCRIPT_DIR.parent
ROOT_DIR = WEB_DIR.parent
NOTEBOOKS_DIR = ROOT_DIR / "notebooks"
OUTPUT_DIR = ROOT_DIR / "output"
DATA_DIR = ROOT_DIR / "data"

sys.path.insert(0, str(NOTEBOOKS_DIR))
from kozy_analisis_notulensi import (
    FAS6,
    generate_data_dummy_sesi_penjualan,
    jalankan_forecasting_pemilik,
    optimasi_dan_forecast,
)

def build_gap_data():
    csv_path = OUTPUT_DIR / "hasil_multivariate_analisis_gap.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"File {csv_path} tidak ditemukan.")

    df_gap = pd.read_csv(csv_path)

    # Hitung benchmark fasilitas
    df_temp = pd.DataFrame({
        "fas_cnt": [int(round(s * len(FAS6) / 100)) for s in df_gap["skor_fasilitas"]],
        "harga": df_gap["harga"].values
    })
    benchmark_map = df_temp.groupby("fas_cnt")["harga"].median().to_dict()

    # Gap fasilitas parsial
    pasar_json_path = WEB_DIR / "src" / "data" / "pasar.json"
    with open(pasar_json_path, encoding="utf-8") as f:
        pasar_data = json.load(f)
    kos_list = pasar_data["kos"]

    fasilitas_gap = []
    for f in FAS6:
        punya = [k["harga"] for k in kos_list if f in k["fasilitas"]]
        tidak = [k["harga"] for k in kos_list if f not in k["fasilitas"]]
        med_punya = float(np.median(punya)) if len(punya) else 0.0
        med_tidak = float(np.median(tidak)) if len(tidak) else 0.0
        diff_rp = med_punya - med_tidak
        diff_pct = round((diff_rp / med_tidak) * 100, 1) if med_tidak > 0 else 0.0
        fasilitas_gap.append({
            "id": f,
            "label": {"km": "KM Dalam", "ac": "AC", "wifi": "WiFi", "kasur": "Kasur", "kloset": "Kloset Duduk", "akses24": "Akses 24 Jam"}.get(f, f.upper()),
            "n_punya": len(punya),
            "n_tidak": len(tidak),
            "median_dengan_fasilitas": med_punya,
            "median_tanpa_fasilitas": med_tidak,
            "gap_nominal": diff_rp,
            "gap_persen": diff_pct
        })
    fasilitas_gap.sort(key=lambda x: x["gap_nominal"], reverse=True)

    # Ringkasan status & kuadran
    status_counts = df_gap["status_gap"].value_counts().to_dict()
    kuadran_counts = df_gap["kuadran_gap"].value_counts().to_dict()
    segmen_counts = df_gap["cluster_segmen"].value_counts().to_dict()

    total_kos = len(df_gap)

    # Param kalkulasi dinamis
    fas_skor_arr = df_gap["skor_fasilitas"].values
    log_harga_arr = np.log(df_gap["harga"].values)

    params_kalkulasi = {
        "fasilitas_mean": float(np.mean(fas_skor_arr)),
        "fasilitas_std": float(np.std(fas_skor_arr)),
        "log_harga_mean": float(np.mean(log_harga_arr)),
        "log_harga_std": float(np.std(log_harga_arr)),
        "benchmark_per_fasilitas": {str(k): float(v) for k, v in benchmark_map.items()},
        "threshold_gap": 0.45
    }

    # Format list kos
    daftar_kos = []
    for _, row in df_gap.iterrows():
        daftar_kos.append({
            "nama": row["nama"],
            "kec": row["kec"],
            "jenis": row["jenis"],
            "sumber": row["sumber"],
            "cluster_segmen": row["cluster_segmen"],
            "harga": float(row["harga"]),
            "skor_fasilitas": float(row["skor_fasilitas"]),
            "z_fasilitas": float(row["z_fasilitas"]),
            "z_harga": float(row["z_harga"]),
            "gap_score": float(row["gap_score"]),
            "gap_nominal_rp": float(row["gap_nominal_rp"]),
            "gap_persen": float(row["gap_persen"]),
            "status_gap": row["status_gap"],
            "kuadran_gap": row["kuadran_gap"]
        })

    gap_data = {
        "meta": {
            "judul": "Multivariate Gap Analysis Kos Surabaya",
            "metode": "Standardized Value Gap Score (z_fasilitas - z_harga)",
            "n": total_kos,
            "threshold": 0.45,
            "diperbarui": "2026-10-19"
        },
        "ringkasan": {
            "total": total_kos,
            "status": {
                "best_value": {"label": "Best Value / Murah", "n": status_counts.get("Best Value / Murah", 0), "persen": round(status_counts.get("Best Value / Murah", 0) / total_kos * 100, 1)},
                "wajar": {"label": "Wajar / Seimbang", "n": status_counts.get("Wajar / Seimbang", 0), "persen": round(status_counts.get("Wajar / Seimbang", 0) / total_kos * 100, 1)},
                "kemahalan": {"label": "Overpriced / Kemahalan", "n": status_counts.get("Overpriced / Kemahalan", 0), "persen": round(status_counts.get("Overpriced / Kemahalan", 0) / total_kos * 100, 1)}
            },
            "kuadran": {
                "kuadran_1": {"label": "Kuadran I: Best Value (Fasilitas Tinggi, Harga Rendah)", "n": kuadran_counts.get("Kuadran I: Best Value (Fasilitas Tinggi, Harga Rendah)", 0), "persen": round(kuadran_counts.get("Kuadran I: Best Value (Fasilitas Tinggi, Harga Rendah)", 0) / total_kos * 100, 1)},
                "kuadran_2": {"label": "Kuadran II: Eksklusif Wajar (Fasilitas Tinggi, Harga Tinggi)", "n": kuadran_counts.get("Kuadran II: Eksklusif Wajar (Fasilitas Tinggi, Harga Tinggi)", 0), "persen": round(kuadran_counts.get("Kuadran II: Eksklusif Wajar (Fasilitas Tinggi, Harga Tinggi)", 0) / total_kos * 100, 1)},
                "kuadran_3": {"label": "Kuadran III: Ekonomis Wajar (Fasilitas Dasar, Harga Rendah)", "n": kuadran_counts.get("Kuadran III: Ekonomis Wajar (Fasilitas Dasar, Harga Rendah)", 0), "persen": round(kuadran_counts.get("Kuadran III: Ekonomis Wajar (Fasilitas Dasar, Harga Rendah)", 0) / total_kos * 100, 1)},
                "kuadran_4": {"label": "Kuadran IV: Overpriced (Fasilitas Dasar, Harga Tinggi)", "n": kuadran_counts.get("Kuadran IV: Overpriced (Fasilitas Dasar, Harga Tinggi)", 0), "persen": round(kuadran_counts.get("Kuadran IV: Overpriced (Fasilitas Dasar, Harga Tinggi)", 0) / total_kos * 100, 1)}
            },
            "segmen": {k: {"n": v, "persen": round(v / total_kos * 100, 1)} for k, v in segmen_counts.items()}
        },
        "params": params_kalkulasi,
        "fasilitas_gap": fasilitas_gap,
        "kos": daftar_kos
    }

    out_gap = WEB_DIR / "src" / "data" / "gap.json"
    with open(out_gap, "w", encoding="utf-8") as f:
        json.dump(gap_data, f, ensure_ascii=False, indent=1)
    print(f"[OK] gap.json tersimpan: {len(daftar_kos)} kos, {len(fasilitas_gap)} fasilitas")
    return df_gap


def build_forecasting_data():
    dummy_csv = DATA_DIR / "dummy_sesi_penjualan_kos.csv"
    if not dummy_csv.exists():
        df_dummy = generate_data_dummy_sesi_penjualan(str(dummy_csv))
    else:
        df_dummy = pd.read_csv(dummy_csv)

    hasil_fc = jalankan_forecasting_pemilik(df_dummy, n_forecast=12)

    properti_list = []
    for nama_kos, res in hasil_fc.items():
        sub_df = df_dummy[df_dummy.nama_kost == nama_kos].sort_values("periode").reset_index(drop=True)

        riwayat = []
        for _, row in sub_df.iterrows():
            riwayat.append({
                "periode": str(row["periode"]),
                "bulan": int(row["bulan"]),
                "tahun": int(row["tahun"]),
                "kamar_terisi": int(row["kamar_terisi"]),
                "total_kamar": int(row["total_kamar"]),
                "okupansi_pct": float(row["okupansi_pct"]),
                "harga_sewa": int(row["harga_sewa"]),
                "sesi_booking": int(row["sesi_booking_baru"]),
                "sesi_checkout": int(row["sesi_checkout"]),
                "omzet": int(row["omzet"]),
                "biaya_operasional": int(row["biaya_operasional"]),
                "laba_bersih": int(row["laba_bersih"])
            })

        fc_o = res["omzet_fc"]
        fc_h = res["harga_fc"]
        fc_occ = res["occ_fc"]

        idx_puncak = int(np.argmax(fc_o["forecast"]))

        properti_list.append({
            "id": str(sub_df["id_kos"].iloc[0]),
            "nama": nama_kos,
            "segmen": str(res["segmen"]),
            "kecamatan": str(sub_df["kecamatan"].iloc[0]),
            "total_kamar": int(res["total_kamar"]),
            "riwayat": riwayat,
            "forecast_12bln": {
                "labels": res["future_labels"],
                "omzet": {
                    "forecast": [float(round(v)) for v in fc_o["forecast"]],
                    "ci_lower": [float(round(v)) for v in fc_o["ci_lower"]],
                    "ci_upper": [float(round(v)) for v in fc_o["ci_upper"]],
                    "mae": float(round(fc_o["mae"])),
                    "rmse": float(round(fc_o["rmse"])),
                    "mape": float(round(fc_o["mape"], 2))
                },
                "harga": {
                    "forecast": [float(round(v)) for v in fc_h["forecast"]],
                    "ci_lower": [float(round(v)) for v in fc_h["ci_lower"]],
                    "ci_upper": [float(round(v)) for v in fc_h["ci_upper"]]
                },
                "okupansi": {
                    "forecast": [float(round(v, 1)) for v in fc_occ["forecast"]],
                    "ci_lower": [float(round(v, 1)) for v in fc_occ["ci_lower"]],
                    "ci_upper": [float(round(v, 1)) for v in fc_occ["ci_upper"]]
                },
                "puncak": {
                    "periode": res["future_labels"][idx_puncak],
                    "omzet": float(round(fc_o["forecast"][idx_puncak])),
                    "keterangan": "Puncak Seasonality Penerimaan Mahasiswa Baru (Juli - September)"
                }
            }
        })

    forecasting_data = {
        "meta": {
            "judul": "Proyeksi Forecasting Omzet Pemilik Kos Surabaya",
            "metode": "Triple Exponential Smoothing (Holt-Winters) dengan Optimasi Parameter",
            "periode_riwayat": "2024-01 s/d 2025-12 (24 bulan)",
            "periode_proyeksi": "2026-01 s/d 2026-12 (12 bulan)",
            "confidence_interval": "95%",
            "sifat_data": "Simulasi berbasis pola riil seasonality penerimaan mahasiswa perguruan tinggi Surabaya"
        },
        "properti": properti_list
    }

    out_fc = WEB_DIR / "src" / "data" / "forecasting.json"
    with open(out_fc, "w", encoding="utf-8") as f:
        json.dump(forecasting_data, f, ensure_ascii=False, indent=1)
    print(f"[OK] forecasting.json tersimpan: {len(properti_list)} properti kos")


def enrich_pasar_and_segmen(df_gap):
    pasar_json_path = WEB_DIR / "src" / "data" / "pasar.json"
    with open(pasar_json_path, encoding="utf-8") as f:
        pasar = json.load(f)

    # Buat lookup dari df_gap
    gap_lookup = {}
    for _, row in df_gap.iterrows():
        kunci = f"{row['nama']}||{row['kec']}"
        gap_lookup[kunci] = {
            "cluster_segmen": row["cluster_segmen"],
            "skor_fasilitas": float(row["skor_fasilitas"]),
            "gap_score": float(row["gap_score"]),
            "gap_nominal_rp": float(row["gap_nominal_rp"]),
            "gap_persen": float(row["gap_persen"]),
            "status_gap": row["status_gap"],
            "kuadran_gap": row["kuadran_gap"]
        }

    # Enrich kos
    matched = 0
    for k in pasar["kos"]:
        kunci = f"{k['nama']}||{k['kec']}"
        if kunci in gap_lookup:
            k.update(gap_lookup[kunci])
            matched += 1
        elif k["nama"] in df_gap["nama"].values:
            sub = df_gap[df_gap["nama"] == k["nama"]].iloc[0]
            k.update({
                "cluster_segmen": sub["cluster_segmen"],
                "skor_fasilitas": float(sub["skor_fasilitas"]),
                "gap_score": float(sub["gap_score"]),
                "gap_nominal_rp": float(sub["gap_nominal_rp"]),
                "gap_persen": float(sub["gap_persen"]),
                "status_gap": sub["status_gap"],
                "kuadran_gap": sub["kuadran_gap"]
            })
            matched += 1

    pasar["meta"]["modelling_terhubung"] = True
    pasar["meta"]["modelling_versi"] = "Multivariate Gap + K-Prototypes Clustering + Holt-Winters Forecasting"

    with open(pasar_json_path, "w", encoding="utf-8") as f:
        json.dump(pasar, f, ensure_ascii=False, indent=1)
    print(f"[OK] pasar.json diperbarui: {matched}/{len(pasar['kos'])} kos berhasil diperkaya dengan data modelling")

    # Enrich segmen.json dengan 3 klaster K-Prototypes
    segmen_json_path = WEB_DIR / "src" / "data" / "segmen.json"
    with open(segmen_json_path, encoding="utf-8") as f:
        segmen_obj = json.load(f)

    segmen_kprototypes = []
    for s_nama in ["Kos Eksklusif / Premium", "Kos Menengah / Standar", "Kos Murah / Ekonomis"]:
        sub_df = df_gap[df_gap.cluster_segmen == s_nama]
        if len(sub_df) == 0:
            continue
        hs = sub_df["harga"].values
        skor_fas = sub_df["skor_fasilitas"].values
        segmen_kprototypes.append({
            "nama": s_nama,
            "n": int(len(sub_df)),
            "bagian": round(float(len(sub_df) / len(df_gap) * 100), 1),
            "harga": {
                "p25": float(np.percentile(hs, 25)),
                "p50": float(np.median(hs)),
                "p75": float(np.percentile(hs, 75)),
                "min": float(np.min(hs)),
                "max": float(np.max(hs))
            },
            "skor_fasilitas_rata": round(float(np.mean(skor_fas)), 1),
            "kecamatan_terbanyak": str(sub_df["kec"].mode()[0]),
            "jenis_terbanyak": str(sub_df["jenis"].mode()[0])
        })

    segmen_obj["kprototypes_3klaster"] = {
        "metode": "K-Prototypes Huang (1997) dengan 3 Klaster",
        "klaster": segmen_kprototypes
    }

    with open(segmen_json_path, "w", encoding="utf-8") as f:
        json.dump(segmen_obj, f, ensure_ascii=False, indent=1)
    print(f"[OK] segmen.json diperbarui dengan 3 klaster K-Prototypes")


if __name__ == "__main__":
    print("Memproses data pemodelan untuk backend & frontend...")
    df_gap = build_gap_data()
    build_forecasting_data()
    enrich_pasar_and_segmen(df_gap)
    print("Selesai! Seluruh data modelling telah tersambung.")
