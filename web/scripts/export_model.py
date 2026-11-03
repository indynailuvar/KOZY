# =============================================================================
# Membungkus model KOZY jadi .pkl untuk dipakai orang lain:
#   src/data/pasar.json  ->  analysis/kozy_model.pkl
#
# BACA DULU SEBELUM PAKAI .pkl
# Model produksinya regresi hedonic log-linear — isinya cuma 24 koefisien,
# sekitar 821 byte. Untuk menyimpan 24 angka, .pkl sebenarnya berlebihan dan
# punya tiga kelemahan:
#   1. Gampang pecah kalau versi Python/numpy/sklearn penerimanya beda.
#   2. Isinya tidak bisa dilihat tanpa dimuat.
#   3. Memuat pickle berarti menjalankan kode dari berkas itu.
# Cara yang lebih aman: pakai scripts/kozy_model.py — satu berkas, tanpa
# dependensi, baca langsung dari pasar.json. Hasilnya identik.
#
# Berkas ini tetap dibuat karena ada yang butuh antarmuka sklearn
# (model.predict). Supaya tidak gampang pecah, isinya dirancang berlapis:
#   - koefisien mentah (list biasa)  -> selalu bisa dipakai, cukup Python polos
#   - model sklearn                  -> hanya kalau versinya cocok
# Jadi kalau bagian sklearn-nya gagal dimuat, koefisiennya masih terpakai.
#
# Koefisiennya diambil dari pasar.json, bukan dilatih ulang, sehingga dijamin
# sama persis dengan yang dipakai aplikasi web.
#
# Jalankan:  python scripts/export_model.py
# =============================================================================
import io
import json
import os
import pickle
import platform
import sys
from datetime import date

import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASAR = os.path.join(BASE, "src", "data", "pasar.json")
KELUAR = os.path.join(BASE, "analysis", "kozy_model.pkl")
VERSI_FORMAT = 1


def rakitKolom(model):
    """Urutan fitur: kecamatan, lalu fasilitas, lalu jenis. Semua kategori ikut
    (tanpa membuang acuan), karena efek kecamatan sudah dipusatkan dan efek
    'putra' memang bernilai 0."""
    kec = sorted(model["kec"])
    fas = list(model["fasilitas"])
    jen = list(model["jenis"])
    nama = [f"kec={k}" for k in kec] + [f"fas={f}" for f in fas] + [f"jenis={j}" for j in jen]
    koef = [model["kec"][k] for k in kec] + [model["fasilitas"][f] for f in fas] + [model["jenis"][j] for j in jen]
    return kec, fas, jen, nama, np.array(koef, dtype=float)


