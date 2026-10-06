# =============================================================================
# Segmentasi kos dengan K-Prototypes:
#   src/data/pasar.json  ->  src/data/segmen.json
#
# Keputusan di sini bukan selera, semuanya hasil pengujian (lihat
# notebooks/kozy_pembuktian_model.ipynb):
#
# 1. HARGA TIDAK IKUT jadi variabel cluster.
#    Kalau harga dipakai membentuk cluster lalu cluster itu dipakai menilai
#    kewajaran harga, penilaiannya melingkar — di aplikasi, harga itulah yang
#    justru sedang dipertanyakan. Diuji: cluster "pakai harga" tampak unggul
#    (MAPE 20,9%) hanya karena mengintip jawabannya; versi jujurnya 24,7%,
#    kalah dari hedonic 21,1%.
#    => Cluster MELABELI, hedonic MEMVONIS. Dua peran terpisah.
#
# 2. K-Prototypes, bukan K-Means one-hot.
#    Bukan karena lebih akurat — selisih silhouette keduanya +0,000, benar-benar
#    imbang. Alasannya keterbacaan: centroid K-Prototypes punya MODUS kategorikal
#    ("kecamatan khas kelompok ini") yang bisa dibaca langsung, sedangkan centroid
#    one-hot menghasilkan angka pecahan yang tak berarti.
#
# 3. k dipilih dengan syarat UKURAN, bukan silhouette tertinggi.
#    Cluster beranggota 7 tidak berguna sebagai label produk. Syaratnya minimal
#    MIN_ANGGOTA; di antara yang lolos, silhouette tertinggi yang menang.
#
# Variabel yang dipakai hanya yang terisi ~100%: 4 fasilitas inti + kecamatan +
# jenis. Rating (9% terisi), koordinat (22%), popularitas (79%) sengaja TIDAK
# dipakai — K-Prototypes tidak bisa menangani data hilang.
#
# Jalankan:  python scripts/build_segmen.py   (setelah build_pasar.py)
# =============================================================================
import io
import json
import os

import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASAR = os.path.join(BASE, "src", "data", "pasar.json")
KELUAR = os.path.join(BASE, "src", "data", "segmen.json")

FAS_CLUSTER = ["km", "ac", "wifi", "kasur"]  # hanya yang dicatat KEDUA situs
MIN_ANGGOTA = 15  # ~5% data; di bawah ini cluster tidak berguna sebagai label
K_DICOBA = range(2, 8)
BENIH = 1


# ---------------------------------------------------------------- K-Prototypes
def kprototypes(Xnum, Xcat, k, gamma, seed=0, iterasi=100):
    """Huang (1997): numerik pakai Euclid kuadrat, kategorikal pakai jumlah ketidakcocokan."""
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(Xnum), k, replace=False)
    Cnum, Ccat = Xnum[idx].copy(), Xcat[idx].copy()
    label = np.full(len(Xnum), -1)
    for _ in range(iterasi):
        d = jarak(Xnum, Xcat, Cnum, Ccat, gamma)
        baru = d.argmin(1)
        if (baru == label).all():
            break
        label = baru
        for j in range(k):
            m = label == j
            if not m.any():
                continue
            Cnum[j] = Xnum[m].mean(0)
            for c in range(Xcat.shape[1]):
                nilai, hitung = np.unique(Xcat[m, c], return_counts=True)
                Ccat[j, c] = nilai[hitung.argmax()]  # modus
    return label, Cnum, Ccat


def jarak(Xnum, Xcat, Cnum, Ccat, gamma):
    return ((Xnum[:, None, :] - Cnum[None]) ** 2).sum(2) + gamma * (Xcat[:, None, :] != Ccat[None]).sum(2)


def siluet(Xnum, Xcat, label, gamma):
    """Silhouette dengan jarak campuran yang sama seperti saat clustering."""
    n = len(label)
    if len(set(label)) < 2:
        return float("nan")
    D = np.sqrt(np.maximum(((Xnum[:, None, :] - Xnum[None]) ** 2).sum(2) + gamma * (Xcat[:, None, :] != Xcat[None]).sum(2), 0))
    skor = []
    for i in range(n):
        sendiri = label == label[i]
        sendiri[i] = False
        if not sendiri.any():
            continue
        a = D[i, sendiri].mean()
        b = min(D[i, label == j].mean() for j in set(label) if j != label[i])
        skor.append((b - a) / max(a, b))
    return float(np.mean(skor))


