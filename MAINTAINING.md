# Maintaining this repository

Meta changes rates only on 1 Jan, 1 Apr, 1 Jul and 1 Oct, announced at least a month ahead. The weekly watcher
(`.github/workflows/watch-meta.yml`) compares Meta's files with `data/latest`. On a difference it opens a pull
request on the branch `watcher/rates-<date>` with the rebuilt data, Meta's workbooks in `raw/<date>/`, a draft
`CHANGELOG.md` entry, the `CITATION.cff` date and, in the PR body, a draft social post (nothing is published), plus
an issue labelled `meta-change` that links the PR. When the page can no longer be read it opens `watcher-broken`.
Weekly reruns update the same PR and only push again when the rates differ. About 15 minutes per quarter.

The PR needs the repository setting "Allow GitHub Actions to create and approve pull requests" (Settings, Actions,
General, Workflow permissions). Without it the branch is still pushed and the issue carries a compare link.

## Quarterly data update

1. Review the watcher's PR: tick its checklist, compare the number of changed USD rates with Meta's changelog,
   edit the draft CHANGELOG entry (remove the draft line, name markets that left a "Rest of" region). Merge on or
   after the effective date; Meta's files are live a month early. Then publish the release (step 5).
   To test the change path offline: `python -m unittest scripts/test_watch.py` (a fixture of the archived workbooks
   with one bumped rate; covers a new card and a mid-quarter correction).
2. Without the watcher, fetch and build by hand (needs `pip install openpyxl`):
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

## MCP server (`mcp/`)

`whatsapp-rates-mcp` bundles `data/latest/*.json`, the country table, the rate cards and the CHANGELOG notes at build
time, so a new rate card needs a new release (minor bump), nothing else. Not yet published: npm and the MCP Registry
both wait for a token.

1. `cd mcp && npm install && npm test` (regenerates `src/data.generated.ts`, compiles, runs the tests).
2. Bump the version in three places that a test keeps equal: `mcp/package.json`, `VERSION` in `mcp/src/server.ts`,
   and both `version` fields in `mcp/server.json`.
3. npm: an npm account for Tobachat with an automation or granular publish token, stored in Google Secret Manager.
   `cd mcp && npm publish --access public` (runs the tests first). Check https://www.npmjs.com/package/whatsapp-rates-mcp.
4. MCP Registry (namespace `io.github.tobachat`, `mcpName` in `package.json` proves the npm package): install
   `mcp-publisher` (https://github.com/modelcontextprotocol/registry/releases), then in `mcp/`:
   `mcp-publisher login github --token <PAT>` and `mcp-publisher publish`. The org namespace needs a token that can
   read the organisation role of an owner of `tobachat`: a classic PAT with `read:org`, or a fine-grained PAT with
   Organization permissions, Members, read-only. The interactive `mcp-publisher login github` only grants the
   personal namespace. Alternative without a PAT: a workflow with `id-token: write` that runs
   `mcp-publisher login github-oidc` (registry docs, "GitHub Actions"), with the npm token as a repository secret.
   Validate first with `mcp-publisher validate`.
5. Listings after the first publish: awesome-mcp-servers (PR), Glama and mcp.so (they index public GitHub servers;
   mcp.so has a submit form).

## n8n templates (`examples/n8n`)

Five templates. The details of what was verified:

- Node types and typeVersions checked against n8n-io/n8n master on 2026-10-27: whatsApp 1.1, whatsAppTrigger 1,
  webhook 2, respondToWebhook 1.4, code 2, if 2.2, googleSheets 4.7, slack 2.3, httpRequest 4.2, wait 1.1,
  manualTrigger 1, stickyNote 1. Template 4 was imported into n8n Cloud and run successfully on 2026-10-28.
  Templates 1, 2, 3 and 5 are not yet tested end to end (need a Meta test number and Google Sheets).
- Sticky notes follow n8n's "Add sticky notes to templates" page (2026-10-28): one yellow overview note (color 1) top
  left, 100 to 300 words, headings `### How it works`, `### Setup`, `### Customization`; white section notes (color 7)
  with a `##` heading, under 50 words; red (color 3) only for a critical warning on a single node.
- Upkeep: review once per quarter (about 30 minutes): re-import all five into the current n8n, check there are no
  deprecated-node warnings, re-run the estimator. Breakage sources are n8n typeVersion bumps, WhatsApp node changes,
  Meta API changes (template component format, status webhook payload) and Google Sheets node schema changes.
- Template 4 reads `data/latest/EUR.csv` from raw.githubusercontent.com and depends on the columns `market`, `iso_codes`,
  `marketing`, `utility`, `authentication`, `effective_date`. Do not rename them without updating that template. The copy
  submitted to the n8n library reads https://tobachat.nl/data/whatsapp-api-rates-eur.csv with the same columns.
- Only one WhatsApp Trigger can exist per Meta app; templates 1, 2 and 3 each include one (said in their overview notes).
- Submission: the creator portal (https://creators.n8n.io, account "tobachat") takes only the workflow JSON, runs an AI
  check, generates the title and description for you to edit, then a human review (3 to 5 business days). No screenshot
  upload. New creators can have one template in review at a time. Template 4 was submitted on 2026-10-28.
  Guidelines: Creator hub, "Template submission guidelines" and "Add sticky notes to templates" on n8n.notion.site.

## If the watcher says "broken"

Run `python scripts/watch.py /tmp/w` locally. If `rate_card_links` fails, Meta changed the page: open
`https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing` with browser-like headers, find how
the "EUR list rates" link is embedded and adjust `LINK_RE`. The page needs browser-like request headers (`get()` in
`scripts/meta_source.py`); a plain default client user agent gets a 400 or a block.

## History

History starts at 2026-10-01 because Meta overwrites its files and no trustworthy archived copy of earlier rate cards
exists (Wayback holds the page but not the signed files). Never add reconstructed numbers without an official file or a
quoted source; flag them `source=reconstructed:<url>` if you ever do.
