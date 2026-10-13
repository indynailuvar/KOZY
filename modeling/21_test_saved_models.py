from pathlib import Path

import joblib
import numpy as np
import pandas as pd

DATA_PATH = Path("analysis/kozy_dataset_clean.csv")
MODEL_DIR = Path("output/final_models")

FEATURES = [
    "lokasi", "jenis", "ac", "wifi", "kmandi_dalam",
    "lemari", "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
]

MODELS = [
    "kozy_ridge_papikost.pkl",
    "kozy_random_forest_papikost.pkl",
    "kozy_best_candidate.pkl",
]

# Baca data untuk membuat input uji yang benar-benar berasal
# dari skema dataset, bukan fitur contoh yang dikarang.
df = pd.read_csv(DATA_PATH)

for col in ["lokasi", "jenis", "sumber"]:
    df[col] = df[col].astype("string").str.strip()

df = df.loc[
    df["sumber"].eq("Papikost")
    & ~df["lokasi"].str.contains("sidoarjo", case=False, na=False)
].copy()

missing = [c for c in FEATURES if c not in df.columns]
if missing:
    raise ValueError(f"Fitur tidak ditemukan: {missing}")

X = df[FEATURES].copy()

# Gunakan beberapa baris aktual sebagai smoke test.
X = X.head(5).copy()

if X.empty:
    raise ValueError("Tidak ada baris untuk pengujian.")

for col in FEATURES[2:]:
    X[col] = pd.to_numeric(X[col], errors="coerce")

if X.isna().any().any():
    raise ValueError(
        "Input uji mengandung nilai kosong. "
        "Periksa data sebelum menguji artefak."
    )

print(f"Jumlah baris uji: {len(X)}")
print("\n=== HASIL UJI ARTEFAK ===")

for filename in MODELS:
    path = MODEL_DIR / filename

    if not path.exists():
        raise FileNotFoundError(f"Artefak tidak ditemukan: {path}")

    artifact = joblib.load(path)

    if not isinstance(artifact, dict):
        raise TypeError(f"Format artefak tidak sesuai: {filename}")

    if "pipeline" not in artifact or "metadata" not in artifact:
        raise ValueError(f"Pipeline/metadata tidak lengkap: {filename}")

    pipeline = artifact["pipeline"]
    metadata = artifact["metadata"]

    if metadata.get("features") != FEATURES:
        raise ValueError(
            f"Urutan/skema fitur tidak sesuai pada {filename}: "
            f"{metadata.get('features')}"
        )

    predictions = np.asarray(pipeline.predict(X), dtype=float)

    if len(predictions) != len(X):
        raise AssertionError("Jumlah prediksi tidak sama dengan jumlah input.")

    if not np.isfinite(predictions).all():
        raise AssertionError("Prediksi mengandung NaN atau infinity.")

    if (predictions <= 0).any():
        print(
            f"PERINGATAN: {filename} menghasilkan prediksi "
            "nol atau negatif; perlu penanganan sebelum produksi."
        )

    # Uji konsistensi pemuatan ulang: prediksi artefak yang sama
    # seharusnya identik untuk input dan lingkungan yang sama.
    reloaded = joblib.load(path)
    predictions_reloaded = np.asarray(
        reloaded["pipeline"].predict(X), dtype=float
    )

    if not np.allclose(
        predictions, predictions_reloaded, rtol=1e-10, atol=1e-6
    ):
        raise AssertionError(
            f"Prediksi berubah setelah pemuatan ulang: {filename}"
        )

    print(f"\nModel       : {metadata.get('model_name', filename)}")
    print(f"File        : {path}")
    print(f"Jumlah fitur: {len(metadata['features'])}")
    print(f"Prediksi    : {np.round(predictions).astype(int).tolist()}")
    print("Reload test : LULUS")

print("\nSemua artefak yang diuji dapat dimuat dan memprediksi input.")
