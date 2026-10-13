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
OUT = Path("output/grouped_validation_papikost")
OUT.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT)

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
    & df["sumber"].eq("Papikost")
].copy().reset_index(drop=True)

# Koordinat harus tersedia agar grup dapat dibentuk.
for col in ["latitude", "longitude"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

if df[["latitude", "longitude"]].isna().any().any():
    raise ValueError(
        "Ada koordinat kosong. Audit data sebelum grouped validation."
    )

y = pd.to_numeric(df["harga"], errors="raise")

if y.isna().any() or (y <= 0).any():
    raise ValueError("Target harga tidak valid.")

# Pembulatan digunakan agar perbedaan kecil pada koordinat
# tidak otomatis memisahkan titik yang seharusnya satu grup.
df["group_coord"] = (
    df["latitude"].round(5).astype(str)
    + "_"
    + df["longitude"].round(5).astype(str)
)

groups = df["group_coord"]
n_groups = groups.nunique()

if n_groups < 5:
    raise ValueError("Jumlah grup koordinat kurang dari 5.")

print("Jumlah observasi:", len(df))
print("Jumlah grup koordinat:", n_groups)

base = ["lokasi", "jenis"]

facilities = [
    "ac", "wifi", "kmandi_dalam", "lemari",
    "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
]

geo = ["latitude", "longitude"]
dynamic = ["jumlah_dilihat", "sisa_kamar"]

feature_sets = {
    "baseline": base,
    "karakteristik": base + geo + facilities,
    "dinamis": base + dynamic,
    "semua": base + geo + facilities + dynamic,
}

# Buang fitur yang seluruhnya kosong atau konstan.
for name, cols in feature_sets.items():
    absent = [c for c in cols if c not in df.columns]
    if absent:
        raise ValueError(f"Kolom untuk {name} tidak ditemukan: {absent}")

    feature_sets[name] = [
        c for c in cols
        if df[c].notna().any() and df[c].nunique(dropna=True) > 1
    ]

cv = GroupKFold(n_splits=5)
splits = list(cv.split(df, y, groups=groups))

# Verifikasi tidak ada grup koordinat yang tersebar antara train dan test.
for fold, (train_idx, test_idx) in enumerate(splits, start=1):
    overlap = set(groups.iloc[train_idx]) & set(groups.iloc[test_idx])
    if overlap:
        raise ValueError(f"Grup koordinat bocor pada fold {fold}.")

    print(
        f"Fold {fold}: train={len(train_idx)}, "
        f"test={len(test_idx)}, "
        f"grup test={groups.iloc[test_idx].nunique()}"
    )


def make_pipeline(model, columns):
    cat_cols = [
        c for c in columns
        if c in ["lokasi", "jenis"]
    ]
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

rows = []
pred_rows = []

for feature_name, columns in feature_sets.items():
    X = df[columns].copy()

    for model_name, model in models.items():
        oof = np.full(len(df), np.nan)

        for train_idx, test_idx in splits:
            pipe = make_pipeline(model, columns)
            pipe.fit(X.iloc[train_idx], y.iloc[train_idx])
            oof[test_idx] = pipe.predict(X.iloc[test_idx])

        if np.isnan(oof).any():
            raise ValueError("Ada observasi yang tidak mendapat prediksi OOF.")

        residual = y.to_numpy() - oof

        rows.append({
            "fitur": feature_name,
            "model": model_name,
            "n": len(y),
            "jumlah_fitur": len(columns),
            "MAE_Rp": mean_absolute_error(y, oof),
            "RMSE_Rp": np.sqrt(mean_squared_error(y, oof)),
            "R2": r2_score(y, oof),
            "bias_aktual_minus_prediksi_Rp": residual.mean(),
            "WAPE_persen": (
                np.abs(residual).sum() / np.abs(y.to_numpy()).sum() * 100
            ),
        })

        for i in range(len(df)):
            pred_rows.append({
                "indeks_observasi": i,
                "nama_kost": (
                    df.loc[i, "nama_kost"]
                    if "nama_kost" in df.columns else None
                ),
                "lokasi": df.loc[i, "lokasi"],
                "harga_aktual": y.iloc[i],
                "grup_koordinat": groups.iloc[i],
                "fitur": feature_name,
                "model": model_name,
                "prediksi_oof": oof[i],
            })

metrics = pd.DataFrame(rows).sort_values("MAE_Rp")
metrics.to_csv(OUT / "metrics_grouped.csv", index=False)
pd.DataFrame(pred_rows).to_csv(
    OUT / "predictions_grouped.csv", index=False
)

print("\n=== HASIL GROUPED VALIDATION ===")
print(metrics.round(3).to_string(index=False))

print("\nFile hasil:")
print(OUT / "metrics_grouped.csv")
print(OUT / "predictions_grouped.csv")