def main():
    pasar = json.load(io.open(PASAR, encoding="utf-8"))
    kos = pasar["kos"]

    # --- rakit matriks: TANPA harga ----------------------------------------
    Xmentah = np.array([[float(f in k["fasilitas"]) for f in FAS_CLUSTER] for k in kos])
    rata, simpang = Xmentah.mean(0), Xmentah.std(0)
    simpang[simpang == 0] = 1.0
    Xnum = (Xmentah - rata) / simpang
    Xcat = np.array([[k["kec"], k["jenis"]] for k in kos], dtype=object)
    gamma = float(0.5 * Xnum.std(0).mean())

    # --- pilih k: ukuran dulu, baru silhouette ------------------------------
    uji = []
    for k in K_DICOBA:
        label, _, _ = kprototypes(Xnum, Xcat, k, gamma, seed=BENIH)
        besar = np.bincount(label, minlength=k)
        uji.append({"k": k, "siluet": round(siluet(Xnum, Xcat, label, gamma), 3), "terkecil": int(besar.min()), "layak": bool(besar.min() >= MIN_ANGGOTA)})
    layak = [u for u in uji if u["layak"]]
    assert layak, f"tidak ada k dengan cluster >= {MIN_ANGGOTA} anggota"
    K = max(layak, key=lambda u: u["siluet"])["k"]

    label, Cnum, Ccat = kprototypes(Xnum, Xcat, K, gamma, seed=BENIH)

    # --- profil tiap cluster, diurutkan dari paling lengkap -----------------
    harga = np.array([k["harga"] for k in kos], float)
    urut = sorted(range(K), key=lambda j: -Xmentah[label == j].mean())
    petaBaru = {lama: baru for baru, lama in enumerate(urut)}
    label = np.array([petaBaru[l] for l in label])
    Cnum, Ccat = Cnum[urut], Ccat[urut]

    persen = lambda v, q: float(np.percentile(v, q))
    segmen = []
    for j in range(K):
        m = label == j
        h = harga[m]
        fas = {f: round(float(Xmentah[m, i].mean()) * 100) for i, f in enumerate(FAS_CLUSTER)}
        jn = {}
        for k in np.array(kos, dtype=object)[m]:
            jn[k["jenis"]] = jn.get(k["jenis"], 0) + 1
        kec = {}
        for k in np.array(kos, dtype=object)[m]:
            kec[k["kec"]] = kec.get(k["kec"], 0) + 1
        segmen.append(
            {
                "id": j,
                "nama": None,  # diisi di bawah
                "n": int(m.sum()),
                "bagian": round(float(m.mean()) * 100, 1),
                "harga": {"p25": persen(h, 25), "p50": persen(h, 50), "p75": persen(h, 75)},
                "fasilitas": fas,
                "jenis_terbanyak": max(jn, key=jn.get),
                "kecamatan_terbanyak": max(kec, key=kec.get),
                "pusat_numerik": [float(x) for x in Cnum[j]],
                "pusat_kategorik": [str(x) for x in Ccat[j]],
            }
        )

    # nama hanya berdasarkan kelengkapan fasilitas, bukan harga
    rerata = [np.mean(list(s["fasilitas"].values())) for s in segmen]
    for s, r in zip(segmen, rerata):
        s["nama"] = "Kos Lengkap" if r >= 75 else "Kos Menengah" if r >= 45 else "Kos Dasar"
    if len(set(s["nama"] for s in segmen)) < len(segmen):  # jaga-jaga nama kembar
        for i, s in enumerate(segmen):
            s["nama"] = f"{s['nama']} {i + 1}" if sum(1 for x in segmen if x["nama"] == s["nama"]) > 1 else s["nama"]

    terkecil = min(s["bagian"] for s in segmen)
    hasil = {
        "meta": {
            "metode": "K-Prototypes (Huang 1997)",
            "k": K,
            "n": len(kos),
            "variabel_numerik": FAS_CLUSTER,
            "variabel_kategorik": ["kec", "jenis"],
            "gamma": gamma,
            "standardisasi": {"rata": [float(x) for x in rata], "simpang": [float(x) for x in simpang]},
            "min_anggota": MIN_ANGGOTA,
            "pemilihan_k": uji,
            "harga_dipakai": False,
            "layak_untuk_label_produk": bool(terkecil >= 15.0),
            "catatan": (
                "Harga sengaja TIDAK ikut membentuk cluster supaya penilaian kewajaran harga tidak melingkar. "
                "Segmen hanya untuk MELABELI; vonis wajar/mahal/murah tetap dari model hedonic di pasar.json."
            ),
            "peringatan": None if terkecil >= 15.0 else f"Segmen terkecil cuma {terkecil}% dari data, jadi label ini lemah sebagai pembeda di produk.",
        },
        "segmen": segmen,
        "label": [int(x) for x in label],  # urutannya mengikuti pasar.json['kos']
    }
    io.open(KELUAR, "w", encoding="utf-8", newline="\n").write(json.dumps(hasil, ensure_ascii=False, indent=1))

    print("pemilihan k (syarat: cluster terkecil >= %d anggota):" % MIN_ANGGOTA)
    for u in uji:
        print("  k=%d  siluet %.3f  terkecil %3d  %s" % (u["k"], u["siluet"], u["terkecil"], "layak" if u["layak"] else "cluster terlalu kecil"))
    print("k terpilih = %d -> %s" % (K, os.path.relpath(KELUAR, BASE)))
    print()
    for s in segmen:
        print(
            "  [%d] %-14s n=%3d (%4.1f%%)  harga p25-p75 Rp%s-%s  fasilitas %s"
            % (s["id"], s["nama"], s["n"], s["bagian"], format(int(s["harga"]["p25"]), ","), format(int(s["harga"]["p75"]), ","), s["fasilitas"])
        )
    if hasil["meta"]["peringatan"]:
        print("\nPERINGATAN:", hasil["meta"]["peringatan"])


if __name__ == "__main__":
    main()
