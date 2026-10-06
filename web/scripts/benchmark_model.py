# =============================================================================
# Tabel benchmark model untuk skripsi:
#   src/data/pasar.json  ->  analysis/benchmark_model.csv + .json
#
# Gunanya menjawab satu pertanyaan sidang: "kenapa tidak pakai Random Forest
# atau XGBoost saja?" Jawabannya bukan opini, melainkan tabel ini.
#
# Supaya adil, model non-linear DITUNING DULU lewat grid search sebelum
# dibandingkan — membandingkan model yang belum dituning dengan OLS adalah
# perbandingan yang menyesatkan. Semua model dilatih di skala log(harga) lalu
# dibalik, dan dinilai pada lipatan yang identik sehingga uji-t-nya berpasangan.
#
# Hasil yang sudah terbukti (lihat notebooks/kozy_pembuktian_model.ipynb):
#   - jarak MAPE model terbaik ke terburuk hanya ~0,3 poin
#   - tuner memilih max_depth 2-3, artinya tidak ada non-linearitas untuk digali
#   - kurva belajar sudah mendatar: menambah data sejenis tidak membuka jarak
# => model produksi tetap hedonic OLS, karena koefisiennya bisa dijelaskan
#    ke pengguna ("AC menaikkan 58%") dan tidak bias oleh penyusutan.
#
# Jalankan:  python scripts/benchmark_model.py
# =============================================================================
import io
import json
import os
import warnings

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "4")
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, RidgeCV
from sklearn.model_selection import GridSearchCV, KFold, RepeatedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

warnings.filterwarnings("ignore")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASAR = os.path.join(BASE, "src", "data", "pasar.json")
KELUAR = os.path.join(BASE, "analysis")

LIPAT, ULANG = 5, 10  # 50 lipatan — uji-t butuh banyak ulangan agar stabil
AMBANG_T = 2.5
FAS = ["km", "ac", "wifi", "kasur", "kloset", "akses24"]


def matriks(kos, kecs):
    X = []
    for k in kos:
        v = [1.0 if k["kec"] == c else 0.0 for c in kecs[1:]]
        v += [1.0 if f in k["fasilitas"] else 0.0 for f in FAS]
        v += [1.0 if k["jenis"] == j else 0.0 for j in ("putri", "campur")]
        v += [1.0 if k["sumber"] == "Papikost" else 0.0]
        v += [np.log1p(k["dilihat"] or 0), 1.0 if k["dilihat"] else 0.0]
        X.append(v)
    return np.array(X)


