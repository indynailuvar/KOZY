"""
KOZY Backend API (FastAPI)
Menghubungkan model cek harga dan tiga komponen fitur eksklusif KOZY ke antarmuka web:
  1. kelas harga murah/menengah/mahal  (K-Prototypes)
  2. gap kos A vs kos B                (gap terstandar + persentil + TOPSIS)
  3. forecast pendapatan KOZY          (Monte Carlo + Beta-Binomial + indeks musiman)
Ketiganya tanpa regresi dan tanpa variabel fasilitas 0/1 (lihat api/premium.py).
"""

import json
import math
import os
from datetime import date
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import List, Optional
import warnings

warnings.filterwarnings("ignore")

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from premium import HARGA_EKSKLUSIF, gap_ab, kelas_kos, simulasi_pendapatan

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "web" / "src" / "data"
OUTPUT_DIR = ROOT_DIR / "output"
MODEL_BUNDLE_PATH = Path(os.environ.get(
    "KOZY_MODEL_BUNDLE_PATH",
    str(ROOT_DIR.parent / "web" / "kozy_modeling_bundle_v1.pkl"),
)).expanduser()

# Load JSON datasets
def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

PASAR_DATA = load_json(DATA_DIR / "pasar.json")
# dibuat oleh web/scripts/build_premium.py
KELAS_DATA = load_json(DATA_DIR / "kelas.json")
GAP_AB_DATA = load_json(DATA_DIR / "gap_ab.json")
FORECAST_DATA = load_json(DATA_DIR / "forecast_kozy.json")

try:
    MODELING_BUNDLE = joblib.load(MODEL_BUNDLE_PATH) if MODEL_BUNDLE_PATH.is_file() else None
    MODEL_BUNDLE_ERROR = None
except Exception as exc:
    MODELING_BUNDLE = None
    MODEL_BUNDLE_ERROR = type(exc).__name__


_CHRONOS_LOCK = Lock()


@lru_cache(maxsize=1)
def chronos2_pipeline():
    import torch
    from chronos import Chronos2Pipeline

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipeline = Chronos2Pipeline.from_pretrained("amazon/chronos-2", device_map=device)
    return pipeline, device

