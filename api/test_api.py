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
    assert "Benchmarking" in r.json()["data_loaded"]["pasar_metode"]

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

    print("\nTesting regresi sudah dihapus...")
    assert client.post("/vonis", json={"kecamatan": "Sukolilo", "harga": 1300000}).status_code == 404

    print("\nTesting Chronos-2 package revenue forecast...")
    r = client.post("/forecast/omzet-paket", json={"pembeli_awal": 6, "pertumbuhan_persen": 3, "horizon": 3})
    assert r.status_code == 200, f"/forecast/omzet-paket error: {r.text}"
    forecast = r.json()
    assert forecast["model"] == "amazon/chronos-2" and forecast["dummy"] is True
    assert forecast["harga_paket"] == 19_900 and len(forecast["forecast"]) == 3
    for bulan in forecast["forecast"]:
        assert bulan["pembeli_p10"] <= bulan["pembeli_p50"] <= bulan["pembeli_p90"]
        assert bulan["omzet_p50"] == bulan["pembeli_p50"] * forecast["harga_paket"]

    print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_endpoints()
