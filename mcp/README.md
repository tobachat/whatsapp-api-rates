# whatsapp-rates-mcp

A read-only [MCP](https://modelcontextprotocol.io) server that gives AI assistants Meta's WhatsApp Business API rates:
per country, per category, in any of the 16 currencies Meta bills in, plus a monthly cost estimate. The rate card is
bundled from this repository's dataset at build time, so the server makes no network calls and needs no keys.

Data: Meta rate cards, compiled by Tobachat (https://tobachat.nl/en/whatsapp-api-pricing-by-country/).

## Tools

| Tool | What it answers |
| --- | --- |
| `get_rate(country, category, currency?)` | List rate per delivered message. `country` is an ISO code (`BR`), a country name or a rate-card market name; `category` is `marketing`, `utility`, `authentication`, `authentication_international` or `service`; `currency` defaults to `USD`. |
| `list_markets()` | The 47 rate-card markets with their member countries (ISO and calling codes), the currencies and the categories. |
| `estimate_cost(messages, currency?, phone_numbers?)` | Monthly cost for `messages: [{country, category, count}]`. Applies the free allowance of 1,000 service messages per business phone number per month. List rates, excluding VAT, no volume tiers, so it is the most you pay. |
| `rate_changes(since?, currency?)` | What changed per quarterly rate card, with Meta's own counts for the quarters before the dataset starts. |

Every answer includes the rate card's effective date, the date it was last compared with Meta, Meta's source URL and the
attribution line. A country Meta does not list is billed at its "Other" rate; an unknown name is an error, not "Other".

## Install

Claude Desktop (`claude_desktop_config.json`) and Cursor (`~/.cursor/mcp.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "whatsapp-rates": {
      "command": "npx",
      "args": ["-y", "whatsapp-rates-mcp"]
    }
  }
}
```

Claude Code:

```
claude mcp add whatsapp-rates -- npx -y whatsapp-rates-mcp
```

From source (Node 18 or newer):

```
git clone https://github.com/tobachat/whatsapp-api-rates.git
cd whatsapp-api-rates/mcp && npm install && npm run build
# then use "command": "node", "args": ["/path/to/whatsapp-api-rates/mcp/dist/index.js"]
```

## Example

> What does a WhatsApp marketing message to Brazil cost, and what would 5,000 marketing plus 3,000 service messages a month cost us in BRL?

The assistant calls `get_rate({"country": "BR", "category": "marketing"})` and
`estimate_cost({"messages": [{"country": "BR", "category": "marketing", "count": 5000}, {"country": "BR", "category": "service", "count": 3000}], "currency": "BRL"})`.

## Data and updates

The rates are Meta's published list prices ([source](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)),
copied without conversion. Meta changes them on 1 January, 1 April, 1 July and 1 October; a new version of this package
follows each rate card. Check Meta's page before relying on a figure for a contract or invoice. Not affiliated with,
endorsed by or sponsored by Meta Platforms, Inc.

## Development

`npm test` regenerates `src/data.generated.ts` from `../data`, compiles and runs the tests (node:test).

## Licence

Code: MIT. Bundled data: CC BY 4.0, attribute as "Data: Meta rate cards, compiled by Tobachat
(https://tobachat.nl/en/whatsapp-api-pricing-by-country/)".