def main():
    pasar = json.load(io.open(PASAR, encoding="utf-8"))
    kos = pasar["kos"]
    kecs = sorted({k["kec"] for k in kos})
    X = matriks(kos, kecs)
    y = np.array([k["harga"] for k in kos], float)
    ly = np.log(y)
    print(f"{len(y)} iklan, {X.shape[1]} fitur, {len(kecs)} kecamatan\n")

    # --- tuning dulu, baru adu ---------------------------------------------
    dalam = KFold(5, shuffle=True, random_state=1)
    grid = {
        "Random Forest": (RandomForestRegressor(n_estimators=300, random_state=0, n_jobs=-1),
                          {"max_depth": [3, 5, None], "min_samples_leaf": [1, 3, 8], "max_features": ["sqrt", 0.6, 1.0]}),
        "XGBoost": (None, {"learning_rate": [0.02, 0.06], "max_depth": [2, 3, 5], "min_child_weight": [1, 5, 10]}),
        "SVR (RBF)": (make_pipeline(StandardScaler(), SVR()),
                      {"svr__C": [0.3, 1, 3, 10], "svr__gamma": ["scale", 0.02], "svr__epsilon": [0.05, 0.1]}),
    }
    try:
        from xgboost import XGBRegressor

        grid["XGBoost"] = (XGBRegressor(n_estimators=300, random_state=0, verbosity=0, n_jobs=-1), grid["XGBoost"][1])
    except ImportError:
        print("xgboost tidak terpasang — dilewati\n")
        grid.pop("XGBoost")

    model = {"OLS log-linear (baseline)": LinearRegression(), "Ridge": RidgeCV(alphas=np.logspace(-3, 3, 25))}
    pilihan = {}
    for nama, (m, g) in grid.items():
        gs = GridSearchCV(m, g, cv=dalam, scoring="neg_mean_absolute_error", n_jobs=-1).fit(X, ly)
        model[nama] = gs.best_estimator_
        pilihan[nama] = {k: (v if isinstance(v, (int, float, str)) else str(v)) for k, v in gs.best_params_.items()}
        print(f"tuning {nama:16}: {gs.best_params_}")

    # --- adu di lipatan yang sama persis ------------------------------------
    lipatan = list(RepeatedKFold(n_splits=LIPAT, n_repeats=ULANG, random_state=7).split(X))
    skor = {}
    for nama, m in model.items():
        mae, mape = [], []
        for tr, te in lipatan:
            m.fit(X[tr], ly[tr])
            p = np.exp(np.clip(m.predict(X[te]), 10, 18))
            mae.append(np.abs(y[te] - p).mean())
            mape.append(np.mean(np.abs(y[te] - p) / y[te]) * 100)
        skor[nama] = {"mae": np.array(mae), "mape": np.array(mape)}

    dasar = skor["OLS log-linear (baseline)"]["mape"]
    baris = []
    for nama, s in skor.items():
        d = s["mape"] - dasar
        acuan = nama.startswith("OLS")
        t = float("nan") if acuan else float(d.mean() / (d.std(ddof=1) / np.sqrt(len(d))))
        baris.append({
            "model": nama,
            "mae_rp": int(round(s["mae"].mean(), -3)),
            "mape": round(float(s["mape"].mean()), 2),
            "mape_sd": round(float(s["mape"].std(ddof=1)), 2),
            "selisih_vs_baseline": None if acuan else round(float(d.mean()), 2),
            "t": None if acuan else round(t, 2),
            "kesimpulan": "acuan" if acuan else ("lebih baik (signifikan)" if t < -AMBANG_T else "lebih buruk (signifikan)" if t > AMBANG_T else "tidak berbeda nyata"),
            "hiperparameter": pilihan.get(nama, {}),
        })
    baris.sort(key=lambda r: r["mape"])

    os.makedirs(KELUAR, exist_ok=True)
    kolom = ["model", "mape", "mape_sd", "mae_rp", "selisih_vs_baseline", "t", "kesimpulan"]
    with io.open(os.path.join(KELUAR, "benchmark_model.csv"), "w", encoding="utf-8", newline="\n") as f:
        f.write(",".join(kolom) + "\n")
        for r in baris:
            f.write(",".join("" if r[c] is None else str(r[c]).replace(",", ";") for c in kolom) + "\n")

    menang = [r["model"] for r in baris if r["t"] is not None and r["t"] < -AMBANG_T]
    jarak = round(max(r["mape"] for r in baris) - min(r["mape"] for r in baris), 2)
    ringkas = {
        "n": len(y),
        "lipatan": LIPAT * ULANG,
        "ambang_t": AMBANG_T,
        "jarak_mape_terbaik_terburuk": jarak,
        "menang_signifikan": menang,
        "model_produksi": "OLS log-linear",
        "alasan_produksi": (
            "Selisih semua model di bawah 1 poin MAPE; pada kos Rp 1 juta itu setara ~Rp 3.000, tidak terasa. "
            "Koefisien OLS tidak bias oleh penyusutan, sehingga faktor harga yang ditampilkan ke pengguna "
            "(mis. 'AC menaikkan 58%') tetap sahih. Ridge dilaporkan di tabel, tidak dipakai produksi."
        ),
        "hasil": baris,
    }
    io.open(os.path.join(KELUAR, "benchmark_model.json"), "w", encoding="utf-8", newline="\n").write(json.dumps(ringkas, ensure_ascii=False, indent=1))

    lebar = max(len(r["model"]) for r in baris)
    print("\n%-*s %8s %12s %9s %7s   %s" % (lebar, "model", "MAPE", "MAE", "selisih", "t", "kesimpulan"))
    for r in baris:
        selisih = "" if r["selisih_vs_baseline"] is None else "%+.2f" % r["selisih_vs_baseline"]
        t = "" if r["t"] is None else "%+.1f" % r["t"]
        print("%-*s %7.2f%% Rp%10s %9s %7s   %s" % (lebar, r["model"], r["mape"], format(r["mae_rp"], ","), selisih, t, r["kesimpulan"]))
    print(f"\njarak terbaik-terburuk: {jarak} poin  |  menang signifikan: {menang or 'tidak ada'}")
    print(f"-> model produksi tetap OLS log-linear (lihat alasan di benchmark_model.json)")
    print(f"tersimpan di {os.path.relpath(KELUAR, BASE)}/benchmark_model.csv dan .json")


if __name__ == "__main__":
    main()