app = FastAPI(
    title="KOZY Analytics & Modelling Backend",
    version="2.0.0",
    description="Backend service KOZY untuk cek kewajaran harga, kelas harga K-Prototypes, gap kos A vs B, dan forecast pendapatan paket eksklusif."
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Helper Functions
# =============================================================================
BATAS_WAJAR = 15.0

def bulat10rb(v: float) -> int:
    return int(round(v / 10000.0) * 10000)

def status_dari_selisih(selisih_persen: float) -> str:
    if selisih_persen > BATAS_WAJAR:
        return "KEMAHALAN"
    elif selisih_persen < -BATAS_WAJAR:
        return "MURAH"
    return "WAJAR"

def hitung_wajar_log_linear(kec: str, fasilitas: List[str], jenis: str = "putra"):
    model = PASAR_DATA.get("model", {})
    intercept = model.get("intercept", 13.276)
    kec_effects = model.get("kec", {})
    fas_effects = model.get("fasilitas", {})
    jenis_effects = model.get("jenis", {})

    kec_val = kec_effects.get(kec, 0.0)
    fas_val = sum(fas_effects.get(f, 0.0) for f in fasilitas)
    jenis_val = jenis_effects.get(jenis, 0.0)

    prediksi_rp = math.exp(intercept + kec_val + fas_val + jenis_val)
    harga_wajar = bulat10rb(prediksi_rp)

    dasar = math.exp(intercept + kec_val)
    faktor = [
        {"key": "lokasi", "label": f"Lokasi di Kec. {kec}", "icon": "pin", "nilai": round(dasar), "arah": "naik", "level": "besar"}
    ]
    for f in ["km", "ac", "wifi", "kasur", "kloset", "akses24"]:
        if f in fasilitas and f in fas_effects:
            tanpa = math.exp(intercept + kec_val + (fas_val - fas_effects[f]) + jenis_val)
            diff = prediksi_rp - tanpa
            porsi = abs(diff) / prediksi_rp
            level = "besar" if porsi >= 0.3 else ("sedang" if porsi >= 0.1 else "kecil")
            label_map = {"km": "KM Dalam", "ac": "AC", "wifi": "WiFi", "kasur": "Kasur", "kloset": "Kloset Duduk", "akses24": "Akses 24 Jam"}
            icon_map = {"km": "bath", "ac": "snow", "wifi": "wifi", "kasur": "bed", "kloset": "toilet", "akses24": "clock"}
            faktor.append({
                "key": f,
                "label": label_map.get(f, f.upper()),
                "icon": icon_map.get(f, "check"),
                "nilai": round(diff),
                "arah": "naik" if diff >= 0 else "turun",
                "level": level
            })

    lokasi_pct = round((dasar / prediksi_rp) * 100)
    return harga_wajar, faktor, {"lokasi": lokasi_pct, "kamar": 100 - lokasi_pct}


# =============================================================================
# Request / Response Schemas
# =============================================================================
class VonisRequest(BaseModel):
    kawasan: Optional[str] = None
    kecamatan: str = "Sukolilo"
    harga: float = Field(..., ge=100000, le=20000000, description="Harga sewa bulanan kos")
    jenis: str = "putra"
    fasilitas: List[str] = []
    lokasi: Optional[str] = None


class KelasRequest(BaseModel):
    harga: float = Field(..., ge=100000, le=20000000, description="Harga sewa bulanan kos")
    kecamatan: Optional[str] = None
    jenis: Optional[str] = None


class KosAB(BaseModel):
    nama: str = "Kos"
    harga: Optional[float] = Field(None, ge=100000, le=20000000, description="Kosong = harga belum diketahui (kos Google Maps)")
    jarak: Optional[float] = Field(None, ge=0, le=100, description="Jarak ke tujuan (km)")
    kec: Optional[str] = None
    jenis: Optional[str] = None


class GapABRequest(BaseModel):
    a: KosAB
    b: KosAB
    prioritas: str = Field("seimbang", description="seimbang | hemat | dekat")


class ForecastRequest(BaseModel):
    pengunjung_awal: float = Field(1000, ge=0, description="Pengunjung baru per bulan di bulan pertama")
    pertumbuhan: float = Field(0.02, ge=-0.5, le=1, description="Pertumbuhan pengunjung per bulan (0,02 = 2%)")
    sesi: int = Field(0, ge=0, description="Jumlah sesi pengunjung yang teramati (data aktivitas)")
    pembeli: int = Field(0, ge=0, description="Jumlah sesi yang membayar paket eksklusif")
    prior_a: float = Field(3, gt=0)
    prior_b: float = Field(97, gt=0)
    horizon: int = Field(12, ge=1, le=36)
    draws: int = Field(10_000, ge=500, le=50_000)


class ForecastOmzetRequest(BaseModel):
    pembeli_awal: int = Field(6, ge=0, le=5000, description="Pembeli bulanan dummy pada awal periode historis")
    pertumbuhan_persen: float = Field(3.0, ge=-5, le=10, description="Asumsi pertumbuhan dummy per bulan")
    horizon: int = Field(12, ge=3, le=12)


class BundleAnalysisRequest(BaseModel):
    harga: float = Field(..., gt=0, le=20_000_000)
    kecamatan: str = Field(..., min_length=1)
    jenis: str = Field(..., pattern="^(putra|putri|campur)$")


# =============================================================================
# API Endpoints
# =============================================================================
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "KOZY Backend API",
        "data_loaded": {
            "pasar_n": PASAR_DATA.get("meta", {}).get("n", 0),
            "kelas_n": KELAS_DATA.get("meta", {}).get("n", 0),
            "gap_ab_n": GAP_AB_DATA.get("uji_jarak_harga", {}).get("n", 0),
            "forecast_musiman": bool(FORECAST_DATA.get("musiman")),
            "modeling_bundle": MODELING_BUNDLE is not None,
        }
    }


