import os
import json
import pandas as pd


BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)


input_file = os.path.join(
    BASE_DIR,
    "mamikos_listings.json"
)


output_file = os.path.join(
    BASE_DIR,
    "mamikos_normalized.csv"
)


with open(
    input_file,
    "r",
    encoding="utf-8"
) as f:

    raw = json.load(f)


df = pd.DataFrame(raw)


print("Data awal Mamikos")
print(df.head())
print(df.columns)