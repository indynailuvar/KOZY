import pandas as pd
import json


# MAMIKOS

mamikos = pd.read_csv(
    "mamikos_bersih.csv"
)

print("\n===== MAMIKOS =====")
print(mamikos.shape)
print(mamikos.columns)



# PAPIKOST

with open(
    "papikost_surabaya_71.json",
    encoding="utf-8"
) as f:
    papikost=json.load(f)


papikost=pd.DataFrame(papikost)


print("\n===== PAPIKOST =====")
print(papikost.shape)
print(papikost.columns)