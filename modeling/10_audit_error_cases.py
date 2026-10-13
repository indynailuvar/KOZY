from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# 1. KONFIGURASI
# ============================================================

CLEAN_PATH = Path("analysis/kozy_dataset_clean.csv")
PRED_PATH = Path("output/feature_ablation_papikost/oof_predictions.csv")
OUT_DIR = Path("output/error_case_audit")

FEATURE_SET = "baseline_plus_facilities"
EXPECTED_SOURCE = "Papikost"
LOW_PRICE_THRESHOLD = 200_000
TOP_N = 10

OUT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# 2. FUNGSI BANTU
# ============================================================

def normalize_text(series):
    """Membersihkan spasi tanpa mengubah nilai kosong menjadi teks."""
    return series.astype("string").str.strip()


def rupiah(value):
    """Format angka sebagai Rupiah untuk tampilan terminal."""
    if pd.isna(value):
        return "-"
    return f"Rp{value:,.0f}".replace(",", ".")


def stop(message):
    """Hentikan audit dengan pesan yang jelas."""
    raise ValueError(message)


# ============================================================
# 3. BACA DAN FILTER DATA ASLI
# ============================================================

if not CLEAN_PATH.exists():
    stop(f"Dataset bersih tidak ditemukan: {CLEAN_PATH}")

if not PRED_PATH.exists():
    stop(f"File prediksi OOF tidak ditemukan: {PRED_PATH}")

df = pd.read_csv(CLEAN_PATH)

required_clean = [
    "nama_kost",
    "lokasi",
    "jenis",
    "harga",
    "sumber",
]

missing_clean = [
    col for col in required_clean if col not in df.columns
]

if missing_clean:
    stop(f"Kolom dataset bersih tidak tersedia: {missing_clean}")

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = normalize_text(df[col])

# Gunakan cakupan Papikost di Surabaya yang sama seperti eksperimen.
df = df.loc[
    df["sumber"].eq(EXPECTED_SOURCE)
    & ~df["lokasi"].str.contains(
        "sidoarjo", case=False, na=False
    )
].copy()

df = df.reset_index(drop=True)

# Indeks ini menjadi kunci penghubung dengan hasil eksperimen.
df["baris"] = np.arange(len(df), dtype=int)

if df.empty:
    stop(
        "Tidak ada data Papikost setelah filter sumber dan lokasi. "
        "Periksa nilai kolom sumber dan lokasi."
    )

df["harga"] = pd.to_numeric(df["harga"], errors="coerce")

if df["harga"].isna().any():
    stop(
        "Ada harga kosong atau nonnumerik pada data Papikost. "
        "Periksa dataset sebelum melanjutkan audit."
    )

print("=" * 65)
print("AUDIT ERROR CASE KOZY")
print("=" * 65)
print(f"Jumlah data Papikost dalam cakupan : {len(df)}")
print(f"Jumlah harga unik                  : {df['harga'].nunique()}")
print(f"Rentang harga                      : "
      f"{rupiah(df['harga'].min())} - {rupiah(df['harga'].max())}")
print(f"Median harga                       : {rupiah(df['harga'].median())}")
print(
    f"Jumlah harga <= {rupiah(LOW_PRICE_THRESHOLD)}       : "
    f"{int(df['harga'].le(LOW_PRICE_THRESHOLD).sum())}"
)


# ============================================================
# 4. BACA DAN FILTER PREDIKSI OOF
# ============================================================

pred_all = pd.read_csv(PRED_PATH)

required_pred = [
    "baris",
    "fitur",
    "model",
    "prediksi_oof",
]

missing_pred = [
    col for col in required_pred if col not in pred_all.columns
]

if missing_pred:
    stop(
        f"Kolom wajib tidak ditemukan pada file prediksi: {missing_pred}\n"
        f"Kolom tersedia: {pred_all.columns.tolist()}"
    )

pred_all["baris"] = pd.to_numeric(
    pred_all["baris"], errors="coerce"
)
pred_all["fitur"] = normalize_text(pred_all["fitur"])
pred_all["model"] = normalize_text(pred_all["model"])
pred_all["prediksi_oof"] = pd.to_numeric(
    pred_all["prediksi_oof"], errors="coerce"
)

pred = pred_all.loc[
    pred_all["fitur"].eq(FEATURE_SET)
].copy()

if pred.empty:
    available = sorted(
        pred_all["fitur"].dropna().unique().tolist()
    )
    stop(
        f"Tidak ada prediksi dengan fitur '{FEATURE_SET}'.\n"
        f"Kelompok fitur yang tersedia: {available}"
    )

