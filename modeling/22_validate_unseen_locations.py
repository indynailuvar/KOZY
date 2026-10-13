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
OUT = Path("output/final_models")
OUT.mkdir(parents=True, exist_ok=True)

CAT = ["lokasi", "jenis"]
BINARY = [
    "ac", "wifi", "kmandi_dalam", "lemari",
    "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
]
FEATURES = CAT + BINARY
TARGET = "harga"

df = pd.read_csv(INPUT)

for c in ["lokasi", "jenis", "sumber"]:
    df[c] = df[c].astype("string").str.strip()

df = df.loc[
    df["sumber"].eq("Papikost")
    & ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy().reset_index(drop=True)

required = FEATURES + [TARGET]
missing = [c for c in required if c not in df.columns]
if missing:
    raise ValueError(f"Kolom tidak ditemukan: {missing}")

for c in BINARY + [TARGET]:
    df[c] = pd.to_numeric(df[c], errors="coerce")

if df[required].isna().any().any():
    raise ValueError(
        "Ada nilai kosong pada fitur atau target. "
        "Periksa data sebelum validasi."
    )

if df["lokasi"].nunique() < 5:
    raise ValueError("Jumlah lokasi unik kurang dari 5.")

X = df[FEATURES]
y = df[TARGET].astype(float)
groups = df["lokasi"]

cv = GroupKFold(n_splits=5)
splits = list(cv.split(X, y, groups=groups))

def make_model(name):
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])

    if name == "Ridge":
        binary = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("scaler", StandardScaler()),
        ])
        estimator = Ridge(alpha=10.0)
    else:
        binary = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
        ])
        estimator = RandomForestRegressor(
            n_estimators=500,
            min_samples_leaf=2,
            max_features=1.0,
            random_state=42,
            n_jobs=-1,
        )

    preprocess = ColumnTransformer([
        ("categorical", categorical, CAT),
        ("binary", binary, BINARY),
    ])

    return Pipeline([
        ("preprocess", preprocess),
        ("model", estimator),
    ])

metric_rows = []
prediction_rows = []

for name in ["Ridge", "RandomForest"]:
    oof = np.full(len(df), np.nan)
    fold_id = np.full(len(df), -1)

    for fold, (train_idx, test_idx) in enumerate(splits, start=1):
        model = make_model(name)
        model.fit(X.iloc[train_idx], y.iloc[train_idx])
        oof[test_idx] = model.predict(X.iloc[test_idx])
        fold_id[test_idx] = fold

        actual = y.iloc[test_idx].to_numpy()
        pred = oof[test_idx]
        metric_rows.append({
            "model": name,
            "fold": fold,
            "n_test": len(test_idx),
            "jumlah_lokasi_test": groups.iloc[test_idx].nunique(),
            "MAE_Rp": mean_absolute_error(actual, pred),
            "RMSE_Rp": np.sqrt(mean_squared_error(actual, pred)),
            "R2": r2_score(actual, pred),
        })

    if np.isnan(oof).any():
        raise RuntimeError(f"Prediksi OOF {name} tidak lengkap.")

    residual = y.to_numpy() - oof
    prediction_rows.append(pd.DataFrame({
        "nama_kost": df["nama_kost"] if "nama_kost" in df else "",
        "lokasi": df["lokasi"],
        "harga_aktual": y,
        "prediksi_oof": oof,
        "residual": residual,
        "fold": fold_id,
        "model": name,
    }))

metrics = pd.DataFrame(metric_rows)
predictions = pd.concat(prediction_rows, ignore_index=True)

summary = (
    predictions.groupby("model")
    .apply(lambda g: pd.Series({
        "MAE_Rp": mean_absolute_error(
            g["harga_aktual"], g["prediksi_oof"]
        ),
        "RMSE_Rp": np.sqrt(mean_squared_error(
            g["harga_aktual"], g["prediksi_oof"]
        )),
        "R2": r2_score(g["harga_aktual"], g["prediksi_oof"]),
        "WAPE_persen": (
            g["residual"].abs().sum()
            / g["harga_aktual"].abs().sum() * 100
        ),
        "bias_aktual_minus_prediksi_Rp": g["residual"].mean(),
    }))
    .reset_index()
)

metrics.to_csv(OUT / "unseen_location_metrics_per_fold.csv", index=False)
predictions.to_csv(
    OUT / "unseen_location_predictions_oof.csv", index=False
)
summary.to_csv(OUT / "unseen_location_metrics_summary.csv", index=False)

print("\n=== VALIDASI LOKASI TIDAK TERLIHAT SAAT TRAINING ===")
print(summary.to_string(index=False))
print("\n=== HASIL PER FOLD ===")
print(metrics.to_string(index=False))
print("\nFile tersimpan di:", OUT)
