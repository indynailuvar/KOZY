# =============================================================================
# Menyiapkan titik kos hasil Google Maps untuk frontend:
#   ../gmaps_all_basic.json      (848 kos: hanya nama + link)
#   data/kos_sample_50_anon.csv  (50 di antaranya, ada alamat + rating)
#     -> src/data/gmaps.json
#
# Sumber ini hanya berisi nama dan link. Tetapi koordinatnya sebenarnya sudah
# ikut tertulis di dalam link Google Maps (pola !3d<lat>!4d<lng>), jadi bisa
# dibaca tanpa membuka halamannya satu per satu. Kecamatan dicari dari koordinat
# itu lewat scripts/geocode_titik.py.
#
# Yang TIDAK ada di sumber ini: harga dan fasilitas. Halaman Google Maps-nya pun
# tidak memuat fasilitas kos (sudah diperiksa: tidak ada WiFi/AC/kamar mandi di
# halamannya), jadi fasilitas memang tidak bisa diambil dari sini dan tidak
# dikarang. Harga diisi sebagai PERKIRAAN dari model hedonic di pasar.json:
#
#   perkiraan = exp(intercept + efek_kecamatan + sigma (peluang_fasilitas x efek) + efek_jenis)
#
# Artinya "harga kos berfasilitas rata-rata di kecamatan itu", bukan harga yang
# dipasang pemiliknya. Tiap baris membawa rentang dan tingkat keyakinan:
#   sedang = kecamatannya ada di data harga (Mamikos + Papikost)
#   rendah = kecamatannya belum ada datanya, dipakai rata-rata kota
#
# Titik yang ternyata kos yang sama dengan iklan Papikost ditandai, supaya
# harga aslinya yang dipakai dan tidak terhitung dua kali.
#
# Jalankan:  python scripts/build_gmaps.py   (perlu build_pasar.py + geocode dulu)
# =============================================================================
import csv
import io
import json
import math
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AKAR = os.path.dirname(BASE)
SUMBER = os.path.join(AKAR, "gmaps_all_basic.json")
RINCI_CSV = os.path.join(BASE, "data", "kos_sample_50_anon.csv")
PASAR = os.path.join(BASE, "src", "data", "pasar.json")
GEOCODE = os.path.join(BASE, "data", "geocode_cache.json")
KELUAR = os.path.join(BASE, "src", "data", "gmaps.json")
DIAMBIL = "2026-09-29"
KOTA = "Surabaya"
DEKAT_M = 60  # dua titik sedekat ini dianggap kos yang sama
TETANGGA_M = 400  # batas jarak untuk menebak wilayah dari titik tetangga
TETANGGA_K = 5

POLA_TITIK = re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)")
POLA_PID = re.compile(r"!1s(0x[0-9a-f]+:0x[0-9a-f]+)")
POLA_JENIS = [("putri", r"putri|mahasiswi|wanita|cewek"), ("putra", r"putra|pria|boys|cowok"), ("campur", r"co-?living|coliving|executive")]

bulat10rb = lambda n: int(round(n / 10_000) * 10_000)
rapat = lambda s: re.sub(r"\s+", " ", s or "").strip().strip("*").strip()


def jarakM(a, b, c, d):
    return math.hypot((a - c) * 111_320, (b - d) * 110_570)


def jenisDari(nama):
    n = nama.lower()
    for jenis, pola in POLA_JENIS:
        if re.search(pola, n):
            return jenis
    return None


def wilayahTetangga(lat, lng, berlabel):
    """Cadangan kalau reverse geocoding belum sempat menjangkau satu titik.

    Wilayahnya diambil dari suara terbanyak titik berlabel dalam radius TETANGGA_M,
    ditimbang jarak. Diuji pada titik yang sudah punya label: 96,7% tepat pada
    radius 400 m. Lebih jauh dari itu dibiarkan kosong daripada ditebak asal.
    """
    dekat = []
    for la, lo, kec, kel in berlabel:
        d = jarakM(lat, lng, la, lo)
        if d <= TETANGGA_M:
            dekat.append((d, kec, kel))
    if not dekat:
        return None, None
    dekat.sort()
    suara = {}
    for d, kec, kel in dekat[:TETANGGA_K]:
        suara[kec] = suara.get(kec, 0) + 1 / (d + 50)
    kec = max(suara, key=suara.get)
    kel = next((k for _, c, k in dekat if c == kec and k), None)
    return kec, kel


def bacaRinci():
    """50 kos yang sempat dicatat lebih rinci: alamat + rating."""
    out = {}
    if not os.path.exists(RINCI_CSV):
        return out
    for x in csv.DictReader(io.open(RINCI_CSV, encoding="utf-8-sig")):
        if not x.get("latitude"):
            continue
        out[(round(float(x["latitude"]), 4), round(float(x["longitude"]), 4))] = {
            "alamat": rapat(x.get("alamat_kos")),
            "rating": float(x["rating"]) if x.get("rating") else None,
            "ulasan": int(x["jumlah_ulasan"]) if x.get("jumlah_ulasan") else None,
        }
    return out


