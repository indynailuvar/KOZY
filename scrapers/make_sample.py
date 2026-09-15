# scrapers/make_sample.py
import csv, os
BASE = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(BASE, "..", "data_kos_surabaya.csv")
out = os.path.join(BASE, "..", "data", "sample", "kos_sample_50_anon.csv")
os.makedirs(os.path.dirname(out), exist_ok=True)
rows = list(csv.DictReader(open(src, encoding="utf-8")))
for r in rows:
    r["telepon_pemilik"] = ""                      # buang data pribadi
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows[:50])
print(f" Sampel anonim tersimpan: 50 baris tanpa telepon")