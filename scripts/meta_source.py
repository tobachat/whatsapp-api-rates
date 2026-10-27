"""Fetch Meta's rate-card files and country-to-market mapping. Stdlib only apart from openpyxl (parsing)."""
import html
import re
import urllib.request

PAGE = "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
BS = chr(92)  # backslash: the page embeds its data as escaped JSON

LINK_RE = re.compile(
    r'"href":"(https:[^"]*?)","target":null\},"isEagerLoaded":false,'
    r'"children":\["([A-Z]{3}) (list rates|volume tiers|rates and volume tiers)"\]'
)


class LayoutChanged(Exception):
    """The page no longer looks the way the scraper expects."""


def get(url, extra=None, timeout=90):
    headers = {"User-Agent": UA, "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9",
               "Sec-Fetch-Mode": "navigate"}
    headers.update(extra or {})
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as r:
        return r.read()


def rate_card_links(page_bytes=None):
    """Return {(currency, kind): url} with kind in list_rates | volume_tiers (PDFs ignored)."""
    if page_bytes is None:
        page_bytes = get(PAGE, {"Sec-Fetch-Dest": "document"})
    text = page_bytes.decode("utf8", "replace").replace(BS, "")
    out = {}
    for url, cur, kind in LINK_RE.findall(text):
        if kind.startswith("rates and"):
            continue
        out[(cur, kind.replace(" ", "_"))] = html.unescape(url)
    curs = {c for c, _ in out}
    if len(curs) < 10 or any((c, k) not in out for c in curs for k in ("list_rates", "volume_tiers")):
        raise LayoutChanged(f"expected >=10 currencies with both files, found {sorted(out)[:6]}...")
    return out


def download(url):
    data = get(url, timeout=120)
    if data[:2] != b"PK":
        raise LayoutChanged("a rate-card download is not an XLSX workbook")
    return data


def country_map_markdown():
    """Meta serves a plain-markdown rendering of the page at <page>.md."""
    raw = get(PAGE + ".md").decode("utf8", "replace")
    m = re.search(r"<pre[^>]*>(.*?)</pre>", raw, re.S)
    if not m:
        raise LayoutChanged("markdown rendering of the pricing page not found")
    return html.unescape(m.group(1))


COUNTRY_RE = re.compile(r"^\s*- (.+?) \(([A-Z]{2})\) - (\d+)(?: \(([^)]*)\))?\s*$")
HEAD_RE = re.compile(r"^\s*- \*\*(.+?)\s+\S\s+(?:(\d+) markets?|All other markets)\*\*\s*$")


def parse_country_map(md):
    """Return (rows, declared) where rows = [(iso, country, market, market_type, calling_code, extra_codes)]
    and declared = {market: declared member count}."""
    start = md.find("Standalone on rate cards")
    if start < 0:
        raise LayoutChanged("country calling code section not found")
    rows, declared, market, mtype = [], {}, None, "country"
    for line in md[start:].splitlines()[1:]:
        h = HEAD_RE.match(line)
        if h:
            market, mtype = h.group(1), ("other" if h.group(1) == "Other" else "region")
            declared[market] = int(h.group(2)) if h.group(2) else 0
            continue
        if line.startswith("- **Charged"):
            continue
        c = COUNTRY_RE.match(line)
        if c:
            name, iso, code, extra = c.groups()
            rows.append((iso, name, name if market is None else market, "country" if market is None else mtype,
                         code, (extra or "").replace(" ", "")))
        elif rows and not line.strip().startswith("-") and line.strip() and not line.startswith(" "):
            break
    if len(rows) < 100:
        raise LayoutChanged(f"only {len(rows)} countries parsed")
    return rows, declared