# Hanya pertahankan kolom yang diperlukan dari tabel prediksi.
pred = pred[
    ["baris", "fitur", "model", "prediksi_oof"]
].copy()

if pred[["baris", "model", "prediksi_oof"]].isna().any().any():
    stop(
        "Ada indeks, nama model, atau prediksi kosong "
        "pada hasil OOF setelah filter fitur."
    )

pred["baris"] = pred["baris"].astype(int)

# Indeks hasil prediksi harus mengacu pada baris dataset yang tersedia.
invalid_idx = ~pred["baris"].isin(df["baris"])

if invalid_idx.any():
    stop(
        "Ditemukan indeks prediksi di luar cakupan data saat ini. "
        "Kemungkinan filter atau urutan data berbeda dari eksperimen.\n"
        f"Contoh indeks: {pred.loc[invalid_idx, 'baris'].head(10).tolist()}"
    )

# Setiap kos boleh muncul untuk model berbeda, tetapi tidak boleh
# memiliki dua prediksi untuk model dan fitur yang sama.
duplicated = pred.duplicated(
    subset=["baris", "model"], keep=False
)

if duplicated.any():
    examples = pred.loc[
        duplicated, ["baris", "model", "fitur", "prediksi_oof"]
    ].sort_values(["baris", "model"])

    print("\nContoh indeks prediksi berulang:")
    print(examples.head(20).to_string(index=False))

    stop(
        "Ada lebih dari satu prediksi untuk kombinasi baris dan model "
        f"pada fitur '{FEATURE_SET}'. Periksa pembentukan OOF."
    )

print("\nModel yang ditemukan:")
for model_name in sorted(pred["model"].unique()):
    print(f"- {model_name}")


# ============================================================
# 5. SIAPKAN METADATA TANPA KOLom DUPLIKAT
# ============================================================

# Kolom identitas dan karakteristik dari sumber asli.
metadata_candidates = [
    "baris",
    "nama_kost",
    "harga",
    "lokasi",
    "jenis",
    "sumber",
    "latitude",
    "longitude",
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
    "jumlah_dilihat",
    "sisa_kamar",
]

metadata_cols = [
    col for col in metadata_candidates if col in df.columns
]

metadata = df[metadata_cols].copy()

if metadata["baris"].duplicated().any():
    stop("Indeks metadata sumber tidak unik; audit tidak aman dilanjutkan.")

# Kolom nama dan harga berasal dari dataset asli, bukan hasil merge
# yang mungkin memiliki nama_kost_x/nama_kost_y.
result = pred.merge(
    metadata,
    on="baris",
    how="left",
    validate="many_to_one",
    indicator=True,
)

if not result["_merge"].eq("both").all():
    unmatched = result.loc[
        result["_merge"].ne("both"), "baris"
    ].tolist()
    stop(f"Prediksi tidak cocok dengan metadata. Indeks: {unmatched[:10]}")

result = result.drop(columns="_merge")

if result["nama_kost"].isna().any():
    stop(
        "Nama kos kosong setelah penggabungan metadata. "
        "Periksa dataset sumber."
    )

# Jika hasil prediksi menyimpan harga aktual, bandingkan dengan sumber.
if "harga_aktual" in pred_all.columns:
    actual_check = pred_all.loc[
        pred_all["fitur"].eq(FEATURE_SET),
        ["baris", "model", "harga_aktual"],
    ].copy()

    actual_check["baris"] = pd.to_numeric(
        actual_check["baris"], errors="coerce"
    )
    actual_check["harga_aktual"] = pd.to_numeric(
        actual_check["harga_aktual"], errors="coerce"
    )

    actual_check = actual_check.dropna(subset=["baris"])
    actual_check["baris"] = actual_check["baris"].astype(int)

    actual_check = actual_check.drop_duplicates(
        subset=["baris", "model"]
    )

    result = result.merge(
        actual_check,
        on=["baris", "model"],
        how="left",
        validate="one_to_one",
    )

    comparable = result["harga_aktual"].notna()

    mismatch = comparable & ~np.isclose(
        result["harga"].astype(float),
        result["harga_aktual"].astype(float),
        rtol=0,
        atol=0.01,
    )

    if mismatch.any():
        print(
            "\nPERINGATAN: harga aktual pada file OOF berbeda "
            "dari dataset bersih."
        )
        print(
            result.loc[
                mismatch,
                ["baris", "nama_kost", "harga", "harga_aktual", "model"],
            ].head(10).to_string(index=False)
        )
        stop(
            "Audit dihentikan karena harga aktual tidak konsisten. "
            "Pastikan urutan dan filter data sama dengan eksperimen."
        )

    result = result.drop(columns=["harga_aktual"])


