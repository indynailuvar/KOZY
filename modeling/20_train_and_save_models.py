from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
import sklearn

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


# =========================================================
# 1. KONFIGURASI
# =========================================================
INPUT = Path("analysis/kozy_dataset_clean.csv")
OUT_DIR = Path("output/final_models")
OUT_DIR.mkdir(parents=True, exist_ok=True)

CATEGORICAL = ["lokasi", "jenis"]
BINARY_FEATURES = [
    "ac", "wifi", "kmandi_dalam", "lemari",
    "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
]
FEATURES = CATEGORICAL + BINARY_FEATURES
TARGET = "harga"

REQUIRED = FEATURES + [
    TARGET, "sumber", "latitude", "longitude",
    "nama_kost",
]

# =========================================================
# 2. BACA DAN VALIDASI DATA
# =========================================================
if not INPUT.exists():
    raise FileNotFoundError(f"Dataset tidak ditemukan: {INPUT}")

df = pd.read_csv(INPUT)

missing_columns = [c for c in REQUIRED if c not in df.columns]
if missing_columns:
    raise ValueError(f"Kolom wajib tidak ditemukan: {missing_columns}")

for col in ["lokasi", "jenis", "sumber", "nama_kost"]:
    df[col] = df[col].astype("string").str.strip()

# Model ini khusus Papikost Surabaya.
df = df.loc[
    df["sumber"].eq("Papikost")
    & ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy().reset_index(drop=True)

for col in BINARY_FEATURES + [TARGET, "latitude", "longitude"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

if df.empty:
    raise ValueError("Tidak ada data Papikost Surabaya setelah filter.")

if df[FEATURES + [TARGET, "latitude", "longitude"]].isna().any().any():
    missing_counts = (
        df[FEATURES + [TARGET, "latitude", "longitude"]]
        .isna().sum()
    )
    raise ValueError(
        "Ada nilai kosong pada fitur, harga, atau koordinat. "
        "Script dihentikan agar evaluasi tidak diam-diam mengubah data.\n"
        f"{missing_counts[missing_counts > 0].to_string()}"
    )

if not df[TARGET].gt(0).all():
    raise ValueError("Harga harus positif.")

for col in BINARY_FEATURES:
    values = set(df[col].unique())
    if not values.issubset({0, 1}):
        raise ValueError(
            f"Kolom {col} bukan biner 0/1. Nilai ditemukan: {values}"
        )

if df[CATEGORICAL].eq("").any().any():
    raise ValueError("Ada kategori kosong pada lokasi atau jenis.")

# Group hanya untuk validasi; koordinat bukan fitur prediktor.
groups = (
    df["latitude"].round(5).astype(str)
    + "_"
    + df["longitude"].round(5).astype(str)
)

if groups.nunique() < 5:
    raise ValueError(
        f"Group koordinat hanya {groups.nunique()}; "
        "tidak cukup untuk GroupKFold 5-fold."
    )

X = df[FEATURES].copy()
y = df[TARGET].astype(float).copy()

cv = GroupKFold(n_splits=5)
splits = list(cv.split(X, y, groups=groups))

# Pastikan setiap listing menjadi data uji tepat satu kali.
test_indices = np.concatenate([test for _, test in splits])
if len(test_indices) != len(df) or len(np.unique(test_indices)) != len(df):
    raise RuntimeError("Pembagian OOF tidak mencakup setiap baris tepat sekali.")

# =========================================================
# 3. DEFINISI PIPELINE
# =========================================================
def make_pipeline(model_name):
    categorical_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])

    if model_name == "Ridge":
        binary_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("scaler", StandardScaler()),
        ])
        estimator = Ridge(alpha=10.0)

    elif model_name == "RandomForest":
        binary_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
        ])
        estimator = RandomForestRegressor(
            n_estimators=500,
            min_samples_leaf=2,
            max_features=1.0,
            random_state=42,
            n_jobs=-1,
        )

    else:
        raise ValueError(f"Model tidak dikenal: {model_name}")

    preprocess = ColumnTransformer([
        ("categorical", categorical_pipe, CATEGORICAL),
        ("binary", binary_pipe, BINARY_FEATURES),
    ])

    return Pipeline([
        ("preprocess", preprocess),
        ("model", estimator),
    ])


def calculate_metrics(actual, predicted):
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    residual = actual - predicted

    return {
        "MAE_Rp": float(mean_absolute_error(actual, predicted)),
        "RMSE_Rp": float(np.sqrt(mean_squared_error(actual, predicted))),
        "R2": float(r2_score(actual, predicted)),
        "bias_aktual_minus_prediksi_Rp": float(np.mean(residual)),
        "WAPE_persen": float(
            np.sum(np.abs(residual)) / np.sum(np.abs(actual)) * 100
        ),
    }


# =========================================================
# 4. EVALUASI OOF DAN METRIK PER FOLD
# =========================================================
models = ["Ridge", "RandomForest"]
all_metrics = []
all_fold_metrics = []
all_predictions = []
fitted_models = {}

