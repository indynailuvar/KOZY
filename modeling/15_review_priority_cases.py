from pathlib import Path

import numpy as np
import pandas as pd

CLEAN_PATH = Path("analysis/kozy_dataset_clean.csv")
COMPARE_PATH = Path(
    "output/anomaly_candidates/perbandingan_kandidat_ridge_rf.csv"
)
OUT_DIR = Path("output/anomaly_candidates")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Baca data asli dan hasil perbandingan model.
clean = pd.read_csv(CLEAN_PATH)
compare = pd.read_csv(COMPARE_PATH)

for col in ["sumber", "lokasi", "jenis"]:
    clean[col] = clean[col].astype("string").str.strip()

clean = clean.loc[
    clean["sumber"].eq("Papikost")
    & ~clean["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy().reset_index(drop=True)

clean["baris"] = np.arange(len(clean))
clean["harga"] = pd.to_numeric(clean["harga"], errors="coerce")

# 2. Pilih kandidat yang ditandai minimal satu model.
candidates = compare.loc[
    compare["status_kandidat"].isin([
        "Ditandai kedua model",
        "Ditandai minimal satu model",
    ])
].copy()

if candidates.empty:
    raise ValueError("Tidak ada kandidat yang perlu ditinjau.")

# 3. Cocokkan dengan data sumber memakai indeks baris.
candidates["baris"] = pd.to_numeric(
    candidates["baris"], errors="raise"
).astype(int)

metadata_cols = [
    "baris", "nama_kost", "harga", "lokasi", "jenis", "sumber",
    "latitude", "longitude", "jumlah_fasilitas",
    "ac", "wifi", "kmandi_dalam", "lemari",
    "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
]
metadata_cols = [c for c in metadata_cols if c in clean.columns]
metadata = clean[metadata_cols].copy()

result = candidates.merge(
    metadata,
    on="baris",
    how="left",
    validate="one_to_one",
    suffixes=("_model", "_sumber"),
)

if result["nama_kost"].isna().any():
    raise ValueError(
        "Ada kandidat yang tidak cocok dengan data sumber. "
        "Periksa kembali urutan data."
    )

# 4. Validasi konsistensi harga.
if "harga_aktual_Ridge" in result.columns:
    mismatch = ~np.isclose(
        result["harga"].astype(float),
        result["harga_aktual_Ridge"].astype(float),
        rtol=0,
        atol=0.01,
    )
    if mismatch.any():
        raise ValueError(
            "Harga pada hasil model tidak sama dengan data sumber. "
            "Audit dihentikan agar tidak mencampur baris yang salah."
        )

# 5. Tambahkan arahan investigasi, bukan vonis.
def next_action(row):
    name = str(row["nama_kost"]).lower()

    if "kamar mawar" in name or "kamar anggrek" in name:
        return (
            "Periksa bersama: pastikan dua kamar/listing berbeda "
            "dan bandingkan atributnya."
        )
    if "cozy one bedroom" in name:
        return (
            "Periksa tipe kamar, fasilitas, dan periode harga; "
            "kedua model menandai."
        )
    if "feliz guesthouse" in name:
        return (
            "Periksa atribut yang belum tercatat; kandidat hanya "
            "ditandai Random Forest."
        )
    if "onnie room" in name:
        return (
            "Periksa atribut yang belum tercatat; kandidat hanya "
            "ditandai Ridge."
        )
    return "Periksa atribut dan validitas harga dari sumber."

result["tindak_lanjut"] = result.apply(next_action, axis=1)

# 6. Simpan file investigasi.
out_cols = [
    "nama_kost", "harga", "lokasi", "jenis",
    "prediksi_oof_Ridge", "residual_Ridge",
    "prediksi_oof_RandomForest", "residual_RandomForest",
    "ditandai_model_Ridge", "ditandai_model_RandomForest",
    "status_kandidat", "tindak_lanjut",
]
out_cols += [
    c for c in [
        "jumlah_fasilitas", "ac", "wifi", "kmandi_dalam",
        "lemari", "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
    ]
    if c in result.columns
]
out_cols = list(dict.fromkeys(c for c in out_cols if c in result.columns))

output = OUT_DIR / "investigasi_kandidat_prioritas.csv"
result[out_cols].to_csv(output, index=False, encoding="utf-8-sig")

print("=" * 65)
print("INVESTIGASI KANDIDAT ANOMALI KOZY")
print("=" * 65)
print(f"Jumlah kandidat             : {len(result)}")
print(f"Ditandai kedua model        : {int(result['ditandai_kedua_model'].sum())}")
print(f"File investigasi            : {output}")
print("\nRingkasan:")
print(result[[
    "nama_kost", "harga", "status_kandidat", "tindak_lanjut"
]].to_string(index=False))
print(
    "\nCatatan: hasil ini merupakan prioritas investigasi, "
    "bukan keputusan harga tidak wajar."
)
