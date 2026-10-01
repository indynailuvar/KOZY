# =============================================================================
# Mencari kelurahan & kecamatan dari koordinat (reverse geocoding).
#
# Dipakai untuk titik Google Maps yang hanya punya nama + link: koordinatnya
# sudah ada di dalam link (!3d<lat>!4d<lng>), tetapi wilayahnya tidak. Tanpa
# kecamatan, model harga tidak bisa dipakai, jadi titiknya perlu dikenali dulu.
#
# Sumber wilayah: Nominatim (OpenStreetMap), gratis, batas 1 permintaan/detik.
# Dalam praktiknya, setelah beberapa ratus permintaan layanannya memperlambat
# jawaban sampai ~19 detik per titik, jadi menghabiskan seluruh 848 titik bisa
# makan berjam-jam. Karena itu urutan permintaannya diatur supaya berhenti di
# tengah jalan pun hasilnya sudah berguna:
#
#   1. Titik Papikost   — dipakai melatih model, jadi harus lengkap lebih dulu.
#   2. Wakil klaster    — titik Google Maps dikelompokkan per radius 500 m, lalu
#                         satu wakil tiap kelompok yang ditanyakan. Sisanya nanti
#                         ikut wilayah tetangga terdekat di build_gmaps.py, yang
#                         pada uji coba 96,7% tepat dalam radius 400 m.
#   3. Sisanya          — ditanyakan satu per satu kalau masih ada waktu.
#
# Hasilnya disimpan di data/geocode_cache.json. Menjalankan ulang hanya
# mengambil titik yang belum ada di cache, jadi aman dihentikan kapan saja.
#
# Jalankan:  python scripts/geocode_titik.py [jumlah_maksimal]
# =============================================================================
import io
import json
import math
import os
import re
import sys
import time
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AKAR = os.path.dirname(BASE)
CACHE = os.path.join(BASE, "data", "geocode_cache.json")
UA = "KOZY-riset-akademik/1.0 (proyek kuliah analitika data)"
JEDA = 1.1  # patuhi batas 1 permintaan/detik Nominatim
RADIUS_KLASTER = 500  # meter

POLA = re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)")
kunci = lambda lat, lng: "%.5f,%.5f" % (lat, lng)
jarakM = lambda a, b, c, d: math.hypot((a - c) * 111_320, (b - d) * 110_570)


def titikDariLink(link):
    m = POLA.search(link or "")
    return (float(m.group(1)), float(m.group(2))) if m else None


def urutkan(cache):
    """Titik yang belum dikenali, diurutkan supaya berhenti di tengah pun tetap berguna."""
    papikost, gmaps = [], []
    for r in json.load(io.open(os.path.join(AKAR, "papikost_surabaya_71.json"), encoding="utf-8")):
        papikost.append((r["lat"], r["lng"]))
    for r in json.load(io.open(os.path.join(AKAR, "gmaps_all_basic.json"), encoding="utf-8")):
        t = titikDariLink(r["link"])
        if t:
            gmaps.append(t)

    sudah = {k: v for k, v in cache.items() if v.get("kec")}
    berlabel = [tuple(map(float, k.split(","))) for k in sudah]
    perlu1 = [t for t in papikost if kunci(*t) not in cache]

    # titik yang sudah punya tetangga berlabel dekat bisa ditunda: wilayahnya nanti
    # bisa diambil dari tetangga itu tanpa bertanya lagi
    sisa = [t for t in gmaps if kunci(*t) not in cache]
    jauh = [t for t in sisa if not any(jarakM(t[0], t[1], q[0], q[1]) <= 400 for q in berlabel)]
    dekat = [t for t in sisa if t not in set(jauh)]

    # satu wakil per klaster 500 m di antara yang jauh dari titik berlabel
    klaster, wakil = [], []
    for t in jauh:
        for k in klaster:
            if jarakM(t[0], t[1], k[0], k[1]) <= RADIUS_KLASTER:
                break
        else:
            klaster.append(t)
            wakil.append(t)
    sisaJauh = [t for t in jauh if t not in set(wakil)]

    urut, lihat = [], set()
    for kelompok in (perlu1, wakil, sisaJauh, dekat):
        for t in kelompok:
            k = kunci(*t)
            if k not in lihat:
                lihat.add(k)
                urut.append((k, t))
    return urut, len(perlu1), len(wakil)


def tanya(lat, lng):
    u = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%s&lon=%s&zoom=14&accept-language=id" % (lat, lng)
    rq = urllib.request.Request(u, headers={"User-Agent": UA})
    a = json.load(urllib.request.urlopen(rq, timeout=60)).get("address") or {}
    return {
        "kel": a.get("village") or a.get("suburb") or a.get("neighbourhood") or None,
        "kec": a.get("municipality") or a.get("city_district") or a.get("subdistrict") or None,
        "kota": a.get("city") or a.get("county") or a.get("town") or None,
    }


def main():
    batas = int(sys.argv[1]) if len(sys.argv) > 1 else 10**9
    cache = json.load(io.open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    urut, nPapikost, nWakil = urutkan(cache)
    urut = urut[:batas]
    print("%d titik sudah dikenali. Antrean kali ini: %d (%d Papikost, %d wakil klaster)" % (len(cache), len(urut), nPapikost, nWakil), flush=True)

    simpan = lambda: io.open(CACHE, "w", encoding="utf-8", newline="\n").write(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True))
    for i, (k, (lat, lng)) in enumerate(urut, 1):
        for coba in range(3):
            try:
                cache[k] = tanya(lat, lng)
                break
            except Exception as e:
                if coba == 2:
                    cache[k] = {"kel": None, "kec": None, "kota": None, "gagal": str(e)[:80]}
                else:
                    time.sleep(3 * (coba + 1))
        if i % 5 == 0 or i == len(urut):
            simpan()
            print("  %d/%d  %s" % (i, len(urut), cache[k]), flush=True)
        time.sleep(JEDA)

    simpan()
    ada = sum(1 for v in cache.values() if v.get("kec"))
    print("selesai: %d/%d titik punya kecamatan -> %s" % (ada, len(cache), os.path.relpath(CACHE, BASE)))


if __name__ == "__main__":
    main()
