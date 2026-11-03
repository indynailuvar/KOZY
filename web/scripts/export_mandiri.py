# =============================================================================
# Membuat SATU berkas Python mandiri berisi model KOZY:
#   src/data/pasar.json (+ segmen.json)  ->  analysis/kozy_mandiri.py
#
# Gunanya menyelesaikan satu masalah praktis: bagaimana orang lain mencobanya.
#   - kozy_model.py  perlu 2 berkas (skrip + pasar.json)
#   - kozy_model.pkl perlu 1 berkas, tapi bisa pecah kalau beda versi pustaka
#   - berkas ini     1 berkas, tanpa dependensi, tidak bisa pecah
#
# Koefisiennya ditanam langsung di dalam berkas hasilnya, jadi penerimanya
# cukup punya Python. Tidak perlu clone repo, tidak perlu pasang apa pun,
# tidak perlu pikir versi numpy. Tinggal kirim lewat WhatsApp atau Drive.
#
# Angkanya dibaca dari pasar.json, bukan ditulis ulang, sehingga dijamin sama
# dengan yang dipakai aplikasi web.
#
# Jalankan:  python scripts/export_mandiri.py
# =============================================================================
import io
import json
import os
from datetime import date

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASAR = os.path.join(BASE, "src", "data", "pasar.json")
SEGMEN = os.path.join(BASE, "src", "data", "segmen.json")
KELUAR = os.path.join(BASE, "analysis", "kozy_mandiri.py")

KEPALA = '''"""Model harga wajar kos Surabaya (KOZY) — satu berkas, siap pakai.

Metode : regresi hedonic, bentuk log-linear, diestimasi dengan Ridge
Rumus  : harga = exp(intercept + efek_kecamatan + sigma efek_fasilitas + efek_jenis)
Data   : {n} iklan sewa ({sumber}), {nkec} kecamatan, diambil {tgl}
Meleset: rata-rata {mape}% (MAPE, uji silang 5 lipat) atau sekitar Rp {mae}

TIDAK PERLU PASANG APA PUN. Cukup Python 3. Tanpa numpy, pandas, sklearn.

Cara pakai:
    python kozy_mandiri.py                      # lihat contoh

    from kozy_mandiri import harga_wajar, cek, segmen
    harga_wajar("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"])
    cek("Sukolilo", "putri", ["ac"], harga=1_900_000)

Cara baca koefisien: exp(b) - 1 = pengaruh dalam persen.
    ac 0,457  ->  exp(0,457) - 1 = 0,58  ->  AC menaikkan harga 58%

Dibuat otomatis oleh scripts/export_mandiri.py pada {dibuat}. Jangan diedit tangan —
kalau modelnya dilatih ulang, jalankan lagi skrip itu.
"""
import math

'''

