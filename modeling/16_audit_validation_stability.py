from pathlib import Path

import pandas as pd
from sklearn.model_selection import GroupKFold

INPUT = Path("analysis/kozy_dataset_clean.csv")
OUT = Path("output/validation_audit")
OUT.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT)

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    df["sumber"].eq("Papikost")
    & ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy().reset_index(drop=True)

df["harga"] = pd.to_numeric(df["harga"], errors="coerce")
df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

if df[["harga", "latitude", "longitude"]].isna().any().any():
    raise ValueError("Ada harga atau koordinat kosong; audit data dahulu.")

if (df["harga"] <= 0).any():
    raise ValueError("Ditemukan harga tidak positif.")

df["grup_koordinat"] = (
    df["latitude"].round(5).astype(str)
    + "_"
    + df["longitude"].round(5).astype(str)
)

cv = GroupKFold(n_splits=5)
rows = []
fold_assignment = pd.Series(index=df.index, dtype="int64")

for fold, (train_idx, test_idx) in enumerate(
    cv.split(df, groups=df["grup_koordinat"]), start=1
):
    train_groups = set(df.iloc[train_idx]["grup_koordinat"])
    test_groups = set(df.iloc[test_idx]["grup_koordinat"])

    if train_groups & test_groups:
        raise ValueError(f"Kebocoran grup ditemukan pada fold {fold}.")

    fold_assignment.iloc[test_idx] = fold
    test = df.iloc[test_idx]

    rows.append({
        "fold": fold,
        "n_test": len(test),
        "jumlah_grup_test": test["grup_koordinat"].nunique(),
        "harga_min": test["harga"].min(),
        "harga_median": test["harga"].median(),
        "harga_mean": test["harga"].mean(),
        "harga_max": test["harga"].max(),
        "jumlah_harga_di_atas_2jt": (test["harga"] > 2_000_000).sum(),
        "jumlah_harga_di_bawah_600rb": (test["harga"] < 600_000).sum(),
    })

summary = pd.DataFrame(rows)
summary.to_csv(OUT / "distribusi_harga_per_fold.csv", index=False)

df["fold_test"] = fold_assignment
df.to_csv(OUT / "penugasan_fold_audit.csv", index=False)

print("=== DISTRIBUSI HARGA PER FOLD ===")
print(summary.round(2).to_string(index=False))
print("\nJumlah listing:", len(df))
print("Jumlah grup koordinat:", df["grup_koordinat"].nunique())
print("Output:", OUT)
