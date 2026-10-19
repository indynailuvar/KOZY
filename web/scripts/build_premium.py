# =============================================================================
# Fitur eksklusif KOZY (Rp19.900 sekali bayar) + forecast pendapatan KOZY.
#
#   src/data/pasar.json            ┐
#   ../harga_dari_ulasan.csv       ├→  src/data/kelas.json          (K-Prototypes)
#   src/data/gmaps.json            │   src/data/gap_ab.json         (gap A vs B)
#   ../../gmaps_ulasan.json        ┘   src/data/forecast_kozy.json  (indeks musiman + skenario)
#
# Aturan yang dipegang, semuanya karena konteks datanya:
#
# 1. TIDAK ADA REGRESI. Tidak ada variabel yang diperlakukan sebagai "penyebab" harga.
# 2. FASILITAS 0/1 TIDAK DIPAKAI. Ada/tidak ada AC, KM dalam, dll. bukan ukuran
#    kontinu, jadi tidak ikut membentuk kelas maupun gap.
# 3. Variabel numerik yang sah hanya HARGA (307 iklan, lengkap) dan JARAK ke kampus
#    terdekat (133 kos berkoordinat). Dilihat & sisa kamar skalanya beda antar situs
#    (Mamikos "500+" / 1–3 kamar, Papikost 6.442 / 1–10), rating hanya 29 → dibuang.
#
# Jalankan:  python scripts/build_premium.py
# =============================================================================
import collections
import datetime as dt
import io
import json
import math
import os
import re
import sys

import numpy as np
import pandas as pd
from scipy.stats import chisquare, kruskal, spearmanr
from sklearn.metrics import adjusted_rand_score
from sklearn.mixture import GaussianMixture

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../KOZY-repo/web
REPO = os.path.dirname(BASE)
DATA = os.path.join(BASE, "src", "data")
sys.path.insert(0, os.path.join(BASE, "scripts"))
sys.path.insert(0, os.path.join(REPO, "api"))
from build_segmen import kprototypes, siluet  # noqa: E402  (implementasi Huang 1997 yang sama)
from premium import HARGA_EKSKLUSIF, simulasi_pendapatan  # noqa: E402

MIN_KEC = 15  # kecamatan dengan iklan < 15 digabung "lain" (modus dari 1–4 iklan tidak stabil)
K_DICOBA = range(2, 7)
K_PILIH = 3  # kebutuhan produk: murah / menengah / mahal
N_INIT = 20
N_BOOT = 100
K_TETANGGA = 10  # kisaran harga di sekitar kos Google Maps (informasi saja, tidak ikut gap)
LABEL = ["Murah", "Menengah", "Mahal"]
NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def baca_json(path):
    return json.load(io.open(path, encoding="utf-8"))


def tulis_json(nama, isi):
    with io.open(os.path.join(DATA, nama), "w", encoding="utf-8") as f:
        json.dump(isi, f, ensure_ascii=False, indent=1)
    print(f"  -> src/data/{nama}")


def koma(x, d):
    """Angka desimal gaya Indonesia untuk teks yang tampil di aplikasi: -0.19 -> −0,19."""
    return f"{x:.{d}f}".replace("-", "−").replace(".", ",")


def kuantil(xs):
    q = np.percentile(xs, [0, 25, 50, 75, 100])
    return {"min": int(q[0]), "p25": int(q[1]), "p50": int(q[2]), "p75": int(q[3]), "max": int(q[4])}


# ================================================================ 1. KELAS HARGA
def biaya(Xn, Xc, lab, Cn, Cc, gamma):
    return float(((Xn - Cn[lab]) ** 2).sum() + gamma * (Xc != Cc[lab]).sum())


def latih(Xn, Xc, k, gamma, n_init=N_INIT, benih=0):
    terbaik = None
    for s in range(benih, benih + n_init):
        lab, Cn, Cc = kprototypes(Xn, Xc, k, gamma, seed=s)
        if len(set(lab)) < k:
            continue
        c = biaya(Xn, Xc, lab, Cn, Cc, gamma)
        if terbaik is None or c < terbaik[0]:
            terbaik = (c, lab, Cn, Cc)
    return terbaik


