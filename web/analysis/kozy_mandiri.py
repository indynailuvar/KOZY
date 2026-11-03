"""Model harga wajar kos Surabaya (KOZY) — satu berkas, siap pakai.

Metode : regresi hedonic, bentuk log-linear, diestimasi dengan Ridge
Rumus  : harga = exp(intercept + efek_kecamatan + sigma efek_fasilitas + efek_jenis)
Data   : 307 iklan sewa (Mamikos + Papikost), 14 kecamatan, diambil 2026-09-29
Meleset: rata-rata 20.8% (MAPE, uji silang 5 lipat) atau sekitar Rp 277.000

TIDAK PERLU PASANG APA PUN. Cukup Python 3. Tanpa numpy, pandas, sklearn.

Cara pakai:
    python kozy_mandiri.py                      # lihat contoh

    from kozy_mandiri import harga_wajar, cek, segmen
    harga_wajar("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"])
    cek("Sukolilo", "putri", ["ac"], harga=1_900_000)

Cara baca koefisien: exp(b) - 1 = pengaruh dalam persen.
    ac 0,457  ->  exp(0,457) - 1 = 0,58  ->  AC menaikkan harga 58%

Dibuat otomatis oleh scripts/export_mandiri.py pada 2026-10-13. Jangan diedit tangan —
kalau modelnya dilatih ulang, jalankan lagi skrip itu.
"""
import math

# ---- koefisien model, dibaca dari pasar.json ----
INTERCEPT = 13.377467981071412

KEC = { "Gayungan": 0.12464738444502377, "Gubeng": -0.02083749763917357, "Gunung Anyar": 0.12464738444502377, "Lakarsantri": 0.12464738444502377, "Mulyorejo": 0.12464738444502377, "Rungkut": -0.049617505327796255, "Sambikerep": 0.12464738444502377, "Sawahan": 0.12464738444502377, "Sukolilo": 0.011980777369577169, "Tambaksari": 0.12464738444502377, "Tegalsari": 0.12464738444502377, "Tenggilis Mejoyo": -0.09844202102243318, "Wonocolo": 0.05799950184671908, "Wonokromo": -0.033869003849945525 }

FAS = { "km": 0.24469980532506844, "ac": 0.4189634154576745, "wifi": 0.05199991453296824, "kasur": 0.09143824578776531, "kloset": 0.10767858896025959, "akses24": -0.005521614791507846 }

JEN = { "putra": 0.0, "putri": -0.04430039486683993, "campur": 0.1567136832831615 }

