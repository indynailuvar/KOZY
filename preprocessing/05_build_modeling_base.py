from pathlib import Path
import pandas as pd

SOURCE = Path("analysis/kozy_dataset_clean.csv")
OUTPUT = Path("data/modeling/kozy_modeling_base.csv")
EXCLUDED_OUTPUT = Path("data/modeling/kozy_excluded_scope_review.csv")

df = pd.read_csv(SOURCE)

required = ["harga", "lokasi", "jenis", "sumber"]
missing_cols = [c for c in required if c not in df.columns]
if missing_cols:
    raise ValueError(f"Kolom wajib tidak tersedia: {missing_cols}")

# Validasi target dan kategori
df["harga"] = pd.to_numeric(df["harga"], errors="coerce")
df["lokasi"] = df["lokasi"].astype("string").str.strip()
df["jenis"] = df["jenis"].astype("string").str.strip()
df["sumber"] = df["sumber"].astype("string").str.strip()

invalid = (
    df["harga"].isna()
    | (df["harga"] <= 0)
    | df["lokasi"].isna()
    | df["jenis"].isna()
    | df["sumber"].isna()
)

if invalid.any():
    raise ValueError(
        f"Ada {int(invalid.sum())} baris dengan target/kategori wajib tidak valid. "
        "Periksa data sumber sebelum melanjutkan."
    )

# Simpan baris di luar cakupan ke file terpisah untuk traceability.
mask_outside = df["lokasi"].str.contains(
    "sidoarjo", case=False, na=False
)

excluded = df.loc[mask_outside].copy()
model_df = df.loc[~mask_outside, ["harga", "lokasi", "jenis", "sumber"]].copy()

if model_df.empty:
    raise ValueError("Dataset modeling kosong setelah penyaringan.")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
model_df.to_csv(OUTPUT, index=False)
excluded.to_csv(EXCLUDED_OUTPUT, index=False)

print("=== DATASET MODELING DASAR ===")
print("Jumlah baris:", len(model_df))
print("Kolom:", model_df.columns.tolist())
print("Harga tetap dalam Rupiah:", bool(model_df["harga"].gt(0).all()))
print("Missing value:", int(model_df.isna().sum().sum()))
print("\nJumlah data per sumber:")
print(model_df["sumber"].value_counts().to_string())
print("\nJumlah kategori lokasi:", model_df["lokasi"].nunique())
print("\nJumlah kategori jenis:", model_df["jenis"].nunique())
print("\nDataset tersimpan:", OUTPUT)
print("Baris yang perlu ditinjau terkait cakupan tersimpan:", EXCLUDED_OUTPUT)
print("Dataset clean asli tidak diubah.")
