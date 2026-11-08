# =============================================================================
# Menyiapkan data pasar dan pembanding harga untuk frontend:
#   data/mamikos_bersih.csv      (240 iklan, harga + fasilitas, tanpa koordinat)
#   ../papikost_surabaya_71.json (71 iklan, harga + fasilitas + koordinat)
#     -> src/data/pasar.json
#
# Kedua sumber sama-sama iklan SEWA BULANAN, jadi boleh digabung. Data OLX
# sengaja tidak ikut: isinya rumah kos yang DIJUAL (miliaran), bukan sewa.
#
# Kewajaran harga dinilai dengan ROBUST STATISTICAL BENCHMARKING, tanpa
# regresi. Tiap harga dibandingkan dengan sebaran harga iklan asli yang
# sebanding, yaitu kos sejenis (putra/putri/campur) di kecamatan yang sama:
#
#   acuan          = median
#   kisaran wajar  = Q1 - Q3 (separuh tengah harga pembanding)
#   gap            = (harga - median) / IQR
#
# Median dan IQR dipilih karena tidak goyah oleh satu-dua iklan yang harganya
# ekstrem. Kuartil memakai interpolasi linear, sama dengan pandas, supaya
# angkanya identik dengan bundle modeling di backend.
#
# Fasilitas TIDAK ikut menghitung gap. Di iklan, fasilitas hanya tercatat
# ada/tidak (0/1) dan sering tidak ditulis pemiliknya, jadi 0 belum tentu
# berarti tidak ada. Persentase fasilitas tetap disimpan per kecamatan, tetapi
# hanya untuk dideskripsikan, bukan untuk menaikkan atau menurunkan harga.
#
# Kelompok kecamatan x jenis dengan iklan < MIN_PEMBANDING dianggap eksploratif;
# aplikasi lalu membandingkan dengan seluruh kos di kecamatan itu.
#
# Jalankan:  python scripts/build_pasar.py   (perlu scripts/geocode_titik.py dulu)
# =============================================================================
import csv
import io
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AKAR = os.path.dirname(BASE)
MAMIKOS_CSV = os.path.join(BASE, "data", "mamikos_bersih.csv")
PAPIKOST_JSON = os.path.join(AKAR, "papikost_surabaya_71.json")
GEOCODE = os.path.join(BASE, "data", "geocode_cache.json")
KELUAR = os.path.join(BASE, "src", "data", "pasar.json")
DIAMBIL = {"Mamikos": "2026-09-16", "Papikost": "2026-09-29"}

BATAS_HARGA = (200_000, 10_000_000)  # di luar ini bukan sewa bulanan yang wajar
KOTA = "Surabaya"
MIN_IKLAN_KEC = 5  # di bawah ini keyakinan data kecamatannya "rendah"
MIN_PEMBANDING = 10  # sama dengan status_sampel "Prioritas (n>=10)" di bundle modeling

# fasilitas yang ditanyakan ke pengguna di aplikasi (urutannya dipakai di UI)
FAS_APLIKASI = ["km", "ac", "wifi", "kasur", "kloset", "akses24"]
MAMIKOS_KOLOM = {
    "km": "ada_km_dalam",
    "ac": "ada_ac",
    "wifi": "ada_wifi",
    "kasur": "ada_kasur",
    "kloset": "ada_kloset_duduk",
    "akses24": "ada_akses_24jam",
}
PAPIKOST_FAS = {
    "kmandi_dalam": "km",
    "ac": "ac",
    "wifi": "wifi",
    "kasur": "kasur",
    "lemari": "lemari",
    "meja_belajar": "meja",
    "pmotor": "pmotor",
    "pmobil": "pmobil",
    "tv": "tv",
    "dispenser": "dispenser",
}
FAS_LAIN = ["lemari", "meja", "pmotor", "pmobil", "tv", "dispenser"]  # dicatat untuk ditampilkan saja
JENIS_CSV = {"Putra": "putra", "Putri": "putri", "Campur": "campur"}
JENIS = ["putra", "putri", "campur"]


