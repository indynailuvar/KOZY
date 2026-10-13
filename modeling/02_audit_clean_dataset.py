from pathlib import Path
import pandas as pd

SOURCE = Path("analysis/kozy_dataset_clean.csv")
OUT = Path("output/audit_clean_dataset")
OUT.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(SOURCE)

required = {"harga", "lokasi", "jenis", "sumber"}
missing_columns = required - set(df.columns)
if missing_columns:
    raise ValueError(f"Kolom wajib tidak ditemukan: {sorted(missing_columns)}")

# 1. Ringkasan struktur dan tipe data
print("\n=== STRUKTUR DATA ===")
print("Ukuran:", df.shape)
print("\nTipe data:")
print(df.dtypes.to_string())

# 2. Validasi target harga
harga = pd.to_numeric(df["harga"], errors="coerce")
print("\n=== AUDIT HARGA ===")
print("Harga tidak dapat dibaca sebagai angka:", int(harga.isna().sum()))
print("Harga <= 0:", int((harga <= 0).sum()))
print("\nStatistik harga:")
print(harga.describe())

# 3. Missing value
missing = pd.DataFrame({
    "jumlah_missing": df.isna().sum(),
    "persentase_missing": df.isna().mean().mul(100).round(2),
})
missing = missing.sort_values("jumlah_missing", ascending=False)
missing.to_csv(OUT / "missing_values.csv")

print("\n=== MISSING VALUE ===")
print(missing[missing["jumlah_missing"] > 0].to_string())

# 4. Missing value menurut sumber
if "sumber" in df.columns:
    by_source = (
        df.groupby("sumber", dropna=False)
        .agg(
            jumlah_baris=("harga", "size"),
            harga_missing=("harga", lambda s: s.isna().sum()),
        )
    )
    by_source.to_csv(OUT / "ringkasan_sumber.csv")

    missing_source = (
        df.groupby("sumber", dropna=False)[df.columns.tolist()]
        .apply(lambda part: part.isna().mean().mul(100))
    )
    missing_source.to_csv(OUT / "missing_menurut_sumber.csv")

    print("\n=== JUMLAH BARIS PER SUMBER ===")
    print(df["sumber"].value_counts(dropna=False).to_string())

# 5. Distribusi kategori
for col in ["lokasi", "jenis", "sumber"]:
    print(f"\n=== DISTRIBUSI {col.upper()} ===")
    print(df[col].value_counts(dropna=False).to_string())

# 6. Duplikasi persis dan kandidat duplikasi listing
print("\n=== DUPLIKASI ===")
print("Baris identik:", int(df.duplicated().sum()))

candidate_cols = [
    c for c in ["nama_kost", "lokasi", "harga"]
    if c in df.columns
]
if candidate_cols:
    candidates = df.loc[
        df.duplicated(subset=candidate_cols, keep=False)
    ].sort_values(candidate_cols)

    print(f"Kandidat duplikasi berdasarkan {candidate_cols}:")
    print(candidates.to_string(index=False) if not candidates.empty else "Tidak ada")
    candidates.to_csv(OUT / "kandidat_duplikasi_listing.csv", index=False)

# 7. Periksa lokasi yang mengandung Sidoarjo
mask = df["lokasi"].astype("string").str.contains(
    "sidoarjo", case=False, na=False
)
outside_candidates = df.loc[mask]
print("\n=== LOKASI MENGANDUNG SIDOARJO ===")
print(
    outside_candidates[
        [c for c in ["nama_kost", "lokasi", "harga", "jenis", "sumber"]
         if c in df.columns]
    ].to_string(index=False)
    if not outside_candidates.empty else "Tidak ditemukan"
)
outside_candidates.to_csv(OUT / "lokasi_sidoarjo_perlu_verifikasi.csv", index=False)

print(f"\nAudit selesai. Laporan tersimpan di: {OUT}")
print("Dataset sumber tidak diubah.")