BADAN = '''

# Ambang vonis, disamakan dengan aplikasi web
BATAS_WAJAR = 15      # di luar +-15% baru disebut kemahalan / murah
BATAS_PERIKSA = -30   # di bawah ini murahnya ekstrem, pastikan dulu sebelum transfer

_bulat = lambda n: int(round(n / 10_000) * 10_000)

KECAMATAN = sorted(KEC)
FASILITAS = list(FAS)
JENIS = list(JEN)


def harga_wajar(kecamatan, jenis="putra", fasilitas=(), bulat=True):
    """Perkiraan harga sewa sebulan yang wajar untuk kamar dengan ciri tersebut."""
    if kecamatan not in KEC:
        raise ValueError("kecamatan '%s' belum ada datanya. Pilihan: %s" % (kecamatan, KECAMATAN))
    if jenis not in JEN:
        raise ValueError("jenis '%s' tidak dikenal. Pilihan: %s" % (jenis, JENIS))
    asing = [f for f in fasilitas if f not in FAS]
    if asing:
        raise ValueError("fasilitas tidak dikenal: %s. Pilihan: %s" % (asing, FASILITAS))
    log = INTERCEPT + KEC[kecamatan] + JEN[jenis] + sum(FAS[f] for f in fasilitas)
    nilai = math.exp(log)
    return _bulat(nilai) if bulat else nilai


def kisaran_wajar(kecamatan, jenis="putra", fasilitas=()):
    """Rentang harga yang masih dianggap wajar."""
    w = harga_wajar(kecamatan, jenis, fasilitas, bulat=False)
    return (_bulat(w * (1 - BATAS_WAJAR / 100)), _bulat(w * (1 + BATAS_WAJAR / 100)))


def faktor(kecamatan, jenis="putra", fasilitas=()):
    """Rincian sumbangan tiap komponen terhadap harga."""
    penuh = harga_wajar(kecamatan, jenis, fasilitas, bulat=False)
    rinci = [("Lokasi di Kec. " + kecamatan, round(math.exp(INTERCEPT + KEC[kecamatan])), None)]
    for f in fasilitas:
        tanpa = harga_wajar(kecamatan, jenis, [x for x in fasilitas if x != f], bulat=False)
        rinci.append((f, round(penuh - tanpa), round((math.exp(FAS[f]) - 1) * 100, 1)))
    if JEN[jenis]:
        tanpa = harga_wajar(kecamatan, "putra", fasilitas, bulat=False)
        rinci.append(("Kos " + jenis, round(penuh - tanpa), round((math.exp(JEN[jenis]) - 1) * 100, 1)))
    return rinci


def segmen(kecamatan, jenis="putra", fasilitas=()):
    """Label kelompok kos. Harga sengaja TIDAK ikut dihitung, supaya penilaian
    kewajaran harga tidak melingkar: segmen MELABELI, harga_wajar MEMVONIS."""
    if not SEGMEN:
        return None
    rata, simpang = SEGMEN["rata"], SEGMEN["simpang"]
    x = [((1.0 if f in fasilitas else 0.0) - rata[i]) / simpang[i] for i, f in enumerate(SEGMEN["numerik"])]
    kat = [kecamatan, jenis]
    terbaik, jmin = None, float("inf")
    for s in SEGMEN["pusat"]:
        d = sum((a - b) ** 2 for a, b in zip(x, s["num"]))
        d += SEGMEN["gamma"] * sum(1 for a, b in zip(kat, s["kat"]) if a != b)
        if d < jmin:
            terbaik, jmin = s, d
    return terbaik["nama"] if terbaik else None


def persentil(harga, kecamatan):
    """Posisi harga di antara kos asli sekecamatan (1-99)."""
    hs = PASAR_KEC.get(kecamatan, {}).get("harga", [])
    if not hs:
        return 50
    return max(1, min(99, round(sum(1 for h in hs if h < harga) / len(hs) * 100)))


def cek(kecamatan, jenis="putra", fasilitas=(), harga=None):
    """Bandingkan harga dari pemilik dengan harga wajar, lalu beri vonis."""
    if harga is None:
        raise ValueError("isi harga= dengan harga yang dipasang pemilik")
    wajar = harga_wajar(kecamatan, jenis, fasilitas)
    selisih = harga - wajar
    persen = selisih / wajar * 100
    n = PASAR_KEC.get(kecamatan, {}).get("n", 0)
    return {
        "harga_pemilik": harga,
        "harga_wajar": wajar,
        "kisaran_wajar": kisaran_wajar(kecamatan, jenis, fasilitas),
        "selisih_rp": selisih,
        "selisih_persen": round(persen, 1),
        "status": "KEMAHALAN" if persen > BATAS_WAJAR else "MURAH" if persen < -BATAS_WAJAR else "WAJAR",
        "perlu_dipastikan": persen <= BATAS_PERIKSA,
        "persentil": persentil(harga, kecamatan),
        "n_pembanding": n,
        "keyakinan": "tinggi" if n >= 40 else "sedang" if n >= 15 else "rendah",
        "segmen": segmen(kecamatan, jenis, fasilitas),
    }


if __name__ == "__main__":
    rp = lambda v: "Rp " + format(int(v), ",").replace(",", ".")
    print(__doc__.split("Cara pakai:")[0].strip())
    print()
    print("Kecamatan tersedia:", ", ".join(KECAMATAN))
    print("Fasilitas tersedia:", ", ".join(FASILITAS))
    print("Jenis tersedia    :", ", ".join(JENIS))
    print()

    contoh = ("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"])
    lo, hi = kisaran_wajar(*contoh)
    print("Contoh: kos %s di %s, fasilitas %s" % (contoh[1], contoh[0], ", ".join(contoh[2])))
    print("  harga wajar  : %s   (kisaran %s - %s)" % (rp(harga_wajar(*contoh)), rp(lo), rp(hi)))
    print("  segmen       : %s" % segmen(*contoh))
    print()
    print("  rincian faktornya:")
    for nama, nilai, pct in faktor(*contoh):
        print("    %-24s %12s%s" % (nama, rp(nilai), "" if pct is None else "  (%+.0f%%)" % pct))
    print()

    print("Kalau pemilik memasang Rp 1.900.000:")
    for k, v in cek(contoh[0], contoh[1], contoh[2], harga=1_900_000).items():
        print("  %-18s %s" % (k, v))
    print()
    print("Pengaruh tiap fasilitas:")
    for f, b in sorted(FAS.items(), key=lambda x: -x[1]):
        print("  %-10s %+5.0f%%" % (f, (math.exp(b) - 1) * 100))
'''


