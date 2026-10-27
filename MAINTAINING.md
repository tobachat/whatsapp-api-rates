# Maintaining this repository

Meta changes rates only on 1 Jan, 1 Apr, 1 Jul and 1 Oct, announced at least a month ahead. The weekly watcher
(`.github/workflows/watch-meta.yml`) opens an issue labelled `meta-change` when Meta's files differ from
`data/latest`, or `watcher-broken` when the page can no longer be read. About 15 minutes per quarter for the
data, plus the package release when you want one.

## Quarterly data update

1. Wait for the effective date (or the issue). Meta's files are already live a month early; do not build before
   the new card is effective unless you want it in a branch.
2. Fetch and build (needs `pip install openpyxl`):
   ```
   python scripts/fetch.py /tmp/meta-raw
   python scripts/build.py --raw /tmp/meta-raw --country-map /tmp/meta-raw/page.md --checked YYYY-MM-DD --archive-raw
   python scripts/validate.py
   ```
   This writes `data/rates/<date>.csv`, `data/tiers/<date>.csv`, `data/latest/*.csv`, `data/country_market.csv`,
   `rates.json`, `datapackage.json` and archives Meta's originals in `raw/<date>/` (links expire, so this repo is the archive).
3. Review `git diff --stat` and the diff of `data/latest/EUR.csv`. Compare the number of changed rates with the count
   in Meta's own changelog (https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/updates-to-pricing)
   and write the quarter into `CHANGELOG.md` (what changed, markets moved out of a "Rest of" region, count match).
   Update the date in `CITATION.cff` (`version`, `date-released`).
4. If the validator or builder fails on a new layout, the fix is almost always in `scripts/build.py` (`LIST_COLS`,
   `TIER_BLOCKS`) or `scripts/meta_source.py` (`LINK_RE`, `COUNTRY_RE`). Meta's files are XLSX despite the `.csv` name.
5. Commit, open a PR, merge, then publish a GitHub Release `vYYYY.MM.DD` (the effective date). The Zenodo GitHub
   integration archives it automatically as a new version under the same concept DOI. Check the new version DOI
   and, only if the concept DOI changed (it should not), update the badge in the README.

## Packages (`packages/js`, `packages/python`)

Optional, only when the rates changed (the packages bundle EUR only):

1. `node packages/scripts/build-data.mjs` regenerates `packages/js/data.json`, `packages/js/src/data.ts` and
   `packages/python/src/whatsapp_pricing/data.json` from `data/latest/EUR.csv`. It fails on a malformed CSV.
2. If Meta changed a rule (not only rates), edit `estimateMonthlyCost` (`packages/js/src/index.ts`) and
   `estimate_monthly_cost` (`packages/python/src/whatsapp_pricing/__init__.py`), and the free-allowance constant in the generator.
3. Bump the version in `packages/js/package.json`, `packages/python/pyproject.toml` and
   `packages/python/src/whatsapp_pricing/__init__.py` (minor bump for a rate update). Update the "Current card" line in both READMEs.
4. Test: `cd packages/js && npm install && npm test`, then `cd packages/python && PYTHONPATH=src python -m unittest discover -s tests`.
   The tests pin cost rules, not rate values.
5. Publish: `cd packages/js && npm publish`; `cd packages/python && python -m build && twine upload dist/*`
   (needs an npm token and a PyPI API token).

## n8n templates (`examples/n8n`)

Five templates; nothing is submitted until someone does the steps below. The details of what was verified:

- Node types and typeVersions checked against n8n-io/n8n master on 2026-10-27: whatsApp 1.1, whatsAppTrigger 1,
  webhook 2, respondToWebhook 1.4, code 2, if 2.2, googleSheets 4.7, slack 2.3, httpRequest 4.2, wait 1.1,
  manualTrigger 1, stickyNote 1. Not tested: a real import into an n8n instance and real Meta sends (needs credentials).
- Upkeep: review once per quarter (about 30 minutes): re-import all five into the current n8n, check there are no
  deprecated-node warnings, re-run the estimator. Breakage sources are n8n typeVersion bumps, WhatsApp node changes,
  Meta API changes (template component format, status webhook payload) and Google Sheets node schema changes.
- Template 4 reads `data/latest/EUR.csv` from raw.githubusercontent.com and depends on the columns `market`, `iso_codes`,
  `marketing`, `utility`, `authentication`, `effective_date`. Do not rename them without updating that template.
- Only one WhatsApp Trigger can exist per Meta app; templates 1, 2 and 3 each include one (said in their descriptions).
- Submission (owner clicks): sign up at https://creators.n8n.io as "Tobachat", read the Creator hub guidelines once,
  import each `workflow.json` into n8n, take the screenshot per `screenshot-instructions.md`, submit with `description.md`
  as a free template, answer review comments. Published guidelines summarised: sticky notes mandatory, no hardcoded
  keys, original work, Markdown description with H2 headings.

## If the watcher says "broken"

Run `python scripts/watch.py /tmp/w` locally. If `rate_card_links` fails, Meta changed the page: open
`https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing` with browser-like headers, find how
the "EUR list rates" link is embedded and adjust `LINK_RE`. The page needs browser-like request headers (`get()` in
`scripts/meta_source.py`); a plain default client user agent gets a 400 or a block.

## History

History starts at 2026-10-01 because Meta overwrites its files and no trustworthy archived copy of earlier rate cards
exists (Wayback holds the page but not the signed files). Never add reconstructed numbers without an official file or a
quoted source; flag them `source=reconstructed:<url>` if you ever do.
