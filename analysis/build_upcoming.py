"""Match next quarter's lecture instructors to each course's instructor history.

    python build_upcoming.py [quarter]       # default 20271; run fetch_upcoming.py first

Reads data/raw/upcoming-<quarter>.json and web/public/data/courses/*.json, writes web/public/data/upcoming.json:
{quarter, fetched_at, source, courses: {slug: [{"name": schedule name, "match": history name or null}]}}.

Matching, in order: the same Registrar name; else the one history name with the same last name and first initial.
Anything else is a new instructor for that course (no grade history), never a guess.
"""

import json
import sys
from pathlib import Path

from build_site_data import slug

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "public" / "data"


def key(name: str) -> tuple[str, str]:
    parts = name.split()
    return parts[0], (parts[1][0] if len(parts) > 1 else "")


def match(name: str, history: list[str]) -> str | None:
    if name in history:
        return name
    last, initial = key(name)
    hits = [h for h in history if key(h)[0] == last and (not initial or key(h)[1] == initial)]
    return hits[0] if len(hits) == 1 else None


def main(quarter: str = "20271"):
    raw = json.loads((ROOT / "data" / "raw" / f"upcoming-{quarter}.json").read_text())
    courses = {}
    matched = new = 0
    for code, names in raw["courses"].items():
        path = DATA / "courses" / f"{slug(code)}.json"
        history = [i["name"] for i in json.loads(path.read_text())["instructors"]] if path.exists() else []
        if not path.exists() or not names:
            continue
        rows = []
        for n in names:
            m = match(n, history)
            matched += m is not None
            new += m is None
            rows.append({"name": n, "match": m})
        courses[slug(code)] = rows
    out = {k: raw[k] for k in ("quarter", "quarter_code", "source", "fetched_at", "note")}
    out["matching"] = "same Registrar name, else a unique history name with the same last name and first initial; otherwise new"
    out["courses"] = courses
    (DATA / "upcoming.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"{len(courses)} courses with history; {matched} instructors matched, {new} new to their course", file=sys.stderr)


if __name__ == "__main__":
    main(*sys.argv[1:])
