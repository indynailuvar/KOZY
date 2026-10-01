# =============================================================================
# Melatih model harga sewa dan menyiapkan data pasar untuk frontend:
#   data/mamikos_bersih.csv      (240 iklan, harga + fasilitas, tanpa koordinat)
#   ../papikost_surabaya_71.json (71 iklan, harga + fasilitas + koordinat)
#     -> src/data/pasar.json
#
# Kedua sumber sama-sama iklan SEWA BULANAN, jadi boleh digabung. Data OLX
# sengaja tidak ikut: isinya rumah kos yang DIJUAL (miliaran), bukan sewa.
#
# Tiga keputusan penting, semuanya diuji dengan uji silang lebih dulu:
#
# 1. Fasilitas yang dipakai hanya enam yang dicatat Mamikos. Papikost memang
#    mencatat lemari, meja belajar, dan parkir, tetapi hampir semua iklannya
#    punya fasilitas itu, jadi pengaruhnya tidak bisa dipisahkan dan malah
#    memperburuk tebakan (MAPE naik dari 21,7% ke 22,7%). Datanya tetap
#    disimpan di `fasilitas_lain` untuk ditampilkan, bukan untuk menghitung.
#
# 2. Penanda situs dipakai untuk menyerap beda tingkat harga antar situs.
#    Penanda ini sekaligus menggantikan penanda "fasilitas tidak tercatat":
#    keduanya bernilai sama persis, jadi kalau dipasang dua-duanya kolomnya
#    berlebih dan koefisiennya jadi ngawur.
#
# 3. Kecamatan dengan iklan < 5 tidak diberi koefisien sendiri (tebakannya
#    terlalu goyah), melainkan digabung jadi satu kelompok "lainnya".
#
# Koefisien kecamatan dipusatkan: 0 berarti "rata-rata Surabaya", bukan
# "sama dengan kecamatan acuan". Penanda situs dilipat ke intercept pada
# proporsi sampelnya, sehingga frontend tetap memakai rumus yang sama:
#   harga = exp(intercept + efek_kecamatan + sigma efek_fasilitas + efek_jenis)
#
# Jalankan:  python scripts/build_pasar.py   (perlu scripts/geocode_titik.py dulu)
# =============================================================================
import csv
import io
import json
import os
import re

import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AKAR = os.path.dirname(BASE)
MAMIKOS_CSV = os.path.join(BASE, "data", "mamikos_bersih.csv")
PAPIKOST_JSON = os.path.join(AKAR, "papikost_surabaya_71.json")
GEOCODE = os.path.join(BASE, "data", "geocode_cache.json")
KELUAR = os.path.join(BASE, "src", "data", "pasar.json")
DIAMBIL = {"Mamikos": "2026-09-16", "Papikost": "2026-09-29"}

BATAS_HARGA = (200_000, 10_000_000)  # di luar ini bukan sewa bulanan yang wajar
KOTA = "Surabaya"
MIN_IKLAN_KEC = 5  # di bawah ini kecamatan ikut kelompok "lainnya"

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
FAS_LAIN = ["lemari", "meja", "pmotor", "pmobil", "tv", "dispenser"]  # dicatat, tidak dimodelkan
JENIS_CSV = {"Putra": "putra", "Putri": "putri", "Campur": "campur"}
JENIS_LAIN = ["putri", "campur"]  # putra jadi acuan


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


def ujiSilang(X, y, lipat=5, ulang=5):
    mae, mape = [], []
    for s in range(ulang):
        idx = np.arange(len(y))
        np.random.default_rng(7 + s).shuffle(idx)
        for f in range(lipat):
            uji = idx[f::lipat]
            latih = np.setdiff1d(idx, uji)
            b, *_ = np.linalg.lstsq(X[latih], np.log(y[latih]), rcond=None)
            p = np.exp(X[uji] @ b)
            mae.append(np.abs(y[uji] - p).mean())
            mape.append(np.mean(np.abs(y[uji] - p) / y[uji]) * 100)
    return float(np.mean(mae)), float(np.mean(mape))


def persen(v, q):
    v = sorted(v)
    return int(v[max(0, min(len(v) - 1, round(q / 100 * (len(v) - 1))))])


