"""Build the static JSON artifacts the website reads.

Usage (from analysis/):  python build_site_data.py [--out ../web/public/data]

Writes
  courses/<slug>.json   one file per course: history, era levels, instructor estimates, sensitivity
  index.json            search index (course, dept, offerings, students, last quarter, recent instructors)
  manifest.json         source checksum, fetch time, model priors, build time
"""
import argparse
import json
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from scipy.special import expit

from load import DEFAULT_CSV, ROOT, load
from model import (
    BOOT,
    DF0,
    J0,
    K0,
    MIN_GRADED,
    MIN_OFFERINGS,
    MIN_REPEAT,
    Z90,
    baseline,
    fit_all,
    instructor_table,
)

Q_ABBR = {"Winter": "W", "Spring": "S", "Summer": "M", "Fall": "F"}
PLAT_URL = "https://ucsbplat.com/curriculum/course/{}"
RECENT_YEARS = 3  # instructors who taught within this many years show up in the search index


def slug(course):
    return re.sub(r"[^A-Za-z0-9]+", "-", course).strip("-")


def wilson(k, n, z=1.96):
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return centre - half, centre + half


def sensitivity_label(score, lo, hi):
    """Plain-language label. Uses the interval, not just the point estimate."""
    if np.isnan(score):
        return "insufficient"
    if score >= 0.3 and lo >= 0.1:
        return "large"
    if score >= 0.1 and lo > 0:
        return "moderate"
    if hi < 0.15:
        return "small"
    return "unclear"


def r3(x):
    return None if x is None or np.isnan(x) else round(float(x), 3)


def qlabel(year, quarter):
    return f"{quarter} {year}"


