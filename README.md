# WhatsApp Business API rates

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23710440.svg)](https://doi.org/10.5281/zenodo.23710440)

Meta's per-message rates for the WhatsApp Business Platform as clean, versioned CSV and JSON, in all 16 currencies Meta publishes.
Rate card in effect: **2026-10-01**, last compared with Meta's files on 2026-10-27.

- **Country to market table.** 141 countries with ISO and calling codes, each mapped to the rate-card market it is billed
  under (its own rate, a "Rest of ..." region or North America), including the shared calling codes (+1, +7).
- **Meta's original files, archived per quarter** in `raw/<date>/`. Meta publishes XLSX workbooks under a `.csv` name,
  behind signed links that expire, and overwrites them every quarter; this repo keeps every card.
- **List rates and volume tiers** for every currency, Meta's own values, never converted.
- **A weekly watcher** that compares Meta's live files with this repo and opens an issue and a pull request when they change.
- **Tools:** JavaScript and Python estimators (`packages/`), five n8n templates (`examples/n8n/`).

## Use it programmatically

Recommended source: the raw files of this repo, for example
`https://raw.githubusercontent.com/tobachat/whatsapp-api-rates/main/data/latest/EUR.csv`.
They work from any client and send `Access-Control-Allow-Origin: *`, so a browser can fetch them too. (tobachat.nl serves
the same data to browsers, curl and Node, but refuses Python's default urllib user agent.)
`rates.json` lists every file, version and hash. A bundled, dependency-free estimator is in `packages/` (EUR only).

## JSON

Every `data/latest/<CUR>.csv` has a JSON twin with the same rows, at a stable URL:

```
curl -s https://raw.githubusercontent.com/tobachat/whatsapp-api-rates/main/data/latest/USD.json
```

```json
{
 "currency": "USD", "effective_date": "2026-10-01", "checked_on": "2026-10-27",
 "source": "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing",
 "license": "CC-BY-4.0", "attribution": "Data: Meta rate cards, compiled by Tobachat (...)",
 "unit": "per delivered message, excluding VAT",
 "markets": [{"market": "Argentina", "type": "country", "iso_codes": ["AR"], "calling_codes": ["54"],
              "marketing": 0.0618, "utility": 0.026, "authentication": 0.026,
              "authentication_international": null, "service": 0.026}, ...]
}
```

Rates are numbers; `null` means Meta does not publish that rate for the market. The CSV keeps the exact decimal strings.

## Files

| File | Contents |
| --- | --- |
| `data/rates/2026-10-01.csv` | Long format, all currencies: `effective_date, currency, market, category, rate`. One file per rate card. Categories: `marketing`, `utility`, `authentication`, `authentication_international`, `service`. Rates are decimal strings per delivered message, excluding VAT. A row is absent where Meta lists "n/a" (for example authentication-international outside the markets that have it). |
| `data/tiers/2026-10-01.csv` | Volume tiers (utility, authentication, authentication-international): `effective_date, currency, market, category, tier_from, tier_to, rate_type, rate, pct_vs_list`. `tier_to` is empty for the open-ended last tier; `rate_type` is `list_rate` or `tier_rate`; `pct_vs_list` is a decimal fraction such as `-0.05`. Tiers are per calendar month. |
| `data/latest/<CUR>.csv` | One wide file per currency, one row per market (47): `currency, effective_date, checked_on, source, market, type, iso_codes, calling_code, marketing, utility, authentication, authentication_international, service`. Empty cell = not published. `type` is `country`, `region` or `other`. |
| `data/latest/<CUR>.json` | The same rows as JSON (see [JSON](#json)). |
| `data/country_market.csv` | Which market a country is priced under: `iso2, country, market, market_type, calling_code, extra_area_codes`. 141 countries: 39 with their own rate, 102 in a "Rest of ..." group or North America. A country that is not listed is priced as `Other`. Source: the "Pricing regions on the rate card" section of [Meta's pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing). |
| `rates.json` | Index: latest effective date, currencies, every version with SHA-256 hashes. |
| `datapackage.json` | Frictionless Data Package with a schema for each file. |
| `raw/<date>/` | Meta's original workbooks for that rate card, kept because Meta's links expire. |
| `CHANGELOG.md` | What changed per rate card. |
| `scripts/` | `fetch.py`, `build.py`, `validate.py`, `watch.py`, `propose.py` (watcher update), `test_watch.py`. |
| `packages/js`, `packages/python` | `whatsapp-pricing`: lookup and monthly cost estimator (EUR). |
| `examples/n8n/` | Five n8n workflow templates. |

## Rates and currencies

Values are Meta's own per currency. Nothing is converted by us. The currency files are close to, but not exactly, plain
exchange-rate versions of each other: for marketing, USD divided by EUR ranges from 1.192 to 1.211 across the 47 markets,
because Meta rounds each currency separately. Use the file for the currency your Meta account is billed in; the currency
is fixed per account.

## Data quality notes (what we cleaned in Meta's files)

- Files named `.csv` are XLSX workbooks; we read them with openpyxl and write real CSV.
- The list-rates sheet has five title and link rows before the header; the header has an embedded line break
  ("Authentication-International"). Names are normalised.
- "n/a" strings become absent rows (long format) or empty cells (wide format); the open-ended tier "--" becomes an empty `tier_to`.
- Numbers are written as plain decimal strings (no `8.0E-4`, no binary float noise).
- HTML entities in names (`&amp;`) are decoded. "Rest of Central & Eastern Europe" is the name Meta uses.
- In the volume-tier sheet the market name appears only on the first row of each block and three tier blocks sit side by
  side; we fill the name down and give each block its own rows.
- The "Service" column is reported as Meta lists it. Service messages are free-form replies inside the customer service
  window; since 2026-10-01 the first 1,000 per business phone number per month are free and the rest are billed at this
  rate (equal to utility in every market). Meta's "Meta Business Agent" column is a flat per-million-token price in USD
  in every row, not a message rate, so it is left out.
- `Other` has no member countries: it is every country not listed in `country_market.csv`.
- Kazakhstan and Russia share calling code 7; Canada, the United States and several Caribbean countries share code 1, so a
  calling code alone is not enough: use `country_market.csv` (ISO code) and the extra area codes.

`python scripts/validate.py` checks 47 markets per currency, no `n/a`, no scientific notation, matching hashes and that
every market resolves.

## History

The data starts at 2026-10-01. Meta overwrites its files and no trustworthy archived copy of the earlier cards exists,
so nothing is reconstructed; `CHANGELOG.md` lists Meta's own counts for earlier quarters. From now on every quarter keeps
its dated files and the original workbooks.

## Staying in sync

A weekly GitHub Action (`.github/workflows/watch-meta.yml`) downloads Meta's current files, keeps them as a workflow
artifact and compares them with `data/latest`. When anything differs it opens a pull request with the rebuilt data,
the archived workbooks and a draft CHANGELOG entry, and an issue that links it; a person reviews and merges. If Meta
changes the page so that the files cannot be found, it opens a "Watcher broken" issue instead of failing silently.
Watch this repository's releases to hear about each new rate card. See `MAINTAINING.md`.

## Licence and citation

The data and its compilation (selection, structure, cleaning, documentation), compiled by Tobachat, are
[CC BY 4.0](LICENSE); all code in this repository (`scripts/`, `packages/`, `examples/` and others) is MIT ([LICENSE-CODE](LICENSE-CODE)). The rates themselves are Meta's published prices. This dataset is not affiliated
with, endorsed by or sponsored by Meta Platforms, Inc.; WhatsApp is a trademark of its owner. Check Meta's pricing page
before relying on a figure for a contract or invoice. Cite via `CITATION.cff` (GitHub's "Cite this repository") or the DOI [10.5281/zenodo.23710440](https://doi.org/10.5281/zenodo.23710440), which always points to the latest version.

Maintained by [Tobachat](https://tobachat.nl). The same data as a page:
[WhatsApp API pricing by country](https://tobachat.nl/en/whatsapp-api-pricing-by-country/).