def bacaMamikos():
    rows = []
    for x in csv.DictReader(io.open(MAMIKOS_CSV, encoding="utf-8-sig")):
        if not x.get("harga_bulanan") or not x.get("kecamatan"):
            continue
        harga = int(float(x["harga_bulanan"]))
        jenis = JENIS_CSV.get((x.get("tipe_penghuni") or "").strip())
        if not jenis or not (BATAS_HARGA[0] <= harga <= BATAS_HARGA[1]):
            continue
        rows.append(
            {
                "sumber": "Mamikos",
                "nama": re.sub(r"\s+", " ", x["nama_kos"]).strip(),
                "kec": x["kecamatan"].strip(),
                "harga": harga,
                "jenis": jenis,
                "fasilitas": sorted(f for f, kol in MAMIKOS_KOLOM.items() if x.get(kol) == "1"),
                "fasilitas_lain": [],
                "dicatat": list(FAS_APLIKASI),
                "rating": float(x["rating"]) if x.get("rating") else None,
                "dilihat": int(x["dilihat"]) if x.get("dilihat") else None,
                "promo": int(float(x["harga_promo"])) if x.get("harga_promo") else None,
                "sisa_kamar": None,
                "lat": None,
                "lng": None,
                "url": None,
            }
        )
    return rows


def bacaPapikost():
    peta = json.load(io.open(GEOCODE, encoding="utf-8")) if os.path.exists(GEOCODE) else {}
    rows, tanpaKec, luarKota, luarHarga = [], 0, 0, 0
    for r in json.load(io.open(PAPIKOST_JSON, encoding="utf-8")):
        g = peta.get("%.5f,%.5f" % (r["lat"], r["lng"])) or {}
        kec, kota = g.get("kec"), g.get("kota") or r.get("kota")
        if kota != KOTA:
            luarKota += 1
            continue
        if not kec:
            tanpaKec += 1
            continue
        if not (BATAS_HARGA[0] <= r["harga"] <= BATAS_HARGA[1]):
            luarHarga += 1
            continue
        punya = {PAPIKOST_FAS[f] for f in r["fasilitas"] if f in PAPIKOST_FAS}
        rows.append(
            {
                "sumber": "Papikost",
                "nama": re.sub(r"\s+", " ", r["nama"]).strip(),
                "kec": kec,
                "kel": g.get("kel"),
                "harga": r["harga"],
                "jenis": r["jenis"],
                "fasilitas": sorted(punya & set(FAS_APLIKASI)),
                "fasilitas_lain": sorted(punya & set(FAS_LAIN)),
                "dicatat": [f for f in FAS_APLIKASI if f in set(PAPIKOST_FAS.values())],
                # ketersediaan kamar hanya dicatat Papikost; Mamikos tidak punya kolomnya
                "sisa_kamar": r.get("sisa_kamar"),
                "rating": r.get("rating"),
                "dilihat": r.get("dilihat"),
                "promo": None,
                "lat": r["lat"],
                "lng": r["lng"],
                "url": r.get("url"),
            }
        )
    return rows, tanpaKec, luarKota, luarHarga


def buangKembar(rows):
    unik, ada = [], set()
    for r in rows:
        k = (r["sumber"], r["nama"].lower(), r["harga"])
        if k in ada:
            continue
        ada.add(k)
        unik.append(r)
    return unik


