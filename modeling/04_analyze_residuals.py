from pathlib import Path

import pandas as pd
from sklearn.metrics import mean_absolute_error


INPUT = Path("output/model_comparison_v2/oof_predictions.csv")
OUTPUT = Path("output/residual_analysis")

if not INPUT.exists():
    raise FileNotFoundError(f"File tidak ditemukan: {INPUT}")

df = pd.read_csv(INPUT)

required = [
    "harga_aktual",
    "sumber",
    "lokasi",
    "jenis",
    "prediksi_Random Forest",
    "prediksi_Ridge Regression",
]

missing = [c for c in required if c not in df.columns]
if missing:
    raise ValueError(f"Kolom tidak ditemukan: {missing}")

OUTPUT.mkdir(parents=True, exist_ok=True)

# Fokus awal pada dua kandidat teratas.
for model in ["Random Forest", "Ridge Regression"]:
    pred_col = f"prediksi_{model}"
    prefix = model.lower().replace(" ", "_")

    result = df[
        ["harga_aktual", "sumber", "lokasi", "jenis", "fold"]
    ].copy()

    result["prediksi"] = df[pred_col]
    result["residual_aktual_minus_prediksi"] = (
        result["harga_aktual"] - result["prediksi"]
    )
    result["error_absolut"] = (
        result["residual_aktual_minus_prediksi"].abs()
    )
    result["error_persen_absolut"] = (
        result["error_absolut"] / result["harga_aktual"] * 100
    )

    # 1. Kasus dengan error absolut terbesar.
    top_errors = result.sort_values(
        "error_absolut", ascending=False
    ).head(20)

    top_errors.to_csv(
        OUTPUT / f"{prefix}_top20_errors.csv",
        index=False,
    )

    # 2. Error menurut sumber.
    by_source = (
        result.groupby("sumber")
        .agg(
            jumlah=("harga_aktual", "size"),
            MAE_Rp=("error_absolut", "mean"),
            median_error_Rp=("error_absolut", "median"),
            median_error_persen=("error_persen_absolut", "median"),
            bias_Rp=("residual_aktual_minus_prediksi", "mean"),
        )
        .reset_index()
    )

    by_source.to_csv(
        OUTPUT / f"{prefix}_by_source.csv",
        index=False,
    )

    # 3. Error menurut lokasi; tampilkan lokasi dengan minimal 5 data.
    by_location = (
        result.groupby("lokasi")
        .agg(
            jumlah=("harga_aktual", "size"),
            MAE_Rp=("error_absolut", "mean"),
            median_error_persen=("error_persen_absolut", "median"),
            bias_Rp=("residual_aktual_minus_prediksi", "mean"),
        )
        .reset_index()
    )

    by_location = by_location[by_location["jumlah"] >= 5]
    by_location = by_location.sort_values("MAE_Rp", ascending=False)

    by_location.to_csv(
        OUTPUT / f"{prefix}_by_location_min5.csv",
        index=False,
    )

    # 4. Error menurut kuartil harga aktual.
    result["kelompok_harga"] = pd.qcut(
        result["harga_aktual"],
        q=4,
        duplicates="drop",
    ).astype(str)

    by_price = (
        result.groupby("kelompok_harga", observed=True)
        .agg(
            jumlah=("harga_aktual", "size"),
            MAE_Rp=("error_absolut", "mean"),
            median_error_persen=("error_persen_absolut", "median"),
            bias_Rp=("residual_aktual_minus_prediksi", "mean"),
        )
        .reset_index()
    )

    by_price.to_csv(
        OUTPUT / f"{prefix}_by_price_group.csv",
        index=False,
    )

    print(f"\n=== {model} ===")
    print("MAE:", round(mean_absolute_error(
        result["harga_aktual"], result["prediksi"]
    )))
    print("\nSumber:")
    print(by_source.round(2).to_string(index=False))
    print("\nLokasi dengan minimal 5 observasi, diurutkan dari MAE tertinggi:")
    print(by_location.head(10).round(2).to_string(index=False))
    print("\nKelompok harga:")
    print(by_price.round(2).to_string(index=False))

print(f"\nSemua hasil tersimpan di: {OUTPUT}")
print("File prediksi dan dataset sumber tidak diubah.")