def require_modeling_bundle():
    if MODELING_BUNDLE is None:
        raise HTTPException(
            status_code=503,
            detail="Bundle modeling tidak tersedia atau gagal dimuat. Periksa KOZY_MODEL_BUNDLE_PATH dan dependency backend.",
        )
    return MODELING_BUNDLE


def frame_records(frame):
    return json.loads(frame.to_json(orient="records"))


@app.get("/modeling/summary")
def modeling_summary():
    """Ringkasan agregat dari bundle internal tanpa data listing individual."""
    bundle = require_modeling_bundle()
    segmentation = bundle["segmentation"]
    gap = bundle["price_gap_analysis"]
    return {
        "bundle": {
            "nama": bundle["bundle_info"]["nama"],
            "versi": bundle["bundle_info"]["versi"],
            "dibuat": bundle["bundle_info"]["dibuat"],
            "jumlah_listing_sumber": bundle["bundle_info"]["jumlah_listing_sumber"],
        },
        "segmentasi": {
            "metadata": segmentation["metadata"],
            "profil": frame_records(segmentation["profile"]),
            "kategori": {
                "kecamatan": list(segmentation["model_bundle"]["model"]._enc_map[0]),
                "jenis": list(segmentation["model_bundle"]["model"]._enc_map[1]),
            },
        },
        "gap_harga": {
            "metode": gap["metode"],
            "benchmark": frame_records(gap["benchmark"]),
            "keterbatasan": gap["keterbatasan"],
        },
    }


@app.post("/modeling/segment")
def modeling_segment(req: BundleAnalysisRequest):
    """Prediksi cluster harga menggunakan K-Prototypes dari bundle internal."""
    bundle = require_modeling_bundle()
    segmentation = bundle["segmentation"]
    model_bundle = segmentation["model_bundle"]
    category_maps = model_bundle["model"]._enc_map
    if req.kecamatan not in category_maps[0]:
        raise HTTPException(status_code=422, detail="Kecamatan tidak termasuk kategori training bundle.")
    if req.jenis not in category_maps[1]:
        raise HTTPException(status_code=422, detail="Jenis kos tidak termasuk kategori training bundle.")

    harga_log_robust = (
        math.log(req.harga) - model_bundle["log_harga_median"]
    ) / model_bundle["log_harga_iqr"]
    fitur = np.asarray([[harga_log_robust, req.kecamatan, req.jenis]], dtype=object)
    cluster_id = int(model_bundle["model"].predict(
        fitur,
        categorical=model_bundle["categorical_indices"],
    )[0])
    profil = segmentation["profile"]
    cocok = profil.loc[profil["cluster_id"] == cluster_id]
    if cocok.empty:
        raise HTTPException(status_code=500, detail="Profil cluster tidak ditemukan di bundle.")
    return {
        "cluster_id": cluster_id,
        "segmen": frame_records(cocok)[0],
        "model": segmentation["metadata"]["model"],
        "jumlah_listing": segmentation["metadata"]["jumlah_listing"],
    }


@app.post("/modeling/price-gap")
def modeling_price_gap(req: BundleAnalysisRequest):
    """Bandingkan harga dengan benchmark kecamatan dan jenis dari bundle."""
    bundle = require_modeling_bundle()
    benchmark = bundle["price_gap_analysis"]["benchmark"]
    cocok = benchmark.loc[
        (benchmark["kec"] == req.kecamatan)
        & (benchmark["jenis"] == req.jenis)
    ]
    if cocok.empty:
        raise HTTPException(status_code=404, detail="Benchmark untuk kecamatan dan jenis ini tidak tersedia.")

    data = frame_records(cocok)[0]
    gap_rp = req.harga - data["median"]
    gap_iqr = gap_rp / data["iqr"] if data["iqr"] else None
    if req.harga < data["q1"]:
        posisi = "di_bawah_q1"
    elif req.harga > data["q3"]:
        posisi = "di_atas_q3"
    else:
        posisi = "dalam_iqr"
    return {
        "harga_diuji": req.harga,
        "benchmark": data,
        "gap_rp_dari_median": round(gap_rp),
        "gap_iqr": round(gap_iqr, 3) if gap_iqr is not None else None,
        "posisi_q1_q3": posisi,
        "catatan": "Benchmark menggambarkan listing dalam dataset, bukan seluruh pasar.",
    }


