from pathlib import Path

import numpy as np
import pandas as pd

AUDIT_PATH = Path(
    "output/validation_audit/penugasan_fold_audit.csv"
)
OOF_PATH = Path(
    "output/feature_ablation_papikost/oof_predictions.csv"
)
OUT_DIR = Path("output/validation_audit")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Baca data audit dan prediksi OOF.
audit = pd.read_csv(AUDIT_PATH)
oof = pd.read_csv(OOF_PATH)

# 2. Ambil konfigurasi kandidat yang sedang dievaluasi.
oof = oof.loc[
    oof["fitur"].eq("baseline_plus_facilities")
    & oof["model"].isin(["Ridge", "RandomForest"])
].copy()

if oof.empty:
    raise ValueError(
        "Prediksi OOF baseline_plus_facilities tidak ditemukan."
    )

# 3. Pisahkan prediksi Ridge dan Random Forest.
predictions = oof.pivot(
    index="baris",
    columns="model",
    values="prediksi_oof",
).reset_index()

predictions.columns.name = None

for model in ["Ridge", "RandomForest"]:
    if model not in predictions.columns:
        raise ValueError(f"Prediksi {model} tidak ditemukan.")

# 4. Pastikan indeks baris konsisten dengan dataset audit.
audit["baris"] = np.arange(len(audit))

data = audit.merge(
    predictions,
    on="baris",
    how="left",
    validate="one_to_one",
)

if data[["Ridge", "RandomForest"]].isna().any().any():
    raise ValueError(
        "Ada listing yang tidak memiliki prediksi OOF."
    )

# 5. Hitung residual dan error absolut.
data["residual_ridge"] = data["harga"] - data["Ridge"]
data["residual_rf"] = data["harga"] - data["RandomForest"]

data["abs_error_ridge"] = data["residual_ridge"].abs()
data["abs_error_rf"] = data["residual_rf"].abs()

# 6. Ringkas error setiap fold.
summary = data.groupby("fold_test").agg(
    jumlah=("harga", "size"),
    median_harga=("harga", "median"),
    MAE_Ridge=("abs_error_ridge", "mean"),
    MAE_RF=("abs_error_rf", "mean"),
    median_abs_error_Ridge=("abs_error_ridge", "median"),
    median_abs_error_RF=("abs_error_rf", "median"),
).reset_index()

summary.to_csv(
    OUT_DIR / "ringkasan_error_per_fold.csv",
    index=False,
)

# 7. Periksa seluruh listing fold 5.
fold5 = data.loc[data["fold_test"].eq(5)].copy()
fold5 = fold5.sort_values(
    "abs_error_ridge",
    ascending=False,
)

facility_cols = [
    col for col in [
        "ac", "wifi", "kmandi_dalam", "lemari",
        "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
    ]
    if col in fold5.columns
]

detail_cols = [
    col for col in [
        "nama_kost", "lokasi", "jenis", "harga",
        "Ridge", "RandomForest",
        "residual_ridge", "residual_rf",
    ] + facility_cols
    if col in fold5.columns
]

fold5[detail_cols].to_csv(
    OUT_DIR / "detail_listing_fold5.csv",
    index=False,
)

# 8. Tampilkan hasil.
print("=== RINGKASAN ERROR PER FOLD ===")
print(summary.round(2).to_string(index=False))

print("\n=== LISTING FOLD 5 ===")
print(fold5[detail_cols].round(2).to_string(index=False))

print("\nFile tersimpan:")
print(OUT_DIR / "ringkasan_error_per_fold.csv")
print(OUT_DIR / "detail_listing_fold5.csv")
