from pathlib import Path

import pandas as pd

CLEAN_PATH = Path("analysis/kozy_dataset_clean.csv")
ERROR_PATH = Path("output/error_case_audit/top_error_cases.csv")
OUT_DIR = Path("output/manual_review")

OUT_DIR.mkdir(parents=True, exist_ok=True)

# Baca data asli dan hasil audit sebelumnya.
df = pd.read_csv(CLEAN_PATH)
errors = pd.read_csv(ERROR_PATH)

# Samakan cakupan dengan eksperimen Papikost di Surabaya.
for col in ["sumber", "lokasi", "jenis"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    df["sumber"].eq("Papikost")
    & ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy().reset_index(drop=True)

df["baris"] = range(len(df))
df["harga"] = pd.to_numeric(df["harga"], errors="coerce")

# Kandidat kombinasi berulang: bukan bukti duplikat.
counts = (
    df.groupby(["harga", "lokasi", "jenis"], dropna=False)["nama_kost"]
    .transform("size")
)
df["kandidat_kombinasi_berulang"] = counts > 1

# Nama kos yang muncul dalam daftar 10 error terbesar.
error_names = set(errors["nama_kost"].dropna().astype(str))
df["masuk_top_error"] = df["nama_kost"].astype(str).isin(error_names)

# Tandai hal yang perlu diverifikasi manusia.
df["perlu_verifikasi_harga"] = df["harga"].le(200_000)
df["perlu_verifikasi_duplikat"] = df["kandidat_kombinasi_berulang"]

def buat_alasan(row):
    alasan = []
    if row["perlu_verifikasi_harga"]:
        alasan.append("Periksa periode dan validitas harga")
    if row["perlu_verifikasi_duplikat"]:
        alasan.append("Periksa kemungkinan listing berulang")
    if row["masuk_top_error"]:
        alasan.append("Periksa karakteristik dan error model")
    return "; ".join(alasan) if alasan else ""

df["alasan_review"] = df.apply(buat_alasan, axis=1)

review = df.loc[df["alasan_review"].ne("")].copy()

# Tambahkan ringkasan error dari masing-masing model.
error_summary = (
    errors.groupby("nama_kost")
    .agg(
        model_dengan_error=("model", lambda x: ", ".join(sorted(set(x)))),
        error_maksimum_rp=("error_absolut", "max"),
        error_persen_maksimum=("error_persen", "max"),
    )
    .reset_index()
)

review = review.merge(
    error_summary,
    on="nama_kost",
    how="left",
    validate="many_to_one",
)

# Simpan semua kolom asli agar pemeriksaan tidak kehilangan konteks.
review = review.sort_values(
    ["perlu_verifikasi_harga", "perlu_verifikasi_duplikat", "masuk_top_error"],
    ascending=False,
)

output_path = OUT_DIR / "daftar_review_manual.csv"
review.to_csv(output_path, index=False, encoding="utf-8-sig")

print("=" * 60)
print("DAFTAR REVIEW MANUAL KOZY")
print("=" * 60)
print(f"Total data Papikost dalam cakupan : {len(df)}")
print(f"Data yang perlu ditinjau          : {len(review)}")
print(f"Kasus harga <= Rp200.000          : {int(df['perlu_verifikasi_harga'].sum())}")
print(f"Kandidat kombinasi berulang       : {int(df['kandidat_kombinasi_berulang'].sum())}")
print(f"Kasus yang masuk top error        : {int(df['masuk_top_error'].sum())}")
print(f"\nFile tersimpan: {output_path}")
print("\nDaftar nama dan alasan pemeriksaan:")
print(review[["nama_kost", "harga", "lokasi", "jenis", "alasan_review"]].to_string(index=False))
