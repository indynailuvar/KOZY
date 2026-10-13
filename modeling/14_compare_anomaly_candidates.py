from pathlib import Path

import pandas as pd

INPUT_PATH = Path("output/feature_ablation_papikost/oof_predictions.csv")
OUT_DIR = Path("output/anomaly_candidates")
OUT_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT_PATH)

required = {
    "baris", "nama_kost", "harga_aktual",
    "prediksi_oof", "model", "fitur"
}
missing = required - set(df.columns)

if missing:
    raise ValueError(
        f"Kolom tidak ditemukan: {sorted(missing)}. "
        f"Kolom tersedia: {df.columns.tolist()}"
    )

df = df.loc[
    df["fitur"].eq("baseline_plus_facilities")
    & df["model"].isin(["Ridge", "RandomForest"])
].copy()

if df.empty:
    raise ValueError("Tidak ada prediksi untuk kedua model.")

df["harga_aktual"] = pd.to_numeric(
    df["harga_aktual"], errors="coerce"
)
df["prediksi_oof"] = pd.to_numeric(
    df["prediksi_oof"], errors="coerce"
)
df = df.dropna(subset=["baris", "harga_aktual", "prediksi_oof"])

df["residual"] = df["harga_aktual"] - df["prediksi_oof"]
df["abs_residual"] = df["residual"].abs()

# Ambang eksploratif dihitung terpisah untuk setiap model.
df["ambang_model"] = df.groupby("model")["abs_residual"].transform(
    lambda s: s.quantile(0.95)
)
df["ditandai_model"] = df["abs_residual"] > df["ambang_model"]

# Pastikan setiap kos memiliki tepat satu prediksi per model.
if df.duplicated(["baris", "model"]).any():
    raise ValueError("Ada prediksi ganda untuk baris dan model yang sama.")

wide = df.pivot(
    index="baris",
    columns="model",
    values=["nama_kost", "harga_aktual", "prediksi_oof",
            "residual", "abs_residual", "ditandai_model"]
)

wide.columns = [f"{a}_{b}" for a, b in wide.columns]
wide = wide.reset_index()

for model in ["Ridge", "RandomForest"]:
    col = f"ditandai_model_{model}"
    if col not in wide.columns:
        raise ValueError(f"Prediksi model {model} tidak tersedia.")

wide["ditandai_kedua_model"] = (
    wide["ditandai_model_Ridge"].fillna(False).astype(bool)
    & wide["ditandai_model_RandomForest"].fillna(False).astype(bool)
)

wide["status_kandidat"] = "Tidak melewati ambang eksploratif"
wide.loc[
    wide["ditandai_model_Ridge"].fillna(False).astype(bool)
    | wide["ditandai_model_RandomForest"].fillna(False).astype(bool),
    "status_kandidat"
] = "Ditandai minimal satu model"
wide.loc[
    wide["ditandai_kedua_model"],
    "status_kandidat"
] = "Ditandai kedua model"

wide["residual_absolut_maksimum"] = wide[
    ["abs_residual_Ridge", "abs_residual_RandomForest"]
].max(axis=1)

wide = wide.sort_values("residual_absolut_maksimum", ascending=False)

output = OUT_DIR / "perbandingan_kandidat_ridge_rf.csv"
wide.to_csv(output, index=False, encoding="utf-8-sig")

print("=" * 60)
print("PERBANDINGAN KANDIDAT ANOMALI KOZY")
print("=" * 60)
print(f"Jumlah kos dibandingkan : {len(wide)}")
print(
    "Ditandai Ridge          : "
    f"{int(wide['ditandai_model_Ridge'].fillna(False).sum())}"
)
print(
    "Ditandai Random Forest  : "
    f"{int(wide['ditandai_model_RandomForest'].fillna(False).sum())}"
)
print(
    "Ditandai kedua model    : "
    f"{int(wide['ditandai_kedua_model'].sum())}"
)
print(f"\nFile hasil: {output}")

cols = [
    "nama_kost_Ridge",
    "harga_aktual_Ridge",
    "prediksi_oof_Ridge",
    "prediksi_oof_RandomForest",
    "ditandai_model_Ridge",
    "ditandai_model_RandomForest",
    "status_kandidat",
]
cols = [c for c in cols if c in wide.columns]

print("\nDaftar kandidat teratas:")
print(wide.loc[
    wide["status_kandidat"] != "Tidak melewati ambang eksploratif",
    cols
].to_string(index=False))

print(
    "\nCatatan: kesepakatan model bukan bukti bahwa harga tidak wajar."
)
