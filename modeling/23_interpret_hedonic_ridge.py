from pathlib import Path

import joblib
import numpy as np
import pandas as pd

MODEL_PATH = Path("output/final_models/kozy_ridge_papikost.pkl")
OUT_DIR = Path("output/final_models")
OUT_DIR.mkdir(parents=True, exist_ok=True)

artifact = joblib.load(MODEL_PATH)
pipeline = artifact["pipeline"]

preprocessor = pipeline.named_steps["preprocess"]
ridge = pipeline.named_steps["model"]

feature_names = preprocessor.get_feature_names_out()
coefficients = ridge.coef_

if len(feature_names) != len(coefficients):
    raise ValueError("Jumlah nama fitur tidak cocok dengan koefisien.")

result = pd.DataFrame({
    "fitur_encoded": feature_names,
    "koefisien_model": coefficients,
})

# Konversi koefisien fitur biner dari skala terstandardisasi
# menjadi estimasi perubahan prediksi untuk perubahan 0 -> 1.
binary_transformer = preprocessor.named_transformers_["binary"]
binary_scaler = (
    binary_transformer.named_steps.get("scaler")
    if hasattr(binary_transformer, "named_steps")
    else None
)

if binary_scaler is not None:
    scale_by_feature = dict(zip(
        [
            "ac", "wifi", "kmandi_dalam", "lemari",
            "meja_belajar", "kasur", "tv", "pmotor", "pmobil",
        ],
        binary_scaler.scale_,
    ))

    result["estimasi_perubahan_0_ke_1_Rp"] = np.nan

    for idx, feature in enumerate(result["fitur_encoded"]):
        for binary_feature, scale in scale_by_feature.items():
            if feature == f"binary__{binary_feature}":
                result.loc[idx, "estimasi_perubahan_0_ke_1_Rp"] = (
                    coefficients[idx] / scale
                )

result["catatan"] = result["fitur_encoded"].apply(
    lambda x: (
        "Asosiasi fitur biner; perubahan 0 ke 1, "
        "fitur lain tetap, menurut model"
        if x.startswith("binary__")
        else "Koefisien kategori hasil One-Hot Encoding; "
             "interpretasi bergantung pada pengodean dan regularisasi"
    )
)

result = result.sort_values(
    "koefisien_model",
    key=lambda s: s.abs(),
    ascending=False,
)

output = OUT_DIR / "hedonic_ridge_coefficients.csv"
result.to_csv(output, index=False)

print("Model:", artifact["metadata"]["model_name"])
print("Ruang lingkup:", artifact["metadata"]["scope"])
print("\n=== KOEFISIEN RIDGE ===")
print(result.to_string(index=False))
print("\nFile tersimpan:", output)
print(
    "\nPERINGATAN: koefisien menunjukkan asosiasi bersyarat "
    "dalam model, bukan bukti hubungan sebab-akibat."
)