# ---- sebaran harga asli per kecamatan, untuk persentil ----
PASAR_KEC = { "Gayungan": { "n": 3, "harga": [ 2300000, 2500000, 2500000 ] }, "Gubeng": { "n": 54, "harga": [ 500000, 550000, 600000, 650000, 650000, 700000, 700000, 700000, 800000, 800000, 852000, 900000, 900000, 900000, 900000, 925000, 950000, 1000000, 1000000, 1100000, 1150000, 1200000, 1200000, 1200000, 1200000, 1225000, 1300000, 1300000, 1300000, 1300000, 1350000, 1400000, 1400000, 1400000, 1500000, 1500000, 1500000, 1500000, 1500010, 1525000, 1525000, 1655000, 1700000, 1750000, 1800000, 1850000, 1950000, 2000000, 2200000, 2500000, 2500000, 2515000, 3000000, 4000000 ] }, "Gunung Anyar": { "n": 4, "harga": [ 800000, 1000000, 1000000, 1500000 ] }, "Lakarsantri": { "n": 2, "harga": [ 800000, 800000 ] }, "Mulyorejo": { "n": 2, "harga": [ 2000000, 2750000 ] }, "Rungkut": { "n": 17, "harga": [ 650000, 700000, 750000, 800000, 1000000, 1000000, 1000000, 1000000, 1300000, 1325000, 1400000, 1500000, 1600000, 1650000, 1850000, 1850000, 1850000 ] }, "Sambikerep": { "n": 4, "harga": [ 600000, 1200000, 1850000, 2700000 ] }, "Sawahan": { "n": 3, "harga": [ 500000, 1600000, 2000000 ] }, "Sukolilo": { "n": 107, "harga": [ 450000, 450000, 500000, 500000, 550000, 550000, 575000, 600000, 600000, 600000, 600000, 625000, 650000, 650000, 650000, 675000, 680000, 680000, 700000, 700000, 700000, 725000, 750000, 750000, 750000, 750000, 753000, 775000, 775000, 800000, 800000, 800000, 800000, 800000, 800000, 800000, 803000, 825000, 860000, 900000, 900000, 900000, 900000, 950000, 950000, 975000, 975000, 975000, 1000000, 1000000, 1000000, 1000000, 1000000, 1100000, 1180000, 1200000, 1200000, 1250000, 1250000, 1250000, 1250000, 1300000, 1300000, 1300000, 1300000, 1300000, 1400000, 1400000, 1400000, 1400000, 1400000, 1400000, 1400000, 1500000, 1500000, 1500000, 1500001, 1520000, 1550000, 1550000, 1550000, 1600000, 1600000, 1675000, 1700000, 1750000, 1750000, 1750000, 1800000, 1800000, 1800000, 1900000, 1950000, 2000000, 2000000, 2000000, 2200000, 2200000, 2225000, 2300000, 2300000, 2300000, 2300000, 2500000, 3000000, 3000000, 3250000 ] }, "Tambaksari": { "n": 4, "harga": [ 800000, 900000, 1000000, 1300000 ] }, "Tegalsari": { "n": 1, "harga": [ 1750000 ] }, "Tenggilis Mejoyo": { "n": 18, "harga": [ 575000, 575000, 600000, 600000, 650000, 800000, 850000, 875000, 950000, 1050000, 1100000, 1200000, 1200000, 1300000, 1300000, 1500000, 2300000, 3000000 ] }, "Wonocolo": { "n": 28, "harga": [ 800000, 800000, 1050000, 1050000, 1100000, 1125000, 1400000, 1500000, 1500000, 1500000, 1502500, 1600000, 1625000, 1700000, 1700000, 1700000, 1702500, 1775000, 1800000, 1900000, 1900000, 2000000, 2000000, 2025000, 2300000, 2400000, 2500000, 3000000 ] }, "Wonokromo": { "n": 60, "harga": [ 350000, 575000, 600000, 600000, 632500, 650000, 650000, 650000, 700000, 700000, 725000, 725000, 750000, 750000, 750000, 794500, 900000, 900001, 980000, 1000000, 1000000, 1000000, 1000000, 1000000, 1100000, 1100000, 1100000, 1100000, 1200000, 1200000, 1300000, 1300000, 1400000, 1400000, 1400000, 1400000, 1400000, 1400000, 1500000, 1500000, 1500000, 1500000, 1500000, 1500000, 1500000, 1500000, 1550000, 1600000, 1700000, 1700000, 1700123, 1750000, 1800000, 1800000, 1800000, 1900000, 1900000, 2000000, 2100000, 2300000 ] } }

# ---- pusat cluster segmentasi (K-Prototypes, tanpa harga) ----
SEGMEN = { "gamma": 0.49999999999999994, "numerik": [ "km", "ac", "wifi", "kasur" ], "rata": [ 0.5439739413680782, 0.6319218241042345, 0.9022801302931596, 0.9771986970684039 ], "simpang": [ 0.4980625387243609, 0.4822827306933263, 0.29693550944829494, 0.14926956661093924 ], "pusat": [ { "nama": "Kos Lengkap", "num": [ 0.03130700348488021, 0.08202309098488508, 0.3290945898939592, 0.03182672478532169 ], "kat": [ "Sukolilo", "putri" ] }, { "nama": "Kos Dasar", "num": [ -0.28906799884372886, -0.7573465400937739, -3.038640046687552, -0.2938667588511369 ], "kat": [ "Sukolilo", "putra" ] } ] }



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
