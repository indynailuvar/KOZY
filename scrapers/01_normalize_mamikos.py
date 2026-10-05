import pandas as pd
import os


input_file="mamikos_bersih.csv"


output_file="output/mamikos_normalized.csv"



df=pd.read_csv(input_file)



print("Jumlah data Mamikos:")
print(df.shape)



# Rename sesuai standar KOZY


mapping={

"nama_kos":"nama_kost",
"tipe_penghuni":"jenis",
"harga_bulanan":"harga",
"dilihat":"jumlah_dilihat"

}



df.rename(
    columns=mapping,
    inplace=True
)



# lokasi

if "kecamatan" in df.columns:

    df["lokasi"]=df["kecamatan"]

else:

    df["lokasi"]=None



# sumber

df["sumber"]="Mamikos"



df.to_csv(
    output_file,
    index=False
)


print("Selesai")