# scrapers/enrich_harga.py  (FILE BARU — tidak mengubah merge_all.py)
import json, csv, os
from math import radians, sin, cos, asin, sqrt
from difflib import SequenceMatcher

BASE = os.path.dirname(os.path.abspath(__file__))
def hav(a1, o1, a2, o2):
    if None in (a1, o1, a2, o2): return 9e9
    a1, o1, a2, o2 = map(radians, [a1, o1, a2, o2])
    x = sin((a2-a1)/2)**2 + cos(a1)*cos(a2)*sin((o2-o1)/2)**2
    return 6371*2*asin(sqrt(x))
def sim(a, b): return SequenceMatcher(None, (a or "").lower(), (b or "").lower()).ratio()

rows = list(csv.DictReader(open(os.path.join(BASE, "..", "data_kos_surabaya.csv"), encoding="utf-8")))
mamikos = json.load(open(os.path.join(BASE, "mamikos_listings.json"), encoding="utf-8")) if os.path.exists(os.path.join(BASE, "mamikos_listings.json")) else []
olx     = json.load(open(os.path.join(BASE, "olx_sewa.json"), encoding="utf-8")) if os.path.exists(os.path.join(BASE, "olx_sewa.json")) else []

# 1) Match Mamikos per kos: dekat (<200 m) DAN nama mirip (>=0.55), atau nama sangat mirip (>=0.85)
hit = 0
for r in rows:
    lat = float(r["latitude"]) if r["latitude"] else None
    lng = float(r["longitude"]) if r["longitude"] else None
    best, bs = None, 0
    for l in mamikos:
        d = hav(lat, lng, l.get("lat"), l.get("lng"))
        s = sim(r["nama_kos"], l["name"])
        if (d < 0.2 and s >= 0.55) or s >= 0.85:
            if s > bs: best, bs = l, s
    if best:
        r["harga_bulanan"] = best["price"]
        r["sumber_harga"] = "Mamikos (match koordinat+nama)"
        hit += 1
print(f"Harga terisi dari Mamikos: {hit}/{len(rows)}")

# 2) OLX sewa -> harga referensi per kecamatan (centroid terdekat < 3 km)
cent = {}
for r in rows:
    if r["kecamatan"] and r["latitude"]:
        c = cent.setdefault(r["kecamatan"], [0, 0, 0])
        c[0] += float(r["latitude"]); c[1] += float(r["longitude"]); c[2] += 1
cent = {k: (v[0]/v[2], v[1]/v[2]) for k, v in cent.items()}
per_kec = {}
for ad in olx:
    nk, nd = None, 9e9
    for k, (la, lo) in cent.items():
        d = hav(ad.get("lat"), ad.get("lon"), la, lo)
        if d < nd: nk, nd = k, d
    if nd < 3: per_kec.setdefault(nk, []).append(ad["price"])
ref = {k: sorted(v)[len(v)//2] for k, v in per_kec.items()}
for r in rows:
    r["harga_referensi_kecamatan"] = ref.get(r["kecamatan"], "")
print(f"Kecamatan punya referensi harga OLX sewa: {len(ref)}")

# 3) Simpan
cols = list(rows[0].keys())
if "harga_referensi_kecamatan" not in cols: cols.append("harga_referensi_kecamatan")
with open(os.path.join(BASE, "..", "data_kos_surabaya_enriched.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader(); w.writerows(rows)
isi = sum(1 for r in rows if r["harga_bulanan"])
print(f"✅ Coverage harga akhir: {isi}/{len(rows)} ({isi/len(rows)*100:.0f}%)")