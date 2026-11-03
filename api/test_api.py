import sys
from pathlib import Path
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api"))
from main import app

client = TestClient(app)

def test_endpoints():
    print("Testing /health...")
    r = client.get("/health")
    assert r.status_code == 200, f"/health error: {r.text}"
    print("Health response:", r.json())
    assert r.json()["data_loaded"]["modeling_bundle"] is True

    print("\nTesting bundle modeling endpoints...")
    r = client.get("/modeling/summary")
    assert r.status_code == 200, f"/modeling/summary error: {r.text}"
    summary = r.json()
    assert summary["bundle"]["jumlah_listing_sumber"] == 307
    assert len(summary["segmentasi"]["profil"]) == 2
    assert "Sukolilo" in summary["segmentasi"]["kategori"]["kecamatan"]
    assert "putri" in summary["segmentasi"]["kategori"]["jenis"]
    assert "listing_price_positions" not in summary["gap_harga"]

    payload_model = {"harga": 900000, "kecamatan": "Sukolilo", "jenis": "putri"}
    r = client.post("/modeling/segment", json=payload_model)
    assert r.status_code == 200, f"/modeling/segment error: {r.text}"
    assert r.json()["cluster_id"] == 0
    r = client.post("/modeling/segment", json={**payload_model, "harga": 1750000, "kecamatan": "Gubeng", "jenis": "campur"})
    assert r.status_code == 200 and r.json()["cluster_id"] == 1

    r = client.post("/modeling/price-gap", json=payload_model)
    assert r.status_code == 200, f"/modeling/price-gap error: {r.text}"
    assert r.json()["benchmark"]["median"] == 1000000
    assert r.json()["posisi_q1_q3"] == "dalam_iqr"

    print("\nTesting Chronos-2 package revenue forecast...")
    r = client.post("/forecast/omzet-paket", json={"pembeli_awal": 6, "pertumbuhan_persen": 3, "horizon": 3})
    assert r.status_code == 200, f"/forecast/omzet-paket error: {r.text}"
    forecast = r.json()
    assert forecast["model"] == "amazon/chronos-2" and forecast["dummy"] is True
    assert forecast["harga_paket"] == 19_900 and len(forecast["forecast"]) == 3
    for bulan in forecast["forecast"]:
        assert bulan["pembeli_p10"] <= bulan["pembeli_p50"] <= bulan["pembeli_p90"]
        assert bulan["omzet_p50"] == bulan["pembeli_p50"] * forecast["harga_paket"]

    print("\nTesting POST /vonis...")
    payload = {
        "kawasan": "gayungan",
        "kecamatan": "Gayungan",
        "harga": 1500000,
        "jenis": "putri",
        "fasilitas": ["ac", "km", "wifi"]
    }
    r = client.post("/vonis", json=payload)
    assert r.status_code == 200, f"/vonis error: {r.text}"
    res = r.json()
    print("Vonis status:", res["status"], "Harga wajar:", res["harga_wajar"], "Kelas:", res["kelas"]["label"])
    assert "kelas" in res and "gap" not in res
    assert "status" in res

    print("\nTesting POST /kelas...")
    for harga, kelas in [(600_000, "murah"), (1_200_000, "menengah"), (2_500_000, "mahal")]:
        r = client.post("/kelas", json={"harga": harga, "kecamatan": "Sukolilo", "jenis": "putri"})
        assert r.status_code == 200, f"/kelas error: {r.text}"
        assert r.json()["id"] == kelas, f"Rp{harga} seharusnya {kelas}, dapat {r.json()['id']}"
    print("Kelas OK; contoh:", r.json()["label"], "persentil", r.json()["persentil"])

    print("\nTesting POST /gap-ab...")
    r = client.post("/gap-ab", json={"a": {"nama": "A", "harga": 900_000, "jarak": 2.0}, "b": {"nama": "B", "harga": 1_300_000, "jarak": 0.5}, "prioritas": "hemat"})
    assert r.status_code == 200, f"/gap-ab error: {r.text}"
    res = r.json()
    print("Gap harga:", res["gap"]["harga"], "TOPSIS:", res["topsis"]["skor"], "menang:", res["topsis"]["menang"])
    assert res["topsis"]["menang"] == "a"  # prioritas hemat -> yang lebih murah
    r = client.post("/gap-ab", json={"a": {"nama": "A", "harga": 900_000, "jarak": 2.0}, "b": {"nama": "B", "harga": 1_000_000, "jarak": 0.5}, "prioritas": "dekat"})
    assert r.json()["topsis"]["menang"] == "b"  # prioritas dekat -> yang lebih dekat
    # kos Google Maps tanpa harga asli: dibandingkan dengan jarak saja
    r = client.post("/gap-ab", json={"a": {"nama": "A", "harga": 900_000, "jarak": 2.0}, "b": {"nama": "B (GMaps)", "jarak": 0.5}, "prioritas": "hemat"})
    res = r.json()
    assert r.status_code == 200 and res["gap"]["harga"] is None and res["b"]["kelas"] is None
    assert res["topsis"]["pakai_harga"] is False and res["topsis"]["menang"] == "b"

    print("\nTesting POST /forecast-pendapatan...")
    r = client.post("/forecast-pendapatan", json={"pengunjung_awal": 1000, "pertumbuhan": 0.02, "draws": 2000})
    assert r.status_code == 200, f"/forecast-pendapatan error: {r.text}"
    res = r.json()
    print("Total 12 bulan (median):", res["kumulatif"]["p50"][-1], "konversi:", res["konversi"])
    assert res["kumulatif"]["p10"][-1] <= res["kumulatif"]["p50"][-1] <= res["kumulatif"]["p90"][-1]

    print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_endpoints()
