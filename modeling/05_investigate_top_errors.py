from pathlib import Path
import pandas as pd

CLEAN_PATH = Path("analysis/kozy_dataset_clean.csv")
BASE_PATH = Path("data/modeling/kozy_modeling_base.csv")
PRED_PATH = Path("output/model_comparison_v2/oof_predictions.csv")

OUT_DIR = Path("output/residual_analysis")
OUT_DIR.mkdir(parents=True, exist_ok=True)

TOP20_PATH = OUT_DIR / "random_forest_top20_with_features.csv"
FULL_PATH = OUT_DIR / "random_forest_oof_with_features.csv"

# 1. Baca data tanpa mengubah file sumber.
clean = pd.read_csv(CLEAN_PATH)
base = pd.read_csv(BASE_PATH).reset_index(drop=True)
pred = pd.read_csv(PRED_PATH).reset_index(drop=True)

# 2. Terapkan aturan cakupan dan normalisasi yang konsisten.
for col in ["lokasi", "jenis", "sumber"]:
    clean[col] = clean[col].astype("string").str.strip()

mask_sidoarjo = clean["lokasi"].str.contains(
    "sidoarjo", case=False, na=False
)
scoped = clean.loc[~mask_sidoarjo].copy().reset_index(drop=True)

# 3. Validasi jumlah baris.
if not (len(scoped) == len(base) == len(pred)):
    raise ValueError(
        "Jumlah baris tidak cocok: "
        f"clean={len(scoped)}, base={len(base)}, prediksi={len(pred)}. "
        "Investigasi dihentikan."
    )

# 4. Bandingkan nilai dengan tipe data yang diseragamkan.
def normalize_text(series):
    return (
        series.astype("string")
        .str.strip()
        .fillna("<MISSING>")
    )

checks = {
    "harga": ("harga", "harga_aktual"),
    "lokasi": ("lokasi", "lokasi"),
    "jenis": ("jenis", "jenis"),
    "sumber": ("sumber", "sumber"),
}

for label, (base_col, pred_col) in checks.items():
    if base_col not in base.columns or pred_col not in pred.columns:
        raise ValueError(
            f"Kolom validasi tidak ditemukan: "
            f"{base_col} atau {pred_col}."
        )

    if label == "harga":
        left = pd.to_numeric(base[base_col], errors="coerce")
        right = pd.to_numeric(pred[pred_col], errors="coerce")
        equal = left.eq(right) | (left.isna() & right.isna())
    else:
        left = normalize_text(base[base_col])
        right = normalize_text(pred[pred_col])
        equal = left.eq(right)

    if not equal.all():
        bad = equal[~equal].index[:5].tolist()
        raise ValueError(
            f"Ketidakcocokan pada {label}, contoh indeks: {bad}. "
            "Investigasi dihentikan."
        )

# Pastikan data clean yang difilter juga cocok dengan base.
for col in ["harga", "lokasi", "jenis", "sumber"]:
    if col == "harga":
        left = pd.to_numeric(scoped[col], errors="coerce")
        right = pd.to_numeric(base[col], errors="coerce")
        equal = left.eq(right) | (left.isna() & right.isna())
    else:
        equal = normalize_text(scoped[col]).eq(
            normalize_text(base[col])
        )

    if not equal.all():
        raise ValueError(
            f"Clean dan modeling base berbeda pada {col}. "
            "Investigasi dihentikan."
        )

print("Validasi berhasil: seluruh 308 observasi cocok.")

# 5. Pastikan kolom prediksi Random Forest tersedia.
rf_col = "prediksi_Random Forest"
if rf_col not in pred.columns:
    raise ValueError(f"Kolom prediksi tidak ditemukan: {rf_col}")

actual = pd.to_numeric(pred["harga_aktual"], errors="coerce")
predicted = pd.to_numeric(pred[rf_col], errors="coerce")

if actual.isna().any() or predicted.isna().any():
    raise ValueError("Ada harga atau prediksi yang tidak valid.")

if (actual <= 0).any():
    raise ValueError("Harga aktual harus positif untuk menghitung persentase.")

# Residual positif = model memprediksi terlalu rendah.
# Residual negatif = model memprediksi terlalu tinggi.
pred["residual_aktual_minus_prediksi"] = actual - predicted
pred["error_absolut"] = (
    pred["residual_aktual_minus_prediksi"].abs()
)
pred["error_persen_absolut"] = (
    pred["error_absolut"] / actual * 100
)

# 6. Tambahkan atribut asli dari clean yang sudah difilter.
feature_cols = [
    "nama_kost",
    "latitude",
    "longitude",
    "rating",
    "jumlah_ulasan",
    "jumlah_dilihat",
    "sisa_kamar",
    "jumlah_fasilitas",
    "ac",
    "wifi",
    "kmandi_dalam",
    "lemari",
    "meja_belajar",
    "kasur",
    "tv",
    "pmotor",
    "pmobil",
]

available_features = [
    col for col in feature_cols if col in scoped.columns
]
missing_features = [
    col for col in feature_cols if col not in scoped.columns
]

# Aman berdasarkan validasi urutan dan nilai di atas.
result = pd.concat(
    [
        pred.reset_index(drop=True),
        scoped[available_features].reset_index(drop=True),
    ],
    axis=1,
)

# Simpan semua observasi agar hasil dapat diaudit ulang.
result.to_csv(FULL_PATH, index=False)

# Ambil 20 error absolut terbesar, bukan 20 harga tertinggi.
top20 = result.nlargest(20, "error_absolut").copy()
top20.to_csv(TOP20_PATH, index=False)

print("\n=== TOP 20 ERROR RANDOM FOREST ===")
display_cols = [
    "nama_kost",
    "harga_aktual",
    rf_col,
    "residual_aktual_minus_prediksi",
    "error_persen_absolut",
    "lokasi",
    "jenis",
    "sumber",
]
display_cols = [c for c in display_cols if c in top20.columns]
print(top20[display_cols].to_string(index=False))

print("\n=== KELENGKAPAN FITUR TOP 20 ===")
for col in available_features:
    missing = int(top20[col].isna().sum())
    print(f"{col}: {20 - missing}/20 terisi")

if missing_features:
    print("\nKolom yang tidak ditemukan pada dataset clean:")
    print(missing_features)

print("\nFile tersimpan:")
print(f"Semua observasi : {FULL_PATH}")
print(f"Top 20 error    : {TOP20_PATH}")
print("Dataset sumber tidak diubah.")
