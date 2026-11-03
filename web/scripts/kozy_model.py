# =============================================================================
# Model KOZY siap pakai — satu berkas, tanpa dependensi apa pun.
#
# Butuh dua hal saja: berkas ini + src/data/pasar.json
# (opsional: src/data/segmen.json kalau mau label segmen juga).
# Tidak perlu sklearn, numpy, atau pandas. Cukup Python bawaan.
#
# KENAPA BUKAN .pkl
# Model produksinya regresi hedonic log-linear — isinya cuma 24 koefisien,
# sekitar 821 byte. Mem-pickle objek sklearn untuk menyimpan 24 angka itu
# berlebihan, dan pickle gampang pecah kalau versi sklearn/numpy/Python
# penerimanya berbeda. Koefisiennya sudah tersimpan apa adanya di pasar.json,
# jadi modul ini cukup menjumlahkannya. Hasilnya identik dengan yang dipakai
# aplikasi web, karena rumusnya memang sama persis.
# (Kalau tetap butuh .pkl untuk antarmuka sklearn, jalankan export_model.py.)
#
# CARA PAKAI
#   from kozy_model import KozyModel
#   m = KozyModel()
#   m.harga_wajar("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"])
#   m.cek("Sukolilo", "putri", ["ac", "wifi"], harga=1_900_000)
#   m.faktor("Sukolilo", "putri", ["ac", "wifi"])
#   m.segmen("Sukolilo", "putri", ["ac", "wifi"])
#
# Coba cepat:  python scripts/kozy_model.py
# =============================================================================
import json
import math
import os

__all__ = ["KozyModel", "BATAS_WAJAR", "BATAS_PERIKSA"]

# Ambang vonis — disamakan dengan src/api/kozy.js supaya hasil Python dan
# aplikasi web tidak pernah berbeda.
BATAS_WAJAR = 15  # selisih di luar +-15% baru disebut kemahalan / murah
BATAS_PERIKSA = -30  # di bawah ini murahnya ekstrem, layak dipastikan dulu

_DIR = os.path.dirname(os.path.abspath(__file__))
_CARI_PASAR = [
    os.path.join(_DIR, "..", "src", "data", "pasar.json"),
    os.path.join(_DIR, "pasar.json"),
    "pasar.json",
    os.path.join("src", "data", "pasar.json"),
    os.path.join("web", "src", "data", "pasar.json"),
]
_bulat10rb = lambda n: int(round(n / 10_000) * 10_000)


