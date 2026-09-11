# scrapers/merge_all.py
import json, re, os, unicodedata
from difflib import SequenceMatcher
from math import radians, sin, cos, asin, sqrt

def norm(s):
    if not s: return ""
    s = unicodedata.normalize("NFKD", str(s)).lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def parse_price(x):
    if x is None: return None
    s = str(x).lower().replace("rp", "").replace(".", "").replace(",", "").strip()
    m = re.search(r"\d+", s)
    return int(m.group()) if m else None

def norm_phone(x):
    if not x: return None
    d = re.sub(r"[^\d+]", "", str(x))
    if d.startswith("+62"): d = "0" + d[3:]
    elif d.startswith("62"): d = "0" + d[2:]
    return d if len(d) >= 9 else None

def haversine_km(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2): return 9e9
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return 6371 * 2 * asin(sqrt(a))

def sim(a, b): return SequenceMatcher(None, norm(a), norm(b)).ratio()

# ---------- 1) GOOGLE MAPS (sumber utama: alamat + telepon) ----------
rows = []
if os.path.exists("gmaps_details.json"):
    for r in json.load(open("gmaps_details.json", encoding="utf-8")):
        rows.append({"nama_kos": r.get("nama"), "alamat": r.get("alamat"),
                     "telepon": norm_phone(r.get("telepon")),
                     "harga_bulanan": None, "rating": r.get("rating"),
                     "jumlah_ulasan": r.get("jumlah_ulasan"),
                     "latitude": r.get("latitude"), "longitude": r.get("longitude"),
                     "fasilitas": None, "sumber": ["Google Maps"],
                     "url": r.get("link"), "telepon_alt": []})

# ---------- 2) MAMIKOS (sumber utama: harga + fasilitas) ----------
def walk_mamikos(node, out):
    if isinstance(node, dict):
        keys = set(node.keys())
        name_k  = keys & {"name", "title", "judul", "propertyName"}
        addr_k  = keys & {"address", "alamat", "fullAddress"}
        price_k = keys & {"price", "harga", "priceText", "displayPrice"}
        if name_k and (addr_k or price_k):
            out.append(node)
        for v in node.values(): walk_mamikos(v, out)
    elif isinstance(node, list):
        for v in node: walk_mamikos(v, out)

if os.path.exists("mamikos_data.json"):
    raw = json.load(open("mamikos_data.json", encoding="utf-8"))
    found = []; walk_mamikos(raw.get("props", raw), found)
    for n in found:
        rows.append({"nama_kos": n.get("name") or n.get("title"),
                     "alamat": n.get("address") or n.get("alamat"),
                     "telepon": norm_phone(n.get("phone") or n.get("telepon")),
                     "harga_bulanan": parse_price(n.get("price") or n.get("harga")),
                     "rating": None, "jumlah_ulasan": None,
                     "latitude": n.get("latitude") or n.get("lat"),
                     "longitude": n.get("longitude") or n.get("lng"),
                     "fasilitas": n.get("facilities") or n.get("fasilitas"),
                     "sumber": ["Mamikos"], "url": n.get("url") or n.get("link"),
                     "telepon_alt": []})

# ---------- 3) OLX (sumber pembanding harga) ----------
if os.path.exists("olx_data.json"):
    raw = json.load(open("olx_data.json", encoding="utf-8"))
    for n in raw.get("data", []):
        loc = n.get("location") or {}
        rows.append({"nama_kos": n.get("title"),
                     "alamat": loc.get("city", {}).get("name") if isinstance(loc, dict) else None,
                     "telepon": norm_phone((n.get("contact") or {}).get("phone")),
                     "harga_bulanan": parse_price((n.get("price") or {}).get("value")),
                     "rating": None, "jumlah_ulasan": None,
                     "latitude": (loc.get("coordinates") or {}).get("latitude") if isinstance(loc, dict) else None,
                     "longitude": (loc.get("coordinates") or {}).get("longitude") if isinstance(loc, dict) else None,
                     "fasilitas": None, "sumber": ["OLX"],
                     "url": n.get("url"), "telepon_alt": []})

print(f"Total record mentah gabungan: {len(rows)}")

# ---------- DEDUPLIKASI & MERGE ----------
# Aturan: kos dianggap SAMA jika jarak < 80 meter ATAU kemiripan nama > 90%
merged = []
for r in rows:  # urutan prioritas sudah: GMaps -> Mamikos -> OLX
    hit = None
    for m in merged:
        if haversine_km(r["latitude"], r["longitude"], m["latitude"], m["longitude"]) < 0.08 \
           or (sim(r["nama_kos"], m["nama_kos"]) > 0.90):
            hit = m; break
    if hit:
        for k in ["alamat", "telepon", "harga_bulanan", "rating", "latitude", "longitude", "fasilitas", "url"]:
            if hit[k] in (None, "", []) and r[k] not in (None, "", []):
                hit[k] = r[k]
        if r["telepon"] and r["telepon"] != hit["telepon"] and r["telepon"] not in hit["telepon_alt"]:
            hit["telepon_alt"].append(r["telepon"])
        for s in r["sumber"]:
            if s not in hit["sumber"]: hit["sumber"].append(s)
    else:
        merged.append(r)

print(f"✅ Setelah deduplikasi: {len(merged)} kos unik")

# ---------- SIMPAN ----------
import csv
cols = ["nama_kos", "alamat", "telepon", "telepon_alt", "harga_bulanan", "rating",
        "jumlah_ulasan", "latitude", "longitude", "fasilitas", "sumber", "url"]
with open("../data_kos_surabaya_final.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    for r in merged:
        rr = dict(r); rr["sumber"] = " + ".join(r["sumber"]); rr["telepon_alt"] = "; ".join(r["telepon_alt"])
        w.writerow(rr)
json.dump(merged, open("../data_kos_surabaya_final.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# ---------- LAPORAN KUALITAS ----------
print("\n📊 Kelengkapan data:")
for k in cols:
    filled = sum(1 for r in merged if r[k] not in (None, "", []))
    print(f"  {k:16}: {filled:4d} / {len(merged)}  ({filled/len(merged)*100:.0f}%)")