# =============================================================================
# Menyiapkan data OLX untuk dashboard admin:
#   ../olx_data.json  ->  src/data/olx.json
#
# PENTING — sumber ini BUKAN harga sewa bulanan.
# Yang diiklankan adalah RUMAH KOST YANG DIJUAL (harga Rp 1,2–7,5 miliar),
# jadi angkanya tidak boleh ikut melatih atau mengisi model harga sewa.
# Mencampurnya akan merusak seluruh perhitungan "harga wajar" untuk penyewa.
#
# Yang bisa dipakai: sisi pemilik/investor. Model sewa dipakai untuk
# memperkirakan pendapatan bangunan itu, lalu dibandingkan dengan harga jualnya:
#
#   perkiraan_sewa_kamar = exp(intercept + efek_kecamatan + Σ peluang_fasilitas + efek_jenis)
#   pendapatan_setahun   = jumlah_kamar × perkiraan_sewa_kamar × 12
#   imbal_hasil_kotor    = pendapatan_setahun / harga_jual
#
# Batasan yang harus selalu ikut ditampilkan: 20 iklan, hanya 2 penjual,
# satu hari yang sama, dan terpusat di satu kawasan. Ini bukan sampel pasar.
#
# Jalankan:  python scripts/build_olx.py
# =============================================================================
import io
import json
import math
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AKAR = os.path.dirname(BASE)
SUMBER = os.path.join(AKAR, "olx_data.json")
PASAR = os.path.join(BASE, "src", "data", "pasar.json")
KELUAR = os.path.join(BASE, "src", "data", "olx.json")

bulat10rb = lambda n: int(round(n / 10_000) * 10_000)
rapat = lambda s: re.sub(r"\s+", " ", s or "").strip()


def angka(pola, teks):
    m = re.search(pola, teks, re.I)
    return int(m.group(1)) if m else None


def sewaPerKamar(pasar, kec):
    """Perkiraan sewa sebulan untuk kamar berfasilitas rata-rata di kecamatan itu."""
    M = pasar["model"]
    fids = list(M["fasilitas"])
    semua = pasar["kos"]
    adaKec = kec in M["kec"]
    if adaKec:
        fas = pasar["kecamatan"][kec]["fasilitas"]
        komposisi = pasar["kecamatan"][kec]["komposisi"]
    else:
        fas = {f: sum(1 for k in semua if f in k["fasilitas"]) / len(semua) * 100 for f in fids}
        komposisi = {j: sum(1 for k in semua if k["jenis"] == j) / len(semua) * 100 for j in ("putra", "putri", "campur")}
    log = (
        M["intercept"]
        + (M["kec"][kec] if adaKec else 0.0)
        + sum(M["fasilitas"][f] * (fas[f] / 100) for f in fids)
        + sum(M["jenis"][j] * (komposisi[j] / 100) for j in komposisi)
    )
    return bulat10rb(math.exp(log)), adaKec


def main():
    pasar = json.load(io.open(PASAR, encoding="utf-8"))
    mentah = json.load(io.open(SUMBER, encoding="utf-8"))
    rows = mentah["data"]

    keluar, penjual = [], {}
    for r in rows:
        harga = r["price"]["value"]["raw"]
        desk = rapat(r["description"])
        kamar = angka(r"\bKT\s*(\d+)", desk) or angka(r"(\d+)\s*KAMAR", r["title"])
        if not harga or not kamar:
            continue
        prm = {p["key"]: p.get("value") for p in (r.get("parameters") or [])}
        lr = r.get("locations_resolved") or {}
        kec = rapat(lr.get("SUBLOCALITY_LEVEL_1_name"))
        lb = angka(r"\bLB\s*(\d+)", desk) or prm.get("p_sqr_building")
        lb = int(lb) if lb else None
        # luas bangunan lebih kecil dari jumlah kamar jelas salah ketik di iklan
        if lb and lb < kamar * 4:
            lb = None
        sewa, adaKec = sewaPerKamar(pasar, kec)
        setahun = kamar * sewa * 12
        titik = (r.get("locations") or [{}])[0]
        penjual[r.get("user_name")] = penjual.get(r.get("user_name"), 0) + 1

        keluar.append(
            {
                "id": f"olx-{r['ad_id']}",
                "judul": rapat(r["title"]),
                "kec": kec or None,
                "harga_jual": int(harga),
                "kamar": kamar,
                "luas_bangunan": lb,
                "per_kamar": int(round(harga / kamar)),
                "per_m2": int(round(harga / lb)) if lb else None,
                "sewa_model": sewa,
                "sewa_pasti": adaKec,
                "pendapatan_setahun": setahun,
                "imbal_hasil": round(setahun / harga * 100, 2),
                "balik_modal_tahun": round(harga / setahun, 1),
                "penjual": rapat(r.get("user_name")),
                "tanggal": (r.get("created_at") or "")[:10],
                "lat": titik.get("lat"),
                "lng": titik.get("lon"),
                "url": f"https://www.olx.co.id/item/iid-{r['ad_id']}",
            }
        )

    tengah = lambda v: sorted(v)[len(v) // 2]
    kecs = sorted({k["kec"] for k in keluar if k["kec"]})
    hasil = {
        "meta": {
            "sumber": "OLX",
            "diambil": sorted({k["tanggal"] for k in keluar})[-1],
            "n": len(keluar),
            "n_iklan_total": mentah["metadata"]["total_ads"],
            "kecamatan": len(kecs),
            "penjual": penjual,
            "jenis_harga": "harga jual bangunan",
            "catatan": (
                "Iklan rumah kos DIJUAL, bukan sewa bulanan. Harga jual tidak dipakai melatih model sewa. "
                "Perkiraan sewa per kamar berasal dari model hedonic Mamikos + Papikost."
            ),
            "batasan": f"Hanya {len(keluar)} iklan dari {len(penjual)} penjual pada satu hari dan terpusat di kawasan kampus. Bukan sampel pasar, jadi angkanya hanya gambaran kasar.",
        },
        "ringkas": {
            "median_harga": tengah([k["harga_jual"] for k in keluar]),
            "median_kamar": tengah([k["kamar"] for k in keluar]),
            "median_per_kamar": tengah([k["per_kamar"] for k in keluar]),
            "median_imbal_hasil": round(tengah([k["imbal_hasil"] for k in keluar]), 2),
            "median_balik_modal": round(tengah([k["balik_modal_tahun"] for k in keluar]), 1),
        },
        "kos": sorted(keluar, key=lambda k: -k["harga_jual"]),
    }
    io.open(KELUAR, "w", encoding="utf-8", newline="\n").write(json.dumps(hasil, ensure_ascii=False, indent=1))

    print(f"{len(keluar)} iklan jual dari {len(kecs)} kecamatan -> {os.path.relpath(KELUAR, BASE)}")
    print(f"penjual: {penjual}")
    print(f"median harga jual Rp{hasil['ringkas']['median_harga']:,}  |  per kamar Rp{hasil['ringkas']['median_per_kamar']:,}")
    print(f"median imbal hasil kotor {hasil['ringkas']['median_imbal_hasil']}%/tahun  |  balik modal {hasil['ringkas']['median_balik_modal']} tahun")
    for k in hasil["kos"][:5]:
        print(f"  {k['kec']:14} {k['kamar']:>3} kamar  jual Rp{k['harga_jual']:>13,}  sewa/kamar Rp{k['sewa_model']:>9,}  imbal {k['imbal_hasil']:>5}%")


if __name__ == "__main__":
    main()
