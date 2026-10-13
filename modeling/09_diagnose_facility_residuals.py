from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_absolute_error, mean_squared_error

CLEAN_PATH = Path("analysis/kozy_dataset_clean.csv")
PRED_PATH = Path(
    "output/feature_ablation_papikost/oof_predictions.csv"
)
OUT_DIR = Path("output/facility_residual_diagnosis")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Susun ulang subset dengan aturan yang sama.
df = pd.read_csv(CLEAN_PATH)

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
    & df["sumber"].eq("Papikost")
].copy().reset_index(drop=True)

df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
df["harga"] = pd.to_numeric(df["harga"], errors="coerce")

if df[["latitude", "longitude"]].isna().any().any():
    raise ValueError("Koordinat kosong; tidak dapat merekonstruksi fold.")

df["group_coord"] = (
    df["latitude"].round(5).astype(str)
    + "_"
    + df["longitude"].round(5).astype(str)
)

# 2. Rekonstruksi fold dengan konfigurasi yang sama.
cv = GroupKFold(n_splits=5)
fold_by_row = {}

for fold, (_, test_idx) in enumerate(
    cv.split(df, groups=df["group_coord"]), start=1
):
    for idx in test_idx:
        fold_by_row[int(idx)] = fold

if len(fold_by_row) != len(df):
    raise ValueError("Tidak semua observasi mendapat fold.")

# 3. Baca file prediksi yang berisi banyak eksperimen.
pred_all = pd.read_csv(PRED_PATH)

required = {
    "baris", "harga_aktual", "lokasi",
    "fitur", "model", "prediksi_oof"
}
missing = required - set(pred_all.columns)

if missing:
    raise ValueError(f"Kolom prediksi tidak ditemukan: {sorted(missing)}")

# Filter satu kelompok fitur, tetapi pertahankan kedua model.
pred = pred_all.loc[
    pred_all["fitur"].eq("baseline_plus_facilities")
    & pred_all["model"].isin(["Ridge", "RandomForest"])
].copy()

pred["baris"] = pd.to_numeric(pred["baris"], errors="raise").astype(int)

if pred.empty:
    raise ValueError("Tidak ditemukan prediksi untuk fitur fasilitas.")

# 4. Validasi: setiap model harus punya 68 observasi yang unik.
expected_rows = set(range(len(df)))

for model_name, part in pred.groupby("model"):
    observed_rows = part["baris"].tolist()

    if part["baris"].duplicated().any():
        raise ValueError(
            f"Ada indeks observasi duplikat pada model {model_name}."
        )

    if set(observed_rows) != expected_rows:
        raise ValueError(
            f"Observasi model {model_name} tidak lengkap atau tidak sesuai."
        )

    print(
        f"Validasi {model_name}: {len(part)} prediksi, "
        "seluruh indeks observasi cocok."
    )

# 5. Pasangkan metadata menggunakan indeks observasi eksplisit.
metadata_cols = ["harga", "lokasi", "jenis", "sumber", "group_coord"]
if "nama_kost" in df.columns:
    metadata_cols.append("nama_kost")

metadata = df[metadata_cols].copy()
metadata["baris"] = np.arange(len(df))
metadata["fold"] = metadata["baris"].map(fold_by_row)

pred = pred.merge(
    metadata,
    on="baris",
    how="left",
    validate="many_to_one",
    suffixes=("_pred", "_data"),
)

# Periksa kembali harga dan lokasi untuk setiap pasangan.
price_equal = (
    pd.to_numeric(pred["harga_aktual"], errors="coerce")
    .eq(pred["harga"])
)
if not price_equal.all():
    raise ValueError("Harga prediksi tidak cocok dengan data sumber.")

location_equal = (
    pred["lokasi_pred"].astype("string").fillna("<MISSING>")
    .eq(pred["lokasi_data"].astype("string").fillna("<MISSING>"))
)
if not location_equal.all():
    raise ValueError("Lokasi prediksi tidak cocok dengan data sumber.")

# Rapikan nama kolom setelah validasi.
pred["lokasi"] = pred["lokasi_data"]
if "nama_kost" in pred.columns:
    pred["nama_kost_asli"] = pred["nama_kost"]

pred["residual"] = pred["harga_aktual"] - pred["prediksi_oof"]
pred["error_absolut"] = pred["residual"].abs()
pred["error_persen"] = (
    pred["error_absolut"] / pred["harga_aktual"] * 100
)

# 6. Ringkasan harga aktual per fold.
fold_summary = (
    metadata.assign(fold=metadata["baris"].map(fold_by_row))
    .groupby("fold")
    .agg(
        jumlah=("harga", "size"),
        harga_median=("harga", "median"),
        harga_rata_rata=("harga", "mean"),
        harga_min=("harga", "min"),
        harga_max=("harga", "max"),
    )
    .reset_index()
)

fold_summary.to_csv(OUT_DIR / "price_by_fold.csv", index=False)

# 7. Metrik tiap model dan fold.
metric_rows = []

for (fold, model), part in pred.groupby(["fold", "model"]):
    actual = part["harga_aktual"].to_numpy()
    predicted = part["prediksi_oof"].to_numpy()
    residual = actual - predicted

    metric_rows.append({
        "fold": fold,
        "model": model,
        "n": len(part),
        "MAE_Rp": mean_absolute_error(actual, predicted),
        "RMSE_Rp": np.sqrt(mean_squared_error(actual, predicted)),
        "bias_aktual_minus_prediksi_Rp": residual.mean(),
    })

fold_metrics = pd.DataFrame(metric_rows)
fold_metrics.to_csv(
    OUT_DIR / "model_metrics_by_fold.csv", index=False
)

# 8. Sepuluh error absolut terbesar untuk setiap model.
top_errors = (
    pred.sort_values("error_absolut", ascending=False)
    .groupby("model", group_keys=False)
    .head(10)
)

top_errors.to_csv(OUT_DIR / "top_errors.csv", index=False)

print("\n=== DISTRIBUSI HARGA PER FOLD ===")
print(fold_summary.round(0).to_string(index=False))

print("\n=== METRIK MODEL PER FOLD ===")
print(fold_metrics.round(0).to_string(index=False))

print("\n=== 10 ERROR TERBESAR PER MODEL ===")
cols = [
    "model", "fold", "nama_kost_asli", "harga_aktual",
    "prediksi_oof", "residual", "error_persen", "lokasi"
]
cols = [c for c in cols if c in top_errors.columns]
print(top_errors[cols].round(2).to_string(index=False))

print("\nFile hasil:")
print(OUT_DIR / "price_by_fold.csv")
print(OUT_DIR / "model_metrics_by_fold.csv")
print(OUT_DIR / "top_errors.csv")
