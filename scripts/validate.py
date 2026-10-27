"""Validate the published CSVs. Exit 1 with a list of problems.

    python scripts/validate.py
"""
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent.parent
DEC = re.compile(r"^-?\d+(\.\d+)?$")
errors = []


def rows(p):
    with open(p, newline="", encoding="utf8") as f:
        return list(csv.DictReader(f))


def err(msg):
    errors.append(msg)


idx = json.loads((ROOT / "rates.json").read_text(encoding="utf8"))
cmap = rows(ROOT / "data/country_market.csv")
if len({r["iso2"] for r in cmap}) != len(cmap):
    err("country_market: duplicate iso2")
cm_markets = {r["market"] for r in cmap}

for v in idx["versions"]:
    for key in ("rates", "tiers"):
        p = ROOT / v[key]
        if hashlib.sha256(p.read_bytes()).hexdigest() != v[key + "_sha256"]:
            err(f"{p.name}: hash in rates.json is stale")
    for r in rows(ROOT / v["rates"]):
        if not DEC.match(r["rate"]):
            err(f"rates {r['currency']} {r['market']} {r['category']}: bad rate {r['rate']!r}")
    per = Counter()
    seen = set()
    for r in rows(ROOT / v["rates"]):
        k = (r["currency"], r["market"], r["category"])
        if k in seen:
            err(f"duplicate rate row {k}")
        seen.add(k)
        if r["category"] == "marketing":
            per[r["currency"]] += 1
    for cur, n in per.items():
        if n != 47:
            err(f"{v['effective_date']} {cur}: {n} markets, expected 47")
    if len(per) < 16:
        err(f"{v['effective_date']}: only {len(per)} currencies")
    for r in rows(ROOT / v["tiers"]):
        for c in ("tier_from", "rate", "pct_vs_list"):
            if not DEC.match(r[c]):
                err(f"tiers {r['currency']} {r['market']}: bad {c} {r[c]!r}")
        if r["tier_to"] and not DEC.match(r["tier_to"]):
            err(f"tiers {r['currency']} {r['market']}: bad tier_to {r['tier_to']!r}")

latest = idx["latest_effective_date"]
long_latest = {(r["currency"], r["market"], r["category"]): r["rate"] for r in rows(ROOT / f"data/rates/{latest}.csv")}
for c in idx["currencies"]:
    ws = rows(ROOT / c["latest"])
    if len(ws) != 47:
        err(f"{c['code']}: {len(ws)} rows in latest")
    for r in ws:
        if r["market"] != "Other" and r["market"] not in cm_markets:
            err(f"{c['code']} {r['market']}: not in country_market")
        for cat in ("marketing", "utility", "authentication", "authentication_international", "service"):
            if r[cat] and not DEC.match(r[cat]):
                err(f"{c['code']} {r['market']} {cat}: {r[cat]!r}")
            if long_latest.get((c["code"], r["market"], cat), "") != r[cat]:
                err(f"{c['code']} {r['market']} {cat}: latest differs from long file")

    j = json.loads((ROOT / c["latest_json"]).read_text(encoding="utf8"))
    if (j["currency"], j["effective_date"], len(j["markets"])) != (c["code"], latest, len(ws)):
        err(f"{c['latest_json']}: header or market count differs from the CSV")
    for r, m in zip(ws, j["markets"]):
        cats = ("marketing", "utility", "authentication", "authentication_international", "service")
        if m["market"] != r["market"] or m["iso_codes"] != r["iso_codes"].split() \
                or any((float(r[k]) if r[k] else None) != m[k] for k in cats):
            err(f"{c['latest_json']} {r['market']}: differs from the CSV")

for p in (ROOT / "data").rglob("*.csv"):
    text = p.read_text(encoding="utf8")
    if re.search(r"(^|,)n/a(,|$)|\d[eE][-+]?\d|&amp;|\\n", text, re.M):
        err(f"{p.relative_to(ROOT)}: contains n/a, scientific notation or an HTML entity")
    if "–" in text or "—" in text:
        err(f"{p.relative_to(ROOT)}: dash character")

if errors:
    print("\n".join(errors[:50]))
    sys.exit(1)
print(f"ok: {len(idx['versions'])} version(s), {len(idx['currencies'])} currencies, 47 markets each")