def main():
    mami = bacaMamikos()
    papi, tanpaKec, luarKota, luarHarga = bacaPapikost()
    rows = buangKembar(mami + papi)

    nKec = {}
    for r in rows:
        nKec[r["kec"]] = nKec.get(r["kec"], 0) + 1
    besar = sorted(k for k, n in nKec.items() if n >= MIN_IKLAN_KEC)
    kecil = sorted(k for k, n in nKec.items() if n < MIN_IKLAN_KEC)
    acuan, kolomKec = besar[0], besar[1:]

    # --- rancang matriks ----------------------------------------------------
    namaKolom = ["intercept"] + ["kec:" + k for k in kolomKec] + ["kec:lainnya"]
    namaKolom += ["fas:" + f for f in FAS_APLIKASI] + ["jenis:" + j for j in JENIS_LAIN] + ["situs:Papikost"]
    X = []
    for r in rows:
        v = [1.0] + [1.0 if r["kec"] == k else 0.0 for k in kolomKec] + [1.0 if r["kec"] in kecil else 0.0]
        v += [1.0 if f in r["fasilitas"] else 0.0 for f in FAS_APLIKASI]
        v += [1.0 if r["jenis"] == j else 0.0 for j in JENIS_LAIN]
        v += [1.0 if r["sumber"] == "Papikost" else 0.0]
        X.append(v)
    X = np.array(X)
    y = np.array([r["harga"] for r in rows], dtype=float)
    assert np.linalg.matrix_rank(X) == X.shape[1], "ada kolom berlebih di matriks"

    beta, *_ = np.linalg.lstsq(X, np.log(y), rcond=None)
    koef = dict(zip(namaKolom, (float(b) for b in beta)))
    r2 = 1 - ((np.log(y) - X @ beta) ** 2).sum() / ((np.log(y) - np.log(y).mean()) ** 2).sum()
    mae, mape = ujiSilang(X, y)

    # --- pusatkan efek kecamatan: 0 = rata-rata Surabaya --------------------
    mentah = {acuan: 0.0}
    for k in kolomKec:
        mentah[k] = koef["kec:" + k]
    for k in kecil:
        mentah[k] = koef["kec:lainnya"]
    total = sum(nKec.values())
    geser = sum(mentah[k] * nKec[k] / total for k in nKec)
    efekKec = {k: mentah[k] - geser for k in sorted(nKec)}

    # penanda situs dilipat ke intercept pada proporsi sampelnya
    bagianPapikost = sum(1 for r in rows if r["sumber"] == "Papikost") / len(rows)
    lipat = koef["situs:Papikost"] * bagianPapikost

    model = {
        "bentuk": "log-linear",
        "intercept": koef["intercept"] + geser + lipat,
        "kec": efekKec,
        "fasilitas": {f: koef["fas:" + f] for f in FAS_APLIKASI},
        "jenis": dict([("putra", 0.0)] + [(j, koef["jenis:" + j]) for j in JENIS_LAIN]),
    }

    # --- sebaran asli tiap kecamatan ---------------------------------------
    # Persentase fasilitas hanya boleh dihitung dari iklan yang situsnya memang
    # mencatat fasilitas itu. Papikost tidak mencatat kloset dan akses 24 jam, jadi
    # kalau ikut dihitung, kecamatan yang datanya cuma dari Papikost akan terlihat 0%
    # padahal artinya "tidak diketahui". Angka ini juga dipakai build_gmaps.py untuk
    # memperkirakan harga, jadi salah di sini ikut menyeret perkiraan harga.
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
            "kecamatan_kuat": len(besar),
            "min_iklan_kec": MIN_IKLAN_KEC,
            "berkoordinat": sum(1 for r in rows if r["lat"]),
            "ada_sisa_kamar": sum(1 for r in rows if r.get("sisa_kamar") is not None),
            "mae": int(round(mae, -3)),
            "mape": round(mape, 1),
            "r2_log": round(float(r2), 3),
            "catatan": "Harga sewa bulanan dari iklan Mamikos dan Papikost. Luas kamar dan nomor pemilik tidak ada di kedua sumber; koordinat hanya ada di Papikost.",
        },
        "model": model,
        "model_penuh": {
            "koefisien": koef,
            "efek_kec_sebelum_dipusatkan": mentah,
            "pergeseran_pusat": float(geser),
            "bagian_papikost": float(bagianPapikost),
            "kecamatan_kelompok_lainnya": kecil,
            "catatan": "Model apa adanya sebelum diringkas. Untuk pemeriksaan, bukan dipakai aplikasi.",
        },
        "kecamatan": kecamatan,
        "kos": sorted(rows, key=lambda r: (r["kec"], r["harga"])),
    }
    io.open(KELUAR, "w", encoding="utf-8", newline="\n").write(json.dumps(hasil, ensure_ascii=False, indent=1))

    print("%d iklan sewa %s dari %d kecamatan -> %s" % (len(rows), hasil["meta"]["n_sumber"], len(nKec), os.path.relpath(KELUAR, BASE)))
    print("Papikost dilewati: %d di luar %s, %d tanpa kecamatan, %d harga di luar batas" % (luarKota, KOTA, tanpaKec, luarHarga))
    print("R2(log)=%.3f  MAE uji silang=Rp%s  MAPE=%.1f%%  |  %d iklan berkoordinat" % (r2, format(int(mae), ","), mape, hasil["meta"]["berkoordinat"]))
    print("kecamatan berkoefisien sendiri (n>=%d): %s" % (MIN_IKLAN_KEC, besar))
    print("kecamatan kelompok 'lainnya': %s" % kecil)
    print("pengaruh fasilitas:", {f: "%+.0f%%" % ((np.exp(koef["fas:" + f]) - 1) * 100) for f in FAS_APLIKASI})
    print("persen fasilitas dihitung dari iklan yang mencatatnya saja; contoh Mulyorejo:", kecamatan["Mulyorejo"]["fasilitas"], "dasar:", kecamatan["Mulyorejo"]["fasilitas_dasar"])
    print("pengaruh jenis:", {j: "%+.0f%%" % ((np.exp(model["jenis"][j]) - 1) * 100) for j in model["jenis"]})
    print("beda situs Papikost vs Mamikos: %+.1f%%" % ((np.exp(koef["situs:Papikost"]) - 1) * 100))
    print("efek kecamatan (0 = rata-rata kota):", {k: "%+.0f%%" % ((np.exp(v) - 1) * 100) for k, v in sorted(efekKec.items(), key=lambda x: -x[1])})


if __name__ == "__main__":
    main()
