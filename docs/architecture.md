# Architecture (planned)

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

Open choices (decide in week 1):
- Chart library (Vega-Lite / Observable Plot / visx)
- LLM provider on a free tier (Gemini Flash, Groq)
- Whether to call the UCSB Academic Curriculums API (needs a free developer key) at build time for upcoming-quarter instructors