def bulan_offset(bulan: date, offset: int) -> date:
    indeks = bulan.year * 12 + bulan.month - 1 + offset
    return date(indeks // 12, indeks % 12 + 1, 1)


@app.post("/forecast/omzet-paket")
def forecast_omzet_paket(req: ForecastOmzetRequest):
    """Forecast omzet paket dari seri dummy pembeli menggunakan Chronos-2."""
    import torch

    akhir = date.today().replace(day=1)
    musim_dummy = [0.88, 0.92, 0.96, 0.98, 1.02, 1.06, 1.08, 1.04, 0.97, 1.01, 1.10, 1.16]
    pertumbuhan = req.pertumbuhan_persen / 100
    histori = []
    nilai_histori = []
    for langkah in range(-35, 1):
        tanggal_bulan = bulan_offset(akhir, langkah)
        urutan = langkah + 35
        pembeli = max(0, round(req.pembeli_awal * (1 + pertumbuhan) ** urutan * musim_dummy[tanggal_bulan.month - 1]))
        histori.append({"bulan": tanggal_bulan.isoformat(), "pembeli": pembeli})
        nilai_histori.append(pembeli)

    try:
        with _CHRONOS_LOCK:
            pipeline, device = chronos2_pipeline()
            with torch.inference_mode():
                kuantil, _ = pipeline.predict_quantiles(
                    [torch.tensor(nilai_histori, dtype=torch.float32)],
                    prediction_length=req.horizon,
                    quantile_levels=[0.1, 0.5, 0.9],
                )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Chronos-2 tidak dapat membuat forecast ({type(exc).__name__}).",
        ) from exc

    keluaran = []
    for indeks in range(req.horizon):
        tanggal_bulan = bulan_offset(akhir, indeks + 1)
        pembeli_p10, pembeli_p50, pembeli_p90 = [max(0, round(float(v))) for v in kuantil[0][0, indeks].tolist()]
        keluaran.append({
            "bulan": tanggal_bulan.isoformat(),
            "label": tanggal_bulan.strftime("%b %Y"),
            "pembeli_p10": pembeli_p10,
            "pembeli_p50": pembeli_p50,
            "pembeli_p90": pembeli_p90,
            "omzet_p10": pembeli_p10 * HARGA_EKSKLUSIF,
            "omzet_p50": pembeli_p50 * HARGA_EKSKLUSIF,
            "omzet_p90": pembeli_p90 * HARGA_EKSKLUSIF,
        })

    return {
        "model": "amazon/chronos-2",
        "device": device,
        "harga_paket": HARGA_EKSKLUSIF,
        "dummy": True,
        "asumsi": {
            "pembeli_awal": req.pembeli_awal,
            "pertumbuhan_persen_bulanan": req.pertumbuhan_persen,
            "panjang_histori_bulan": len(histori),
            "catatan": "Histori pembeli dan pola musiman adalah dummy, bukan transaksi KOZY. Omzet dihitung dari jumlah pembeli dikali harga paket.",
        },
        "histori": histori,
        "forecast": keluaran,
        "ringkasan": {
            "pembeli_p50_total": sum(x["pembeli_p50"] for x in keluaran),
            "omzet_p50_total": sum(x["omzet_p50"] for x in keluaran),
        },
    }


