#!/usr/bin/env bash
# Download the Daily Nexus grade data (Registrar records via Public Records Act requests).
# Source: https://github.com/dailynexusdata/grades-data  ("All data is free to reuse")
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
base=https://raw.githubusercontent.com/dailynexusdata/grades-data/main
for f in courseGrades.csv ges.csv ges_long_form.csv; do
  curl -fsSL "$base/$f" -o "data/raw/$f"
done
sha256sum data/raw/*.csv > data/raw/SHA256SUMS
date -u +%Y-%m-%dT%H:%M:%SZ > data/raw/FETCHED_AT
wc -l data/raw/courseGrades.csv
