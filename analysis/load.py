"""Load and normalize the Daily Nexus courseGrades.csv.

Known quirks handled here:
- course codes are space-padded ("CMPSC    24"); 2026 rows also have trailing spaces ("PHYS      7A ").
- 2026 rows pad instructor names ("KOUTROULAKIS                  "), which silently splits one person in two.
- "A", "B", ... exclude plus/minus; letter totals must add Ap/Am etc.
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "data" / "raw" / "courseGrades.csv"

LETTERS = ["A", "Ap", "Am", "B", "Bp", "Bm", "C", "Cp", "Cm", "D", "Dp", "Dm", "F"]
QUARTER_ORDER = {"Winter": 0, "Spring": 1, "Summer": 2, "Fall": 3}
ERAS = [2008, 2014, 2019, 2021, 2026]
ERA_LABELS = ["09-14", "15-19", "20-21", "22-26"]


def load(path=DEFAULT_CSV) -> pd.DataFrame:
    df = pd.read_csv(path)
    for col in ["course", "instructor", "dept", "quarter"]:
        df[col] = df[col].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    df["nA"] = df[["A", "Ap", "Am"]].sum(axis=1)
    df["nGraded"] = df[LETTERS].sum(axis=1)
    df["nDF"] = df[["D", "Dp", "Dm", "F"]].sum(axis=1)
    df["t"] = df["year"] + df["quarter"].map(QUARTER_ORDER) / 4
    df["era"] = pd.cut(df["year"], ERAS, labels=ERA_LABELS)
    return df
