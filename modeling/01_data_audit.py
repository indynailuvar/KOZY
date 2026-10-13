from pathlib import Path

import pandas as pd


# ============================================================
# PROJECT PATH
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATA_PATH = (
    PROJECT_ROOT
    / "analysis"
    / "kozy_dataset_clean.csv"
)

OUTPUT_DIR = (
    PROJECT_ROOT
    / "modeling"
    / "output"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("KOZY - DATA AUDIT")
print("=" * 70)

print("\nProject root:")
print(PROJECT_ROOT)

print("\nDataset:")
print(DATA_PATH)


if not DATA_PATH.exists():
    raise FileNotFoundError(
        f"\nDataset tidak ditemukan:\n{DATA_PATH}"
    )


df = pd.read_csv(DATA_PATH)


# ============================================================
# BASIC INFORMATION
# ============================================================

print("\n" + "=" * 70)
print("BASIC INFORMATION")
print("=" * 70)

print("Rows   :", df.shape[0])
print("Columns:", df.shape[1])


# ============================================================
# COLUMNS
# ============================================================

print("\n" + "=" * 70)
print("COLUMNS")
print("=" * 70)

for number, column in enumerate(
    df.columns,
    start=1
):
    print(
        f"{number:02d}. {column}"
    )


# ============================================================
# DATA TYPES
# ============================================================

print("\n" + "=" * 70)
print("DATA TYPES")
print("=" * 70)

print(
    df.dtypes.to_string()
)


# ============================================================
# MISSING VALUES
# ============================================================

print("\n" + "=" * 70)
print("MISSING VALUES")
print("=" * 70)

missing = pd.DataFrame({

    "column": df.columns,

    "dtype": [
        str(dtype)
        for dtype in df.dtypes
    ],

    "non_null": [
        df[column].notna().sum()
        for column in df.columns
    ],

    "missing": [
        df[column].isna().sum()
        for column in df.columns
    ]
})


missing["missing_pct"] = (
    missing["missing"]
    / len(df)
    * 100
).round(2)


print(
    missing
    .sort_values(
        "missing_pct",
        ascending=False
    )
    .to_string(index=False)
)


# ============================================================
# DUPLICATE
# ============================================================

print("\n" + "=" * 70)
print("DUPLICATE")
print("=" * 70)

duplicate_count = df.duplicated().sum()

print(
    "Duplicate rows:",
    duplicate_count
)


# ============================================================
# TARGET
# ============================================================

print("\n" + "=" * 70)
print("HARGA")
print("=" * 70)

if "harga" not in df.columns:
    raise ValueError(
        "Kolom 'harga' tidak ditemukan."
    )

print(
    df["harga"].describe()
)


# ============================================================
# SOURCE
# ============================================================

if "sumber" in df.columns:

    print("\n" + "=" * 70)
    print("SUMBER DATA")
    print("=" * 70)

    print(
        df["sumber"]
        .value_counts(
            dropna=False
        )
        .to_string()
    )


# ============================================================
# CATEGORICAL DISTRIBUTION
# ============================================================

for column in [
    "jenis",
    "lokasi"
]:

    if column not in df.columns:
        continue

    print("\n" + "=" * 70)
    print(
        f"DISTRIBUSI {column.upper()}"
    )
    print("=" * 70)

    print(
        df[column]
        .value_counts(
            dropna=False
        )
        .to_string()
    )


# ============================================================
# NUMERIC DESCRIPTION
# ============================================================

print("\n" + "=" * 70)
print("NUMERIC DESCRIPTION")
print("=" * 70)

numeric_summary = (
    df
    .select_dtypes(
        include="number"
    )
    .describe()
    .transpose()
)

print(
    numeric_summary.to_string()
)


# ============================================================
# SAVE AUDIT
# ============================================================

output_file = (
    OUTPUT_DIR
    / "data_audit.xlsx"
)

with pd.ExcelWriter(
    output_file,
    engine="openpyxl"
) as writer:

    missing.to_excel(
        writer,
        sheet_name="missing",
        index=False
    )

    numeric_summary.to_excel(
        writer,
        sheet_name="numeric_summary"
    )

    df.describe(
        include="all"
    ).transpose().to_excel(
        writer,
        sheet_name="describe_all"
    )

    df.head(20).to_excel(
        writer,
        sheet_name="sample",
        index=False
    )


print("\n" + "=" * 70)
print("AUDIT SELESAI")
print("=" * 70)

print(
    "Output:",
    output_file
)