for model_name in models:
    oof = np.full(len(df), np.nan, dtype=float)

    for fold_number, (train_idx, test_idx) in enumerate(splits, start=1):
        pipeline = make_pipeline(model_name)
        pipeline.fit(X.iloc[train_idx], y.iloc[train_idx])
        predictions = pipeline.predict(X.iloc[test_idx])
        oof[test_idx] = predictions

        fold_result = calculate_metrics(y.iloc[test_idx], predictions)
        fold_result.update({
            "model": model_name,
            "fold": fold_number,
            "n_train": len(train_idx),
            "n_test": len(test_idx),
            "jumlah_group_train": groups.iloc[train_idx].nunique(),
            "jumlah_group_test": groups.iloc[test_idx].nunique(),
        })
        all_fold_metrics.append(fold_result)

    if np.isnan(oof).any():
        raise RuntimeError(f"Prediksi OOF {model_name} tidak lengkap.")

    result = calculate_metrics(y, oof)
    result.update({
        "model": model_name,
        "n_listing": len(df),
        "n_group_koordinat": int(groups.nunique()),
        "validasi": "GroupKFold 5-fold; group koordinat dibulatkan 5 desimal",
    })
    all_metrics.append(result)

    pred_df = pd.DataFrame({
        "nama_kost": df["nama_kost"],
        "lokasi": df["lokasi"],
        "jenis": df["jenis"],
        "harga_aktual": y,
        "prediksi_oof": oof,
        "residual_aktual_minus_prediksi": y - oof,
        "fold": -1,
        "model": model_name,
    })

    for fold_number, (_, test_idx) in enumerate(splits, start=1):
        pred_df.loc[test_idx, "fold"] = fold_number

    all_predictions.append(pred_df)

    # Fit final pada seluruh data setelah evaluasi selesai.
    final_pipeline = make_pipeline(model_name)
    final_pipeline.fit(X, y)
    fitted_models[model_name] = final_pipeline

metrics_df = pd.DataFrame(all_metrics)
fold_df = pd.DataFrame(all_fold_metrics)
predictions_df = pd.concat(all_predictions, ignore_index=True)

metrics_df.to_csv(OUT_DIR / "metrics_oof.csv", index=False)
fold_df.to_csv(OUT_DIR / "metrics_per_fold.csv", index=False)
predictions_df.to_csv(OUT_DIR / "predictions_oof.csv", index=False)

# =========================================================
# 5. SIMPAN PIPELINE .PKL DAN METADATA
# =========================================================
metadata = {
    "project": "KOZY",
    "target": TARGET,
    "features": FEATURES,
    "categorical_features": CATEGORICAL,
    "binary_features": BINARY_FEATURES,
    "scope": "Papikost Surabaya; listing Sidoarjo dikecualikan",
    "training_rows": int(len(df)),
    "validation": "GroupKFold 5-fold berdasarkan koordinat dibulatkan 5 desimal",
    "price_unit": "Mengikuti data sumber; periode harga wajib diverifikasi",
    "sklearn_version": sklearn.__version__,
}

for model_name, pipeline in fitted_models.items():
    artifact = {
        "pipeline": pipeline,
        "metadata": {**metadata, "model_name": model_name},
    }
    filename = (
        "kozy_ridge_papikost.pkl"
        if model_name == "Ridge"
        else "kozy_random_forest_papikost.pkl"
    )
    joblib.dump(artifact, OUT_DIR / filename)

# Pilihan sementara berdasarkan hasil eksperimen sebelumnya:
# MAE kedua model hampir sama, sedangkan Ridge memiliki RMSE dan R2
# lebih baik. Jangan menganggap ini sebagai kemenangan universal.
joblib.dump(
    {
        "pipeline": fitted_models["Ridge"],
        "metadata": {
            **metadata,
            "model_name": "Ridge",
            "status": "kandidat utama sementara",
            "selection_note": (
                "MAE hampir setara dengan Random Forest; "
                "Ridge dipilih sementara karena RMSE lebih rendah "
                "dan R2 lebih tinggi pada eksperimen sebelumnya."
            ),
        },
    },
    OUT_DIR / "kozy_best_candidate.pkl",
)

with open(OUT_DIR / "metadata.json", "w", encoding="utf-8") as f:
    json.dump(metadata, f, ensure_ascii=False, indent=2)

print("\n=== METRIK OOF: PERBANDINGAN MODEL ===")
print(metrics_df[
    ["model", "MAE_Rp", "RMSE_Rp", "R2",
     "bias_aktual_minus_prediksi_Rp", "WAPE_persen"]
].to_string(index=False))

print("\n=== METRIK PER FOLD ===")
print(fold_df[
    ["model", "fold", "MAE_Rp", "RMSE_Rp", "R2"]
].to_string(index=False))

print("\n=== MODEL TERSIMPAN ===")
for name in [
    "kozy_ridge_papikost.pkl",
    "kozy_random_forest_papikost.pkl",
    "kozy_best_candidate.pkl",
]:
    print(OUT_DIR / name)

print("\nFile evaluasi:")
print(OUT_DIR / "metrics_oof.csv")
print(OUT_DIR / "metrics_per_fold.csv")
print(OUT_DIR / "predictions_oof.csv")
print(OUT_DIR / "metadata.json")
