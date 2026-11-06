# TakeOrWait (working title)

**Should I take this course now, with this instructor, or wait?** A data-driven course decision tool for UC Santa Barbara, built on 17 years of real Registrar grade records.

**Live: https://takeorwait.vercel.app** (deploys automatically from `main` via Vercel's GitHub integration; project root `web/`)

> Status: v1, one feature: instructor comparison within a course (8,601 courses). See [ROADMAP.md](ROADMAP.md).

## Why

Course pages typically show an absolute number like "82.7% A". That number can't tell you whether 82.7% is high *for this course*, whether it reflects the instructor or just the era it was taught in, or whether it rests on one offering or fifteen. v1 answers two questions, and only these:

1. **Does the instructor matter for this course?** For some courses it explains most of the offering-to-offering variation, and for others almost none.
2. **Where does each instructor sit** among everyone who has taught the course, adjusted for grading era and shown with a 90% interval?

Rotation forecasts and the cost of waiting a quarter are planned, not built (see the roadmap).

Grading distributions describe grading, not teaching quality. Every number comes with its sample size.

## Data

[Daily Nexus grades data](https://github.com/dailynexusdata/grades-data): grade counts obtained from the UCSB Office of the Registrar via Public Records Act requests, Fall 2009 – Summer 2026, free to reuse. No scraped ratings.

## The interface

The site is a single view in the style of an archive terminal (after [RhineLabUI](https://github.com/LBEILC/RhineLabUI), MIT). A Three.js scene renders the course as a drawer of glass files, one per instructor, ranked by era-adjusted A-rate, between lanes of blank files.

- **Course overview**: whether the instructor matters (leave-one-out score with a bootstrap interval and a label), the typical A-rate at the current grading level, and the highlighted instructor. Each column of the drawer is one course of the department, in course-number order. ←/→ move along the current course's instructors, in the direction they lie on screen; ↑/↓ (or the wheel) switch to the course lane above or below (next or previous course number); a click on a side column jumps to that course and instructor. A ripple runs out from the selected file.
- **Instructor file**: the selected file lifts out, turns to the camera and "decrypts" (a scan line, then the glass clears from the top). Its parts are the data:
  - copper arc on the large ring: era-adjusted A-rate estimate;
  - lighter outer band: its 90% interval;
  - ink tick: a typical (new) instructor in this course;
  - small ring: P(above typical);
  - glass clarity: certainty. A wide interval leaves the glass frosted.
- **Next quarter**: the small block on top of each file is green if that instructor is on the Winter 2027 schedule (UCSB public schedule of classes, lecture sections), amber if history only. A sliding switch shows either all history or only next quarter's instructors; instructors new to a course appear as files with the model's new-instructor estimate.
- **Name and photo**: the opened file carries a name plate on the outside of the glass and a small photo frame. Photos are used only when hand-checked against the instructor's own page on the official UCSB department site (see `analysis/photo_sources.json`); they are downloaded by `scripts/fetch_photos.py` into `web/public/photos/`, each with its source page in `manifest.json`. Everyone else gets initials.
- The text panel repeats every number with sample sizes, and a 2D strip places the instructor among all instructors of the course. Values roll character by character when they change, and are masked until the file is decrypted.
- Without WebGL, or with reduced motion, the same numbers are shown without the animation. Each course links to [UCSBPlat](https://ucsbplat.com) for sections and registration.

## How it works

```
Registrar grade counts (Daily Nexus)  ->  analysis/ (Python: pandas, numpy, scipy)  ->  web/public/data/*.json  ->  web/ (Next.js static export)
```

- `analysis/load.py`: cleaning (padded course codes and names, plus/minus grade totals).
- `analysis/model.py`: per course, era levels on the logit scale, empirical-Bayes shrinkage of instructor effects, leave-one-out instructor-sensitivity score. Every formula is in [docs/methodology.md](docs/methodology.md).
- `analysis/build_site_data.py`: one JSON per course plus a search index and a manifest with the source file's SHA-256.
- `web/`: Next.js + TypeScript + Three.js (`web/components/archive/`), no backend. Runs entirely as static files.

## Quick start

```bash
conda env create -f environment.yml
conda activate project-for-acm
./scripts/fetch_nexus.sh                      # data/raw/, with checksums
cd analysis && python build_site_data.py      # ~2 min, writes web/public/data/
python fetch_upcoming.py && python build_upcoming.py   # next quarter's instructors (~3 min)
cd .. && python scripts/fetch_photos.py && cd analysis   # instructor photos (hand-checked list)
cd ../web && npm install && npm run dev       # http://localhost:3000
```

`npm run build` writes the static site to `web/out/`. On Vercel, set the project root to `web/`; the framework preset (Next.js) needs no other settings.

Prototype scripts: `cd analysis && python prof_compare.py "CMPSC 24"` and `python variance_share.py`.

## Layout

```
analysis/   statistics: load/clean, model, site data export, prototypes
web/        Next.js site (app/, components/, lib/); generated data in web/public/data/
scripts/    data fetching
docs/       product spec, methodology, architecture, dated findings
data/raw/   downloaded source data (not committed)
```

## Early findings

From [docs/findings/2026-11-05-first-look.md](docs/findings/2026-11-05-first-look.md):

- **Era matters a lot.** CMPSC 24's A-rate went 39% (2009–14) → 82% (2020–21) → 69% (2022–26). Across 660 courses, era explains a median 36% of offering-to-offering variance.
- **Instructor sensitivity varies by course.** After era adjustment, instructor explains a median 19% of the remaining variance (IQR 6–37%, in-sample upper bound).
- **Single offerings mislead.** An instructor with one 96% CMPSC 24 offering ranks at the raw 100th percentile; the era-adjusted, shrunk estimate is 83% with a 90% interval of 67–92%.
- **Out of sample, instructor usually doesn't predict grading.** Across 1,170 courses with enough repeat instructors, the median cross-validated score is about 0. It is clearly large in 62 courses (e.g. MCDB 1A, MCDB 1B, MATH 6A, WRIT 2) and clearly small in 764 (e.g. CHEM 1A, the PHYS 6 labs, ECON 1). See [docs/findings/2026-11-05-model-v1.md](docs/findings/2026-11-05-model-v1.md).
