"""
Tiga komponen fitur eksklusif KOZY (paket Rp19.900 sekali bayar) + forecast pendapatan.
Tidak ada regresi di sini, dan fasilitas 0/1 tidak dipakai sebagai variabel model.

1. Kelas harga   : K-Prototypes (Huang, 1997) — numerik log harga, kategorik kecamatan + jenis.
                   Kos baru dimasukkan ke prototipe terdekat dengan jarak campuran yang sama.
2. Gap A vs B    : selisih harga & jarak dalam satuan IQR pasar, posisi persentil harga di
                   kelasnya (distribusi empiris), lalu TOPSIS untuk rekomendasi.
3. Forecast      : simulasi Monte Carlo funnel. Konversi ~ Beta (prior + data aktivitas),
                   pembeli per bulan ~ Poisson(pengunjung × indeks musiman × konversi).

Parameter (prototipe, sebaran pasar, indeks musiman) dibuat oleh
web/scripts/build_premium.py dan dibaca dari kelas.json, gap_ab.json, forecast_kozy.json.
Logika yang sama ada di web/src/api/premium.js untuk mode tanpa backend.
"""

import math
from bisect import bisect_left
from typing import Dict, List, Optional

import numpy as np

HARGA_EKSKLUSIF = 19_900


# ----------------------------------------------------------------- 1. Kelas harga
def kelas_kos(model: dict, harga: float, kec: Optional[str] = None, jenis: Optional[str] = None) -> dict:
    """Masukkan satu kos ke prototipe K-Prototypes terdekat.

    Jarak = (z_harga - pusat)^2 + gamma * [kec != modus] + gamma * [jenis != modus].
    Kalau kecamatan/jenis tidak diketahui, sukunya dilewati (sama besar untuk semua prototipe).
    """
    p = model["param"]
    z = (math.log(max(harga, 1)) - p["log_mean"]) / p["log_std"]
    kec_g = None
    if kec:
        kec_g = kec if kec in p["kec_dikenal"] else "lain"
    jarak = []
    for pr in model["prototipe"]:
        d = (z - pr["z"]) ** 2
        if kec_g is not None:
            d += p["gamma"] * (kec_g != pr["kec"])
        if jenis:
            d += p["gamma"] * (jenis != pr["jenis"])
        jarak.append(d)
    urut = sorted(range(len(jarak)), key=lambda i: jarak[i])
    pilih = model["prototipe"][urut[0]]
    kls = next(k for k in model["kelas"] if k["id"] == pilih["id"])
    return {
        "id": kls["id"],
        "label": kls["label"],
        "jarak": [{"id": model["prototipe"][i]["id"], "nilai": round(jarak[i], 3)} for i in range(len(jarak))],
        # selisih jarak ke prototipe kedua terdekat: makin kecil, makin dekat ke batas kelas
        "margin": round(jarak[urut[1]] - jarak[urut[0]], 3) if len(urut) > 1 else None,
        "persentil": persentil(kls["harga_urut"], harga),
        "rentang": [kls["harga"]["min"], kls["harga"]["max"]],
        "median": kls["harga"]["p50"],
        "n": kls["n"],
        "pakai_kec": kec_g is not None,
        "pakai_jenis": bool(jenis),
    }


def persentil(urut: List[float], nilai: float) -> int:
    """Persentil empiris: porsi anggota kelas yang harganya lebih murah."""
    if not urut:
        return 50
    return max(1, min(99, round(bisect_left(urut, nilai) / len(urut) * 100)))


# ----------------------------------------------------------------- 2. Gap A vs B
def topsis(alternatif: List[Dict[str, float]], bobot: Dict[str, float]) -> List[float]:
    """TOPSIS (Hwang & Yoon, 1981) untuk kriteria biaya (makin kecil makin baik).

    Kriteria yang nilainya tidak lengkap dibuang dan bobotnya dinormalkan ulang.
    Mengembalikan koefisien kedekatan (0–1) per alternatif.
    """
    krit = [c for c, w in bobot.items() if w > 0 and all(a.get(c) is not None for a in alternatif)]
    if not krit:
        return [0.5] * len(alternatif)
    total = sum(bobot[c] for c in krit)
    w = {c: bobot[c] / total for c in krit}
    norm = {c: math.sqrt(sum(a[c] ** 2 for a in alternatif)) or 1 for c in krit}
    v = [{c: w[c] * a[c] / norm[c] for c in krit} for a in alternatif]
    ideal = {c: min(x[c] for x in v) for c in krit}  # biaya: terbaik = terkecil
    anti = {c: max(x[c] for x in v) for c in krit}
    hasil = []
    for x in v:
        dp = math.sqrt(sum((x[c] - ideal[c]) ** 2 for c in krit))
        dm = math.sqrt(sum((x[c] - anti[c]) ** 2 for c in krit))
        hasil.append(0.5 if dp + dm == 0 else dm / (dp + dm))
    return hasil