def tetapkan(Xn, Xc, Cn, Cc, gamma):
    return (((Xn[:, None, :] - Cn[None]) ** 2).sum(2) + gamma * (Xc[:, None, :] != Cc[None]).sum(2)).argmin(1)


def bangun_kelas(kos):
    df = pd.DataFrame(kos)
    n_kec = df.kec.value_counts()
    kec_dikenal = sorted(n_kec[n_kec >= MIN_KEC].index)
    df["kec_g"] = df.kec.where(df.kec.isin(kec_dikenal), "lain")
    log_h = np.log(df.harga.values.astype(float))
    mean, std = float(log_h.mean()), float(log_h.std())
    Xn = ((log_h - mean) / std).reshape(-1, 1)
    kat_kec = sorted(df.kec_g.unique())
    kat_jenis = sorted(df.jenis.unique())
    Xc = np.column_stack([df.kec_g.map(kat_kec.index), df.jenis.map(kat_jenis.index)])
    gamma = 0.5  # Huang (1997): 0,5–0,7 × simpangan baku numerik; numerik sudah dibakukan (sd = 1)

    # Apakah harga memang punya kelompok alami? (dijawab dengan BIC Gaussian Mixture)
    bic = [{"k": k, "bic": round(GaussianMixture(k, n_init=10, random_state=0).fit(Xn).bic(Xn), 1)} for k in range(1, 6)]

    pemilihan = []
    for k in K_DICOBA:
        c, lab, _, _ = latih(Xn, Xc, k, gamma)
        pemilihan.append({"k": k, "biaya": round(c, 1), "siluet": round(siluet(Xn, Xc, lab, gamma), 3), "ukuran": sorted(np.bincount(lab).tolist())})
        print(f"  k={k}  biaya={c:7.1f}  siluet={pemilihan[-1]['siluet']:.3f}  ukuran={pemilihan[-1]['ukuran']}")

    c, lab, Cn, Cc = latih(Xn, Xc, K_PILIH, gamma)
    urut = np.argsort(Cn[:, 0])  # urutkan prototipe dari harga terendah

    # Stabilitas: latih ulang di sampel bootstrap, tetapkan semua iklan, bandingkan dengan ARI
    rng = np.random.default_rng(0)
    ari = []
    for b in range(N_BOOT):
        idx = rng.integers(0, len(Xn), len(Xn))
        hasil = latih(Xn[idx], Xc[idx], K_PILIH, gamma, n_init=5, benih=b * 5)
        if hasil:
            ari.append(adjusted_rand_score(lab, tetapkan(Xn, Xc, hasil[2], hasil[3], gamma)))
    ari = np.array(ari)

    prototipe, kelas = [], []
    for posisi, j in enumerate(urut):
        m = lab == j
        anggota = df[m]
        kid = LABEL[posisi].lower()
        prototipe.append(
            {
                "id": kid,
                "z": round(float(Cn[j, 0]), 4),
                "harga_pusat": int(round(math.exp(Cn[j, 0] * std + mean), -3)),
                "kec": kat_kec[Cc[j, 0]],
                "jenis": kat_jenis[Cc[j, 1]],
            }
        )
        kelas.append(
            {
                "id": kid,
                "label": LABEL[posisi],
                "n": int(m.sum()),
                "bagian": round(m.mean() * 100, 1),
                "harga": kuantil(anggota.harga),
                "kec_terbanyak": anggota.kec.value_counts().head(3).to_dict(),
                "jenis": {j2: round(v * 100) for j2, v in anggota.jenis.value_counts(normalize=True).items()},
                "harga_urut": sorted(int(h) for h in anggota.harga),
            }
        )
    print(f"  k={K_PILIH} terpilih, ARI bootstrap {ari.mean():.3f} ± {ari.std():.3f}")
    for k in kelas:
        print(f"    {k['label']:9s} n={k['n']:3d}  Rp{k['harga']['min']:>9,} – Rp{k['harga']['max']:>9,}  median Rp{k['harga']['p50']:,}")

    sil = {p["k"]: p["siluet"] for p in pemilihan}
    return {
        "meta": {
            "metode": "K-Prototypes (Huang, 1997)",
            "n": len(df),
            "sumber": "Mamikos + Papikost (pasar.json)",
            "variabel_numerik": ["log harga (dibakukan)"],
            "variabel_kategorik": ["kecamatan", "jenis kos"],
            "tidak_dipakai": "Fasilitas (biner 0/1), dilihat & sisa kamar (skala beda antar situs), rating (29 dari 307).",
            "gamma": gamma,
            "n_init": N_INIT,
            "k": K_PILIH,
            "alasan_k": (
                f"Kebutuhan produk 3 kelas (murah/menengah/mahal). Semua klaster beranggota ≥ {MIN_KEC}; "
                f"siluet k=3 {koma(sil[3], 3)} (k=2 {koma(sil[2], 3)}) — struktur lemah tapi ada (Kaufman & Rousseeuw, 0,26–0,50)."
            ),
            "pemilihan_k": pemilihan,
            "uji_kelompok_alami": {
                "metode": "BIC Gaussian Mixture pada log harga",
                "hasil": bic,
                "k_terbaik": min(bic, key=lambda x: x["bic"])["k"],
                "arti": "Harga tidak membentuk kelompok alami, jadi batas kelas tidak diklaim 'alami'; K-Prototypes membagi pasar sambil memperhitungkan kecamatan dan jenis.",
            },
            "stabilitas": {"metode": f"ARI bootstrap ({len(ari)} ulangan)", "rata": round(float(ari.mean()), 3), "sd": round(float(ari.std()), 3)},
            "cara_klasifikasi": "Kos baru masuk ke prototipe dengan jarak campuran terkecil: (z_harga − pusat)² + γ·[kecamatan ≠ modus] + γ·[jenis ≠ modus].",
        },
        "param": {"log_mean": mean, "log_std": std, "gamma": gamma, "kec_dikenal": kec_dikenal},
        "prototipe": prototipe,
        "kelas": kelas,
    }


