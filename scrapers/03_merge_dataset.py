import pandas as pd



mamikos=pd.read_csv(
"output/mamikos_normalized.csv"
)


papikost=pd.read_csv(
"output/papikost_normalized.csv"
)



kolom=[

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
"sumber"

]



for df in [mamikos,papikost]:

    for c in kolom:

        if c not in df.columns:

            df[c]=None



mamikos=mamikos[kolom]

papikost=papikost[kolom]



final=pd.concat(
[
mamikos,
papikost
],
ignore_index=True
)



final.drop_duplicates(
subset=[
"nama_kost",
"lokasi"
],
inplace=True
)



final.to_csv(
"output/kozy_dataset_final.csv",
index=False
)



print(final.shape)
print("BERHASIL")