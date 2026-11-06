# Roadmap

Started 2026-11-05. Target: a deployed, usable version by the end of week 1 and a stronger version by the end of week 2. Applications use rolling admission, so earlier is better.

## Week 0 — setup (done 2026-11-05)

- [x] Data fetch script with checksums
- [x] Cleaning (whitespace and padded-name fix), instructor comparison prototype, variance decomposition
- [x] Product spec, methodology draft, architecture plan

## Week 1 — minimum shippable version

- [x] Era-adjusted instructor model with intervals (methodology §1–2)
- [x] Instructor-sensitivity score, cross-validated (methodology §3)
- [x] Build step: per-course static JSON artifacts + manifest
- [x] Next.js site: course search, course page (history chart, instructor table with intervals, sensitivity badge), "Open in UCSBPlat" link
- [x] 2026-11-06: scope narrowed to one feature (instructor comparison within a course); site rebuilt as a Three.js archive view (glass file per instructor, decryption, rolling text)
- [x] Deploy to Vercel (2026-11-06): https://takeorwait.vercel.app
- [ ] README with screenshots, method summary, data license (method + data done; screenshots after deploy)
- [x] **v1 public**: deployed URL linked from the README

## Week 2 — the differentiators

- [ ] Rotation forecast (methodology §4)
- [ ] Head-to-head P(A > B) for same-quarter instructors
- [ ] Instructor-name entity resolution (rules first, LLM for residual cases, logged)
- [ ] Natural-language questions → validated structured query (serverless function, rate limited)
- [ ] Grounded explanations with numeric check
- [ ] Hand-labelled evaluation set (~50 questions) and published results

## Later

- [ ] Waiting-cost model on the prerequisite graph (LLM-assisted prerequisite parsing + evaluation)
- [x] Upcoming-quarter instructors (2026-11-06, from the public schedule of classes; `analysis/fetch_upcoming.py`)
- [ ] Instructor photos beyond the hand-checked set; decide whether photos ship with the deployed site
- [ ] Monthly data refresh via GitHub Action