# ============================================================
# 6. HITUNG ERROR
# ============================================================

result["residual"] = result["harga"] - result["prediksi_oof"]
result["error_absolut"] = result["residual"].abs()

# Persentase error tidak terdefinisi jika harga aktual nol.
result["error_persen"] = np.where(
    result["harga"].ne(0),
    result["error_absolut"] / result["harga"].abs() * 100,
    np.nan,
)

# Positif = model memprediksi terlalu rendah.
# Negatif = model memprediksi terlalu tinggi.
result["arah_error"] = np.select(
    [
        result["residual"] > 0,
        result["residual"] < 0,
    ],
    [
        "Prediksi terlalu rendah",
        "Prediksi terlalu tinggi",
    ],
    default="Prediksi tepat",
)

# Simpan seluruh hasil audit, bukan hanya 10 terbesar.
all_cols = [
    "baris",
    "nama_kost",
    "harga",
    "prediksi_oof",
    "residual",
    "error_absolut",
    "error_persen",
    "arah_error",
    "lokasi",
    "jenis",
    "sumber",
    "model",
    "fitur",
]
all_cols = [col for col in all_cols if col in result.columns]

all_results = result[all_cols].copy()

top_parts = []

for model_name, group in all_results.groupby("model", sort=True):
    top = group.sort_values(
        "error_absolut", ascending=False
    ).head(TOP_N).copy()

    top_parts.append(top)

    print(f"\n{'=' * 65}")
    print(f"TOP {min(TOP_N, len(group))} ERROR — {model_name}")
    print("=" * 65)

    display_cols = [
        "nama_kost",
        "lokasi",
        "jenis",
        "harga",
        "prediksi_oof",
        "residual",
        "error_persen",
        "arah_error",
    ]
    display_cols = [
        col for col in display_cols if col in top.columns
    ]

    print(
        top[display_cols].to_string(
            index=False,
            formatters={
                col: rupiah
                for col in [
                    "harga",
                    "prediksi_oof",
                    "residual",
                ]
                if col in display_cols
            },
        )
    )

top_errors = pd.concat(top_parts, ignore_index=True)

top_path = OUT_DIR / "top_error_cases.csv"
top_errors.to_csv(top_path, index=False, encoding="utf-8-sig")


# ============================================================
# 7. CARI KANDIDAT KOMBINASI BERULANG
# ============================================================

# Ini hanya kandidat berdasarkan harga, lokasi, dan jenis.
# Hasil ini TIDAK membuktikan bahwa dua baris adalah duplikat.
group_cols = ["harga", "lokasi", "jenis"]

repeat_candidates = (
    df.groupby(group_cols, dropna=False)
    .agg(
        jumlah_baris=("baris", "size"),
        indeks=("baris", lambda s: ", ".join(map(str, s))),
        nama_kos=(
            "nama_kost",
            lambda s: " | ".join(s.dropna().astype(str).tolist()),
        ),
        sumber=("sumber", lambda s: " | ".join(
            s.dropna().astype(str).unique().tolist()
        )),
    )
    .reset_index()
)

repeat_candidates = repeat_candidates.loc[
    repeat_candidates["jumlah_baris"] > 1
].sort_values(
    ["jumlah_baris", "harga"],
    ascending=[False, True],
)

repeat_path = OUT_DIR / "repeated_price_location_type_candidates.csv"
repeat_candidates.to_csv(
    repeat_path, index=False, encoding="utf-8-sig"
)

print("\n" + "=" * 65)
print("RINGKASAN AUDIT")
print("=" * 65)
print(f"Jumlah prediksi yang diaudit : {len(result)}")
print(f"Jumlah model                 : {result['model'].nunique()}")
print(f"Jumlah kandidat berulang     : {len(repeat_candidates)}")
print(f"Hasil top error              : {top_path}")
print(f"Kandidat kombinasi berulang  : {repeat_path}")

if not repeat_candidates.empty:
    print("\nKandidat kombinasi berulang (maksimal 10):")
    print(repeat_candidates.head(10).to_string(index=False))
else:
    print(
        "\nTidak ditemukan kombinasi harga, lokasi, dan jenis "
        "yang berulang."
    )

print("\nAudit selesai.")
print(
    "PENTING: error prediksi besar adalah sinyal untuk pemeriksaan, "
    "bukan bukti otomatis bahwa harga kos tidak wajar."
)
