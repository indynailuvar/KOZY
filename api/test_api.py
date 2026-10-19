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

    print("\nTesting POST /forecast-pendapatan...")
    r = client.post("/forecast-pendapatan", json={"pengunjung_awal": 1000, "pertumbuhan": 0.02, "draws": 2000})
    assert r.status_code == 200, f"/forecast-pendapatan error: {r.text}"
    res = r.json()
    print("Total 12 bulan (median):", res["kumulatif"]["p50"][-1], "konversi:", res["konversi"])
    assert res["kumulatif"]["p10"][-1] <= res["kumulatif"]["p50"][-1] <= res["kumulatif"]["p90"][-1]

    print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_endpoints()
