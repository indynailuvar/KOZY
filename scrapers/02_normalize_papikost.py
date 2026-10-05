import pandas as pd
import json


with open(
    "papikost_surabaya_71.json",
    encoding="utf-8"
) as f:

    data=json.load(f)



df=pd.DataFrame(data)



print(df.shape)



# Rename

df.rename(
columns={

"nama":"nama_kost",
"harga_max":"harga",
"jenis":"jenis",
"lat":"latitude",
"lng":"longitude",
"ulasan":"jumlah_ulasan",
"dilihat":"jumlah_dilihat"

},
inplace=True
)



# lokasi

df["lokasi"]=(
    df["kelurahan"]
    +" "
    +df["kota"]
)



# fasilitas

fasilitas_master=[

"ac",
"wifi",
"kmandi_dalam",
"lemari",
"meja_belajar",
"kasur",
"tv",
"pmotor",
"pmobil"

]



for f in fasilitas_master:

    df[f]=df["fasilitas"].apply(
        lambda x:
        1 if f in x else 0
    )



df["jumlah_fasilitas"]=(
    df[fasilitas_master]
    .sum(axis=1)
)



df["sumber"]="Papikost"



df.to_csv(
"output/papikost_normalized.csv",
index=False
)


print("Selesai")