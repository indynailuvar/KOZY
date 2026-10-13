from pathlib import Path
import pandas as pd

INPUT = Path("analysis/kozy_dataset_clean.csv")
PROFILE_FILE = Path(
    "output/validation_audit/profil_identik_harga_berbeda.csv"
)
OUT_DIR = Path("output/manual_review")
OUT_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT)

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    df["sumber"].eq("Papikost")
    & ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy()

features = [
    "lokasi", "jenis", "ac", "wifi", "kmandi_dalam",
    "lemari", "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
]

required = features + ["nama_kost", "harga", "sumber"]
missing = [c for c in required if c not in df.columns]
if missing:
    raise ValueError(f"Kolom tidak ditemukan: {missing}")

for col in features[2:] + ["harga"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

if df[features + ["harga"]].isna().any().any():
    raise ValueError(
        "Ada nilai kosong pada fitur atau harga. "
        "Audit missing value sebelum membuat antrean review."
    )

# Profil berulang dengan harga yang berbeda.
grouped = df.groupby(features, dropna=False)
df["jumlah_listing_profil"] = grouped["nama_kost"].transform("size")
df["jumlah_harga_profil"] = grouped["harga"].transform("nunique")

review = df.loc[
    (df["jumlah_listing_profil"] > 1)
    & (df["jumlah_harga_profil"] > 1)
].copy()

review = review.sort_values(
    ["lokasi", "jenis", "harga", "nama_kost"]
).reset_index(drop=True)

review.insert(
    0, "id_review",
    [f"PROFIL-{i:03d}" for i in range(1, len(review) + 1)]
)

# Kolom berikut diisi setelah pemeriksaan sumber/listing.
review["periode_harga_terverifikasi"] = ""
review["luas_kamar_m2"] = ""
review["biaya_listrik_termasuk"] = ""
review["detail_tipe_dan_kondisi"] = ""
review["identitas_listing_terverifikasi"] = ""
review["bukti_url_atau_catatan"] = ""
review["keputusan_audit"] = ""
review["alasan_keputusan"] = ""

columns = [
    "id_review", "nama_kost", "lokasi", "jenis", "harga", "sumber",
    *features[2:],
    "jumlah_listing_profil", "jumlah_harga_profil",
    "periode_harga_terverifikasi", "luas_kamar_m2",
    "biaya_listrik_termasuk", "detail_tipe_dan_kondisi",
    "identitas_listing_terverifikasi", "bukti_url_atau_catatan",
    "keputusan_audit", "alasan_keputusan",
]

output = OUT_DIR / "review_profil_identik_harga_berbeda.csv"
review[columns].to_csv(output, index=False)

print(f"Jumlah listing untuk review : {len(review)}")
print(f"Jumlah profil bermasalah   : "
      f"{review[features].drop_duplicates().shape[0]}")
print(f"File tersimpan              : {output}")
print("\nDaftar listing:")
print(review[["id_review", "nama_kost", "lokasi", "harga"]].to_string(index=False))
