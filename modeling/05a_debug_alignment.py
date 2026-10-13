from pathlib import Path
import pandas as pd

CLEAN_PATH = Path("analysis/kozy_dataset_clean.csv")
BASE_PATH = Path("data/modeling/kozy_modeling_base.csv")

clean = pd.read_csv(CLEAN_PATH)
base = pd.read_csv(BASE_PATH)

# Terapkan normalisasi yang sama seperti pipeline sebelumnya.
for col in ["lokasi", "jenis", "sumber"]:
    clean[col] = clean[col].astype("string").str.strip()

# Aturan cakupan: keluarkan lokasi yang mengandung Sidoarjo.
mask = clean["lokasi"].str.contains(
    "sidoarjo", case=False, na=False
)
scoped = clean.loc[~mask].copy().reset_index(drop=True)
base = base.reset_index(drop=True)

print("=== JUMLAH BARIS ===")
print(f"Clean awal       : {len(clean)}")
print(f"Dikeluarkan      : {int(mask.sum())}")
print(f"Clean setelah filter: {len(scoped)}")
print(f"Modeling base    : {len(base)}")

if len(scoped) != len(base):
    print("\nPERINGATAN: jumlah baris berbeda.")
    print("Jangan tempelkan atribut berdasarkan posisi baris.")
    raise SystemExit(1)

print("\n=== PERBANDINGAN KOLOM ===")
for col in ["harga", "lokasi", "jenis", "sumber"]:
    if col not in scoped.columns or col not in base.columns:
        print(f"{col}: KOLOM TIDAK DITEMUKAN")
        continue

    left = scoped[col].astype("string").fillna("<MISSING>")
    right = base[col].astype("string").fillna("<MISSING>")

    # Perbandingan persis setelah normalisasi dasar.
    diff = left.ne(right)
    n_diff = int(diff.sum())

    print(f"\n{col}: {n_diff} baris berbeda")

    if n_diff:
        positions = diff[diff].index[:10]
        for i in positions:
            print(
                f"  baris {i}: "
                f"clean={left.iloc[i]!r} | "
                f"base={right.iloc[i]!r}"
            )

print("\n=== PEMERIKSAAN LOKASI YANG DINORMALISASI ===")
left_loc = (
    scoped["lokasi"].astype("string")
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
    .str.casefold()
    .fillna("<MISSING>")
)
right_loc = (
    base["lokasi"].astype("string")
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
    .str.casefold()
    .fillna("<MISSING>")
)

print(
    "Perbedaan lokasi setelah normalisasi spasi dan kapitalisasi:",
    int(left_loc.ne(right_loc).sum())
)

print("\nAudit selesai. Tidak ada dataset yang diubah.")
