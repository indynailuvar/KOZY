# =============================================================================
# Menyimpan hasil model KOZY sebagai file JSON supaya web jalan TANPA server.
#
#   kozy_modeling_bundle_public_v1.pkl  ->  src/data/model.json
#     ringkasan bundle, pusat cluster K-Prototypes, dan benchmark Q1/median/Q3.
#     Penentuan segmen (jarak ke pusat cluster) dihitung ulang di browser
#     dengan rumus yang sama persis dengan KPrototypes.predict.
#
#   Chronos-2 (amazon/chronos-2)        ->  src/data/forecast_omzet.json
#     forecast dihitung SEKALI untuk setiap kombinasi pilihan di layar Admin
#     (pembeli awal x pertumbuhan). Horizon 3/6/9 bulan = potongan awal dari
#     forecast 12 bulan; Chronos-2 memberi angka identik untuk keduanya.
#
# Jalankan ulang setelah bundle berubah atau di awal bulan baru:
#   python scripts/build_model_statis.py
# Perlu: joblib, kmodes, pandas, torch, chronos-forecasting (GPU opsional).
# =============================================================================
import json
import math
import os
from datetime import date

import joblib
import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(BASE, "kozy_modeling_bundle_public_v1.pkl")
OUT_MODEL = os.path.join(BASE, "src", "data", "model.json")
OUT_FORECAST = os.path.join(BASE, "src", "data", "forecast_omzet.json")

# pilihan yang tersedia di layar Admin
PEMBELI_AWAL = [3, 6, 10, 20, 50, 100, 250, 500, 1000]
PERTUMBUHAN = [x / 2 for x in range(-10, 21)]  # -5,0 sampai 10,0 per 0,5
HORIZON = 12
HARGA_PAKET = 19_900
MUSIM = [0.88, 0.92, 0.96, 0.98, 1.02, 1.06, 1.08, 1.04, 0.97, 1.01, 1.10, 1.16]


def records(frame):
    return json.loads(frame.to_json(orient="records"))


def bulan_offset(bulan, offset):
    i = bulan.year * 12 + bulan.month - 1 + offset
    return date(i // 12, i % 12 + 1, 1)


def histori(awal, persen, akhir):
    """Seri pembeli dummy 36 bulan, sama dengan backend lama."""
    g = persen / 100
    return [
        max(0, round(awal * (1 + g) ** (langkah + 35) * MUSIM[bulan_offset(akhir, langkah).month - 1]))
        for langkah in range(-35, 1)
    ]


def segmen_js(pusat, gamma, harga_robust, kec, jenis):
    """Rumus yang dipakai browser: jarak kuadrat numerik + gamma x jumlah kategori beda."""
    jarak = [(harga_robust - c[0]) ** 2 + gamma * ((kec != c[1]) + (jenis != c[2])) for c in pusat]
    return int(np.argmin(jarak))


def ekspor_model():
    b = joblib.load(BUNDLE)
    seg, gap = b["segmentation"], b["price_gap_analysis"]
    mb = seg["model_bundle"]
    m = mb["model"]
    kec_map, jenis_map = m._enc_map
    pusat = [[float(c[0]), str(c[1]), str(c[2])] for c in np.asarray(m.cluster_centroids_)]
    info = b["bundle_info"]
    n = info.get("jumlah_listing_training")

    # pastikan rumus browser = model.predict untuk semua kecamatan, jenis, dan harga
    beda = 0
    for kec in kec_map:
        for jenis in jenis_map:
            for harga in range(300_000, 5_000_001, 25_000):
                x = (math.log(harga) - mb["log_harga_median"]) / mb["log_harga_iqr"]
                asli = int(m.predict(np.asarray([[x, kec, jenis]], dtype=object), categorical=mb["categorical_indices"])[0])
                beda += asli != segmen_js(pusat, m.gamma, x, kec, jenis)
    assert beda == 0, f"{beda} prediksi segmen berbeda dari model"

    data = {
        "ringkasan": {
            "bundle": {"nama": info["nama"], "versi": info["versi"], "dibuat": None, "jumlah_listing_sumber": n},
            "segmentasi": {
                "metadata": {"model": "K-Prototypes", "jumlah_listing": n, **seg.get("metrics", {})},
                "profil": records(seg["profile_aggregate"]),
                "kategori": {"kecamatan": list(kec_map), "jenis": list(jenis_map)},
            },
            "gap_harga": {
                "metode": gap["metode"],
                "benchmark": records(gap["benchmark_aggregate"]),
                "keterbatasan": gap.get("catatan", []),
            },
        },
        "kprototypes": {
            "pusat": pusat,
            "gamma": float(m.gamma),
            "log_harga_median": float(mb["log_harga_median"]),
            "log_harga_iqr": float(mb["log_harga_iqr"]),
        },
    }
    with open(OUT_MODEL, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"model.json: {len(pusat)} cluster, rumus browser cocok dengan model.predict")


def ekspor_forecast():
    import torch
    from chronos import Chronos2Pipeline

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipe = Chronos2Pipeline.from_pretrained("amazon/chronos-2", device_map=device)
    akhir = date.today().replace(day=1)
    kunci, seri = [], []
    for a in PEMBELI_AWAL:
        for g in PERTUMBUHAN:
            kunci.append(f"{a}|{g:g}")  # "6|3", "6|-4.5": sama dengan template string di browser
            seri.append(torch.tensor(histori(a, g, akhir), dtype=torch.float32))

    hasil = {}
    with torch.inference_mode():
        for i in range(0, len(seri), 64):
            q, _ = pipe.predict_quantiles(seri[i:i + 64], prediction_length=HORIZON, quantile_levels=[0.1, 0.5, 0.9])
            for k, t in zip(kunci[i:i + 64], q):
                hasil[k] = [[max(0, round(float(v))) for v in baris] for baris in t[0].tolist()]

    data = {
        "model": "amazon/chronos-2",
        "dihitung": date.today().isoformat(),
        "akhir_histori": akhir.isoformat(),
        "harga_paket": HARGA_PAKET,
        "musim": MUSIM,
        "pilihan": {"pembeli_awal": PEMBELI_AWAL, "pertumbuhan_persen": PERTUMBUHAN, "horizon": [3, 6, 9, 12]},
        "hasil": hasil,  # "pembeli|pertumbuhan" -> 12 bulan x [p10, p50, p90] jumlah pembeli
    }
    with open(OUT_FORECAST, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"forecast_omzet.json: {len(hasil)} skenario x {HORIZON} bulan ({device})")


if __name__ == "__main__":
    ekspor_model()
    ekspor_forecast()
