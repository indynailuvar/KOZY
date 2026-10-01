# =============================================================================
# Menyusun daftar kawasan (kelurahan) dari titik yang sudah dikenali wilayahnya:
#   src/data/pasar.json + src/data/gmaps.json  ->  src/data/kawasan.json
#
# Sebelumnya daftar kawasan ditulis tangan (30 kelurahan dengan koordinat kira-kira).
# Sekarang kelurahan dan koordinatnya bisa diambil dari data: tiap titik kos sudah
# punya kelurahan + kecamatan hasil reverse geocoding, jadi titik tengah kawasan
# memakai median koordinat kos yang benar-benar ada di sana.
#
# Kelurahan dengan titik terlalu sedikit dibuang supaya tidak muncul kawasan yang
# sebenarnya hanya satu kos nyasar.
#
# Nama id kawasan lama dipertahankan bila namanya sama, supaya pilihan yang sudah
# tersimpan di browser pengguna tidak hilang.
#
# Jalankan:  python scripts/build_kawasan.py   (setelah build_pasar + build_gmaps)
# =============================================================================
import io
import json
import os
import re
import unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASAR = os.path.join(BASE, "src", "data", "pasar.json")
GMAPS = os.path.join(BASE, "src", "data", "gmaps.json")
GEOCODE = os.path.join(BASE, "data", "geocode_cache.json")
KELUAR = os.path.join(BASE, "src", "data", "kawasan.json")

MINIMAL_TITIK = 3  # di bawah ini kelurahan dianggap belum layak jadi pilihan

# id yang sudah dipakai versi sebelumnya, supaya pilihan tersimpan tidak hilang
ID_LAMA = {
    "keputih": "Keputih", "gebang": "Gebang Putih", "semolowaru": "Semolowaru", "klampis": "Klampis Ngasem",
    "menur": "Menur Pumpungan", "nginden": "Nginden Jangkungan", "medokan": "Medokan Semampir",
    "airlangga": "Airlangga", "dharmawangsa": "Dharmawangsa", "pucang": "Pucang Sewu", "gubeng": "Gubeng",
    "baratajaya": "Baratajaya", "darmo": "Darmo", "wonokromo": "Wonokromo", "jagir": "Jagir", "ngagel": "Ngagel",
    "jemursari": "Jemursari", "sidosermo": "Sidosermo", "margorejo": "Margorejo", "tenggilis": "Tenggilis Mejoyo",
    "kutisari": "Kutisari", "rungkut": "Rungkut", "medokan-ayu": "Medokan Ayu", "mulyorejo": "Mulyorejo",
    "tegalsari": "Tegalsari", "ketintang": "Ketintang", "lakarsantri": "Lakarsantri", "benowo": "Benowo", "pakal": "Pakal",
}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def median(v):
    v = sorted(v)
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def main():
    pasar = json.load(io.open(PASAR, encoding="utf-8"))
    gmaps = json.load(io.open(GMAPS, encoding="utf-8"))
    geo = json.load(io.open(GEOCODE, encoding="utf-8"))

    # kumpulkan titik: kelurahan -> daftar koordinat
    kel = {}

    def tambah(nama, kec, lat, lng, berharga):
        if not nama or not kec:
            return
        k = kel.setdefault((nama.strip(), kec.strip()), {"lat": [], "lng": [], "harga": 0})
        k["lat"].append(lat)
        k["lng"].append(lng)
        k["harga"] += 1 if berharga else 0

    for r in pasar["kos"]:
        if r.get("lat"):
            g = geo.get("%.5f,%.5f" % (r["lat"], r["lng"])) or {}
            tambah(g.get("kel"), r["kec"], r["lat"], r["lng"], True)
    for r in gmaps["kos"]:
        tambah(r.get("kel"), r["kec"], r["lat"], r["lng"], False)

    namaKeId = {v: k for k, v in ID_LAMA.items()}
    keluar, dibuang = [], 0
    for (nama, kec), v in kel.items():
        if len(v["lat"]) < MINIMAL_TITIK:
            dibuang += 1
            continue
        keluar.append(
            {
                "id": namaKeId.get(nama, slug(nama)),
                "nama": nama,
                "kec": kec,
                "lat": round(median(v["lat"]), 5),
                "lng": round(median(v["lng"]), 5),
                "titik": len(v["lat"]),
                "berharga": v["harga"],
            }
        )

    # kalau satu kelurahan terbaca di dua kecamatan, ambil yang titiknya terbanyak
    terbaik = {}
    for k in sorted(keluar, key=lambda x: -x["titik"]):
        terbaik.setdefault(k["id"], k)
    keluar = sorted(terbaik.values(), key=lambda k: (k["kec"], k["nama"]))

    perKec = {}
    for k in keluar:
        perKec[k["kec"]] = perKec.get(k["kec"], 0) + 1
    hasil = {
        "meta": {
            "n": len(keluar),
            "kecamatan": len(perKec),
            "minimal_titik": MINIMAL_TITIK,
            "dibuang": dibuang,
            "catatan": "Kelurahan dan titik tengahnya berasal dari koordinat kos yang benar-benar terdata, bukan tulisan tangan.",
        },
        "kawasan": keluar,
    }
    io.open(KELUAR, "w", encoding="utf-8", newline="\n").write(json.dumps(hasil, ensure_ascii=False, indent=1))

    print("%d kawasan dari %d kecamatan -> %s" % (len(keluar), len(perKec), os.path.relpath(KELUAR, BASE)))
    print("dibuang karena titiknya < %d: %d kelurahan" % (MINIMAL_TITIK, dibuang))
    print("10 kawasan dengan titik terbanyak:")
    for k in sorted(keluar, key=lambda x: -x["titik"])[:10]:
        print("  %-24s %-18s %3d titik (%d berharga)" % (k["nama"], k["kec"], k["titik"], k["berharga"]))


if __name__ == "__main__":
    main()
