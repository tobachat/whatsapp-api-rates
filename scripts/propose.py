"""Turn a "changed" watcher run into a ready update of the repo, for a pull request.

    python scripts/propose.py WORKDIR [--repo DIR] [--checked YYYY-MM-DD]

Reads WORKDIR/raw (written by watch.py), rebuilds data/latest, the dated rate and tier files, rates.json and
datapackage.json in the repo, archives Meta's workbooks in raw/<date>/, runs validate.py, adds a draft CHANGELOG
entry and writes WORKDIR/pr-title.txt and WORKDIR/pr-body.md (report, checks, a draft social post). Publishes
nothing. Writes status=ready|failed, branch=... and effective=... to $GITHUB_OUTPUT; exit code is 0 either way
so the workflow still opens the issue.
"""
import argparse
import csv
import datetime as dt
import os
import re
import subprocess
import sys
import traceback
from pathlib import Path

HERE = Path(__file__).parent
REPO_URL = "https://github.com/tobachat/whatsapp-api-rates"
CATS = ["marketing", "utility", "authentication", "authentication_international", "service"]
POST_LIMIT = 300  # Bluesky's limit; Mastodon allows 500


def latest_rates(path):
    """{(market, category): Decimal string} from a data/latest/<CUR>.csv, or {} if absent."""
    if not path.exists():
        return {}, None
    with open(path, newline="", encoding="utf8") as f:
        rows = list(csv.DictReader(f))
    return {(r["market"], c): r[c] for r in rows for c in CATS if r[c]}, (rows[0]["effective_date"] if rows else None)


def compare(old, new):
    changed = [(m, c, old[(m, c)], new[(m, c)]) for (m, c) in sorted(set(old) & set(new)) if old[(m, c)] != new[(m, c)]]
    added = sorted({m for (m, _) in set(new) - set(old)})
    removed = sorted({m for (m, _) in set(old) - set(new)})
    return changed, added, removed


def pct(a, b):
    return (float(b) - float(a)) / float(a) * 100 if float(a) else 0.0


def social_post(eff, changed, added, removed):
    """Short factual post: counts, the biggest moves (USD list rates), the dataset link. Under POST_LIMIT chars."""
    head = f"Meta's WhatsApp Business API rate card effective {eff}: {len(changed)} USD list rate{'' if len(changed) == 1 else 's'} changed"
    if added:
        head += f", {len(added)} new market{'s' if len(added) > 1 else ''} ({', '.join(added[:3])}{', ...' if len(added) > 3 else ''})"
    if removed:
        head += f", {len(removed)} market{'s' if len(removed) > 1 else ''} gone"
    tail = f"\nOpen CSV and JSON (CC BY 4.0): {REPO_URL}"
    moves = sorted(changed, key=lambda x: -abs(pct(x[2], x[3])))
    for n in range(min(3, len(moves)), -1, -1):
        bits = [f"{m} {c.replace('_', ' ')} {pct(a, b):+.1f}%" for m, c, a, b in moves[:n]]
        text = head + (". Biggest moves: " + "; ".join(bits) + "." if bits else ".") + tail
        if len(text) <= POST_LIMIT:
            return text
    return (head[: POST_LIMIT - len(tail) - 4] + "...") + tail


def changelog_entry(eff, checked, changed, added, removed, correction):
    title = f"## {eff}" + (f" (correction found {checked})" if correction else " (current)")
    lines = [title, "",
             f"Draft written by the watcher on {checked}; review it against Meta's changelog "
             "(https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/updates-to-pricing) "
             "before merging.", "",
             f"- USD list rates changed: {len(changed)} (compare with the count Meta states)."]
    if added:
        lines.append(f"- New markets on the card: {', '.join(added)}.")
    if removed:
        lines.append(f"- Markets no longer on the card: {', '.join(removed)}.")
    for label, sign in (("up", 1), ("down", -1)):
        ms = sorted({m for m, _, a, b in changed if (float(b) - float(a)) * sign > 0})
        if ms:
            lines.append(f"- Rates {label}: {', '.join(ms)}.")
    return "\n".join(lines) + "\n"


