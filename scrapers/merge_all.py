# ============================================================
# scrapers/merge_all.py
# Menyatukan seluruh hasil scraping menjadi SATU file master.
# Kololom inti: no, nama_kos, alamat_kos, telepon_pemilik,
#               harga_bulanan, kamar_mandi, pendingin, link_gmaps
# ============================================================
import json, re, csv, os
from difflib import SequenceMatcher

BASE      = os.path.dirname(os.path.abspath(__file__))
DETAILS   = os.path.join(BASE, "gmaps_details.json")
MAMIKOS   = os.path.join(BASE, "mamikos_data.json")    # opsional
OLX       = os.path.join(BASE, "olx_data.json")        # opsional
OUT_CSV   = os.path.join(BASE, "..", "data_kos_surabaya.csv")
OUT_JSON  = os.path.join(BASE, "..", "data_kos_surabaya.json")
QUEUE_CSV = os.path.join(BASE, "..", "queue_lengkapi_manual.csv")

KECAMATAN = ["Wonokromo","Gubeng","Sukolilo","Rungkut","Gunung Anyar","Gn. Anyar",
             "Mulyorejo","Wiyung","Sawahan","Tegalsari","Jambangan","Gayungan",
             "Lakarsantri","Benowo","Sukomanunggal","Sambikerep","Pakal",
             "Wonocolo","Genteng","Bubutan"]

def clean(s):
    if s is None: return None
    s = str(s).replace("Alamat:", "").replace("Telepon:", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s if s else None

def norm_phone(s):
    s = clean(s)
    if not s: return None
    d = re.sub(r"[^\d]", "", s)
    if d.startswith("62"):  d = "0" + d[2:]
    elif not d.startswith("0"): d = "0" + d
    return d if 9 <= len(d) <= 13 else None

def parse_latlng(link):
    m = re.search(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", link or "")
    return (float(m.group(1)), float(m.group(2))) if m else (None, None)

def fasilitas_dari_nama(nama):
    n = (nama or "").lower()
    ac    = bool(re.search(r"\bac\b|air conditioner", n))
    nonac = bool(re.search(r"non[\s\-]?ac|tanpa ac|kipas", n))
    kmd   = bool(re.search(r"kamar mandi dalam|\bkmd\b", n))
    kml   = bool(re.search(r"kamar mandi luar", n))
    wifi  = bool(re.search(r"wifi|wi-?fi", n))
    pendingin = "AC & Non-AC" if (ac and nonac) else \
                "AC" if ac else "Kipas" if nonac else "tidak diketahui"
    km = "dalam" if kmd else "luar" if kml else "tidak diketahui"
    return km, pendingin, wifi

def kecamatan_dari_alamat(alamat):
    a = (alamat or "").lower()
    for k in KECAMATAN:
        if k.lower() in a:
            return "Gunung Anyar" if k == "Gn. Anyar" else k
    return None

def sim(a, b):
    return SequenceMatcher(None, (a or "").lower(), (b or "").lower()).ratio()

# ---------- 1) Muat & normalisasi detail (dua format bercampur) ----------
raw    = json.load(open(DETAILS, encoding="utf-8"))
master = {}
for r in raw:
    link = (r.get("link") or "").strip()
    nama = clean(r.get("nama") or r.get("name"))
    alam = clean(r.get("alamat") or r.get("address"))
    telp = norm_phone(r.get("telepon") or r.get("phone"))
    rat, ulu = r.get("rating"), r.get("jumlah_ulasan")
    lat, lng = parse_latlng(link)
    if lat is None: lat, lng = r.get("latitude"), r.get("longitude")
    key = link or nama
    if key not in master:
        master[key] = dict(nama=nama, link=link, alamat=alam, telepon=telp,
                           rating=rat, jumlah_ulasan=ulu, latitude=lat, longitude=lng)
    else:
        m = master[key]
        for f, v in [("nama",nama),("alamat",alam),("telepon",telp),
                     ("rating",rat),("jumlah_ulasan",ulu),
                     ("latitude",lat),("longitude",lng)]:
            if m.get(f) in (None, "") and v not in (None, ""):
                m[f] = v
print(f"Record mentah: {len(raw)} | kos unik setelah dedup: {len(master)}")

# ---------- 2) Sumber harga eksternal (Mamikos/OLX, opsional) ----------
def walk_harga(node, out):
    if isinstance(node, dict):
        nama  = node.get("name") or node.get("title") or node.get("judul")
        harga = node.get("price") or node.get("harga")
        if isinstance(harga, dict):
            harga = harga.get("value") or harga.get("displayPrice")
        if nama and harga:
            try: out.append((str(nama), int(re.sub(r"[^\d]", "", str(harga)))))
            except Exception: pass
        for v in node.values(): walk_harga(v, out)
    elif isinstance(node, list):
        for v in node: walk_harga(v, out)

harga_eksternal = []
for p in (MAMIKOS, OLX):
    if os.path.exists(p):
        try: walk_harga(json.load(open(p, encoding="utf-8")), harga_eksternal)
        except Exception as e: print("  skip", os.path.basename(p), e)
print(f"Kandidat harga dari Mamikos/OLX: {len(harga_eksternal)}")

# ---------- 3) Rakit baris master ----------
rows = []
for i, (key, m) in enumerate(
        sorted(master.items(), key=lambda kv: kv[1]["nama"] or ""), 1):
    km, pend, wifi = fasilitas_dari_nama(m["nama"])
    harga, sumber_harga = None, None
    if harga_eksternal:
        nm, hv = max(harga_eksternal, key=lambda t: sim(t[0], m["nama"]))
        if sim(nm, m["nama"]) >= 0.85:
            harga, sumber_harga = hv, "iklan (Mamikos/OLX)"
    rows.append({
        "no": i,
        "nama_kos": m["nama"],
        "alamat_kos": m["alamat"],
        "telepon_pemilik": m["telepon"],
        "harga_bulanan": harga,
        "kamar_mandi": km,
        "pendingin": pend,
        "link_gmaps": m["link"],
        # ---- kolom pendukung (untuk modeling & UI) ----
        "wifi": wifi,
        "rating": m["rating"],
        "jumlah_ulasan": m["jumlah_ulasan"],
        "kecamatan": kecamatan_dari_alamat(m["alamat"]),
        "latitude": m["latitude"],
        "longitude": m["longitude"],
        "sumber_harga": sumber_harga,
    })

# ---------- 4) Tulis output ----------
cols = list(rows[0].keys())
with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
json.dump(rows, open(OUT_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

queue = [r for r in rows
         if r["harga_bulanan"] is None
         or r["kamar_mandi"] == "tidak diketahui"
         or r["pendingin"] == "tidak diketahui"]
with open(QUEUE_CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(queue)

# ---------- 5) Laporan kelengkapan ----------
print(f"\n✅ File master : {os.path.normpath(OUT_CSV)} ({len(rows)} kos)")
print(f"✅ Queue manual: {os.path.normpath(QUEUE_CSV)} ({len(queue)} kos)")
print("\nLaporan kelengkapan kolom:")
for f_ in ["alamat_kos","telepon_pemilik","harga_bulanan",
           "kamar_mandi","pendingin","kecamatan","rating"]:
    isi = sum(1 for r in rows if r.get(f_) not in (None, "", "tidak diketahui"))
    print(f"  {f_:16}: {isi:4d}/{len(rows)}  ({isi/len(rows)*100:.0f}%)")