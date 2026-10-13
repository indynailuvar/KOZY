from pathlib import Path

import numpy as np
import pandas as pd

CLEAN_PATH = Path("analysis/kozy_dataset_clean.csv")
PRED_PATH = Path("output/feature_ablation_papikost/oof_predictions.csv")
OUT_DIR = Path("output/anomaly_candidates")

FEATURE_SET = "baseline_plus_facilities"
MODEL_NAME = "Ridge"
THRESHOLD_QUANTILE = 0.95

OUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Baca data bersih dan pertahankan cakupan eksperimen.
df = pd.read_csv(CLEAN_PATH)

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    df["sumber"].eq("Papikost")
    & ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy().reset_index(drop=True)

df["baris"] = np.arange(len(df))
df["harga"] = pd.to_numeric(df["harga"], errors="coerce")

if df.empty or df["harga"].isna().any():
    raise ValueError("Data Papikost kosong atau mengandung harga tidak valid.")

# 2. Baca prediksi out-of-fold.
pred = pd.read_csv(PRED_PATH)

required = ["baris", "fitur", "model", "prediksi_oof"]
missing = [c for c in required if c not in pred.columns]
if missing:
    raise ValueError(f"Kolom prediksi tidak tersedia: {missing}")

pred["fitur"] = pred["fitur"].astype("string").str.strip()
pred["model"] = pred["model"].astype("string").str.strip()
pred["baris"] = pd.to_numeric(pred["baris"], errors="coerce")
pred["prediksi_oof"] = pd.to_numeric(
    pred["prediksi_oof"], errors="coerce"
)

pred = pred.loc[
    pred["fitur"].eq(FEATURE_SET)
    & pred["model"].eq(MODEL_NAME)
].copy()

if pred.empty:
    raise ValueError(
        f"Tidak ditemukan prediksi untuk {MODEL_NAME}, {FEATURE_SET}."
    )

if pred["baris"].isna().any() or pred["prediksi_oof"].isna().any():
    raise ValueError("Ada indeks atau prediksi OOF yang tidak valid.")

pred["baris"] = pred["baris"].astype(int)

if pred["baris"].duplicated().any():
    raise ValueError("Ada indeks berulang pada prediksi Ridge.")

if not pred["baris"].isin(df["baris"]).all():
    raise ValueError(
        "Indeks prediksi tidak cocok dengan data saat ini. "
        "Periksa kembali filter dan urutan data eksperimen."
    )

# 3. Gabungkan prediksi dengan data asli.
result = pred[["baris", "prediksi_oof"]].merge(
    df,
    on="baris",
    how="left",
    validate="one_to_one",
)

if result["nama_kost"].isna().any():
    raise ValueError("Ada nama kos yang tidak cocok setelah penggabungan.")

# 4. Hitung residual.
# Residual positif = harga aktual di atas estimasi model.
# Residual negatif = harga aktual di bawah estimasi model.
result["residual"] = result["harga"] - result["prediksi_oof"]
result["residual_absolut"] = result["residual"].abs()

result["arah_indikasi"] = np.select(
    [
        result["residual"] > 0,
        result["residual"] < 0,
    ],
    [
        "Relatif lebih mahal dari estimasi",
        "Relatif lebih murah dari estimasi",
    ],
    default="Sesuai estimasi model",
)

# 5. Ambang eksploratif berdasarkan persentil residual OOF.
threshold = result["residual_absolut"].quantile(
    THRESHOLD_QUANTILE
)

result["ambang_residual"] = threshold
result["kandidat_anomali"] = (
    result["residual_absolut"] > threshold
)

result["catatan"] = np.where(
    result["kandidat_anomali"],
    "Perlu ditinjau; belum terbukti tidak wajar",
    "Tidak melewati ambang eksploratif",
)

# 6. Urutkan dan simpan seluruh hasil.
result = result.sort_values(
    "residual_absolut", ascending=False
)

output_cols = [
    "baris",
    "nama_kost",
    "harga",
    "prediksi_oof",
    "residual",
    "residual_absolut",
    "arah_indikasi",
    "kandidat_anomali",
    "catatan",
    "lokasi",
    "jenis",
    "sumber",
]
output_cols = [c for c in output_cols if c in result.columns]

all_path = OUT_DIR / "semua_skor_anomali.csv"
candidate_path = OUT_DIR / "kandidat_anomali.csv"

result[output_cols].to_csv(
    all_path, index=False, encoding="utf-8-sig"
)

candidates = result.loc[result["kandidat_anomali"]]
candidates[output_cols].to_csv(
    candidate_path, index=False, encoding="utf-8-sig"
)

# 7. Ringkasan terminal.
print("=" * 60)
print("KOZY - KANDIDAT ANOMALI HARGA")
print("=" * 60)
print(f"Jumlah data                 : {len(result)}")
print(f"Model                       : {MODEL_NAME}")
print(f"Fitur                       : {FEATURE_SET}")
print(f"Ambang persentil            : {THRESHOLD_QUANTILE:.0%}")
print(f"Ambang residual absolut     : Rp{threshold:,.0f}")
print(f"Jumlah kandidat             : {len(candidates)}")
print(f"\nSemua skor : {all_path}")
print(f"Kandidat   : {candidate_path}")

if not candidates.empty:
    print("\nDaftar kandidat:")
    print(
        candidates[
            [
                "nama_kost",
                "harga",
                "prediksi_oof",
                "residual",
                "arah_indikasi",
            ]
        ].to_string(
            index=False,
            formatters={
                "harga": lambda x: f"Rp{x:,.0f}",
                "prediksi_oof": lambda x: f"Rp{x:,.0f}",
                "residual": lambda x: f"Rp{x:,.0f}",
            },
        )
    )
else:
    print("\nTidak ada data yang melewati ambang.")

print(
    "\nCatatan: kandidat adalah sinyal pemeriksaan, "
    "bukan bukti harga tidak wajar."
)