# ================================================================ 2. GAP A vs B
def haversine(a1, o1, a2, o2):
    a1, o1, a2, o2 = map(np.radians, (a1, o1, a2, o2))
    return 2 * 6371 * np.arcsin(np.sqrt(np.sin((a2 - a1) / 2) ** 2 + np.cos(a1) * np.cos(a2) * np.sin((o2 - o1) / 2) ** 2))


def kampus():
    teks = io.open(os.path.join(DATA, "surabaya.js"), encoding="utf-8").read()
    pola = r"singkat: '([^']+)', jenis: 'kampus', lat: ([-\d.]+), lng: ([-\d.]+)"
    return [(s, float(la), float(lo)) for s, la, lo in re.findall(pola, teks)]


def jenis_dari_nama(nama):
    n = nama.lower()
    for j in ("putri", "putra", "campur", "pasutri"):
        if j in n:
            return "campur" if j == "pasutri" else j
    return None


def bangun_gap(kos):
    # 67 iklan Papikost berkoordinat + harga yang disebut di ulasan Google Maps (≤ 3 tahun)
    pk = [{"nama": k["nama"], "kec": k["kec"], "harga": k["harga"], "lat": k["lat"], "lng": k["lng"], "sumber": "Papikost"} for k in kos if k.get("lat") is not None]
    ul = pd.read_csv(os.path.join(REPO, "harga_dari_ulasan.csv"))
    ul = ul[ul.usia_tahun_median <= 3]
    kec_gm = {g["link"]: g["kec"] for g in baca_json(os.path.join(DATA, "gmaps.json"))["kos"]}
    gm = [
        {"nama": r.nama, "kec": kec_gm.get(r.link) or r.kecamatan_query.title(), "harga": float(r.harga_median_ulasan), "lat": r.latitude, "lng": r.longitude, "sumber": "Ulasan Google Maps"}
        for r in ul.itertuples()
    ]
    titik = []
    for t in pk + gm:  # titik yang sama di dua sumber (< 50 m) dihitung sekali
        if any(t["sumber"] != s["sumber"] and haversine(t["lat"], t["lng"], s["lat"], s["lng"]) < 0.05 for s in titik):
            continue
        titik.append(t)
    df = pd.DataFrame(titik)
    df = df[(df.harga >= 300_000) & (df.harga <= 5_000_000)].reset_index(drop=True)
    kp = kampus()
    d = np.column_stack([haversine(df.lat.values, df.lng.values, la, lo) for _, la, lo in kp])
    df["jarak"] = d.min(1)

    rho = spearmanr(df.harga, df.jarak)
    pita = pd.cut(df.jarak, [0, 1, 2, 3, np.inf], labels=["< 1 km", "1–2 km", "2–3 km", "> 3 km"])
    kel = [g.harga.values for _, g in df.groupby(pita, observed=True)]
    kw = kruskal(*kel)
    per_pita = [{"label": str(lbl), "n": int(len(g)), "median": int(g.harga.median())} for lbl, g in df.groupby(pita, observed=True)]
    print(f"  {len(df)} kos berkoordinat · Spearman ρ={rho.statistic:.3f} (p={rho.pvalue:.3f}) · Kruskal-Wallis H={kw.statistic:.2f} (p={kw.pvalue:.3f})")

    # Uji leave-one-out: tiap kos ditaksir dari median K tetangga terdekatnya (dirinya tidak ikut)
    lat, lng, hg = df.lat.values, df.lng.values, df.harga.values.astype(float)
    tebak = np.array([np.median(hg[np.argsort(np.where(np.arange(len(df)) == i, np.inf, haversine(lat[i], lng[i], lat, lng)))[:K_TETANGGA]]) for i in range(len(df))])
    galat = np.abs(tebak - hg) / hg * 100
    loo = {"mape": round(float(galat.mean()), 1), "median_ape": round(float(np.median(galat)), 1), "dalam_20persen": round(float((galat <= 20).mean() * 100), 1)}
    loo_kota = round(float(np.mean([abs(np.median(np.delete(hg, i)) - hg[i]) / hg[i] * 100 for i in range(len(hg))])), 1)
    loo["mape_median_kota"] = loo_kota
    print(f"  taksiran {K_TETANGGA} tetangga (leave-one-out): MAPE {loo['mape']}%, median galat {loo['median_ape']}%, {loo['dalam_20persen']}% kos meleset ≤ 20%")

    harga_all = np.array([k["harga"] for k in kos], float)
    q1h, q3h = np.percentile(harga_all, [25, 75])
    q1j, q3j = np.percentile(df.jarak, [25, 75])
    lemah = "lemah" if abs(rho.statistic) < 0.3 else "sedang"
    return {
        "meta": {
            "metode": "Gap terstandar (selisih / IQR pasar) + persentil empiris di kelas K-Prototypes + TOPSIS (Hwang & Yoon, 1981)",
            "variabel": ["harga (Rp/bulan)", "jarak ke tujuan (km)"],
            "tidak_dipakai": "Fasilitas 0/1 hanya ditampilkan sebagai informasi, tidak dihitung.",
            "kampus": [s for s, _, _ in kp],
        },
        "skala": {
            "harga": {"median": float(np.median(harga_all)), "q1": float(q1h), "q3": float(q3h), "iqr": float(q3h - q1h), "n": len(harga_all), "sumber": "307 iklan Mamikos + Papikost"},
            "jarak": {"median": round(float(df.jarak.median()), 2), "q1": round(float(q1j), 2), "q3": round(float(q3j), 2), "iqr": round(float(q3j - q1j), 2), "n": len(df), "sumber": "jarak ke kampus terdekat, kos berkoordinat"},
        },
        "uji_jarak_harga": {
            "n": len(df),
            "sumber": {k: int(v) for k, v in df.sumber.value_counts().items()},
            "spearman": {"rho": round(float(rho.statistic), 3), "p": round(float(rho.pvalue), 4)},
            "kruskal_wallis": {"H": round(float(kw.statistic), 2), "df": len(kel) - 1, "p": round(float(kw.pvalue), 4)},
            "per_pita": per_pita,
            "kesimpulan": (
                f"Hubungan jarak ke kampus dengan harga {lemah} (ρ = {koma(rho.statistic, 2)}); median harga antar pita jarak "
                + ("tidak berbeda signifikan" if kw.pvalue >= 0.05 else "berbeda signifikan")
                + f" (Kruskal-Wallis p = {koma(kw.pvalue, 2)})."
            ),
        },
        # Titik kos berharga asli di sekitar kos Google Maps. Hanya untuk INFORMASI kisaran harga:
        # uji leave-one-out menunjukkan taksiran dari tetangga tidak lebih baik daripada median kota,
        # jadi kos Google Maps dibandingkan dengan jarak saja. [lat, lng, harga, 0 Papikost / 1 ulasan]
        "tetangga": {
            "k": K_TETANGGA,
            "metode": f"Kuartil harga {K_TETANGGA} kos berharga asli terdekat (jarak haversine), hanya sebagai informasi.",
            "kesimpulan": f"Taksiran dari {K_TETANGGA} tetangga (MAPE {koma(loo['mape'], 1)}%) tidak lebih baik dari median kota (MAPE {koma(loo_kota, 1)}%): lokasi saja tidak cukup menaksir harga, jadi kos tanpa harga asli dibandingkan dengan jarak saja.",
            "uji_loo": loo,
            "titik": [[round(r.lat, 6), round(r.lng, 6), int(r.harga), 0 if r.sumber == "Papikost" else 1] for r in df.itertuples()],
        },
        "topsis": {
            "kriteria": {"harga": "biaya", "jarak": "biaya"},
            "bobot": {
                "seimbang": {"harga": 0.5, "jarak": 0.5},
                "hemat": {"harga": 0.75, "jarak": 0.25},
                "dekat": {"harga": 0.25, "jarak": 0.75},
            },
        },
    }


