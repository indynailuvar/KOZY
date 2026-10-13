from pathlib import Path
import pandas as pd

INPUT_PATH = Path("output/manual_review/daftar_review_manual.csv")
OUTPUT_PATH = Path("output/manual_review/template_verifikasi.csv")

if not INPUT_PATH.exists():
    raise FileNotFoundError(f"File tidak ditemukan: {INPUT_PATH}")

df = pd.read_csv(INPUT_PATH)

# Kolom keputusan diisi setelah memeriksa listing sumber.
review_columns = {
    "status_verifikasi": "",
    "periode_sewa": "",
    "identitas_listing": "",
    "atribut_terverifikasi": "",
    "catatan_bukti": "",
    "tindakan_data": "",
}

for column, default_value in review_columns.items():
    if column not in df.columns:
        df[column] = default_value

df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")

print("Template verifikasi berhasil dibuat.")
print(f"Jumlah listing untuk ditinjau: {len(df)}")
print(f"Lokasi file: {OUTPUT_PATH}")
print("\nIsi file tersebut menggunakan Excel.")
