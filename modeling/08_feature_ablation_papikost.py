from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

INPUT = Path("analysis/kozy_dataset_clean.csv")
OUT = Path("output/feature_ablation_papikost")
OUT.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT)

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
    & df["sumber"].eq("Papikost")
].copy().reset_index(drop=True)

base_features = ["lokasi", "jenis"]
geo_features = ["latitude", "longitude"]
facility_features = [
    "ac", "wifi", "kmandi_dalam", "lemari", "meja_belajar",
    "kasur", "tv", "pmotor", "pmobil",
]

all_features = base_features + geo_features + facility_features

for col in all_features + ["harga"]:
    if col not in df.columns:
        raise ValueError(f"Kolom tidak ditemukan: {col}")

for col in geo_features + facility_features + ["harga"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

if df["harga"].isna().any() or (df["harga"] <= 0).any():
    raise ValueError("Target harga tidak valid.")

# Cek kelengkapan dan variasi fitur sebelum eksperimen.
print("=== AUDIT FITUR ===")
print("Jumlah observasi:", len(df))

for col in geo_features + facility_features:
    print(
        f"{col}: terisi={df[col].notna().sum()}/{len(df)}, "
        f"nilai unik={df[col].nunique(dropna=True)}"
    )

# Buat grup koordinat untuk mencegah koordinat sama masuk train dan test.
if df[geo_features].isna().any().any():
    raise ValueError("Koordinat kosong; audit sebelum membuat grup.")

df["group_coord"] = (
    df["latitude"].round(5).astype(str)
    + "_"
    + df["longitude"].round(5).astype(str)
)

groups = df["group_coord"]
if groups.nunique() < 5:
    raise ValueError("Jumlah grup koordinat kurang dari 5.")

cv = GroupKFold(n_splits=5)
splits = list(cv.split(df, groups=groups))

for fold, (train_idx, test_idx) in enumerate(splits, start=1):
    train_groups = set(groups.iloc[train_idx])
    test_groups = set(groups.iloc[test_idx])

    if train_groups & test_groups:
        raise ValueError(f"Grup koordinat bocor pada fold {fold}")

    print(
        f"Fold {fold}: train={len(train_idx)}, "
        f"test={len(test_idx)}, "
        f"grup test={groups.iloc[test_idx].nunique()}"
    )

feature_sets = {
    "baseline": base_features,
    "baseline_plus_geo": base_features + geo_features,
    "baseline_plus_facilities": base_features + facility_features,
    "geo_plus_facilities": all_features,
}

# Hapus fitur konstan atau seluruhnya kosong secara eksplisit.
for name, columns in feature_sets.items():
    feature_sets[name] = [
        c for c in columns
        if df[c].notna().any() and df[c].nunique(dropna=True) > 1
    ]

def make_pipeline(model, columns):
    cat_cols = [c for c in columns if c in ["lokasi", "jenis"]]
    num_cols = [c for c in columns if c not in cat_cols]

    transformers = []

    if cat_cols:
        transformers.append((
            "cat",
            Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OneHotEncoder(handle_unknown="ignore")),
            ]),
            cat_cols,
        ))

    if num_cols:
        transformers.append((
            "num",
            Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]),
            num_cols,
        ))

    return Pipeline([
        ("prep", ColumnTransformer(transformers=transformers)),
        ("model", model),
    ])

models = {
    "Ridge": Ridge(alpha=10),
    "RandomForest": RandomForestRegressor(
        n_estimators=300,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1,
    ),
}

y = df["harga"]
metric_rows = []
fold_rows = []
prediction_rows = []

for feature_name, columns in feature_sets.items():
    X = df[columns].copy()

    for model_name, estimator in models.items():
        oof = np.full(len(df), np.nan)

        for fold, (train_idx, test_idx) in enumerate(splits, start=1):
            pipeline = make_pipeline(estimator, columns)
            pipeline.fit(X.iloc[train_idx], y.iloc[train_idx])
            pred = pipeline.predict(X.iloc[test_idx])
            actual = y.iloc[test_idx].to_numpy()

            oof[test_idx] = pred

            fold_rows.append({
                "fitur": feature_name,
                "model": model_name,
                "fold": fold,
                "n_test": len(test_idx),
                "MAE_Rp": mean_absolute_error(actual, pred),
                "RMSE_Rp": np.sqrt(mean_squared_error(actual, pred)),
            })

        if np.isnan(oof).any():
            raise ValueError("Ada observasi tanpa prediksi OOF.")

        residual = y.to_numpy() - oof

        metric_rows.append({
            "fitur": feature_name,
            "model": model_name,
            "jumlah_fitur": len(columns),
            "MAE_Rp": mean_absolute_error(y, oof),
            "RMSE_Rp": np.sqrt(mean_squared_error(y, oof)),
            "R2": r2_score(y, oof),
            "bias_aktual_minus_prediksi_Rp": residual.mean(),
            "WAPE_persen": (
                np.abs(residual).sum() / np.abs(y.to_numpy()).sum() * 100
            ),
        })

        for i, prediction in enumerate(oof):
            prediction_rows.append({
                "baris": i,
                "nama_kost": (
                    df.loc[i, "nama_kost"]
                    if "nama_kost" in df.columns else None
                ),
                "harga_aktual": y.iloc[i],
                "lokasi": df.loc[i, "lokasi"],
                "grup_koordinat": groups.iloc[i],
                "fitur": feature_name,
                "model": model_name,
                "prediksi_oof": prediction,
            })

metrics = pd.DataFrame(metric_rows).sort_values("MAE_Rp")
fold_metrics = pd.DataFrame(fold_rows)

metrics.to_csv(OUT / "metrics.csv", index=False)
fold_metrics.to_csv(OUT / "metrics_by_fold.csv", index=False)
pd.DataFrame(prediction_rows).to_csv(
    OUT / "oof_predictions.csv", index=False
)

print("\n=== HASIL FEATURE ABLATION ===")
print(metrics.round(3).to_string(index=False))

print("\n=== MAE PER FOLD ===")
print(
    fold_metrics.pivot(
        index=["fitur", "fold"],
        columns="model",
        values="MAE_Rp",
    ).round(0).to_string()
)

print("\nHasil tersimpan di:", OUT)
