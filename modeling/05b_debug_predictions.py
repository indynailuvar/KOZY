from pathlib import Path
import pandas as pd

BASE_PATH = Path("data/modeling/kozy_modeling_base.csv")
PRED_PATH = Path("output/model_comparison_v2/oof_predictions.csv")

base = pd.read_csv(BASE_PATH).reset_index(drop=True)
pred = pd.read_csv(PRED_PATH).reset_index(drop=True)

print("=== UKURAN DATA ===")
print("Modeling base :", base.shape)
print("Prediksi OOF  :", pred.shape)

print("\n=== KOLOM PREDIKSI OOF ===")
print(pred.columns.tolist())

print("\n=== 5 BARIS PERTAMA BASE ===")
print(base.head().to_string(index=False))

print("\n=== 5 BARIS PERTAMA PREDIKSI ===")
print(pred.head().to_string(index=False))

print("\n=== PEMERIKSAAN KESESUAIAN ===")
if len(base) != len(pred):
    print("GAGAL: jumlah baris berbeda.")
    print("Jangan memasangkan prediksi dengan atribut berdasarkan indeks.")
else:
    print("Jumlah baris sama.")

    checks = {
        "harga": "harga_aktual",
        "lokasi": "lokasi",
        "jenis": "jenis",
        "sumber": "sumber",
    }

    for base_col, pred_col in checks.items():
        if base_col not in base.columns:
            print(f"{base_col}: tidak tersedia di base.")
            continue

        if pred_col not in pred.columns:
            print(f"{pred_col}: tidak tersedia di prediksi OOF.")
            continue

        left = base[base_col].astype("string").str.strip()
        right = pred[pred_col].astype("string").str.strip()

        left = left.fillna("<MISSING>")
        right = right.fillna("<MISSING>")

        diff = left.ne(right)
        print(f"{base_col} vs {pred_col}: {int(diff.sum())} berbeda")

        if diff.any():
            print("Contoh ketidakcocokan:")
            for i in diff[diff].index[:5]:
                print(
                    f"  baris {i}: "
                    f"base={left.iloc[i]!r}, "
                    f"prediksi={right.iloc[i]!r}"
                )

print("\nPemeriksaan selesai. Tidak ada dataset yang diubah.")
