import pandas as pd
import json
import os


BASE_DIR = os.path.dirname(os.path.abspath(__file__))


input_file = os.path.join(
    BASE_DIR,
    "papikost_surabaya_71.json"
)


output_file = os.path.join(
    BASE_DIR,
    "papikost_normalized.csv"
)



# =========================
# LOAD JSON
# =========================

with open(
    input_file,
    "r",
    encoding="utf-8"
) as f:

    data = json.load(f)


df = pd.DataFrame(data)



print("Data Papikost awal")
print(df.head())



# =========================
# RENAME COLUMN
# =========================


df.rename(
    columns={

        "nama":"nama_kost",
        "jenis":"jenis",
        "harga_max":"harga",
        "lat":"latitude",
        "lng":"longitude",
        "ulasan":"jumlah_ulasan",
        "dilihat":"jumlah_dilihat"

    },
    inplace=True
)



# =========================
# LOCATION
# =========================

df["lokasi"] = (
    df["kelurahan"]
    + ", "
    + df["kota"]
)



# =========================
# NORMALIZE JENIS
# =========================


def jenis_normal(x):

    x=str(x).lower()

    if "putri" in x:
        return "putri"

    elif "putra" in x:
        return "putra"

    elif "campur" in x:
        return "campur"

    else:
        return "lainnya"



df["jenis"] = (
    df["jenis"]
    .apply(jenis_normal)
)



# =========================
# EKSTRAK FASILITAS
# =========================


fasilitas = [

"ac",
"wifi",
"kmandi_dalam",
"lemari",
"meja_belajar",
"kasur",
"tv",
"pmotor",
"pmobil",
"dapur"

]


def extract_fasilitas(row):

    hasil={}

    for f in fasilitas:

        if f in row:

            hasil[f]=1

        else:

            hasil[f]=0


    return pd.Series(hasil)



fitur_fasilitas = (
    df["fasilitas"]
    .apply(extract_fasilitas)
)



df = pd.concat(
    [
        df,
        fitur_fasilitas
    ],
    axis=1
)



# =========================
# JUMLAH FASILITAS
# =========================


df["jumlah_fasilitas"] = (
    fitur_fasilitas.sum(axis=1)
)



# =========================
# TAMBAH SUMBER
# =========================


df["sumber"]="Papikost"



# =========================
# SIMPAN
# =========================


df.to_csv(
    output_file,
    index=False
)


print(
    "Selesai normalize Papikost"
)

print(
    output_file
)