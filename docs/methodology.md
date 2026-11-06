# Methodology

Status: sections 1–3 are implemented in `analysis/model.py` and power the site. Items marked **TODO** are not implemented yet.

## Data

- `courseGrades.csv` from [dailynexusdata/grades-data](https://github.com/dailynexusdata/grades-data): one row per course × instructor × quarter, Fall 2009 – Summer 2026, courses with ≥5 students. Counts for A+ … F (plus/minus in separate columns), P/NP, S/U, and average GPA.
- Fetched by `scripts/fetch_nexus.sh`; SHA-256 and fetch time recorded in `data/raw/`.

### Cleaning (`analysis/load.py`)

- Collapse whitespace and strip course codes **and instructor names**. 2026 rows pad both (`"PHYS      7A "`, `"KOUTROULAKIS                  "`); without stripping, one instructor splits into two.
- Letter total = A+A+A− + … + F. Columns `A`, `B`, … exclude plus/minus.
- **A-rate** = (A+ + A + A−) / letter-graded students. **D/F rate** analogous.
- Summer offerings are analysed separately (different population and format).

## Model used by the site (`analysis/model.py`)

Sections 1–3 are implemented in `analysis/model.py` and exported by `analysis/build_site_data.py`. The model is fitted **separately for each course** on regular-quarter offerings (Fall, Winter, Spring) with at least 5 letter grades. Summer offerings are shown on the site but not modelled.

### Outcome scale

For an offering with `k` A-grades (A+, A, A−) out of `n` letter grades:

- `y = log((k + 0.5) / (n − k + 0.5))`, the empirical logit. The +0.5 keeps 0% and 100% offerings finite.
- `v = 1/(k + 0.5) + 1/(n − k + 0.5)`, its approximate binomial variance. A 300-student lecture has small `v`; a 12-student seminar has large `v`.

Why logit and not raw percentages: a 10-point gap means more near 90% than near 50%, and binomial noise depends on the rate. On the logit scale effects add and noise is roughly constant for a given class size.

The same model is run with D/F counts instead of A counts for the D/F view.

### 1. Era adjustment

A-rates drift strongly over time: CMPSC 24 went 39% (2009–14) → 55% (2015–19) → 82% (2020–21, P/NP policy period) → 69% (2022–26). Across 660 courses, era means explain a median of 36% of offering-to-offering variance. Comparing an instructor from 2015 with one from 2025 without adjusting is mostly comparing eras.

Eras: 2009–14, 2015–19, 2020–21, 2022–26 (`load.ERAS`). Each course gets an **era level** `β[era]`:

- the precision-weighted mean of `y` over the course's offerings in that era, with weights `1 / (σw² + τ² + v)` (total variance of one offering), plus
- a prior worth `K0 = 2` offerings centred on (course mean + the department's average shift for that era). The department shift itself is pulled toward the all-campus shift with a weight of 20 offerings. This only matters when a course has one or two offerings in an era.

**Era levels are not net of instructor effects.** If everyone who taught a course in 2009–14 graded low, the model calls that the era, not the instructors. This is a deliberate, conservative choice: when instructors and eras are confounded (an instructor taught only in one era), the data cannot separate them, and attributing the difference to the era avoids inventing instructor differences. An earlier version fitted era and instructor jointly (backfitting); for CMPSC 24 it put the 2009–14 level at 53% while every offering in that era was below 56%, and blamed the gap on the instructors. That version was dropped.

### 2. Instructor estimates with shrinkage

After era adjustment, each offering's residual `r = y − β[era]` is modelled as

```
r = u[instructor] + e
u ~ Normal(0, τ²)          how much instructors differ (between-instructor variance)
e ~ Normal(0, σw² + v)     same instructor, different offering (σw²) + binomial noise (v)
```

Given τ² and σw², the instructor effect is the standard shrinkage (BLUP / empirical-Bayes) estimate:

- `P_j = Σ 1/(σw² + v)` over instructor j's offerings (total precision of their data),
- `r̄_j` = precision-weighted mean of their residuals,
- `u_j = r̄_j · τ²P_j / (1 + τ²P_j)`, with posterior variance `τ² / (1 + τ²P_j)`.

An instructor with one offering has small `P_j`, so `u_j` is pulled strongly toward 0 (the typical instructor). Fifteen offerings barely move.

**Variance components** (method of moments, so they can be explained in one line each):

- `σw²` = pooled variance of residuals around each instructor's own mean (instructors with ≥2 offerings), minus the average binomial variance.
- `τ²` = mean over instructors of `r̄_j² − 1/P_j` (spread of instructor means minus what noise alone would produce).
- Both are **moderated** toward campus-wide medians, like a prior: `σw² ← (df·σ̂w² + 5·σw0²) / (df + 5)`, `τ² ← (J·τ̂² + 3·τ0²) / (J + 3)`. The medians come from a first pass over courses with ≥10 within-instructor degrees of freedom and ≥3 instructors (1,072 courses). For A-rates: σw0² = 0.089, τ0² = 0.010 on the logit scale. For D/F rates both medians are ≤0 and are floored at 0.01.

**What the site shows** (all at the course's latest era level `β_cur`, converted back to a percentage with the inverse logit):

| Number | Formula | Meaning |
|---|---|---|
| Adjusted estimate | `expit(β_cur + u_j)` | expected A-rate of a typical offering by this instructor, at today's grading level |
| 90% interval | `± 1.645 · sqrt(Var(u_j) + Var(β_cur))` | uncertainty about that expectation |
| Single-offering range (light band) | add `σw² + v_typical` to the variance | where one next offering would likely land |
| P(above typical) | `Φ(u_j / sd(u_j))` | probability the instructor's effect is above the course's average instructor |
| Typical or new instructor | `expit(β_cur)`, interval with `τ²` added | what to expect with no history |

Single-offering instructors are listed separately ("thin evidence") when sorting by estimate.

Known simplifications: τ² and σw² are plugged in, not integrated over; `expit(mean)` is the median rather than the mean of a logit-normal; 2020–21 letter grades come from a self-selected population because many students chose P/NP.

### 3. Instructor-sensitivity score (cross-validated)

The question: *does knowing who teaches help predict how an offering is graded?*

For each offering `o`:

- era-only prediction: `r̂ = 0` (i.e. predict the era level),
- with-instructor prediction: the instructor's shrunk effect computed from their **other** offerings only (leave one out). If they taught it only once, this is 0, the same as era-only.

`score = 1 − SSE(with instructor) / SSE(era only)`, with squared errors weighted by `1/(σw² + v)`. It is the share of out-of-sample prediction error removed by knowing the instructor; it can be negative when an instructor's past offerings mislead about their next one.

**Interval**: 400 bootstrap resamples of instructors (each instructor's offerings kept together), 5th–95th percentile.

**Eligibility**: at least 3 instructors who taught the course twice or more, and at least 6 offerings. With only 2 repeat instructors the bootstrap over instructors is degenerate (e.g. a zero-width interval), so those courses show "not enough data".

**Labels** use the interval, not just the point estimate:

| Label | Rule |
|---|---|
| Matters a lot | score ≥ 0.30 and lower bound ≥ 0.10 |
| Matters somewhat | score ≥ 0.10 and lower bound > 0 |
| Barely matters | upper bound < 0.15 |
| Unclear | anything else |

Simplification: era levels and variance components are held at their full-data values during leave-one-out. That leak affects both predictions about equally.

This replaces the in-sample variance share in `variance_share.py` (median 0.19 across 660 courses), which was an upper bound. Out of sample the median is about 0; see `docs/findings/2026-11-05-model-v1.md`.

## 4. Rotation forecast (**TODO**)

From the sequence of (quarter, instructor), estimate P(instructor | course, quarter type) with recency weighting. Observed patterns:
- PHYS 7A: Winter → Koutroulakis (2024, 2025, 2026); Spring → Popescu (2024, 2025), Freund (2026).
- Koutroulakis appears to follow a cohort through the series: 7A Winter 2024 → 7B Spring 2024; 7A Winter 2025 → 7D Spring 2025 → 7C Fall 2025; 7A Winter 2026 → 7B Spring 2026.

Must handle instructors new to the course ("no data") and new courses (PHYS 7 series only exists since 2024).

## 5. Waiting cost (**TODO**)

Inputs: prerequisite graph (parsed from catalog text, LLM-assisted with a labelled evaluation set), offering frequency per quarter type, and a student's plan. Output: how many quarters the downstream chain shifts if this course moves one quarter later.

## 6. Entity resolution (**TODO**)

Match Nexus names (`LAST F M`, sometimes truncated) to schedule-API names. Deterministic rules first (normalize, last name + initials, same department), LLM only for residual ambiguous cases, and every match logged with its rule.
