# TakeOrWait (working title)

**Should I take this course now, with this instructor, or wait?** A data-driven course decision tool for UC Santa Barbara, built on 17 years of real Registrar grade records.

> Status: early prototype (analysis scripts only). No deployed site yet. See [ROADMAP.md](ROADMAP.md).

## Why

Course pages typically show an absolute number like "82.7% A". That number can't tell you whether 82.7% is high *for this course*, whether it reflects the instructor or just the era it was taught in, or whether it rests on one offering or fifteen. This project answers the relative, decision-shaped questions:

1. **Does the instructor matter for this course?** For some courses it explains most of the offering-to-offering variation, and for others almost none.
2. **Where does this quarter's instructor sit** in the course's history, adjusted for era and shown with uncertainty?
3. **Who is likely to teach it next**, based on rotation patterns?
4. **What does waiting a quarter cost** along your prerequisite chain?

Grading distributions describe grading, not teaching quality. Every number comes with its sample size.

## Data

[Daily Nexus grades data](https://github.com/dailynexusdata/grades-data): grade counts obtained from the UCSB Office of the Registrar via Public Records Act requests, Fall 2009 – Summer 2026, free to reuse. No scraped ratings.

## Quick start

```bash
conda env create -f environment.yml
conda activate project-for-acm
./scripts/fetch_nexus.sh
cd analysis
python prof_compare.py "CMPSC 24" "PHYS 7A"
python variance_share.py
```

## Layout

```
analysis/   prototype statistics (load/clean, instructor comparison, variance decomposition)
scripts/    data fetching
docs/       product spec, methodology, architecture, dated findings
data/raw/   downloaded source data (not committed)
```

## Early findings

From [docs/findings/2026-11-05-first-look.md](docs/findings/2026-11-05-first-look.md):

- **Era matters a lot.** CMPSC 24's A-rate went 39% (2009–14) → 82% (2020–21) → 69% (2022–26). Across 660 courses, era explains a median 36% of offering-to-offering variance.
- **Instructor sensitivity varies by course.** After era adjustment, instructor explains a median 19% of the remaining variance (IQR 6–37%, in-sample upper bound).
- **Single offerings mislead.** An instructor with one 96% offering ranks at the raw 100th percentile, but the shrunk estimate is 76% ± 14%.
