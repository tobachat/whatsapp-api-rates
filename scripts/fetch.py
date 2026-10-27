"""Download Meta's current rate-card workbooks (plus the markdown page for the country map) into a directory.

    python scripts/fetch.py DIR
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import meta_source as ms  # noqa: E402


def fetch_all(dest, want_map=True):
    dest = Path(dest)
    dest.mkdir(parents=True, exist_ok=True)
    links = ms.rate_card_links()
    for (cur, kind), url in sorted(links.items()):
        (dest / f"{cur}_{kind}.xlsx").write_bytes(ms.download(url))
    if want_map:
        (dest / "page.md").write_text(ms.country_map_markdown(), encoding="utf8")
    return len({c for c, _ in links})


if __name__ == "__main__":
    print(f"downloaded {fetch_all(sys.argv[1])} currencies")
