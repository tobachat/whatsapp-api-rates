# Estimate monthly WhatsApp Business API cost per country

Price your planned WhatsApp template sends per country and category with an open rate card. No credentials needed.

## Who is this for
Anyone budgeting WhatsApp Business Platform messaging before launching notifications or campaigns.

## How it works
1. List your planned sends (country, category, messages per month).
2. The workflow downloads an open CSV of per-message rates in EUR.
3. A Code node matches each country (or its regional rate) and calculates the cost per line and in total.

## Setup
None. Run it manually, then connect Slack, Gmail or Sheets after the last node if you want the result delivered.

## Notes
Rates are list prices and an estimate. Check the effective date in the output and Meta's own pricing page before you commit to a budget. Free service windows and volume tiers are not modelled.

Rates data: [Tobachat open dataset](https://tobachat.nl/en/whatsapp-api-pricing-by-country/) (CSV: https://raw.githubusercontent.com/tobachat/whatsapp-api-rates/main/data/latest/EUR.csv)

Author: Tobachat