class KozyModel:
    """Model harga wajar kos Surabaya (regresi hedonic log-linear, Ridge).

        harga = exp(intercept + efek_kecamatan + sigma efek_fasilitas + efek_jenis)

    Efek kecamatan sudah dipusatkan: 0 berarti rata-rata Surabaya, bukan
    "sama dengan kecamatan acuan".
    """

    def __init__(self, pasar=None, segmen=None):
        jalur = pasar or next((p for p in _CARI_PASAR if os.path.exists(p)), None)
        if not jalur:
            raise FileNotFoundError("pasar.json tidak ketemu. Beri jalurnya: KozyModel(pasar='.../pasar.json')")
        with open(jalur, encoding="utf-8") as f:
            self._p = json.load(f)
        self.model = self._p["model"]
        self.meta = self._p["meta"]
        self.kecamatan = self._p["kecamatan"]

        self._seg = None
        js = segmen or os.path.join(os.path.dirname(jalur), "segmen.json")
        if os.path.exists(js):
            with open(js, encoding="utf-8") as f:
                self._seg = json.load(f)

    # ---------------------------------------------------------------- dasar
    @property
    def daftar_kecamatan(self):
        return sorted(self.model["kec"])

    @property
    def daftar_fasilitas(self):
        return list(self.model["fasilitas"])

    @property
    def daftar_jenis(self):
        return list(self.model["jenis"])

    def _periksa(self, kec, jenis, fasilitas):
        if kec not in self.model["kec"]:
            raise ValueError(f"kecamatan '{kec}' belum ada datanya. Pilihan: {self.daftar_kecamatan}")
        if jenis not in self.model["jenis"]:
            raise ValueError(f"jenis '{jenis}' tidak dikenal. Pilihan: {self.daftar_jenis}")
        asing = [f for f in (fasilitas or []) if f not in self.model["fasilitas"]]
        if asing:
            raise ValueError(f"fasilitas tidak dikenal: {asing}. Pilihan: {self.daftar_fasilitas}")

    # ------------------------------------------------------------- prediksi
    def harga_wajar(self, kec, jenis="putra", fasilitas=(), bulat=True):
        """Perkiraan harga sewa sebulan yang wajar untuk kamar dengan ciri tersebut."""
        self._periksa(kec, jenis, fasilitas)
        M = self.model
        log = M["intercept"] + M["kec"][kec] + M["jenis"][jenis] + sum(M["fasilitas"][f] for f in fasilitas)
        nilai = math.exp(log)
        return _bulat10rb(nilai) if bulat else nilai

    def kisaran_wajar(self, kec, jenis="putra", fasilitas=()):
        """Rentang harga yang masih dianggap wajar (+-BATAS_WAJAR%)."""
        w = self.harga_wajar(kec, jenis, fasilitas, bulat=False)
        return (_bulat10rb(w * (1 - BATAS_WAJAR / 100)), _bulat10rb(w * (1 + BATAS_WAJAR / 100)))

    def faktor(self, kec, jenis="putra", fasilitas=()):
        """Rincian sumbangan tiap komponen terhadap harga, dalam rupiah dan persen.

        Dihitung dengan membandingkan harga lengkap terhadap harga tanpa komponen
        itu, jadi angkanya menjumlah mendekati harga akhir.
        """
        penuh = self.harga_wajar(kec, jenis, fasilitas, bulat=False)
        dasar = math.exp(self.model["intercept"] + self.model["kec"][kec])
        rinci = [{"komponen": f"Lokasi di Kec. {kec}", "rupiah": round(dasar), "persen": None}]
        for f in fasilitas:
            tanpa = self.harga_wajar(kec, jenis, [x for x in fasilitas if x != f], bulat=False)
            rinci.append({"komponen": f, "rupiah": round(penuh - tanpa), "persen": round((math.exp(self.model["fasilitas"][f]) - 1) * 100, 1)})
        if self.model["jenis"][jenis]:
            tanpa = self.harga_wajar(kec, "putra", fasilitas, bulat=False)
            rinci.append({"komponen": f"Kos {jenis}", "rupiah": round(penuh - tanpa), "persen": round((math.exp(self.model["jenis"][jenis]) - 1) * 100, 1)})
        return rinci

    # ----------------------------------------------------------------- vonis
    def cek(self, kec, jenis="putra", fasilitas=(), harga=None):
        """Bandingkan harga dari pemilik dengan harga wajar, lalu beri vonis."""
        if harga is None:
            raise ValueError("isi harga= dengan harga yang dipasang pemilik")
        wajar = self.harga_wajar(kec, jenis, fasilitas)
        selisih = harga - wajar
        persen = selisih / wajar * 100
        stat = self.kecamatan[kec]
        return {
            "harga_pemilik": harga,
            "harga_wajar": wajar,
            "kisaran_wajar": self.kisaran_wajar(kec, jenis, fasilitas),
            "selisih_rp": selisih,
            "selisih_persen": round(persen, 1),
            "status": "KEMAHALAN" if persen > BATAS_WAJAR else "MURAH" if persen < -BATAS_WAJAR else "WAJAR",
            "perlu_dipastikan": persen <= BATAS_PERIKSA,  # murah ekstrem: cek dulu sebelum transfer
            "persentil": self.persentil(harga, kec),
            "n_pembanding": stat["n"],
            "keyakinan": "tinggi" if stat["n"] >= 40 else "sedang" if stat["n"] >= 15 else "rendah",
            "segmen": self.segmen(kec, jenis, fasilitas),
        }

    def persentil(self, harga, kec):
        """Posisi harga di antara kos asli sekecamatan (1-99)."""
        hs = [k["harga"] for k in self._p["kos"] if k["kec"] == kec]
        if not hs:
            return 50
        return max(1, min(99, round(sum(1 for h in hs if h < harga) / len(hs) * 100)))

    def pasar(self, kec):
        """Sebaran harga asli di kecamatan itu (bukan hasil model)."""
        s = self.kecamatan[kec]
        return {k: s[k] for k in ("n", "p10", "p25", "p50", "p75", "p90")}

    # --------------------------------------------------------------- segmen
    def segmen(self, kec, jenis="putra", fasilitas=()):
        """Label kelompok kos (K-Prototypes). Harga sengaja tidak ikut dihitung.

        Segmen hanya MELABELI ("Kos Lengkap"); vonis wajar/mahal/murah tetap
        urusan harga_wajar(). Dipisah supaya penilaian harga tidak melingkar.
        """
        if not self._seg:
            return None
        m = self._seg["meta"]
        rata, simpang = m["standardisasi"]["rata"], m["standardisasi"]["simpang"]
        x = [((1.0 if f in fasilitas else 0.0) - rata[i]) / simpang[i] for i, f in enumerate(m["variabel_numerik"])]
        kat = [kec, jenis]
        terbaik, jarak_min = None, float("inf")
        for s in self._seg["segmen"]:
            d = sum((a - b) ** 2 for a, b in zip(x, s["pusat_numerik"]))
            d += m["gamma"] * sum(1 for a, b in zip(kat, s["pusat_kategorik"]) if a != b)
            if d < jarak_min:
                terbaik, jarak_min = s, d
        return terbaik["nama"] if terbaik else None

    def __repr__(self):
        return "KozyModel(%d iklan, %d kecamatan, MAPE %.1f%%, diambil %s)" % (
            self.meta["n"], self.meta["kecamatan"], self.meta["mape"], self.meta["diambil"])


if __name__ == "__main__":
    m = KozyModel()
    print(m, "\n")

    print("Harga wajar kos putri di Sukolilo dengan KM dalam + AC + WiFi + kasur:")
    print("  Rp %s   (kisaran wajar Rp %s - Rp %s)\n" % (
        format(m.harga_wajar("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"]), ","),
        *[format(x, ",") for x in m.kisaran_wajar("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"])]))

    print("Rincian faktor harganya:")
    for f in m.faktor("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"]):
        p = "" if f["persen"] is None else "  (%+.0f%%)" % f["persen"]
        print("  %-22s Rp %10s%s" % (f["komponen"], format(f["rupiah"], ","), p))

    print("\nCek kos yang dipasang Rp 1.900.000:")
    for k, v in m.cek("Sukolilo", "putri", ["ac", "wifi"], harga=1_900_000).items():
        print("  %-18s %s" % (k, v))

    print("\nPengaruh tiap fasilitas (exp(koefisien) - 1):")
    for f, b in sorted(m.model["fasilitas"].items(), key=lambda x: -x[1]):
        print("  %-10s %+5.0f%%" % (f, (math.exp(b) - 1) * 100))
