"""Download instructor photos listed in analysis/photo_sources.json from their official UCSB department pages.

    python scripts/fetch_photos.py

Writes web/public/photos/<slug>.<ext> and web/public/photos/manifest.json (with each photo's source page).
The photos belong to their departments; every one is credited to its page in the manifest and THIRD_PARTY_NOTICES.md.
"""

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "photos"
UA = {"User-Agent": "Mozilla/5.0 (UCSB student project; instructor photos)"}
SKIP = re.compile(r"logo|icon|wordmark|seal|banner|ucsb-default", re.IGNORECASE)


def get(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


def portrait(page_url: str) -> str | None:
    """The first content image on the person's page (Drupal stores them under /sites/default/files/)."""
    page = get(page_url).decode("utf-8", "replace")
    for src in re.findall(r'src="(/sites/default/files/[^"]+\.(?:jpe?g|png|webp)[^"]*)"', page, re.IGNORECASE):
        if not SKIP.search(src):
            return urllib.parse.urljoin(page_url, html.unescape(src))
    return None


def main():
    sources = json.loads((ROOT / "analysis" / "photo_sources.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key, s in sources.items():
        if key.startswith("_"):
            continue
        img = portrait(s["page"])
        if not img:
            print(f"  no photo on {s['page']}", file=sys.stderr)
            continue
        ext = Path(urllib.parse.urlparse(img).path).suffix.lower() or ".jpg"
        name = re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-") + ext
        (OUT / name).write_bytes(get(img))
        manifest[key] = {"file": name, "display": s["display"], "source": s["page"]}
        print(f"  {key:22} {name}", file=sys.stderr)
        time.sleep(0.5)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"{len(manifest)} photos", file=sys.stderr)


if __name__ == "__main__":
    main()
