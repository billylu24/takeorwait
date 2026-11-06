# Roadmap

Started 2026-11-05. Target: a deployed, usable version by the end of week 1 and a stronger version by the end of week 2. Applications use rolling admission, so earlier is better.

## Week 0 — setup (done 2026-11-05)

- [x] Data fetch script with checksums
- [x] Cleaning (whitespace and padded-name fix), instructor comparison prototype, variance decomposition
- [x] Product spec, methodology draft, architecture plan

## Week 1 — minimum shippable version

- [ ] Era-adjusted instructor model with intervals (methodology §1–2)
- [ ] Instructor-sensitivity score, cross-validated (methodology §3)
- [ ] Build step: per-course static JSON artifacts + manifest
- [ ] Next.js site: course search, course page (history chart, instructor table with intervals, sensitivity badge), "Open in UCSBPlat" link
- [ ] Deploy to Vercel; check in an incognito window
- [ ] README with screenshots, method summary, data license
- [ ] **v1 public**: deployed URL linked from the README

## Week 2 — the differentiators

- [ ] Rotation forecast (methodology §4)
- [ ] Head-to-head P(A > B) for same-quarter instructors
- [ ] Instructor-name entity resolution (rules first, LLM for residual cases, logged)
- [ ] Natural-language questions → validated structured query (serverless function, rate limited)
- [ ] Grounded explanations with numeric check
- [ ] Hand-labelled evaluation set (~50 questions) and published results

## Later

- [ ] Waiting-cost model on the prerequisite graph (LLM-assisted prerequisite parsing + evaluation)
- [ ] Upcoming-quarter instructors via the UCSB Academic Curriculums API
- [ ] Monthly data refresh via GitHub Action
