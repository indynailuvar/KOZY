from pathlib import Path

import pandas as pd

INPUT = Path("analysis/kozy_dataset_clean.csv")
OUT_DIR = Path("output/validation_audit")
OUT_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT)

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    df["sumber"].eq("Papikost")
    & ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy().reset_index(drop=True)

features = [
    "lokasi", "jenis",
    "ac", "wifi", "kmandi_dalam", "lemari",
    "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
]

required = features + ["harga", "nama_kost"]
missing = [col for col in required if col not in df.columns]

if missing:
    raise ValueError(f"Kolom tidak ditemukan: {missing}")

for col in features[2:] + ["harga"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

if df[features].isna().any().any():
    raise ValueError(
        "Ada fitur kosong. Audit missing value sebelum membandingkan profil."
    )

if df["harga"].isna().any():
    raise ValueError("Ada harga kosong.")

# Kelompokkan listing dengan profil fitur yang identik.
grouped = (
    df.groupby(features, dropna=False)
    .agg(
        jumlah_listing=("nama_kost", "size"),
        jumlah_harga_berbeda=("harga", "nunique"),
        harga_min=("harga", "min"),
        harga_median=("harga", "median"),
        harga_max=("harga", "max"),
        daftar_nama=("nama_kost", lambda x: " | ".join(x.astype(str))),
        daftar_harga=("harga", lambda x: " | ".join(
            x.astype(int).astype(str)
        )),
    )
    .reset_index()
)

# Profil yang muncul lebih dari sekali dan memiliki harga berbeda.
profiles = grouped.loc[
    (grouped["jumlah_listing"] > 1)
    & (grouped["jumlah_harga_berbeda"] > 1)
].copy()

profiles["rentang_harga"] = (
    profiles["harga_max"] - profiles["harga_min"]
)

profiles = profiles.sort_values(
    "rentang_harga", ascending=False
)

profiles.to_csv(
    OUT_DIR / "profil_identik_harga_berbeda.csv",
    index=False,
)

# Simpan juga ringkasan seluruh profil berulang.
repeated = grouped.loc[
    grouped["jumlah_listing"] > 1
].copy()

repeated.to_csv(
    OUT_DIR / "seluruh_profil_fitur_berulang.csv",
    index=False,
)

print("Jumlah listing:", len(df))
print("Jumlah profil fitur unik:", len(grouped))
print("Profil fitur berulang:", len(repeated))
print("Profil identik dengan harga berbeda:", len(profiles))

print("\n=== PROFIL IDENTIK, HARGA BERBEDA ===")
if profiles.empty:
    print("Tidak ditemukan profil dengan harga berbeda.")
else:
    print(
        profiles[
            features + [
                "jumlah_listing",
                "jumlah_harga_berbeda",
                "harga_min",
                "harga_median",
                "harga_max",
                "rentang_harga",
                "daftar_nama",
                "daftar_harga",
            ]
        ].to_string(index=False)
    )

print("\nOutput:", OUT_DIR)