def build_course(code, d_all, fa, fd):
    """d_all: every offering (incl. summer and tiny ones). fa/fd: A-rate and D/F fits."""
    d_all = d_all.sort_values("t")
    shown = d_all[d_all.nGraded >= MIN_GRADED]
    reg = shown[shown.quarter != "Summer"]

    history = []
    for row in shown.itertuples():
        a_lo, a_hi = wilson(row.nA, row.nGraded)
        history.append([
            round(float(row.t), 2), int(row.year), Q_ABBR[row.quarter], row.instructor,
            int(row.nGraded), int(row.nA), round(a_lo, 3), round(a_hi, 3), int(row.nDF),
            r3(row.avgGPA),
        ])

    ta = instructor_table(fa).set_index("instructor")
    td = instructor_table(fd).set_index("instructor")
    instructors = []
    for name, g in reg.groupby("instructor"):
        first, last = g.iloc[0], g.iloc[-1]
        a, dfr = ta.loc[name], td.loc[name]
        n = int(g.nGraded.sum())
        instructors.append({
            "name": name,
            "offerings": len(g),
            "students": n,
            "first": qlabel(first.year, first.quarter),
            "last": qlabel(last.year, last.quarter),
            "last_t": round(float(last.t), 2),
            "quarters": "".join(q for q in "WSF" if q in {Q_ABBR[x] for x in g.quarter}),
            "raw_a": r3(g.nA.sum() / n),
            "raw_df": r3(g.nDF.sum() / n),
            "a": {"est": r3(a.est), "lo": r3(a.lo), "hi": r3(a.hi), "pred_lo": r3(a.pred_lo),
                   "pred_hi": r3(a.pred_hi), "p_above": r3(a.p_above)},
            "df": {"est": r3(dfr.est), "lo": r3(dfr.lo), "hi": r3(dfr.hi), "p_above": r3(dfr.p_above)},
        })

    eras = []
    for i, e in enumerate(fa["eras"]):
        b, sd = fa["beta"][i], np.sqrt(fa["beta_var"][i])
        k = int((fa["era_idx"] == i).sum())
        eras.append({"era": e, "level": r3(expit(b)), "lo": r3(expit(b - Z90 * sd)),
                         "hi": r3(expit(b + Z90 * sd)), "offerings": k})

    s, lo, hi = fa["sens"]
    base_a, base_d = baseline(fa), baseline(fd)
    sw = float(np.sqrt(fa["sw2"]))  # same-instructor offering-to-offering sd (logit scale)
    b_cur = fa["beta"][-1]
    swing = (r3(expit(b_cur - Z90 * sw)), r3(expit(b_cur + Z90 * sw)))
    return {
        "code": code,
        "dept": d_all.dept.iloc[0],
        "plat_url": PLAT_URL.format(code.replace(" ", "%20").replace("&", "%26")),
        "summary": {
            "offerings": len(shown),
            "regular_offerings": len(reg),
            "summer_offerings": int((shown.quarter == "Summer").sum()),
            "students": int(shown.nGraded.sum()),
            "instructors": int(reg.instructor.nunique()),
            "first": qlabel(shown.year.iloc[0], shown.quarter.iloc[0]),
            "last": qlabel(shown.year.iloc[-1], shown.quarter.iloc[-1]),
        },
        "current_era": fa["eras"][-1],
        "eras": eras,
        "baseline": {"a": {k: r3(v) if k != "era" else v for k, v in base_a.items()},
                      "df": {k: r3(v) if k != "era" else v for k, v in base_d.items()}},
        "same_instructor_swing": {"lo": swing[0], "hi": swing[1], "centre": r3(expit(b_cur))},
        "sensitivity": {"score": r3(s), "lo": r3(lo), "hi": r3(hi), "label": sensitivity_label(s, lo, hi),
                         "repeat_instructors": fa["repeat_ins"], "offerings": len(reg)},
        "instructors": instructors,
        "history": history,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "web" / "public" / "data"))
    args = ap.parse_args()
    out = Path(args.out)

    df = load()
    fits_a, prior_a, _ = fit_all(df, "nA")
    fits_d, prior_d, _ = fit_all(df, "nDF")

    if (out / "courses").exists():
        shutil.rmtree(out / "courses")
    (out / "courses").mkdir(parents=True)

    max_t = df.t.max()
    index, labels = [], {}
    for code, d_all in df.groupby("course"):
        if code not in fits_a:
            continue  # no regular-quarter offering with letter grades
        c = build_course(code, d_all, fits_a[code], fits_d[code])
        (out / "courses" / f"{slug(code)}.json").write_text(json.dumps(c, separators=(",", ":")))
        recent = sorted({i["name"] for i in c["instructors"] if i["last_t"] >= max_t - RECENT_YEARS},
                        key=lambda n: -max(i["last_t"] for i in c["instructors"] if i["name"] == n))
        label = c["sensitivity"]["label"]
        labels[label] = labels.get(label, 0) + 1
        index.append([code, slug(code), c["summary"]["offerings"], c["summary"]["students"],
                      c["summary"]["last"], recent[:4], label])

    index.sort(key=lambda r: -r[3])
    (out / "index.json").write_text(json.dumps(index, separators=(",", ":")))

    sha = next((line.split()[0] for line in (ROOT / "data/raw/SHA256SUMS").read_text().splitlines()
                if line.endswith("courseGrades.csv")), None)
    manifest = {
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "source": {"url": "https://github.com/dailynexusdata/grades-data", "file": DEFAULT_CSV.name,
                    "sha256": sha, "fetched_at": (ROOT / "data/raw/FETCHED_AT").read_text().strip(),
                    "first": f"{df.year.min()}", "last": f"{df.year.max()}"},
        "courses": len(index),
        "sensitivity_labels": labels,
        "model": {"K0": K0, "DF0": DF0, "J0": J0, "bootstrap": BOOT, "min_graded": MIN_GRADED, "min_repeat": MIN_REPEAT,
                   "min_offerings": MIN_OFFERINGS, "z90": round(float(Z90), 3),
                   "prior_a": prior_a, "prior_df": prior_d, "interval": "90%"},
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"wrote {len(index)} courses to {out}; sensitivity labels: {labels}")


if __name__ == "__main__":
    main()
