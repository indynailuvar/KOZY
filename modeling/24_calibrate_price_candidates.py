from pathlib import Path
import json

import numpy as np
import pandas as pd

INPUT_PATH = Path("output/final_models/predictions_oof.csv")
OUT_DIR = Path("output/final_models")

QUANTILE = 0.95
MODEL_NAME = "Ridge"


def main():
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"File tidak ditemukan: {INPUT_PATH}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(INPUT_PATH)

    required = {
        "nama_kost",
        "lokasi",
        "jenis",
        "harga_aktual",
        "prediksi_oof",
        "residual_aktual_minus_prediksi",
        "fold",
        "model",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan: {sorted(missing)}")

    # Kalibrasi hanya menggunakan residual OOF Ridge.
    df = df.loc[df["model"].eq(MODEL_NAME)].copy()

    if len(df) < 20:
        raise ValueError(
            f"Data OOF {MODEL_NAME} terlalu sedikit: {len(df)} baris."
        )

    numeric_cols = [
        "harga_aktual",
        "prediksi_oof",
        "residual_aktual_minus_prediksi",
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.dropna(subset=numeric_cols).copy()

    if df.empty:
        raise ValueError("Tidak ada residual valid untuk kalibrasi.")

    # Hitung ulang residual untuk konsistensi.
    df["residual_aktual_minus_prediksi"] = (
        df["harga_aktual"] - df["prediksi_oof"]
    )
    df["residual_absolut"] = (
        df["residual_aktual_minus_prediksi"].abs()
    )

    # Ambang empiris: persentil ke-95 residual absolut OOF.
    threshold = float(
        np.quantile(
            df["residual_absolut"].to_numpy(),
            QUANTILE,
            method="higher",
        )
    )

    df["persentase_selisih_dari_prediksi"] = np.where(
        df["prediksi_oof"] > 0,
        df["residual_absolut"] / df["prediksi_oof"] * 100,
        np.nan,
    )

    df["arah_selisih"] = np.select(
        [
            df["residual_aktual_minus_prediksi"] > 0,
            df["residual_aktual_minus_prediksi"] < 0,
        ],
        [
            "Harga aktual di atas estimasi",
            "Harga aktual di bawah estimasi",
        ],
        default="Sama dengan estimasi",
    )

    df["status_penyaringan"] = np.where(
        df["residual_absolut"] >= threshold,
        "Kandidat ditinjau",
        "Tidak melewati ambang penyaringan",
    )

    df = df.sort_values("residual_absolut", ascending=False)

    output_all = OUT_DIR / "price_candidate_screening.csv"
    output_candidates = OUT_DIR / "price_candidates_review.csv"
    output_metadata = OUT_DIR / "price_candidate_threshold.json"

    df.to_csv(output_all, index=False)

    candidates = df.loc[
        df["status_penyaringan"].eq("Kandidat ditinjau")
    ].copy()
    candidates.to_csv(output_candidates, index=False)

    metadata = {
        "model": MODEL_NAME,
        "data_source": str(INPUT_PATH),
        "prediction_type": "out-of-fold",
        "threshold_method": "empirical_quantile_absolute_residual",
        "quantile": QUANTILE,
        "threshold_rp": threshold,
        "n_valid_oof": int(len(df)),
        "n_candidates": int(len(candidates)),
        "interpretation": (
            "Kandidat investigasi, bukan keputusan otomatis "
            "bahwa harga tidak wajar."
        ),
        "limitation": (
            "Ambang dihitung dari residual OOF yang sama untuk "
            "penyaringan eksploratif; belum merupakan ambang "
            "independen yang tervalidasi untuk penggunaan produksi."
        ),
    }
    output_metadata.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print("\n=== KALIBRASI KANDIDAT HARGA KOZY ===")
    print(f"Model                  : {MODEL_NAME}")
    print(f"Jumlah residual valid  : {len(df)}")
    print(f"Kuantil                : {QUANTILE:.0%}")
    print(f"Ambang residual absolut: Rp{threshold:,.0f}")
    print(f"Jumlah kandidat        : {len(candidates)}")
    print(f"\nFile tersimpan:")
    print(f"- {output_all}")
    print(f"- {output_candidates}")
    print(f"- {output_metadata}")

    if not candidates.empty:
        cols = [
            "nama_kost",
            "lokasi",
            "harga_aktual",
            "prediksi_oof",
            "residual_aktual_minus_prediksi",
            "arah_selisih",
            "fold",
        ]
        print("\n=== KANDIDAT UNTUK DITINJAU ===")
        print(candidates[cols].to_string(index=False))

    print(
        "\nCATATAN: status kandidat menunjukkan selisih besar "
        "terhadap estimasi model, bukan bukti harga tidak wajar."
    )


if __name__ == "__main__":
    main()
