# Architecture

## v1 (implemented)

```
scripts/fetch_nexus.sh         -> data/raw/courseGrades.csv (+ SHA256SUMS, FETCHED_AT)
analysis/build_site_data.py    -> web/public/data/
  load.py   clean / normalize          courses/<slug>.json   one per course (8,601)
  model.py  era levels, shrinkage,     index.json            search index
            cross-validated score      manifest.json         source hash, model priors, build time
web/  Next.js (static export, `output: "export"`)
  /?c=<slug>&i=<instructor>  the archive view; fetches courses/<slug>.json (index.json on search)
  /course/?c=<slug>          same view, kept for old links
  /about/           method in plain English
```

- The JSON is committed, so a Vercel build only runs `next build`; no Python on the host. Rebuild it locally after a data refresh: `cd analysis && python build_site_data.py`.
- Course pages are fetched on the client rather than pre-rendered. Pre-rendering one page per course embedded each course's data twice (HTML + RSC payload) and produced about 500 MB / 43k files; the client page keeps the deploy at about 40 MB.
- The page is one client view (`web/components/archive/`): `ArchiveScene.ts` (Three.js scene: camera, light, drawer, motion, decryption, picking), `cassette.ts` (the instructor file and how its parts encode the numbers), `CourseApp.tsx` (data, state, text panel), `Roll.tsx` (rolling text and masks), `SearchModal.tsx`. `/` and `/course/` both render it and read `?c=` and `?i=`.
- Post-processing: MSAA render target, bokeh depth of field focused on the selected file, ACES tone mapping. Glass is `MeshPhysicalMaterial` transmission; arcs are full tori that discard fragments outside the shown fraction, so values can sweep.
- `?debug` exposes the scene as `window.__archive` with `advance(seconds)`, used to screenshot animation states under software WebGL.

## Target (planned)

Goal: deployable on free tiers, no cold starts, no secrets in the client, and reviewers can use it without logging in.

```
GitHub Action (monthly + manual)
  scripts/fetch_nexus.sh  ->  data/raw/*.csv
  Python (pandas / DuckDB): clean, model, aggregate
  -> static artifacts: per-course JSON / Parquet, manifest with source hash
        |
        v
Next.js static site on Vercel  (frontend may be AI-assisted; the statistics are not)
  course pages, comparison views, charts
  optional DuckDB-WASM for ad-hoc queries, run in the visitor's browser
        |
        v
One serverless function (Vercel) for LLM features
  natural-language question -> validated structured query
  grounded explanation with numeric check
  per-IP rate limit, API key in environment variables only
```

Why this shape:
- The heavy computation happens once, at build time, so the site is static and fast.
- LLM-generated queries run in the visitor's browser (DuckDB-WASM) against public aggregates, never on a server.
- If the LLM function is down or rate-limited, every core view still works.

Open choices:
- LLM provider on a free tier (Gemini Flash, Groq)
- Whether to call the UCSB Academic Curriculums API (needs a free developer key) at build time for upcoming-quarter instructors
