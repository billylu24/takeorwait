"""Fetch next quarter's lecture instructors from UCSB's public class search (Registrar schedule of classes).

    python fetch_upcoming.py [quarter]      # quarter code YYYYQ, Q: 1 winter, 2 spring, 3 summer, 4 fall; default 20271

Writes data/raw/upcoming-<quarter>.json: {course code: [instructor, ...]} for primary (lecture) sections,
with the fetch time and source URL. Names are in the Registrar format used by the grade data ("MIRZA D").
Sequential requests with a pause; one request per subject area.
"""

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from http.cookiejar import CookieJar
from pathlib import Path

URL = "https://my.sa.ucsb.edu/public/curriculum/coursesearch.aspx"
ROOT = Path(__file__).resolve().parents[1]
QUARTER_NAME = {"1": "Winter", "2": "Spring", "3": "Summer", "4": "Fall"}

_space = re.compile(r"\s+")
_left = re.compile(r'<td style="text-align: left; vertical-align: middle;">(.*?)</td>', re.DOTALL)


def clean(s: str) -> str:
    return _space.sub(" ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def hidden(page: str, name: str) -> str:
    m = re.search(rf'name="{re.escape(name)}"[^>]*value="([^"]*)"', page)
    return html.unescape(m.group(1)) if m else ""


def parse(page: str) -> dict[str, set[str]]:
    """Lecture rows only: the hidden 'Section' cell is True for primary sections.
    The instructor is the first left/middle-aligned cell (then days, then location)."""
    out: dict[str, set[str]] = {}
    for row in page.split('<tr class="CourseInfoRow">')[1:]:
        flag = re.search(r'class="Section">\s*(\w+)', row)
        code = re.search(r'id="CourseTitle"[^>]*>\s*([^<]+)', row)
        if not flag or flag.group(1) != "True" or not code:
            continue
        cells = _left.findall(row)
        names = out.setdefault(clean(code.group(1)), set())
        for name in (clean(n) for n in (re.split(r"<br\s*/?>", cells[0]) if cells else [])):
            if name and name.replace(".", "").replace(" ", "") != "TBA":
                names.add(name)
    return out


def main(quarter: str = "20271"):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    opener.addheaders = [("User-Agent", "Mozilla/5.0 (UCSB student project; schedule of classes)")]
    page = opener.open(URL, timeout=60).read().decode("utf-8", "replace")
    select = re.search(r'<select[^>]*courseList.*?</select>', page, re.DOTALL).group(0)
    subjects = [html.unescape(v) for v in re.findall(r'<option[^>]*value="([^"]*)"', select)]
    courses: dict[str, set[str]] = {}
    for i, subject in enumerate(subjects):
        data = {
            "__VIEWSTATE": hidden(page, "__VIEWSTATE"),
            "__VIEWSTATEGENERATOR": hidden(page, "__VIEWSTATEGENERATOR"),
            "__EVENTVALIDATION": hidden(page, "__EVENTVALIDATION"),
            "ctl00$pageContent1$courseList": subject,
            "ctl00$pageContent1$quarterList": quarter,
            "ctl00$pageContent1$dropDownCourseLevels": "All",
            "ctl00$pageContent1$searchButton.x": "10",
            "ctl00$pageContent1$searchButton.y": "10",
        }
        for attempt in range(3):
            try:
                body = opener.open(URL, urllib.parse.urlencode(data).encode(), timeout=120).read().decode("utf-8", "replace")
                break
            except Exception as e:  # noqa: BLE001 - retry transient server errors
                print(f"  {subject!r}: {e}, retry", file=sys.stderr)
                time.sleep(3)
        else:
            continue
        found = parse(body)
        for code, names in found.items():
            courses.setdefault(_space.sub(" ", code), set()).update(names)
        print(f"{i + 1:3}/{len(subjects)} {subject.strip():8} {len(found):4} courses", file=sys.stderr)
        time.sleep(0.6)

    out = {
        "quarter": f"{QUARTER_NAME[quarter[-1]]} {quarter[:4]}",
        "quarter_code": quarter,
        "source": URL,
        "fetched_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "note": "Primary (lecture) sections only; instructors as listed by the Registrar, T.B.A. omitted.",
        "courses": {k: sorted(v) for k, v in sorted(courses.items())},
    }
    path = ROOT / "data" / "raw" / f"upcoming-{quarter}.json"
    path.write_text(json.dumps(out, indent=1))
    print(f"wrote {path} ({len(courses)} courses)", file=sys.stderr)


if __name__ == "__main__":
    main(*sys.argv[1:])