def main():
    pasar = json.load(io.open(PASAR, encoding="utf-8"))
    geo = json.load(io.open(GEOCODE, encoding="utf-8"))
    rinci = bacaRinci()
    M = pasar["model"]
    mape = pasar["meta"]["mape"]
    fids = list(M["fasilitas"])
    semua = pasar["kos"]

    kotaFas = {f: sum(1 for k in semua if f in k["fasilitas"]) / len(semua) * 100 for f in fids}
    kotaJenis = {j: sum(1 for k in semua if k["jenis"] == j) / len(semua) * 100 for j in ("putra", "putri", "campur")}
    berharga = [k for k in semua if k.get("lat")]  # iklan yang sudah punya harga asli + koordinat

    berlabel = []
    for k, v in geo.items():
        if v.get("kec"):
            la, lo = map(float, k.split(","))
            berlabel.append((la, lo, v["kec"], v.get("kel")))

    keluar, sudahPid, lewatKota, lewatKec, dariTetangga = [], set(), 0, 0, 0
    for r in json.load(io.open(SUMBER, encoding="utf-8")):
        m = POLA_TITIK.search(r["link"])
        if not m:
            continue
        lat, lng = float(m.group(1)), float(m.group(2))
        pid = POLA_PID.search(r["link"])
        pid = pid.group(1) if pid else "%.5f,%.5f" % (lat, lng)
        if pid in sudahPid:
            continue
        sudahPid.add(pid)

        g = geo.get("%.5f,%.5f" % (lat, lng)) or {}
        if (g.get("kota") or KOTA) != KOTA:
            lewatKota += 1
            continue
        kec, kel, asalWilayah = g.get("kec"), g.get("kel"), "reverse geocoding"
        if not kec:
            kec, kel = wilayahTetangga(lat, lng, berlabel)
            asalWilayah = "titik terdekat"
            if not kec:
                lewatKec += 1
                continue
            dariTetangga += 1

        adaKec = kec in M["kec"]
        fas = pasar["kecamatan"][kec]["fasilitas"] if adaKec else kotaFas
        komposisi = pasar["kecamatan"][kec]["komposisi"] if adaKec else kotaJenis
        nama = rapat(r["name"])
        jenis = jenisDari(nama)
        efekJenis = M["jenis"][jenis] if jenis else sum(M["jenis"][j] * (komposisi[j] / 100) for j in komposisi)
        log = M["intercept"] + (M["kec"][kec] if adaKec else 0.0) + sum(M["fasilitas"][f] * (fas[f] / 100) for f in fids) + efekJenis
        titik = math.exp(log)
        lebar = mape / 100 if adaKec else (mape * 1.75) / 100

        # sudah ada iklan berharga asli di titik yang sama?
        kembar = next((k for k in berharga if jarakM(lat, lng, k["lat"], k["lng"]) <= DEKAT_M), None)
        extra = rinci.get((round(lat, 4), round(lng, 4))) or {}

        keluar.append(
            {
                "id": "gm-" + pid.split(":")[-1][-10:],
                "nama": nama,
                "alamat": extra.get("alamat") or None,
                "kec": kec,
                "kel": kel or None,
                "wilayah_dari": asalWilayah,
                "lat": lat,
                "lng": lng,
                "rating": extra.get("rating"),
                "ulasan": extra.get("ulasan"),
                "link": r["link"],
                "jenis": jenis,
                "estimasi": bulat10rb(titik),
                "rendah": bulat10rb(titik * (1 - lebar)),
                "tinggi": bulat10rb(titik * (1 + lebar)),
                "keyakinan": "sedang" if adaKec else "rendah",
                "harga_asli": kembar["harga"] if kembar else None,
            }
        )

    kecs = sorted({k["kec"] for k in keluar})
    perKec = {}
    for k in keluar:
        perKec[k["kec"]] = perKec.get(k["kec"], 0) + 1
    hasil = {
        "meta": {
            "sumber": "Google Maps",
            "diambil": DIAMBIL,
            "n": len(keluar),
            "n_mentah": 848,
            "kecamatan": len(kecs),
            "n_sedang": sum(1 for k in keluar if k["keyakinan"] == "sedang"),
            "n_harga_asli": sum(1 for k in keluar if k["harga_asli"]),
            "n_rinci": sum(1 for k in keluar if k["alamat"]),
            "n_wilayah_tetangga": dariTetangga,
            "dasar_model": "%s %d iklan" % (pasar["meta"]["sumber"], pasar["meta"]["n"]),
            "catatan": "Harga dan fasilitas tidak ada di sumber ini, dan halaman Google Maps-nya juga tidak memuat fasilitas. Angka harga adalah perkiraan model untuk kos berfasilitas rata-rata di kecamatan itu, bukan harga yang dipasang pemilik.",
        },
        "per_kecamatan": dict(sorted(perKec.items(), key=lambda x: -x[1])),
        "kos": sorted(keluar, key=lambda k: (k["kec"], k["nama"])),
    }
    io.open(KELUAR, "w", encoding="utf-8", newline="\n").write(json.dumps(hasil, ensure_ascii=False, indent=1))

    print("%d titik dari %d kecamatan -> %s" % (len(keluar), len(kecs), os.path.relpath(KELUAR, BASE)))
    print("dilewati: %d di luar %s, %d tanpa wilayah (tidak ada tetangga <%d m)" % (lewatKota, KOTA, lewatKec, TETANGGA_M))
    print("wilayah dari titik terdekat (bukan reverse geocoding): %d titik" % dariTetangga)
    print("keyakinan sedang (kecamatan ada di data harga): %d, sisanya rendah" % hasil["meta"]["n_sedang"])
    print("cocok dengan iklan berharga asli: %d titik" % hasil["meta"]["n_harga_asli"])
    print("5 kecamatan terbanyak:", dict(list(hasil["per_kecamatan"].items())[:5]))
    for k in keluar[:4]:
        print("  %-38s %-16s Rp%9s  (%s-%s)  %s" % (k["nama"][:38], k["kec"], format(k["estimasi"], ","), format(k["rendah"], ","), format(k["tinggi"], ","), k["keyakinan"]))


if __name__ == "__main__":
    main()
