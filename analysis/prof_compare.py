"""Within-course instructor comparison: raw A-rate, percentile, shrunk estimate, rotation.

Usage: python analysis/prof_compare.py "CMPSC 24" "MATH 4B" "PHYS 7A"

Prototype only. Known gap: the shrinkage here is NOT era-adjusted yet (see docs/methodology.md).
"""
import sys

import numpy as np

from load import load


def compare(df, course):
    d = df[(df.course == course) & (df.nGraded >= 5)]
    reg = d[d.quarter != "Summer"].assign(rate=lambda x: x.nA / x.nGraded)
    print(f"\n==================== {course}: {len(d)} offerings ({len(reg)} non-summer), "
          f"{d.year.min()}-{d.year.max()}, {d.nGraded.sum()} graded students")
    if reg.empty:
        return

    m, v = reg.rate.mean(), reg.rate.var()
    # between-instructor variance = offering variance minus expected binomial noise
    tau2 = max(v - m * (1 - m) / reg.nGraded.mean(), 1e-4)

    g = reg.groupby("instructor").agg(
        offerings=("rate", "size"), students=("nGraded", "sum"), nA=("nA", "sum"),
        lo=("rate", "min"), hi=("rate", "max"), gpa=("avgGPA", "mean"),
        DF=("nDF", "sum"), last=("t", "max"),
        quarters=("quarter", lambda s: ",".join(sorted({q[:2] for q in s}))))
    g["raw"] = g.nA / g.students

    shrunk, sd = {}, {}
    for ins, rates in reg.groupby("instructor")["rate"]:
        n = len(rates)
        within = rates.var(ddof=1) if n > 1 else v
        se2 = max(within, 1e-4) / n
        w = tau2 / (tau2 + se2)
        shrunk[ins] = w * rates.mean() + (1 - w) * m
        sd[ins] = np.sqrt(w * se2)
    g["shrunk"] = g.index.map(shrunk)
    g["sd"] = g.index.map(sd)
    g["pctile"] = (g.raw.rank(pct=True) * 100).round(0)
    g["DF%"] = (g.DF / g.students * 100).round(1)
    g["gpa"] = g.gpa.round(2)
    g["last"] = g["last"].map(lambda t: f"{int(t)}{['Wi', 'Sp', 'Su', 'Fa'][round((t % 1) * 4)]}")
    for col in ["raw", "lo", "hi", "shrunk", "sd"]:
        g[col] = (g[col] * 100).round(1)

    print(f"course mean A-rate per offering = {m:.1%}, between-offering sd = {np.sqrt(v):.1%}")
    cols = ["offerings", "students", "quarters", "last", "raw", "lo", "hi", "shrunk", "sd", "pctile", "DF%", "gpa"]
    print(g.sort_values("shrunk", ascending=False)[cols].head(14).to_string())

    era = reg.groupby("era", observed=True).apply(lambda x: x.nA.sum() / x.nGraded.sum())
    print("A-rate by era:", " | ".join(f"{e}: {r:.0%}" for e, r in era.items()))
    rec = reg.sort_values("t").tail(8)
    print("recent rotation:", " -> ".join(
        f"{q[:2]}{y} {i.split()[0]}" for q, y, i in zip(rec.quarter, rec.year, rec.instructor)))


if __name__ == "__main__":
    data = load()
    for c in sys.argv[1:] or ["CMPSC 24", "MATH 4B", "PHYS 7A"]:
        compare(data, c)
