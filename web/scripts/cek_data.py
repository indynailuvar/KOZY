# =============================================================================
# Memeriksa ulang seluruh data dari berkas MENTAH, bukan dari hasil olahan.
#
# Gunanya: memastikan tiap angka yang muncul di aplikasi dan di dashboard /admin
# memang bisa dilacak balik ke berkas hasil scraping. Kalau ada skrip build yang
# salah atau berkas mentah berubah, pemeriksaan di sini yang duluan berteriak.
#
# Jalankan:  python scripts/cek_data.py
# Keluarannya: daftar pemeriksaan (OK / BEDA) lalu rekap total keseluruhan.
# =============================================================================
import csv, io, json, math, os, re

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AKAR = os.path.dirname(WEB)
ok = []
gagal = []


def cek(nama, dapat, harap):
    (ok if dapat == harap else gagal).append("%-56s %s%s" % (nama, dapat, "" if dapat == harap else "  <- harap %s" % (harap,)))


# ---- mentah ----------------------------------------------------------------
mami = list(csv.DictReader(io.open(os.path.join(WEB, "data", "mamikos_bersih.csv"), encoding="utf-8-sig")))
papi = json.load(io.open(os.path.join(AKAR, "papikost_surabaya_71.json"), encoding="utf-8"))
gm = json.load(io.open(os.path.join(AKAR, "gmaps_all_basic.json"), encoding="utf-8"))
olxm = json.load(io.open(os.path.join(AKAR, "olx_data.json"), encoding="utf-8"))["data"]

# ---- hasil olahan ----------------------------------------------------------
pasar = json.load(io.open(os.path.join(WEB, "src", "data", "pasar.json"), encoding="utf-8"))
gmaps = json.load(io.open(os.path.join(WEB, "src", "data", "gmaps.json"), encoding="utf-8"))
olx = json.load(io.open(os.path.join(WEB, "src", "data", "olx.json"), encoding="utf-8"))
kaw = json.load(io.open(os.path.join(WEB, "src", "data", "kawasan.json"), encoding="utf-8"))
geo = json.load(io.open(os.path.join(WEB, "data", "geocode_cache.json"), encoding="utf-8"))

print("=== BERKAS MENTAH ===")
print("mamikos_bersih.csv          %4d baris" % len(mami))
print("papikost_surabaya_71.json   %4d baris" % len(papi))
print("gmaps_all_basic.json        %4d baris" % len(gm))
print("olx_data.json               %4d baris" % len(olxm))
print()

# 1. jumlah iklan sewa
mamiSah = [x for x in mami if x.get("harga_bulanan") and x.get("kecamatan") and (x.get("tipe_penghuni") or "").strip() in ("Putra", "Putri", "Campur") and 200_000 <= float(x["harga_bulanan"]) <= 10_000_000]
nama_harga = {(re.sub(r"\s+", " ", x["nama_kos"]).strip().lower(), int(float(x["harga_bulanan"]))) for x in mamiSah}
cek("Mamikos lolos saring (unik)", len(nama_harga), pasar["meta"]["n_sumber"]["Mamikos"])

papiSah = 0
luarKota = 0
luarHarga = 0
for r in papi:
    g = geo.get("%.5f,%.5f" % (r["lat"], r["lng"])) or {}
    if (g.get("kota") or r.get("kota")) != "Surabaya":
        luarKota += 1
    elif not (200_000 <= r["harga"] <= 10_000_000):
        luarHarga += 1
    elif g.get("kec"):
        papiSah += 1
cek("Papikost lolos saring", papiSah, pasar["meta"]["n_sumber"]["Papikost"])
cek("Papikost di luar Surabaya", luarKota, 3)
cek("Papikost harga di luar batas", luarHarga, 1)
cek("Total iklan sewa berharga asli", len(nama_harga) + papiSah, pasar["meta"]["n"])
cek("Iklan berkoordinat asli", sum(1 for k in pasar["kos"] if k.get("lat")), papiSah)

# 2. koordinat gmaps terbaca dari link
pola = re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)")
titik = [pola.search(r["link"]) for r in gm]
cek("Koordinat terbaca dari link Google Maps", sum(1 for t in titik if t), len(gm))
cek("Titik Google Maps dipakai", gmaps["meta"]["n"], len(gmaps["kos"]))

