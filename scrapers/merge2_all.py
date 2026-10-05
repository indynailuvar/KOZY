import pandas as pd
import os



BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)



# FILE

mamikos_file = os.path.join(
    BASE_DIR,
    "mamikos_normalized.csv"
)


papikost_file = os.path.join(
    BASE_DIR,
    "papikost_normalized.csv"
)



# LOAD

mamikos = pd.read_csv(
    mamikos_file
)


papikost = pd.read_csv(
    papikost_file
)



print(
    "Mamikos:",
    mamikos.shape
)


print(
    "Papikost:",
    papikost.shape
)



# =========================
# SAMAKAN COLUMN
# =========================


kolom_final=[

"nama_kost",
"lokasi",
"latitude",
"longitude",
"harga",
"jenis",
"rating",
"jumlah_ulasan",
"jumlah_dilihat",
"sisa_kamar",

"jumlah_fasilitas",

"ac",
"wifi",
"kmandi_dalam",
"lemari",
"meja_belajar",
"kasur",
"tv",
"pmotor",
"pmobil",
"dapur",

"sumber"

]



for col in kolom_final:

    if col not in mamikos.columns:

        mamikos[col]=None



    if col not in papikost.columns:

        papikost[col]=None



mamikos=mamikos[kolom_final]

papikost=papikost[kolom_final]



# =========================
# GABUNG
# =========================


kozy = pd.concat(
    [
        mamikos,
        papikost
    ],
    ignore_index=True
)



# =========================
# HAPUS DUPLIKASI
# =========================


kozy.drop_duplicates(
    subset=[
        "nama_kost",
        "lokasi"
    ],
    inplace=True
)



# =========================
# SAVE
# =========================


output=os.path.join(
    BASE_DIR,
    "output",
    "kozy_dataset_final.csv"
)



kozy.to_csv(
    output,
    index=False
)



print("================")
print("DATA FINAL")
print(kozy.shape)
print("================")


print(output)