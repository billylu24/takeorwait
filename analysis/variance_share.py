"""How much of offering-to-offering A-rate variation is era vs instructor?

For each course with >=15 regular-quarter offerings (n>=20 graded) and >=3 instructors:
- era_R2: share of variance explained by era means
- instructor_R2_after_era: share of era-adjusted variance explained by instructor means
  (instructors with >=2 offerings only). In-sample group means overfit, so this is an UPPER bound.
"""
import numpy as np
import pandas as pd

from load import load

df = load()
df = df[(df.nGraded >= 20) & (df.quarter != "Summer")].assign(rate=lambda x: x.nA / x.nGraded)

rows = []
for course, d in df.groupby("course"):
    if len(d) < 15 or d.instructor.nunique() < 3:
        continue
    tot = ((d.rate - d.rate.mean()) ** 2).sum()
    adj = d.rate - d.groupby("era", observed=True).rate.transform("mean")
    era_r2 = 1 - (adj ** 2).sum() / tot if tot > 0 else np.nan
    ins_mean = adj.groupby(d.instructor).transform("mean")
    multi = d.instructor.map(d.instructor.value_counts()) >= 2
    ins_r2 = ((ins_mean - adj.mean())[multi] ** 2).sum() / (adj ** 2).sum() if (adj ** 2).sum() > 0 else np.nan
    rows.append((course, len(d), d.instructor.nunique(), era_r2, ins_r2))

r = pd.DataFrame(rows, columns=["course", "offerings", "instructors", "era_R2", "instructor_R2_after_era"])
print(f"{len(r)} courses with >=15 regular offerings and >=3 instructors")
print(r[["era_R2", "instructor_R2_after_era"]].describe(percentiles=[.25, .5, .75]).round(2).to_string())
print("\nMost instructor-sensitive (era-adjusted):")
print(r.sort_values("instructor_R2_after_era", ascending=False).head(10).round(2).to_string(index=False))
print("\nLeast instructor-sensitive:")
print(r.sort_values("instructor_R2_after_era").head(10).round(2).to_string(index=False))