def kuantil(v, q):
    """kuantil interpolasi linear, sama dengan pandas Series.quantile bawaan"""
    v = sorted(v)
    h = (len(v) - 1) * q
    lo = int(h)
    hi = min(lo + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (h - lo)


def persen(v, q):
    return int(round(kuantil(v, q / 100)))


def ringkas(harga):
    """median, Q1, Q3, dan IQR satu kelompok pembanding"""
    q1, q3 = kuantil(harga, 0.25), kuantil(harga, 0.75)
    return {
        "n": len(harga),
        "median": int(round(kuantil(harga, 0.5))),
        "q1": int(round(q1)),
        "q3": int(round(q3)),
        "iqr": int(round(q3 - q1)),
        "min": min(harga),
        "max": max(harga),
    }


def periksaGabungan(rows):
    """Berhenti berisik kalau penggabungan merusak data.

    Dibuat setelah satu versi pipeline lain diam-diam mengosongkan seluruh
    fasilitas Mamikos karena nama kolomnya tidak dipetakan (ada_ac vs ac),
    lalu tetap mencetak "BERHASIL". Jumlah baris dan jumlah kolomnya pas,
    yang rusak isinya — dan tidak ada yang memeriksa. Hasilnya melenceng
    jauh tanpa ada yang sadar.

    Aturannya: lebih baik pipeline mati sekarang daripada angka salah
    mengalir ke aplikasi dan ke skripsi.
    """
    galat = []
    perSumber = {}
    for r in rows:
        perSumber.setdefault(r["sumber"], []).append(r)

    # 1. tiap situs HARUS menyumbang fasilitas yang memang dicatatnya
    for sumber, daftar in perSumber.items():
        dicatat = set(FAS_APLIKASI) if sumber == "Mamikos" else set(PAPIKOST_FAS.values()) & set(FAS_APLIKASI)
        for f in sorted(dicatat):
            punya = sum(1 for r in daftar if f in r["fasilitas"])
            if punya == 0:
                galat.append(f"fasilitas '{f}' kosong di SELURUH {len(daftar)} baris {sumber} — pemetaan nama kolom kemungkinan putus")

    # 2. jenis kos harus persis tiga kategori, huruf kecil
    jenis = {r["jenis"] for r in rows}
    if jenis != {"putra", "putri", "campur"}:
        galat.append(f"kategori 'jenis' = {sorted(jenis)}, seharusnya persis putra/putri/campur (cek huruf besar-kecil antar sumber)")

    # 3. kecamatan harus satu satuan wilayah, tanpa sisa sufiks kota
    for kec in sorted({r["kec"] for r in rows}):
        if any(k in kec for k in ("Surabaya", "Sidoarjo", ",")):
            galat.append(f"kecamatan '{kec}' masih membawa sufiks kota — satuan wilayah antar sumber belum disamakan")

    # 4. harga harus di rentang sewa bulanan yang wajar
    liar = [r for r in rows if not (BATAS_HARGA[0] <= r["harga"] <= BATAS_HARGA[1])]
    if liar:
        galat.append(f"{len(liar)} baris berharga di luar {BATAS_HARGA} — mis. {liar[0]['nama'][:40]} Rp{liar[0]['harga']:,}")

    if galat:
        raise SystemExit("PENGGABUNGAN DITOLAK:\n  - " + "\n  - ".join(galat))

    print("periksa gabungan: %d baris, %s, fasilitas tiap sumber utuh, jenis 3 kategori" % (len(rows), {s: len(v) for s, v in perSumber.items()}))


def main():
    mami = bacaMamikos()
    papi, tanpaKec, luarKota, luarHarga = bacaPapikost()
    rows = buangKembar(mami + papi)
    periksaGabungan(rows)

    nKec = {}
    for r in rows:
        nKec[r["kec"]] = nKec.get(r["kec"], 0) + 1

    # --- sebaran asli tiap kecamatan ---------------------------------------
    # Persentase fasilitas hanya boleh dihitung dari iklan yang situsnya memang
    # mencatat fasilitas itu. Papikost tidak mencatat kloset dan akses 24 jam, jadi
    # kalau ikut dihitung, kecamatan yang datanya cuma dari Papikost akan terlihat 0%
    # padahal artinya "tidak diketahui".
    kotaFas = {}
    for f in FAS_APLIKASI:
        amati = [r for r in rows if f in r["dicatat"]]
        kotaFas[f] = round(sum(1 for r in amati if f in r["fasilitas"]) / len(amati) * 100)

    kecamatan = {}
    for k in sorted(nKec):
        pk = [r for r in rows if r["kec"] == k]
        hs = [r["harga"] for r in pk]
        fasPersen, fasDasar = {}, {}
        for f in FAS_APLIKASI:
            amati = [r for r in pk if f in r["dicatat"]]
            fasPersen[f] = round(sum(1 for r in amati if f in r["fasilitas"]) / len(amati) * 100) if amati else kotaFas[f]
            fasDasar[f] = len(amati)
        kecamatan[k] = {
            "n": len(pk),
            "p10": persen(hs, 10),
            "p25": persen(hs, 25),
            "p50": persen(hs, 50),
            "p75": persen(hs, 75),
            "p90": persen(hs, 90),
            "komposisi": {j: round(sum(1 for r in pk if r["jenis"] == j) / len(pk) * 100) for j in ("putra", "putri", "campur")},
            "fasilitas": fasPersen,
            "fasilitas_dasar": fasDasar,
            "sumber": {s: sum(1 for r in pk if r["sumber"] == s) for s in ("Mamikos", "Papikost") if any(r["sumber"] == s for r in pk)},
            "berkoordinat": sum(1 for r in pk if r["lat"]),
            "keyakinan": "sedang" if len(pk) >= MIN_IKLAN_KEC else "rendah",
            # pembanding harga: seluruh kecamatan + tiap jenis kos yang ada iklannya
            "benchmark": dict(
                [("semua", ringkas(hs))]
                + [(j, ringkas([r["harga"] for r in pk if r["jenis"] == j])) for j in JENIS if any(r["jenis"] == j for r in pk)]
            ),
        }

    for r in rows:
        r.pop("dicatat", None)

    hasil = {
        "meta": {
            "sumber": "Mamikos + Papikost",
            "diambil": max(DIAMBIL.values()),
            "diambil_per_sumber": DIAMBIL,
            "n": len(rows),
            "n_sumber": {
                "Mamikos": sum(1 for r in rows if r["sumber"] == "Mamikos"),
                "Papikost": sum(1 for r in rows if r["sumber"] == "Papikost"),
            },
            "kecamatan": len(nKec),
            "min_iklan_kec": MIN_IKLAN_KEC,
            "min_pembanding": MIN_PEMBANDING,
            "berkoordinat": sum(1 for r in rows if r["lat"]),
            "ada_sisa_kamar": sum(1 for r in rows if r.get("sisa_kamar") is not None),
            "metode": "Robust Statistical Benchmarking: median, Q1, Q3, dan IQR per kecamatan x jenis kos",
            "kuantil": "interpolasi linear",
            "catatan": "Harga sewa bulanan dari iklan Mamikos dan Papikost. Luas kamar dan nomor pemilik tidak ada di kedua sumber; koordinat hanya ada di Papikost.",
        },
        "kecamatan": kecamatan,
        "kos": sorted(rows, key=lambda r: (r["kec"], r["harga"])),
    }
    io.open(KELUAR, "w", encoding="utf-8", newline="\n").write(json.dumps(hasil, ensure_ascii=False, indent=1))

    print("%d iklan sewa %s dari %d kecamatan -> %s" % (len(rows), hasil["meta"]["n_sumber"], len(nKec), os.path.relpath(KELUAR, BASE)))
    print("Papikost dilewati: %d di luar %s, %d tanpa kecamatan, %d harga di luar batas" % (luarKota, KOTA, tanpaKec, luarHarga))
    kelompok = [(k, j, b) for k, v in kecamatan.items() for j, b in v["benchmark"].items() if j != "semua"]
    prioritas = [x for x in kelompok if x[2]["n"] >= MIN_PEMBANDING]
    print("kelompok kecamatan x jenis: %d, prioritas (n>=%d): %d, mencakup %d iklan" % (len(kelompok), MIN_PEMBANDING, len(prioritas), sum(b["n"] for _, _, b in prioritas)))
    for k, j, b in sorted(prioritas, key=lambda x: -x[2]["n"]):
        print("  %-17s %-7s n=%3d  median Rp%9s  Q1-Q3 Rp%9s - Rp%9s  IQR Rp%9s" % (k, j, b["n"], format(b["median"], ","), format(b["q1"], ","), format(b["q3"], ","), format(b["iqr"], ",")))
    print("persen fasilitas dihitung dari iklan yang mencatatnya saja; contoh Mulyorejo:", kecamatan["Mulyorejo"]["fasilitas"], "dasar:", kecamatan["Mulyorejo"]["fasilitas_dasar"])


if __name__ == "__main__":
    main()
