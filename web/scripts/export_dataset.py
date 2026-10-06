# =============================================================================
# Mengekspor dataset kanonik ke CSV datar untuk pemodelan & skripsi:
#   src/data/pasar.json  ->  analysis/kozy_dataset_final.csv
#
# KENAPA ADA BERKAS INI
# Sempat ada DUA jalur penggabungan yang hidup berdampingan dan menghasilkan
# angka berbeda: satu lewat scrapers/03_merge_dataset.py, satu lewat
# scripts/build_pasar.py. Yang pertama diam-diam mengosongkan seluruh fasilitas
# Mamikos (nama kolomnya ada_ac, yang dicari ac) sehingga MAPE model melonjak
# dari 21% ke 35%, tanpa pesan error apa pun.
#
# Pelajarannya: logika penggabungan tidak boleh ditulis dua kali. Sekarang
# penggabungan HANYA terjadi di build_pasar.py, lengkap dengan reverse geocoding,
# penyaringan, dan pemeriksaan yang gagal berisik. Berkas ini sekadar meratakan
# hasilnya ke CSV supaya tetap nyaman dipakai di notebook.
#
# ARTI SEL KOSONG — penting, jangan diisi 0
#   kosong = situs sumbernya TIDAK MENCATAT kolom itu  (bukan berarti tidak ada)
#   0      = tercatat, dan memang tidak ada
#   1      = tercatat, dan ada
# Mengisi "tidak tercatat" dengan 0 akan membuat situs yang tidak mencatat
# terlihat seolah-olah semua kosnya tanpa fasilitas itu — persis kesalahan yang
# dulu membuat modelnya melenceng.
#
# Jalankan:  python scripts/export_dataset.py   (setelah build_pasar.py)
# =============================================================================
import csv
import io
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASAR = os.path.join(BASE, "src", "data", "pasar.json")
SEGMEN = os.path.join(BASE, "src", "data", "segmen.json")
KELUAR = os.path.join(BASE, "analysis", "kozy_dataset_final.csv")

# fasilitas yang dicatat tiap situs — menentukan kolom mana yang boleh berisi 0
DICATAT = {
    "Mamikos": ["km", "ac", "wifi", "kasur", "kloset", "akses24"],
    "Papikost": ["km", "ac", "wifi", "kasur", "lemari", "meja", "pmotor", "pmobil", "tv", "dispenser"],
}
FASILITAS = ["km", "ac", "wifi", "kasur", "kloset", "akses24", "lemari", "meja", "pmotor", "pmobil", "tv", "dispenser"]
KOLOM = (
    ["nama_kost", "kecamatan", "kelurahan", "jenis", "harga", "sumber"]
    + ["fas_" + f for f in FASILITAS]
    + ["n_fasilitas_tercatat", "rating", "jumlah_dilihat", "sisa_kamar", "latitude", "longitude", "segmen", "url"]
)


def main():
    pasar = json.load(io.open(PASAR, encoding="utf-8"))
    kos = pasar["kos"]

    segmen = {}
    if os.path.exists(SEGMEN):
        sg = json.load(io.open(SEGMEN, encoding="utf-8"))
        nama = {s["id"]: s["nama"] for s in sg["segmen"]}
        segmen = {i: nama[l] for i, l in enumerate(sg["label"])}

    os.makedirs(os.path.dirname(KELUAR), exist_ok=True)
    kosong = {f: 0 for f in FASILITAS}
    with io.open(KELUAR, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=KOLOM, lineterminator="\n")
        w.writeheader()
        for i, k in enumerate(kos):
            dicatat = DICATAT[k["sumber"]]
            punya = set(k["fasilitas"]) | set(k.get("fasilitas_lain") or [])
            baris = {
                "nama_kost": k["nama"],
                "kecamatan": k["kec"],
                "kelurahan": k.get("kel") or "",
                "jenis": k["jenis"],
                "harga": k["harga"],
                "sumber": k["sumber"],
                "n_fasilitas_tercatat": len(dicatat),
                "rating": k.get("rating") if k.get("rating") is not None else "",
                "jumlah_dilihat": k.get("dilihat") if k.get("dilihat") is not None else "",
                "sisa_kamar": k.get("sisa_kamar") if k.get("sisa_kamar") is not None else "",
                "latitude": k.get("lat") if k.get("lat") is not None else "",
                "longitude": k.get("lng") if k.get("lng") is not None else "",
                "segmen": segmen.get(i, ""),
                "url": k.get("url") or "",
            }
            for fas in FASILITAS:
                # kosong kalau situsnya memang tidak mencatat kolom ini
                baris["fas_" + fas] = (1 if fas in punya else 0) if fas in dicatat else ""
                if fas in dicatat and fas in punya:
                    kosong[fas] += 1
            w.writerow(baris)

    n = len(kos)
    print("%d baris x %d kolom -> %s" % (n, len(KOLOM), os.path.relpath(KELUAR, BASE)))
    print("sumber:", pasar["meta"]["n_sumber"])
    print()
    print("%-12s %-22s %s" % ("fasilitas", "dicatat oleh", "yang punya"))
    for fas in FASILITAS:
        oleh = [s for s, d in DICATAT.items() if fas in d]
        n_amati = sum(1 for k in kos if k["sumber"] in oleh)
        print("  fas_%-9s %-22s %3d dari %3d tercatat" % (fas, "+".join(oleh), kosong[fas], n_amati))
    print()
    print("Sel kosong = situs tidak mencatat kolom itu. JANGAN diisi 0 saat pemodelan;")
    print("pakai penanda 'tidak tercatat' atau batasi analisis ke situs yang mencatatnya.")


if __name__ == "__main__":
    main()
