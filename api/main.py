"""
KOZY Backend API (FastAPI)
  /modeling/segment      segmen harga, K-Prototypes (bundle modeling)
  /modeling/price-gap    gap harga terhadap median & IQR kecamatan x jenis (bundle modeling)
  /modeling/summary      ringkasan kedua metode di atas
  /forecast/omzet-paket  proyeksi omzet paket, Chronos-2 di atas histori dummy

Tidak ada regresi. Cek Harga di frontend menghitung median & IQR yang sama
langsung dari web/src/data/pasar.json, jadi tetap jalan saat server tidur.
"""

import json
import math
import os
from datetime import date
from functools import lru_cache
from pathlib import Path
from threading import Lock
import warnings

warnings.filterwarnings("ignore")

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "web" / "src" / "data"
OUTPUT_DIR = ROOT_DIR / "output"
# harga paket KOZY Match, sama dengan HARGA_MATCH di frontend
HARGA_EKSKLUSIF = 19_900


def cari_bundle() -> Path:
    """KOZY_MODEL_BUNDLE_PATH > bundle lengkap di laptop tim > bundle publik di repo"""
    if os.environ.get("KOZY_MODEL_BUNDLE_PATH"):
        return Path(os.environ["KOZY_MODEL_BUNDLE_PATH"]).expanduser()
    lokal = ROOT_DIR.parent / "web" / "kozy_modeling_bundle_v1.pkl"
    return lokal if lokal.is_file() else OUTPUT_DIR / "kozy_modeling_bundle_public_v1.pkl"


MODEL_BUNDLE_PATH = cari_bundle()

# Load JSON datasets
def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

PASAR_DATA = load_json(DATA_DIR / "pasar.json")

def seragamkan(bundle: dict) -> dict:
    """Bundle publik menyimpan hanya ringkasan agregat dengan nama kunci *_aggregate.
    Samakan dengan nama kunci bundle lengkap supaya endpoint cukup membaca satu bentuk."""
    info, seg, gap = bundle["bundle_info"], bundle["segmentation"], bundle["price_gap_analysis"]
    info.setdefault("jumlah_listing_sumber", info.get("jumlah_listing_training"))
    info.setdefault("dibuat", None)
    seg.setdefault("profile", seg.get("profile_aggregate"))
    seg.setdefault("metadata", {"model": "K-Prototypes", "jumlah_listing": info["jumlah_listing_sumber"], **seg.get("metrics", {})})
    gap.setdefault("benchmark", gap.get("benchmark_aggregate"))
    gap.setdefault("keterbatasan", gap.get("catatan", []))
    return bundle


try:
    MODELING_BUNDLE = seragamkan(joblib.load(MODEL_BUNDLE_PATH)) if MODEL_BUNDLE_PATH.is_file() else None
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
    description="Backend KOZY: segmen K-Prototypes, gap harga median & IQR, dan forecast omzet Chronos-2."
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
# Request / Response Schemas
# =============================================================================
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
            "pasar_metode": PASAR_DATA.get("meta", {}).get("metode"),
            "modeling_bundle": MODELING_BUNDLE is not None,
            "modeling_bundle_file": MODEL_BUNDLE_PATH.name,
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


if __name__ == "__main__":
    import uvicorn
    print("Menjalankan KOZY FastAPI Server di http://127.0.0.1:8000...")
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)