# 3. OLX
cek("OLX iklan terpakai", len(olxm), olx["meta"]["n"])
cek("OLX semua kategori sama (jual rumah kos)", len({r["category_id"] for r in olxm}), 1)
cek("OLX jumlah penjual", len({r["user_name"] for r in olxm}), len(olx["meta"]["penjual"]))
cek("OLX jumlah tanggal unggah", len({r["created_at"][:10] for r in olxm}), 1)
hargaOlx = sorted(r["price"]["value"]["raw"] for r in olxm)
cek("OLX harga terendah (rupiah)", int(hargaOlx[0]), 1_200_000_000)
cek("OLX harga tertinggi (rupiah)", int(hargaOlx[-1]), 7_500_000_000)

# 4. model dihitung ulang dari koefisien
M = pasar["model"]
salah = 0
for k in pasar["kos"]:
    t = math.exp(M["intercept"] + M["kec"][k["kec"]] + sum(M["fasilitas"][f] for f in k["fasilitas"]) + M["jenis"][k["jenis"]])
    if not (50_000 < t < 20_000_000):
        salah += 1
cek("Tebakan model masuk akal untuk semua iklan", salah, 0)
cek("Efek kecamatan sudah dipusatkan (rata-rata tertimbang ~0)",
    round(sum(M["kec"][k] * pasar["kecamatan"][k]["n"] for k in M["kec"]) / pasar["meta"]["n"], 9), 0.0)

# 5. kawasan
cek("Semua kawasan punya kecamatan", sum(1 for x in kaw["kawasan"] if x["kec"]), len(kaw["kawasan"]))
cek("Semua kawasan minimal 3 titik", min(x["titik"] for x in kaw["kawasan"]) >= 3, True)
cek("Id kawasan unik", len({x["id"] for x in kaw["kawasan"]}), len(kaw["kawasan"]))

# 6. tidak ada harga jual OLX yang bocor ke data sewa
cek("Tidak ada harga miliaran di data sewa", sum(1 for k in pasar["kos"] if k["harga"] > 10_000_000), 0)
cek("Tidak ada harga miliaran di perkiraan Google Maps", sum(1 for k in gmaps["kos"] if k["estimasi"] > 10_000_000), 0)

print("=== PEMERIKSAAN ===")
for x in ok:
    print("  OK   " + x)
for x in gagal:
    print("  BEDA " + x)
print()
print("%d cocok, %d beda" % (len(ok), len(gagal)))

print()
print("=== TOTAL AKHIR ===")
print("Iklan sewa berharga asli : %d  (%d Mamikos + %d Papikost) di %d kecamatan" % (pasar["meta"]["n"], pasar["meta"]["n_sumber"]["Mamikos"], pasar["meta"]["n_sumber"]["Papikost"], pasar["meta"]["kecamatan"]))
print("Titik lokasi Google Maps : %d dari %d (harga = perkiraan model)" % (gmaps["meta"]["n"], gmaps["meta"]["n_mentah"]))
print("  - wilayah dari geocoding: %d, dari titik terdekat: %d" % (gmaps["meta"]["n"] - gmaps["meta"]["n_wilayah_tetangga"], gmaps["meta"]["n_wilayah_tetangga"]))
print("Iklan rumah kos dijual   : %d (dashboard admin saja)" % olx["meta"]["n"])
kosUnik = pasar["meta"]["n"] + gmaps["meta"]["n"] - gmaps["meta"]["n_harga_asli"]
print("Kos unik di aplikasi     : %d  (%d berharga asli + %d hanya lokasi, %d kembar dibuang)" % (kosUnik, pasar["meta"]["n"], gmaps["meta"]["n"] - gmaps["meta"]["n_harga_asli"], gmaps["meta"]["n_harga_asli"]))
print("Kawasan bisa dipilih     : %d kelurahan di %d kecamatan" % (kaw["meta"]["n"], kaw["meta"]["kecamatan"]))
print("Ketelitian model         : meleset +-Rp %s (%.1f%%), R2 log %.3f" % (format(pasar["meta"]["mae"], ","), pasar["meta"]["mape"], pasar["meta"]["r2_log"]))