# ================================================================ 3. FORECAST
def cari_ulasan():
    for p in (os.path.join(REPO, "data", "gmaps_ulasan.json"), os.path.join(os.path.dirname(REPO), "gmaps_ulasan.json")):
        if os.path.exists(p):
            return p
    raise SystemExit("gmaps_ulasan.json tidak ditemukan (dicari di KOZY-repo/data/ dan folder induk KOZY-repo).")


def bangun_forecast():
    path = cari_ulasan()
    ambil = dt.date.fromtimestamp(os.path.getmtime(path))  # tanggal scraping = tanggal berkas ditulis
    tempat = baca_json(path)
    lihat, ember = set(), collections.Counter()
    total = duplikat = tanpa_bulan = 0
    for t in tempat:
        for r in t.get("ulasan", []):
            total += 1
            kunci = (t.get("place_id"), (r.get("teks") or "")[:120])
            if kunci in lihat:
                duplikat += 1
                continue
            lihat.add(kunci)
            s = (r.get("tanggal") or "").replace("Diedit ", "").split(" di")[0].strip()
            s = s.replace("sebulan", "1 bulan").replace("seminggu", "1 minggu")
            m = re.match(r"(\d+) (minggu|bulan) lalu", s)
            if not m:
                tanpa_bulan += 1  # "x tahun lalu" atau kosong: resolusinya tidak sampai bulan
                continue
            ember[0 if m[2] == "minggu" else int(m[1])] += 1

    # ember b = "b bulan lalu" dari tanggal ambil → bulan kalender
    hitung = [0] * 12
    periode = [None] * 12
    for b in range(12):
        bln = (ambil.month - 1 - b) % 12
        thn = ambil.year + (ambil.month - 1 - b) // 12
        hitung[bln] = ember[b]
        periode[bln] = f"{NAMA_BULAN[bln]} {thn}"
    rata = sum(hitung) / 12
    indeks = [round(h / rata, 3) for h in hitung]
    ci = [[round((h - 1.96 * math.sqrt(h)) / rata, 3), round((h + 1.96 * math.sqrt(h)) / rata, 3)] for h in hitung]
    uji = chisquare(hitung)
    print(f"  ulasan {total} · duplikat {duplikat} · beresolusi bulan {sum(hitung)} · χ²={uji.statistic:.1f} (df=11, p={uji.pvalue:.2g})")
    print("  indeks:", {NAMA_BULAN[i]: indeks[i] for i in range(12)})

    hari_ini = dt.date.today()
    mulai = hari_ini.month % 12  # bulan depan (0 = Januari)
    tahun_mulai = hari_ini.year + (1 if hari_ini.month == 12 else 0)
    prior = {"a": 3, "b": 97}
    skenario = {
        "pesimis": {"label": "Pesimis", "pengunjung_awal": 500, "pertumbuhan": 0.0},
        "moderat": {"label": "Moderat", "pengunjung_awal": 1000, "pertumbuhan": 0.02},
        "optimis": {"label": "Optimis", "pengunjung_awal": 2000, "pertumbuhan": 0.04},
    }
    for kunci, s in skenario.items():
        h = simulasi_pendapatan(indeks, mulai, s["pengunjung_awal"], s["pertumbuhan"], prior["a"], prior["b"])
        s["hasil_tanpa_data_aktivitas"] = {"total_p50": h["kumulatif"]["p50"][-1], "total_p10": h["kumulatif"]["p10"][-1], "total_p90": h["kumulatif"]["p90"][-1]}
        print(f"  {s['label']:8s} 12 bln: median Rp{h['kumulatif']['p50'][-1]:,.0f} (80%: Rp{h['kumulatif']['p10'][-1]:,.0f} – Rp{h['kumulatif']['p90'][-1]:,.0f})")

    return {
        "meta": {
            "judul": "Forecast pendapatan KOZY dari paket eksklusif",
            "metode": "Simulasi Monte Carlo funnel: konversi ~ Beta (prior + data aktivitas), pembeli ~ Poisson(pengunjung × indeks musiman × konversi)",
            "harga": HARGA_EKSKLUSIF,
            "model_bayar": "sekali bayar per pengguna",
            "kenapa_bukan_holt_winters": "Holt-Winters/SARIMA butuh ≥ 2 siklus musiman (24 bulan); ulasan yang beresolusi bulan hanya mencakup 12 bulan terakhir.",
            "keterbatasan": [
                "Indeks musiman memakai volume ulasan Google Maps sebagai proksi permintaan kos, bukan data kunjungan KOZY.",
                "Dengan satu siklus (12 bulan), tren dan musiman belum bisa dipisahkan sepenuhnya.",
                "Google membulatkan waktu ulasan ('3 bulan lalu'), jadi penempatan per bulan bisa bergeser ± 1 bulan.",
                "Pengunjung awal dan pertumbuhan adalah asumsi skenario sampai ada data kunjungan asli.",
            ],
        },
        "musiman": {
            "sumber": "Ulasan Google Maps 3.125 tempat kos Surabaya",
            "diambil": ambil.isoformat(),
            "ulasan_total": total,
            "duplikat_dibuang": duplikat,
            "tanpa_resolusi_bulan": tanpa_bulan,
            "hitung": hitung,
            "periode": periode,
            "indeks": indeks,
            "ci95": ci,
            "uji": {"metode": "Chi-square goodness of fit vs. merata", "chi2": round(float(uji.statistic), 1), "df": 11, "p": float(f"{uji.pvalue:.3g}")},
        },
        "mulai": {"bulan": mulai, "tahun": tahun_mulai},
        "prior": {**prior, "arti": "Rata-rata konversi 3% dengan bobot setara 100 pengunjung — asumsi awal, ikut bergeser begitu data aktivitas masuk."},
        "skenario": skenario,
        "draws": 10_000,
    }


def main():
    pasar = baca_json(os.path.join(DATA, "pasar.json"))
    kos = pasar["kos"]
    print("1. Kelas harga (K-Prototypes)")
    tulis_json("kelas.json", bangun_kelas(kos))
    print("2. Gap A vs B")
    tulis_json("gap_ab.json", bangun_gap(kos))
    print("3. Forecast pendapatan")
    tulis_json("forecast_kozy.json", bangun_forecast())


if __name__ == "__main__":
    main()