def add_changelog(path, entry, correction):
    text = path.read_text(encoding="utf8")
    if not correction:
        text = text.replace(" (current)\n", "\n", 1)
    i = text.index("\n## ") + 1
    path.write_text(text[:i] + entry + "\n" + text[i:], encoding="utf8", newline="\n")


def set_citation(path, eff, checked):
    text = path.read_text(encoding="utf8")
    text = re.sub(r'^version: ".*"$', f'version: "{eff}"', text, flags=re.M)
    text = re.sub(r'^date-released: ".*"$', f'date-released: "{checked}"', text, flags=re.M)
    path.write_text(text, encoding="utf8", newline="\n")


def output(**kv):
    out = os.environ.get("GITHUB_OUTPUT")
    for k, v in kv.items():
        print(f"{k}={v}")
        if out:
            with open(out, "a", encoding="utf8") as f:
                f.write(f"{k}={v}\n")


def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f"{' '.join(map(str, cmd[1:]))} failed:\n{(r.stdout + r.stderr).strip()[-3000:]}")
    return r.stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work")
    ap.add_argument("--repo", default=str(HERE.parent))
    ap.add_argument("--checked", default=dt.date.today().isoformat())
    a = ap.parse_args()
    work, repo, raw = Path(a.work), Path(a.repo), Path(a.work) / "raw"
    try:
        old, old_eff = latest_rates(repo / "data" / "latest" / "USD.csv")
        cmd = [sys.executable, str(HERE / "build.py"), "--raw", str(raw), "--out", str(repo), "--checked", a.checked,
               "--archive-raw"]
        if (raw / "page.md").exists():
            cmd += ["--country-map", str(raw / "page.md")]
        built = run(cmd, repo)
        checked = run([sys.executable, str(repo / "scripts" / "validate.py")], repo)
        eff = sorted(p.stem for p in (repo / "data" / "rates").glob("*.csv"))[-1]
        new, _ = latest_rates(repo / "data" / "latest" / "USD.csv")
        correction = eff == old_eff
        changed, added, removed = compare(old, new)
        add_changelog(repo / "CHANGELOG.md", changelog_entry(eff, a.checked, changed, added, removed, correction),
                      correction)
        if not correction:
            set_citation(repo / "CITATION.cff", eff, a.checked)
    except Exception as e:
        msg = "".join(traceback.format_exception_only(type(e), e)).strip()
        (work / "propose-error.md").write_text(f"Automatic update failed, so no pull request:\n\n```\n{msg}\n```\n",
                                               encoding="utf8")
        output(status="failed")
        return

    title = (f"Rate card correction for {eff}" if correction else f"Rate card effective {eff}") + " (watcher)"
    report = (work / "report.md").read_text(encoding="utf8") if (work / "report.md").exists() else ""
    body = [f"Opened by the weekly watcher. {built}. Validator: {checked}", "",
            "## Before merging",
            f"- [ ] Merge on or after {eff} (Meta publishes its files about a month early)." if not correction else
            "- [ ] Confirm on Meta's page that this is a real correction, not a scraper problem.",
            f"- [ ] The number of changed USD rates ({len(changed)}) matches the count in Meta's changelog.",
            "- [ ] CHANGELOG entry reviewed and the draft line removed.",
            "- [ ] After merging: GitHub Release `v" + eff.replace("-", ".") + "` (Zenodo picks it up), then the package "
            "releases in MAINTAINING.md.", "",
            "## Draft social post (not published)", "", "```", social_post(eff, changed, added, removed), "```", "",
            "## Watcher report", "", report]
    (work / "pr-title.txt").write_text(title + "\n", encoding="utf8")
    (work / "pr-body.md").write_text("\n".join(body), encoding="utf8")
    output(status="ready", branch=f"watcher/rates-{eff}", effective=eff)


if __name__ == "__main__":
    main()
