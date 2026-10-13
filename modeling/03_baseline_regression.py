from pathlib import Path

import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


# =====================================================
# 1. KONFIGURASI
# =====================================================
DATA_PATH = Path("data/modeling/kozy_modeling_base.csv")
OUTPUT_DIR = Path("output/model_comparison_v2")

TARGET = "harga"
SOURCE = "sumber"
FEATURES = ["lokasi", "jenis"]

N_SPLITS = 5
RANDOM_STATE = 42


# =====================================================
# 2. LOAD DAN VALIDASI DATA
# =====================================================
if not DATA_PATH.exists():
    raise FileNotFoundError(f"Dataset tidak ditemukan: {DATA_PATH}")

df = pd.read_csv(DATA_PATH)

required = [TARGET, SOURCE, *FEATURES]
missing_cols = [col for col in required if col not in df.columns]

if missing_cols:
    raise ValueError(f"Kolom wajib tidak ditemukan: {missing_cols}")

if df[required].isna().any().any():
    raise ValueError("Ada missing value pada kolom yang digunakan.")

df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce")

if df[TARGET].isna().any() or (df[TARGET] <= 0).any():
    raise ValueError("Harga harus numerik dan lebih besar dari nol.")

source_counts = df[SOURCE].value_counts()

if source_counts.min() < N_SPLITS:
    raise ValueError(
        f"Setiap sumber harus memiliki minimal {N_SPLITS} baris."
    )

X = df[FEATURES]
y = df[TARGET]

# =====================================================
# 3. FOLD: STRATIFIKASI BERDASARKAN SUMBER
# =====================================================
cv = StratifiedKFold(
    n_splits=N_SPLITS,
    shuffle=True,
    random_state=RANDOM_STATE,
)

# Penting: argumen kedua adalah label sumber, bukan harga.
splits = list(cv.split(X, df[SOURCE]))

# Simpan nomor fold untuk setiap observasi.
fold_id = [-1] * len(df)

for fold_number, (_, valid_idx) in enumerate(splits, start=1):
    for idx in valid_idx:
        fold_id[idx] = fold_number

# Verifikasi jumlah data tiap sumber di setiap fold.
fold_source_counts = []

for fold_number, (_, valid_idx) in enumerate(splits, start=1):
    counts = df.iloc[valid_idx][SOURCE].value_counts()

    for source_name in source_counts.index:
        fold_source_counts.append({
            "fold": fold_number,
            "sumber": source_name,
            "jumlah_validasi": int(counts.get(source_name, 0)),
        })

fold_source_counts = pd.DataFrame(fold_source_counts)


# =====================================================
# 4. DEFINISI PIPELINE
# =====================================================
def make_pipeline(regressor):
    preprocessing = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                FEATURES,
            )
        ],
        remainder="drop",
    )

    return Pipeline([
        ("preprocessing", preprocessing),
        ("regressor", regressor),
    ])


models = {
    "Median Baseline": DummyRegressor(strategy="median"),

    "Linear Regression": make_pipeline(
        LinearRegression()
    ),

    "Ridge Regression": make_pipeline(
        Ridge(alpha=10.0)
    ),

    "Random Forest": make_pipeline(
        RandomForestRegressor(
            n_estimators=300,
            min_samples_leaf=3,
            random_state=RANDOM_STATE,
            n_jobs=1,
        )
    ),

    "Extra Trees": make_pipeline(
        ExtraTreesRegressor(
            n_estimators=300,
            min_samples_leaf=3,
            random_state=RANDOM_STATE,
            n_jobs=1,
        )
    ),
}


# =====================================================
# 5. PREDIKSI OUT-OF-FOLD
# =====================================================
predictions = pd.DataFrame({
    "harga_aktual": y,
    "sumber": df[SOURCE],
    "lokasi": df["lokasi"],
    "jenis": df["jenis"],
    "fold": fold_id,
})

for name, model in models.items():
    print(f"Mengevaluasi: {name}")

    if name == "Median Baseline":
        X_model = pd.DataFrame({"dummy": range(len(df))})
    else:
        X_model = X

    predictions[f"prediksi_{name}"] = cross_val_predict(
        model,
        X_model,
        y,
        cv=splits,
        method="predict",
        n_jobs=-1,
    )


# =====================================================
# 6. METRIK KESELURUHAN
# =====================================================
def calculate_metrics(actual, predicted):
    actual = pd.Series(actual)
    predicted = pd.Series(predicted)

    errors = actual - predicted
    total_actual = actual.abs().sum()

    return {
        "jumlah": len(actual),
        "MAE_Rp": mean_absolute_error(actual, predicted),
        "RMSE_Rp": mean_squared_error(actual, predicted) ** 0.5,
        "R2": r2_score(actual, predicted),
        "bias_Rp": errors.mean(),
        "WAPE_pct": (
            errors.abs().sum() / total_actual * 100
            if total_actual != 0
            else float("nan")
        ),
    }


overall_rows = []

for name in models:
    metrics = calculate_metrics(
        predictions["harga_aktual"],
        predictions[f"prediksi_{name}"],
    )
    metrics["model"] = name
    overall_rows.append(metrics)

overall = pd.DataFrame(overall_rows).sort_values("MAE_Rp")


# =====================================================
# 7. METRIK PER SUMBER
# =====================================================
source_rows = []

for name in models:
    pred_col = f"prediksi_{name}"

    for source_name, group in predictions.groupby("sumber"):
        metrics = calculate_metrics(
            group["harga_aktual"],
            group[pred_col],
        )
        metrics["model"] = name
        metrics["sumber"] = source_name
        source_rows.append(metrics)

by_source = pd.DataFrame(source_rows)


# =====================================================
# 8. METRIK PER FOLD
# =====================================================
fold_rows = []

for name in models:
    pred_col = f"prediksi_{name}"

    for fold_number, group in predictions.groupby("fold"):
        metrics = calculate_metrics(
            group["harga_aktual"],
            group[pred_col],
        )
        metrics["model"] = name
        metrics["fold"] = int(fold_number)
        fold_rows.append(metrics)

by_fold = pd.DataFrame(fold_rows)


# =====================================================
# 9. SIMPAN HASIL
# =====================================================
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

overall.to_csv(OUTPUT_DIR / "overall_metrics.csv", index=False)
by_source.to_csv(OUTPUT_DIR / "metrics_by_source.csv", index=False)
by_fold.to_csv(OUTPUT_DIR / "metrics_by_fold.csv", index=False)
fold_source_counts.to_csv(
    OUTPUT_DIR / "fold_source_counts.csv",
    index=False,
)
predictions.to_csv(
    OUTPUT_DIR / "oof_predictions.csv",
    index=False,
)

print("\n=== PEMBAGIAN DATA VALIDASI PER FOLD ===")
print(fold_source_counts.to_string(index=False))

print("\n=== PERBANDINGAN MODEL KESELURUHAN ===")
print(overall.round(3).to_string(index=False))

print("\n=== METRIK BERDASARKAN SUMBER ===")
print(by_source.round(3).to_string(index=False))

print("\n=== METRIK PER FOLD ===")
print(by_fold.round(3).to_string(index=False))

print(f"\nSemua hasil tersimpan di: {OUTPUT_DIR}")
print("Dataset sumber tidak diubah.")
