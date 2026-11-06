# CLAUDE.md

## What this is

A UCSB course decision tool (working title TakeOrWait) built on Daily Nexus / Registrar grade data. It is the deployed project for Billy's application to a student-industry project program (details in `notes/acm-application.md`; rolling admission, so ship early). Product: `docs/product-spec.md`. Statistics: `docs/methodology.md`. Plan: `ROADMAP.md`.

## Private context

`notes/` is gitignored and holds personal goals, application strategy, and the competitor/people analysis. Read `notes/goals.md` first in a new session. **Never move content from `notes/` into tracked files.** In particular, don't write anything disparaging about UCSBPlat or naming its maintainers in the public repo. The project is positioned as complementary to Plat.

## Working rules

- The user communicates in Chinese. Write public docs (README, docs/) in English and private notes in Chinese.
- Real data only. Every displayed statistic carries its sample size and an interval. Never invent instructor or course facts.
- No RateMyProfessors data.
- The statistics and data pipeline must stay something Billy can explain end to end (he will be interviewed on it). Prefer simple, documented methods over opaque ones, and explain non-obvious choices in `docs/methodology.md`. The frontend may be AI-generated freely.
- No secrets in git. LLM keys go in environment variables only.

## Environment and commands

- Conda env `project-for-acm` (`environment.yml`); PyCharm is configured to use it.
- `./scripts/fetch_nexus.sh` downloads data to `data/raw/` (gitignored) with SHA-256 checksums.
- Analysis scripts import `load.py` by relative module name, so run them from `analysis/`: `cd analysis && python prof_compare.py "CMPSC 24"`.
- Save dated analysis outputs to `docs/findings/YYYY-MM-DD-*.md`.
- Site data: `cd analysis && python build_site_data.py` regenerates `web/public/data/` (committed; Vercel only runs `next build`).
- Site: `cd web && npm run dev`, or `npm run build` for the static export in `web/out/`. The `web-static` entry in `.claude/launch.json` serves `web/out/` on port 4321.

## Data gotchas

- Course codes and (in 2026 rows) instructor names are space-padded. Always go through `analysis/load.py`.
- `A`, `B`, … exclude plus/minus. Use `nA` / `nGraded` from `load.py`.
- Some names are truncated (`GARCIA-CERVER`).
- The PHYS 7 series only exists from 2024 on.
