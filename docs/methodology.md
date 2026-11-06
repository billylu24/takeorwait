# Methodology (draft)

Status: prototype scripts in `analysis/`. Items marked **TODO** are not implemented yet.

## Data

- `courseGrades.csv` from [dailynexusdata/grades-data](https://github.com/dailynexusdata/grades-data): one row per course × instructor × quarter, Fall 2009 – Summer 2026, courses with ≥5 students. Counts for A+ … F (plus/minus in separate columns), P/NP, S/U, and average GPA.
- Fetched by `scripts/fetch_nexus.sh`; SHA-256 and fetch time recorded in `data/raw/`.

### Cleaning (`analysis/load.py`)

- Collapse whitespace and strip course codes **and instructor names**. 2026 rows pad both (`"PHYS      7A "`, `"KOUTROULAKIS                  "`); without stripping, one instructor splits into two.
- Letter total = A+A+A− + … + F. Columns `A`, `B`, … exclude plus/minus.
- **A-rate** = (A+ + A + A−) / letter-graded students. **D/F rate** analogous.
- Summer offerings are analysed separately (different population and format).

## 1. Era adjustment (**TODO**: currently only reported, not removed)

A-rates drift strongly over time: CMPSC 24 went 39% (2009–14) → 55% (2015–19) → 82% (2020–21, P/NP policy period) → 69% (2022–26). Across 660 courses, era means explain a median of 36% of offering-to-offering variance. Comparing an instructor from 2015 with one from 2025 without adjusting is mostly comparing eras.

Plan: model offering A-rate on the logit scale as course effect + era/year effect + instructor effect, and compare instructors on the era-adjusted scale. Candidate eras: 2009–14, 2015–19, 2020–21, 2022–26; also try a smooth year trend.

## 2. Instructor estimate with shrinkage (prototype in `prof_compare.py`)

Treat each offering as one draw of an instructor-level rate. Between-instructor variance τ² is estimated as offering variance minus expected binomial noise. Each instructor's mean is shrunk toward the course mean by w = τ² / (τ² + s²/n), where n is the number of offerings.

Effect: an instructor with a single 96% offering (CMPSC 24, Boyland, 2025) ranks at the 100th raw percentile but has a shrunk estimate of 76% ± 14%.

**TODO**: era-adjusted version; proper hierarchical model (beta-binomial or logit-normal) with posterior intervals; P(A > B) for head-to-head.

## 3. Instructor-sensitivity score (prototype in `variance_share.py`)

For each course: the share of era-adjusted variance explained by instructor means (instructors with ≥2 offerings). Across 660 courses (≥15 regular offerings, ≥3 instructors): median 0.19, IQR 0.06–0.37.

Caveats: in-sample group means overfit, so this is an upper bound. Courses where most instructors taught once show 0 by construction. **TODO**: cross-validated or random-effects (ICC) version.

## 4. Rotation forecast (**TODO**)

From the sequence of (quarter, instructor), estimate P(instructor | course, quarter type) with recency weighting. Observed patterns:
- PHYS 7A: Winter → Koutroulakis (2024, 2025, 2026); Spring → Popescu (2024, 2025), Freund (2026).
- Koutroulakis appears to follow a cohort through the series: 7A Winter 2024 → 7B Spring 2024; 7A Winter 2025 → 7D Spring 2025 → 7C Fall 2025; 7A Winter 2026 → 7B Spring 2026.

Must handle instructors new to the course ("no data") and new courses (PHYS 7 series only exists since 2024).

## 5. Waiting cost (**TODO**)

Inputs: prerequisite graph (parsed from catalog text, LLM-assisted with a labelled evaluation set), offering frequency per quarter type, and a student's plan. Output: how many quarters the downstream chain shifts if this course moves one quarter later.

## 6. Entity resolution (**TODO**)

Match Nexus names (`LAST F M`, sometimes truncated) to schedule-API names. Deterministic rules first (normalize, last name + initials, same department), LLM only for residual ambiguous cases, and every match logged with its rule.
