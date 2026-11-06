# Product spec

Working title: **TakeOrWait** (tentative).

## The question we answer

> "This course is offered this quarter by Professor X. Is that a good draw compared with how this course has historically been taught, does the instructor even matter much for this course, and should I take it now or wait?"

Existing tools show *absolute* numbers for one section ("82.7% A"). A number without context can't tell a student whether 82.7% is high **for this course**, in **this era**, from an instructor who has taught it **once or fifteen times**. We answer the relative, decision-shaped question, with real Registrar data and honest uncertainty.

Complementary to UCSBPlat: every course links out to its Plat page for registration details.

## Core views (per course)

1. **Does the instructor matter here?** An instructor-sensitivity score: the share of era-adjusted, offering-to-offering variation explained by who teaches. Some courses vary a lot by instructor and some barely do. If it doesn't matter, say so and stop the agonizing.
2. **Where does this quarter's instructor sit?** Era-adjusted, shrunk estimate of the instructor's A-rate (and D/F rate) for this course, with an interval and the number of offerings it rests on. "1 offering" is flagged as thin evidence, never ranked #1.
3. **Who is likely to teach next?** Rotation forecast from history (e.g. PHYS 7A has alternated Winter → Koutroulakis, Spring → Popescu/Freund since 2024). Shown as probabilities, labelled "no data" for instructors new to the course.
4. **What does waiting cost?** Given a plan (sequence of quarters), how far does delaying this course push its downstream prerequisite chain, and is it offered every quarter or once a year?
5. **Same quarter, two instructors**: head-to-head with P(instructor A's A-rate > B's).

## Principles

- **Real data only.** Daily Nexus grade data (Registrar records, Fall 2009 – Summer 2026). No scraped ratings.
- **Every number carries n and an interval.** No bare percentiles.
- **No verdicts.** We show trade-offs (GPA risk, D/F risk, timing cost); the student sets their own priorities.
- **Grading distribution is not teaching quality.** Stated on every instructor view.

## Where LLM / NLP fits

- **Entity resolution**: instructor names differ across sources ("MIRZA D" in Nexus, full names in the schedule API) and even within Nexus (2026 rows are space-padded; some names are truncated, e.g. "GARCIA-CERVER").
- **Natural-language questions → structured queries** ("CE student, PHYS 7A this winter or wait for spring?"), validated against a schema whitelist, with the generated query shown to the user.
- **Grounded explanations**: numbers are computed by code; the LLM only writes prose, and every number in the prose is checked against the computed stats before display.
- Evaluated with a hand-labelled question set (accuracy of query translation and numeric faithfulness).

## Non-goals

- RateMyProfessors data (ToS forbids scraping; it is per-instructor not per-course; it double-counts grading leniency).
- Live enrollment tracking, schedule building, registration (Plat does these well).
- Ranking instructors by "quality".