@app.post("/vonis")
def vonis_harga(req: VonisRequest):
    """
    Endpoint utama penilaian kewajaran harga kos.
    Menghitung harga wajar log-linear hedonic, ditambah kelas harga K-Prototypes.
    """
    kec = req.kecamatan
    harga = req.harga
    fasilitas = req.fasilitas
    jenis = req.jenis

    stat = PASAR_DATA.get("kecamatan", {}).get(kec, {"n": 20, "p10": 700000, "p25": 850000, "p50": 1100000, "p75": 1600000, "p90": 2100000})

    harga_wajar, faktor, komposisi = hitung_wajar_log_linear(kec, fasilitas, jenis)
    selisih_rp = harga - harga_wajar
    selisih_persen = (selisih_rp / harga_wajar) * 100

    # Posisi persentil
    kos_kec = [k["harga"] for k in PASAR_DATA.get("kos", []) if k.get("kec") == kec]
    if kos_kec:
        persentil = max(1, min(99, round((sum(1 for h in kos_kec if h < harga) / len(kos_kec)) * 100)))
    else:
        persentil = 50

    return {
        "status": status_dari_selisih(selisih_persen),
        "harga_wajar": harga_wajar,
        "selisih_rp": round(selisih_rp),
        "selisih_persen": round(selisih_persen, 1),
        "persentil": persentil,
        "kisaran": [bulat10rb(harga_wajar * 0.85), bulat10rb(harga_wajar * 1.15)],
        "faktor": faktor,
        "komposisi": komposisi,
        "pasar": {
            "p10": stat.get("p10", 700000),
            "p25": stat.get("p25", 850000),
            "p50": stat.get("p50", 1100000),
            "p75": stat.get("p75", 1600000),
            "p90": stat.get("p90", 2100000),
            "n_pembanding": stat.get("n", 20)
        },
        "meta": {
            "confidence": "tinggi" if stat.get("n", 0) >= 40 else ("sedang" if stat.get("n", 0) >= 15 else "rendah"),
            "kecamatan": kec,
            "updated_at": PASAR_DATA.get("meta", {}).get("diambil", "2026-10-19"),
            "sumber": PASAR_DATA.get("meta", {}).get("sumber", "Mamikos + Papikost"),
            "mae": PASAR_DATA.get("meta", {}).get("mae", 279000),
            "anomali": abs(selisih_persen) > 60
        },
        # fitur eksklusif: frontend hanya menampilkannya ke pemilik paket
        "kelas": kelas_kos(KELAS_DATA, harga, kec, jenis),
    }


@app.get("/kelas")
def get_kelas_model():
    """Ringkasan model K-Prototypes: pemilihan k, uji, stabilitas, profil 3 kelas."""
    return {**KELAS_DATA, "kelas": [{k: v for k, v in c.items() if k != "harga_urut"} for c in KELAS_DATA.get("kelas", [])]}


@app.post("/kelas")
def klasifikasi_kelas(req: KelasRequest):
    """Fitur eksklusif 1 — masukkan satu kos ke kelas murah/menengah/mahal (prototipe terdekat)."""
    return kelas_kos(KELAS_DATA, req.harga, req.kecamatan, req.jenis)


@app.post("/gap-ab")
def gap_kos_ab(req: GapABRequest):
    """Fitur eksklusif 2 — gap harga & jarak kos A vs B, posisi di kelas, dan rekomendasi TOPSIS."""
    return gap_ab(KELAS_DATA, GAP_AB_DATA, req.a.model_dump(), req.b.model_dump(), req.prioritas)


@app.get("/forecast-pendapatan")
def get_forecast_meta():
    """Indeks musiman, uji chi-square, prior, dan skenario bawaan forecast pendapatan."""
    return FORECAST_DATA


@app.post("/forecast-pendapatan")
def forecast_pendapatan(req: ForecastRequest):
    """Forecast pendapatan KOZY dari paket eksklusif (Monte Carlo funnel)."""
    mulai = FORECAST_DATA["mulai"]
    hasil = simulasi_pendapatan(
        FORECAST_DATA["musiman"]["indeks"],
        mulai["bulan"],
        req.pengunjung_awal,
        req.pertumbuhan,
        req.prior_a,
        req.prior_b,
        sesi=req.sesi,
        pembeli=req.pembeli,
        harga=HARGA_EKSKLUSIF,
        horizon=req.horizon,
        draws=req.draws,
    )
    return {"mulai": mulai, **hasil}


if __name__ == "__main__":
    import uvicorn
    print("Menjalankan KOZY FastAPI Server di http://127.0.0.1:8000...")
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)