def gap_ab(model_kelas: dict, gap: dict, a: dict, b: dict, prioritas: str = "seimbang") -> dict:
    """Bandingkan dua kos hanya dengan variabel kontinu: harga (Rp) dan jarak (km).

    Harga None = belum diketahui (kos Google Maps). Harganya tidak ditaksir — uji leave-one-out
    menunjukkan taksiran dari kos sekitar tidak lebih baik dari median kota — jadi gap harga & kelas
    dilewati dan TOPSIS memakai jarak saja.
    """
    skala = gap["skala"]
    hasil = {}
    for kunci, kos in (("a", a), ("b", b)):
        kls = kelas_kos(model_kelas, kos["harga"], kos.get("kec"), kos.get("jenis")) if kos.get("harga") is not None else None
        hasil[kunci] = {**kos, "kelas": kls}

    harga = None
    if a.get("harga") is not None and b.get("harga") is not None:
        d_harga = b["harga"] - a["harga"]
        harga = {
            "selisih_rp": round(d_harga),
            "selisih_persen": round(d_harga / a["harga"] * 100, 1),
            "selisih_iqr": round(d_harga / skala["harga"]["iqr"], 2),
            "setahun_rp": round(d_harga * 12),
        }
    jarak = None
    if a.get("jarak") is not None and b.get("jarak") is not None:
        d_jarak = b["jarak"] - a["jarak"]
        jarak = {"selisih_km": round(d_jarak, 2), "selisih_iqr": round(d_jarak / skala["jarak"]["iqr"], 2)}

    bobot = gap["topsis"]["bobot"].get(prioritas) or gap["topsis"]["bobot"]["seimbang"]
    cc = topsis([{"harga": a["harga"], "jarak": a.get("jarak")}, {"harga": b["harga"], "jarak": b.get("jarak")}], bobot)
    menang = "a" if cc[0] >= cc[1] else "b"
    return {
        "a": hasil["a"],
        "b": hasil["b"],
        "gap": {
            "harga": harga,
            "jarak": jarak,
            "persentil_poin": hasil["b"]["kelas"]["persentil"] - hasil["a"]["kelas"]["persentil"] if hasil["a"]["kelas"] and hasil["b"]["kelas"] else None,
        },
        "topsis": {"prioritas": prioritas, "bobot": bobot, "skor": {"a": round(cc[0], 3), "b": round(cc[1], 3)}, "menang": menang, "pakai_jarak": jarak is not None, "pakai_harga": harga is not None},
        "uji_pasar": gap["uji_jarak_harga"],
    }


# ----------------------------------------------------------------- 3. Forecast
def simulasi_pendapatan(
    indeks: List[float],
    bulan_mulai: int,
    pengunjung_awal: float,
    pertumbuhan: float,
    prior_a: float,
    prior_b: float,
    sesi: int = 0,
    pembeli: int = 0,
    harga: int = HARGA_EKSKLUSIF,
    horizon: int = 12,
    draws: int = 10_000,
    seed: int = 7,
) -> dict:
    """Monte Carlo funnel pengunjung -> pembeli.

    konversi p ~ Beta(prior_a + pembeli, prior_b + sesi - pembeli)    (Beta-Binomial konjugat)
    pengunjung_t ~ Poisson(lambda_t),  lambda_t = pengunjung_awal * (1+g)^t * indeks[bulan_t]
    pembeli_t | p ~ Poisson(lambda_t * p)   (penipisan Poisson: Binomial(Poisson(λ), p) = Poisson(λp))
    pendapatan_t = pembeli_t * harga        (sekali bayar: tiap pembeli membayar satu kali)
    """
    rng = np.random.default_rng(seed)
    pembeli = max(0, min(pembeli, sesi))
    a_post, b_post = prior_a + pembeli, prior_b + sesi - pembeli
    p = rng.beta(a_post, b_post, draws)
    bulan = [(bulan_mulai + t) % 12 for t in range(horizon)]
    lam = np.array([pengunjung_awal * (1 + pertumbuhan) ** t * indeks[m] for t, m in enumerate(bulan)])
    beli = rng.poisson(lam[None, :] * p[:, None])
    uang = beli * harga
    kum = uang.cumsum(1)

    def ring(x):
        q = np.percentile(x, [2.5, 10, 50, 90, 97.5], axis=0)
        return {"p2_5": q[0].round().tolist(), "p10": q[1].round().tolist(), "p50": q[2].round().tolist(), "p90": q[3].round().tolist(), "p97_5": q[4].round().tolist()}

    return {
        "bulan": bulan,
        "pengunjung": lam.round().tolist(),
        "pembeli": ring(beli),
        "pendapatan": ring(uang),
        "kumulatif": ring(kum),
        "konversi": {
            "a": a_post,
            "b": b_post,
            "rata": a_post / (a_post + b_post),
            "ci95": np.percentile(p, [2.5, 97.5]).tolist(),
        },
        "draws": draws,
        "harga": harga,
    }
