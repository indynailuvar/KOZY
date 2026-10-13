from pathlib import Path
import pandas as pd

SOURCE = Path("analysis/kozy_dataset_clean.csv")
OUT = Path("output/eda_modeling_decisions")
OUT.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(SOURCE)

# Buat salinan kerja khusus analisis Surabaya.
# Kandidat Sidoarjo dikecualikan sementara dari analisis ini,
# bukan dihapus dari dataset sumber.
df["lokasi"] = df["lokasi"].astype("string").str.strip()
df["jenis"] = df["jenis"].astype("string").str.strip()
df["sumber"] = df["sumber"].astype("string").str.strip()

mask_sidoarjo = df["lokasi"].str.contains(
    "sidoarjo", case=False, na=False
)
surabaya = df.loc[~mask_sidoarjo].copy()

print("=== CAKUPAN ANALISIS ===")
print("Baris sumber:", len(df))
print("Kandidat Sidoarjo yang dikecualikan sementara:", int(mask_sidoarjo.sum()))
print("Baris untuk analisis Surabaya:", len(surabaya))

# 1. Harga berdasarkan sumber
by_source = (
    surabaya.groupby("sumber", dropna=False)["harga"]
    .agg(["count", "mean", "median", "std", "min", "max"])
    .round(2)
)
by_source.to_csv(OUT / "harga_menurut_sumber.csv")
print("\n=== HARGA MENURUT SUMBER ===")
print(by_source.to_string())

# 2. Harga berdasarkan jenis kos
by_type = (
    surabaya.groupby("jenis", dropna=False)["harga"]
    .agg(["count", "mean", "median", "std", "min", "max"])
    .round(2)
)
by_type.to_csv(OUT / "harga_menurut_jenis.csv")
print("\n=== HARGA MENURUT JENIS ===")
print(by_type.to_string())

# 3. Harga menurut lokasi; tampilkan juga ukuran sampel
by_location = (
    surabaya.groupby("lokasi", dropna=False)["harga"]
    .agg(["count", "mean", "median", "std", "min", "max"])
    .sort_values(["count", "median"], ascending=[True, True])
    .round(2)
)
by_location.to_csv(OUT / "harga_menurut_lokasi.csv")
print("\n=== LOKASI DENGAN JUMLAH OBSERVASI PALING SEDIKIT ===")
print(by_location.head(20).to_string())

# 4. Kelengkapan data menurut sumber
missing_by_source = (
    df.groupby("sumber", dropna=False)
    .apply(lambda part: part.isna().mean().mul(100), include_groups=False)
    .T
    .round(2)
)
missing_by_source.to_csv(OUT / "missing_persen_menurut_sumber.csv")
print("\n=== PERSENTASE MISSING MENURUT SUMBER ===")
print(missing_by_source.to_string())

# 5. Nilai unik fitur fasilitas sebelum imputasi
facility_cols = [
    c for c in [
        "ac", "wifi", "kmandi_dalam", "lemari",
        "meja_belajar", "kasur", "tv", "pmotor", "pmobil"
    ]
    if c in df.columns
]
facility_rows = []
for col in facility_cols:
    for value, count in df[col].value_counts(dropna=False).items():
        facility_rows.append({
            "fitur": col,
            "nilai": "<MISSING>" if pd.isna(value) else str(value),
            "jumlah": int(count),
        })

facility_values = pd.DataFrame(facility_rows)
facility_values.to_csv(OUT / "nilai_fitur_fasilitas.csv", index=False)
print("\n=== NILAI UNIK FITUR FASILITAS ===")
print(facility_values.to_string(index=False))

print(f"\nLaporan EDA tersimpan di: {OUT}")
print("Dataset sumber tidak diubah.")
