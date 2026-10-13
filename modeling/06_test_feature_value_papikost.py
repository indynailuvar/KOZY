from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

CLEAN_PATH = Path("analysis/kozy_dataset_clean.csv")
OUT_DIR = Path("output/feature_experiment_papikost")
OUT_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
N_SPLITS = 5

df = pd.read_csv(CLEAN_PATH)

# Samakan aturan cakupan dan teks dengan pipeline sebelumnya.
for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy()

df = df.loc[df["sumber"].eq("Papikost")].reset_index(drop=True)

if len(df) < N_SPLITS:
    raise ValueError("Observasi terlalu sedikit untuk 5-fold CV.")

# Fitur baseline dan fitur tambahan.
categorical_base = ["lokasi", "jenis"]

numeric_extra = [
    "latitude",
    "longitude",
    "jumlah_dilihat",
    "sisa_kamar",
    "jumlah_fasilitas",
    "ac",
    "wifi",
    "kmandi_dalam",
    "lemari",
    "meja_belajar",
    "kasur",
    "tv",
    "pmotor",
    "pmobil",
]

missing_columns = [
    c for c in categorical_base + numeric_extra + ["harga"]
    if c not in df.columns
]
if missing_columns:
    raise ValueError(f"Kolom tidak ditemukan: {missing_columns}")

# Buang fitur tambahan yang seluruhnya kosong atau konstan.
usable_extra = []
excluded_extra = {}

for col in numeric_extra:
    values = pd.to_numeric(df[col], errors="coerce")
    n_unique = values.nunique(dropna=True)

    if values.notna().sum() == 0:
        excluded_extra[col] = "seluruh nilai kosong"
    elif n_unique <= 1:
        excluded_extra[col] = "nilai konstan"
    else:
        usable_extra.append(col)

# Informasi audit untuk menilai kelayakan fitur.
print("=== AUDIT SUBSET ===")
print("Jumlah observasi Papikost:", len(df))
print("Jumlah harga kosong:", int(df["harga"].isna().sum()))

print("\n=== KELENGKAPAN FITUR TAMBAHAN ===")
for col in numeric_extra:
    print(
        f"{col}: {int(df[col].notna().sum())}/{len(df)} terisi; "
        f"nilai unik={df[col].nunique(dropna=True)}"
    )

print("\n=== FITUR TAMBAHAN YANG TIDAK DIGUNAKAN ===")
print(excluded_extra if excluded_extra else "Tidak ada")

if df["harga"].isna().any() or (df["harga"] <= 0).any():
    raise ValueError("Target harga tidak valid.")

# Data kategorikal diimputasi dengan modus dan di-one-hot encode.
# Data numerik diimputasi median; scaling membantu Ridge.
def build_pipeline(model, categorical_cols, numeric_cols):
    transformers = []

    if categorical_cols:
        cat_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ])
        transformers.append(("cat", cat_pipe, categorical_cols))

    if numeric_cols:
        num_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ])
        transformers.append(("num", num_pipe, numeric_cols))

    prep = ColumnTransformer(transformers=transformers)

    return Pipeline([
        ("preprocess", prep),
        ("model", model),
    ])

# Fold yang sama digunakan untuk semua eksperimen.
cv = KFold(
    n_splits=N_SPLITS,
    shuffle=True,
    random_state=RANDOM_STATE,
)
splits = list(cv.split(df))

experiments = [
    ("Ridge_baseline", Ridge(alpha=10), categorical_base, []),
    ("Ridge_enriched", Ridge(alpha=10), categorical_base, usable_extra),
    (
        "RF_baseline",
        RandomForestRegressor(
            n_estimators=300,
            min_samples_leaf=3,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        categorical_base,
        [],
    ),
    (
        "RF_enriched",
        RandomForestRegressor(
            n_estimators=300,
            min_samples_leaf=3,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        categorical_base,
        usable_extra,
    ),
]

y = pd.to_numeric(df["harga"], errors="raise")
predictions = pd.DataFrame({
    "harga_aktual": y,
    "lokasi": df["lokasi"],
    "jenis": df["jenis"],
    "sumber": df["sumber"],
})

metrics = []

for name, estimator, cat_cols, num_cols in experiments:
    X = df[cat_cols + num_cols].copy()
    pipe = build_pipeline(estimator, cat_cols, num_cols)

    oof = cross_val_predict(
        pipe, X, y, cv=splits, n_jobs=1
    )

    predictions[f"prediksi_{name}"] = oof

    residual = y.to_numpy() - oof
    metrics.append({
        "model": name,
        "n": len(y),
        "MAE_Rp": mean_absolute_error(y, oof),
        "RMSE_Rp": np.sqrt(mean_squared_error(y, oof)),
        "R2": r2_score(y, oof),
        "bias_aktual_minus_prediksi_Rp": float(residual.mean()),
        "WAPE_persen": (
            np.abs(residual).sum() / np.abs(y.to_numpy()).sum() * 100
        ),
        "jumlah_fitur_tambahan": len(num_cols),
    })

metrics_df = pd.DataFrame(metrics).sort_values("MAE_Rp")
metrics_df.to_csv(OUT_DIR / "metrics.csv", index=False)
predictions.to_csv(OUT_DIR / "oof_predictions.csv", index=False)

# Evaluasi per fold agar terlihat kestabilan hasil.
fold_rows = []

for fold_id, (train_idx, test_idx) in enumerate(splits, start=1):
    for name, estimator, cat_cols, num_cols in experiments:
        X = df[cat_cols + num_cols].copy()
        pipe = build_pipeline(estimator, cat_cols, num_cols)
        pipe.fit(X.iloc[train_idx], y.iloc[train_idx])
        p = pipe.predict(X.iloc[test_idx])
        actual = y.iloc[test_idx].to_numpy()

        fold_rows.append({
            "fold": fold_id,
            "model": name,
            "n_test": len(test_idx),
            "MAE_Rp": mean_absolute_error(actual, p),
            "RMSE_Rp": np.sqrt(mean_squared_error(actual, p)),
        })

pd.DataFrame(fold_rows).to_csv(
    OUT_DIR / "metrics_by_fold.csv", index=False
)

print("\n=== PERBANDINGAN MODEL ===")
print(metrics_df.to_string(index=False))

print("\n=== MAE PER FOLD ===")
print(
    pd.DataFrame(fold_rows)
    .pivot(index="fold", columns="model", values="MAE_Rp")
    .round(0)
    .to_string()
)

print("\nFile hasil:")
print(OUT_DIR / "metrics.csv")
print(OUT_DIR / "metrics_by_fold.csv")
print(OUT_DIR / "oof_predictions.csv")
print("\nEksperimen selesai; dataset sumber tidak diubah.")