def main():
    pasar = json.load(io.open(PASAR, encoding="utf-8"))
    model = pasar["model"]
    kec, fas, jen, nama, koef = rakitKolom(model)
    intercept = float(model["intercept"])

    bundel = {
        "versi_format": VERSI_FORMAT,
        "dibuat": str(date.today()),
        "nama": "KOZY — harga wajar kos Surabaya",
        "metode": "Regresi hedonic, bentuk log-linear, diestimasi dengan Ridge (alpha=%s)" % model.get("alpha"),
        "rumus": "harga = exp(intercept + efek_kecamatan + sigma efek_fasilitas + efek_jenis)",
        "target": "log(harga sewa per bulan)",
        # --- lapis 1: selalu bisa dipakai, tanpa sklearn ---
        "kolom": nama,
        "koefisien": koef.tolist(),
        "intercept": intercept,
        "kategori": {"kecamatan": kec, "fasilitas": fas, "jenis": jen},
        # --- info ketelitian & asal data ---
        "meta": pasar["meta"],
        "catatan_penting": [
            "Keluaran rumus ini sudah dalam RUPIAH (exp sudah diterapkan), bukan log.",
            "Efek kecamatan sudah dipusatkan: 0 berarti rata-rata Surabaya, bukan kecamatan acuan.",
            "Koefisien dibaca sebagai persen dengan exp(b) - 1. Contoh: ac 0,457 -> +58%.",
            "Vonis harga: selisih > +15% kemahalan, < -15% murah, di antaranya wajar.",
            f"Model meleset rata-rata {pasar['meta']['mape']}% (MAPE), uji silang 5 lipat.",
        ],
        "dibuat_dengan": {
            "python": platform.python_version(),
            "numpy": np.__version__,
        },
    }

    # --- lapis 2: objek sklearn, kalau tersedia ---------------------------
    try:
        import sklearn
        from sklearn.linear_model import LinearRegression

        sk = LinearRegression()
        sk.coef_ = koef.copy()
        sk.intercept_ = intercept
        sk.n_features_in_ = len(koef)
        # feature_names_in_ sengaja TIDAK diisi: kalau diisi, sklearn memuntahkan
        # UserWarning tiap kali predict() dipanggil dengan array numpy biasa.
        # Nama kolomnya tetap tersedia di bundel["kolom"] dengan urutan yang sama.
        bundel["model_sklearn"] = sk
        bundel["dibuat_dengan"]["sklearn"] = sklearn.__version__
        bundel["catatan_sklearn"] = "model_sklearn.predict(X) mengeluarkan log(harga). Bungkus dengan np.exp() untuk dapat rupiah."
    except Exception as e:  # sklearn tidak ada / versinya rewel
        bundel["model_sklearn"] = None
        bundel["catatan_sklearn"] = f"objek sklearn tidak disertakan ({e}); pakai koefisien mentah saja"

    os.makedirs(os.path.dirname(KELUAR), exist_ok=True)
    with open(KELUAR, "wb") as f:
        pickle.dump(bundel, f, protocol=4)  # protokol 4 = kompatibel sampai Python 3.4

    # --- uji muat ulang + bandingkan dengan pasar.json ---------------------
    with open(KELUAR, "rb") as f:
        ulang = pickle.load(f)
    contoh = {"kec": "Sukolilo", "jenis": "putri", "fasilitas": ["km", "ac", "wifi", "kasur"]}
    x = np.array([[1.0 if k == contoh["kec"] else 0.0 for k in kec] + [1.0 if f in contoh["fasilitas"] else 0.0 for f in fas] + [1.0 if j == contoh["jenis"] else 0.0 for j in jen]])
    dari_pkl = float(np.exp(ulang["intercept"] + x @ np.array(ulang["koefisien"]))[0])
    dari_json = np.exp(intercept + model["kec"][contoh["kec"]] + model["jenis"][contoh["jenis"]] + sum(model["fasilitas"][f] for f in contoh["fasilitas"]))
    assert abs(dari_pkl - dari_json) < 1e-6, f"pkl tidak cocok dengan pasar.json: {dari_pkl} vs {dari_json}"

    print("tersimpan: %s  (%.1f KB)" % (os.path.relpath(KELUAR, BASE), os.path.getsize(KELUAR) / 1024))
    print("uji muat ulang: cocok dengan pasar.json (Rp %s)" % format(int(round(dari_pkl, -4)), ","))
    print("dibuat dengan:", bundel["dibuat_dengan"])
    print()
    print("=" * 72)
    print("CARA PAKAI — tempel ke notebook temanmu")
    print("=" * 72)
    print('''
import pickle, numpy as np

with open("kozy_model.pkl", "rb") as f:
    m = pickle.load(f)

kec, fas, jen = m["kategori"]["kecamatan"], m["kategori"]["fasilitas"], m["kategori"]["jenis"]

def harga_wajar(kecamatan, jenis, fasilitas):
    x = ([1.0 if k == kecamatan else 0.0 for k in kec]
         + [1.0 if f in fasilitas else 0.0 for f in fas]
         + [1.0 if j == jenis     else 0.0 for j in jen])
    return float(np.exp(m["intercept"] + np.dot(x, m["koefisien"])))

print(harga_wajar("Sukolilo", "putri", ["km", "ac", "wifi", "kasur"]))
''')
    print("=" * 72)
    print("Tanpa sklearn pun jalan. Kalau mau antarmuka sklearn:")
    print('  m["model_sklearn"].predict(X)   -> keluarannya log(harga), bungkus np.exp()')
    print()
    print("CATATAN: untuk pemakaian sehari-hari, scripts/kozy_model.py lebih disarankan —")
    print("satu berkas, tanpa dependensi, dan tidak bisa pecah karena beda versi pustaka.")


if __name__ == "__main__":
    main()
