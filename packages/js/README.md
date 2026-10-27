# whatsapp-pricing

Meta's WhatsApp Business API per-message rates by country and category, plus a monthly cost estimator. Zero dependencies, no network calls: the rate card is bundled.

```
npm install whatsapp-pricing
```

```js
import { getRate, listMarkets, estimateMonthlyCost } from 'whatsapp-pricing'

getRate('NL', 'marketing')
// { market: 'Netherlands', rate: 0.1323, currency: 'EUR', ... }

estimateMonthlyCost({ country: 'NL', marketing: 500, utility: 2000, service: 3000 })
// { total: 231.75, lines: { ... }, free_service_messages: 1000, ... }
```

- `getRate(country, category)`: `country` is an ISO code or market name; categories are `marketing`, `utility`, `authentication`, `service`. Countries Meta does not name fall under its "Other" rate.
- `listMarkets()`: every market on the rate card.
- `estimateMonthlyCost({ country, marketing, utility, authentication, service, phoneNumbers })`: list rates, excl. VAT. The first 1,000 service messages per business phone number per month are free.

Rates are list rates in EUR per delivered message. Volume tiers for utility and authentication are not modelled, so the estimate is the most you pay. Always check Meta's page before budgeting.

## Data

Source: [Meta's pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing). Every result carries `effective_date` and `source`. Current card: effective 2026-10-01, checked 2026-10-27. Updated quarterly on Meta's dates (1 Jan, 1 Apr, 1 Jul, 1 Oct).

Code is MIT. The data is CC BY 4.0: attribute Meta as the source and Tobachat as the compiler.

Maintained by [Tobachat](https://tobachat.nl/en/whatsapp-api-pricing-by-country/). Repo: https://github.com/tobachat/whatsapp-api-rates. Not affiliated with Meta.

Data source: the open dataset https://github.com/tobachat/whatsapp-api-rates (raw files at raw.githubusercontent.com are the recommended programmatic source; this package bundles the EUR card and makes no network calls).