def main():
    pasar = json.load(io.open(PASAR, encoding="utf-8"))
    M, meta = pasar["model"], pasar["meta"]

    seg = None
    if os.path.exists(SEGMEN):
        s = json.load(io.open(SEGMEN, encoding="utf-8"))
        seg = {
            "gamma": s["meta"]["gamma"],
            "numerik": s["meta"]["variabel_numerik"],
            "rata": s["meta"]["standardisasi"]["rata"],
            "simpang": s["meta"]["standardisasi"]["simpang"],
            "pusat": [{"nama": x["nama"], "num": x["pusat_numerik"], "kat": x["pusat_kategorik"]} for x in s["segmen"]],
        }

    # harga asli per kecamatan, dipakai menghitung persentil
    perKec = {}
    for k in pasar["kos"]:
        perKec.setdefault(k["kec"], []).append(k["harga"])
    pasarKec = {k: {"n": len(v), "harga": sorted(v)} for k, v in sorted(perKec.items())}

    tulis = lambda nama, obj: "%s = %s\n\n" % (nama, json.dumps(obj, ensure_ascii=False, indent=0).replace("\n", " "))
    isi = KEPALA.format(
        n=meta["n"], sumber=meta["sumber"], nkec=meta["kecamatan"], tgl=meta["diambil"],
        mape=meta["mape"], mae=format(meta["mae"], ",").replace(",", "."), dibuat=date.today(),
    )
    isi += "# ---- koefisien model, dibaca dari pasar.json ----\n"
    isi += "INTERCEPT = %r\n\n" % M["intercept"]
    isi += tulis("KEC", M["kec"]) + tulis("FAS", M["fasilitas"]) + tulis("JEN", M["jenis"])
    isi += "# ---- sebaran harga asli per kecamatan, untuk persentil ----\n"
    isi += tulis("PASAR_KEC", pasarKec)
    isi += "# ---- pusat cluster segmentasi (K-Prototypes, tanpa harga) ----\n"
    isi += tulis("SEGMEN", seg)
    isi += BADAN

    os.makedirs(os.path.dirname(KELUAR), exist_ok=True)
    io.open(KELUAR, "w", encoding="utf-8", newline="\n").write(isi)

    # --- uji: jalankan hasilnya, bandingkan dengan pasar.json -------------
    ruang = {}
    exec(compile(isi, KELUAR, "exec"), ruang)
    import math as _m

    contoh = ("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"])
    dari_mandiri = ruang["harga_wajar"](*contoh, bulat=False)
    dari_json = _m.exp(M["intercept"] + M["kec"][contoh[0]] + M["jenis"][contoh[1]] + sum(M["fasilitas"][f] for f in contoh[2]))
    assert abs(dari_mandiri - dari_json) < 1e-9, "hasil tidak cocok dengan pasar.json"

    kb = os.path.getsize(KELUAR) / 1024
    print("tersimpan: %s  (%.0f KB, %d baris)" % (os.path.relpath(KELUAR, BASE), kb, isi.count("\n")))
    print("uji jalan: cocok dengan pasar.json (Rp %s)" % format(int(round(dari_mandiri, -4)), ","))
    print("isinya   : %d kecamatan, %d fasilitas, %d jenis, %s" % (
        len(M["kec"]), len(M["fasilitas"]), len(M["jenis"]), "segmentasi ikut" if seg else "tanpa segmentasi"))
    print()
    print("Kirim SATU berkas ini ke siapa pun. Penerimanya cukup punya Python,")
    print("tidak perlu pasang apa pun, tidak perlu clone repo:")
    print("    python kozy_mandiri.py")


if __name__ == "__main__":
    main()
