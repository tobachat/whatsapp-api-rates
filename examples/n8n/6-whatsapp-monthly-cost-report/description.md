# Monthly WhatsApp Business API cost report with budget alert

On the 1st of each month, emails what last month's WhatsApp Business Platform messages cost, built from Meta's own
message volumes and the open rate card in your account currency.

## Who is this for
Businesses on the WhatsApp Business Platform (Cloud API) that want to see last month's messaging cost before the
invoice arrives, including those billed through a partner (BSP), where Meta's API returns volumes but no cost.

## How it works
1. A Schedule Trigger runs on the 1st at 08:00; a Code node checks the settings and works out last month and the
   month before in the workflow timezone.
2. One Graph API call (`pricing_analytics`, monthly, per country, category, pricing type and volume tier) returns the
   account currency and delivered volumes.
3. The list rates and volume tiers in that currency are downloaded from this repo (`data/latest/<CUR>.csv`,
   `data/tiers/<effective_date>.csv`).
4. Every paid line is priced with its market's list rate or tier rate; free messages cost 0.
5. The report (total, change on the month before, per category, top countries, free messages) goes out by Gmail, or
   an over-budget alert when the total exceeds your budget.
6. If Meta or a download fails, an error email names the likely cause (expired token, wrong WABA ID, missing
   permission) and the fix.

## Setup
1. Header Auth credential: name `Authorization`, value `Bearer <System User token>` with `whatsapp_business_management`.
2. Gmail credential on the three email nodes.
3. Settings node: WABA ID, monthly budget (0 = no check), report email, Graph API version.

## Notes
An estimate at list prices, excluding VAT and partner fees; Meta's invoice is leading. Tested on n8n Cloud (November 2026)
against a live WABA. Submitted to the n8n template library as workflow 21896 (resubmitted 2026-11-05).

Rates data: [Tobachat open dataset](https://tobachat.nl/en/whatsapp-api-pricing-by-country/)

Author: Tobachat
