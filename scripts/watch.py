"""Compare Meta's live rate cards with this repo's data/latest and write a report.

    python scripts/watch.py WORKDIR

Writes WORKDIR/raw/*.xlsx (+ page.md), WORKDIR/report.md and prints a status line. When $GITHUB_OUTPUT is set it
also writes status=ok|changed|broken. Exit code is always 0 for ok/changed/broken so the workflow can open the
right issue; a crash of this script itself is the only failure.
"""
import csv
import os
import shutil
import subprocess
import sys
import traceback
from pathlib import Path

HERE = Path(__file__).parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))
import meta_source as ms  # noqa: E402
from fetch import fetch_all  # noqa: E402


def rows(path):
    with open(path, newline="", encoding="utf8") as f:
        return list(csv.DictReader(f))


def keyed(path, keys, val):
    return {tuple(r[k] for k in keys): r[val] for r in rows(path)}


def diff(old, new, label, limit=40):
    lines = []
    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))
    changed = sorted(k for k in set(old) & set(new) if old[k] != new[k])
    if added or removed or changed:
        lines.append(f"### {label}: {len(changed)} changed, {len(added)} added, {len(removed)} removed")
        for k in changed[:limit]:
            lines.append(f"- `{' / '.join(k)}`: {old[k]} -> {new[k]}")
        for k in added[:limit]:
            lines.append(f"- added `{' / '.join(k)}`: {new[k]}")
        for k in removed[:limit]:
            lines.append(f"- removed `{' / '.join(k)}`: {old[k]}")
        extra = len(changed) + len(added) + len(removed) - 3 * limit
        if extra > 0:
            lines.append(f"- (list truncated; run the watcher locally for the full diff)")
    return lines


def emit(work, status, text):
    (work / "report.md").write_text(text, encoding="utf8")
    print(f"status={status}")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf8") as f:
            f.write(f"status={status}\n")


def main():
    work = Path(sys.argv[1])
    work.mkdir(parents=True, exist_ok=True)
    raw = work / "raw"
    try:
        links = ms.rate_card_links()
        raw.mkdir(exist_ok=True)
        for (cur, kind), url in sorted(links.items()):
            (raw / f"{cur}_{kind}.xlsx").write_bytes(ms.download(url))
        have_map = True
        try:
            (raw / "page.md").write_text(ms.country_map_markdown(), encoding="utf8")
            ms.parse_country_map((raw / "page.md").read_text(encoding="utf8"))
        except Exception as e:  # country map is secondary: report it, keep comparing rates
            have_map = False
            map_err = f"{type(e).__name__}: {e}"
        tmp = work / "build"
        if tmp.exists():
            shutil.rmtree(tmp)
        shutil.copytree(REPO / "data", tmp / "data")
        cmd = [sys.executable, str(HERE / "build.py"), "--raw", str(raw), "--out", str(tmp)]
        if have_map:
            cmd += ["--country-map", str(raw / "page.md")]
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except Exception as e:
        tb = "".join(traceback.format_exception_only(type(e), e)).strip()
        emit(work, "broken", "## Meta watcher broken\n\nThe scraper could not read Meta's rate-card page, so "
             "nothing was compared. Meta probably changed the page layout or started blocking the request.\n\n"
             f"Error: `{tb}`\n\nLook at `scripts/meta_source.py` (`LINK_RE`, `get`).\n")
        return

    new_rates = sorted((tmp / "data" / "rates").glob("*.csv"))[-1]
    eff = new_rates.stem
    lines = []
    old_rates = REPO / "data" / "rates" / new_rates.name
    if not old_rates.exists():
        known = sorted(p.stem for p in (REPO / "data" / "rates").glob("*.csv"))
        lines.append(f"## New rate card: effective {eff} (repo has up to {known[-1] if known else 'nothing'})")
        lines.append("Run the quarterly update in MAINTAINING.md.")
    else:
        lines += diff(keyed(old_rates, ["currency", "market", "category"], "rate"),
                      keyed(new_rates, ["currency", "market", "category"], "rate"), "List rates")
        tk = ["currency", "market", "category", "tier_from"]
        t_old, t_new = REPO / "data" / "tiers" / new_rates.name, tmp / "data" / "tiers" / new_rates.name
        lines += diff(keyed(t_old, tk, "rate"), keyed(t_new, tk, "rate"), "Volume tiers")
        if have_map:
            ck = ["iso2"]
            lines += diff(keyed(REPO / "data" / "country_market.csv", ck, "market"),
                          keyed(tmp / "data" / "country_market.csv", ck, "market"), "Country to market")
        if lines:
            lines.insert(0, f"## Meta changed the rate card that is effective {eff}")
            lines.append("Meta changes rates only on 1 Jan/Apr/Jul/Oct; a mid-quarter change is a correction or a "
                         "scraper problem. Review before updating (MAINTAINING.md).")
    if not have_map:
        lines.append(f"Note: the country map could not be read this run (`{map_err}`); rates were still compared.")
    if any(l.startswith("##") for l in lines):
        emit(work, "changed", "\n".join(lines) + "\n")
    else:
        emit(work, "ok", "No difference with data/latest." + ("\n" + "\n".join(lines) if lines else "") + "\n")


if __name__ == "__main__":
    main()
