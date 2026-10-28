import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { CATEGORIES } from './types.js'
import { InputError, estimateCost, getRate, listMarkets, rateChanges } from './rates.js'

export const NAME = 'whatsapp-rates'
export const VERSION = '0.1.0'

type Result = { content: { type: 'text'; text: string }[]; isError?: boolean }

function respond(fn: () => unknown): Result {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(fn(), null, 2) }] }
  } catch (e) {
    if (e instanceof InputError) return { content: [{ type: 'text', text: e.message }], isError: true }
    throw e
  }
}

const country = z.string().describe('ISO 3166-1 alpha-2 code (e.g. "BR"), country name, or rate-card market name')
// Case and separators are forgiven ("Marketing", "authentication-international"); the schema still lists the enum.
const category = z
  .preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/[ -]/g, '_') : v), z.enum(CATEGORIES))
  .describe('Meta pricing category')
const currency = z
  .string()
  .optional()
  .describe('Billing currency of the WhatsApp Business account, one of the 16 Meta publishes (default USD)')

export function createServer(): McpServer {
  const server = new McpServer({ name: NAME, version: VERSION })
  const readOnly = { readOnlyHint: true, openWorldHint: false }

  server.registerTool(
    'get_rate',
    {
      title: 'WhatsApp rate for a country',
      description:
        "Meta's WhatsApp Business API list rate per delivered message for a country and category, in the account's billing currency.",
      inputSchema: { country, category, currency },
      annotations: readOnly,
    },
    async (a) => respond(() => getRate(a.country, a.category, a.currency)),
  )

  server.registerTool(
    'list_markets',
    {
      title: 'WhatsApp rate-card markets',
      description:
        "Every market on Meta's WhatsApp rate card with its member countries (ISO and calling codes), plus the currencies and categories available.",
      annotations: readOnly,
    },
    async () => respond(() => listMarkets()),
  )

  server.registerTool(
    'estimate_cost',
    {
      title: 'Estimate monthly WhatsApp cost',
      description:
        'Monthly cost at list rates for a mix of messages by country and category, including the free service-message allowance per business phone number.',
      inputSchema: {
        messages: z
          .array(z.object({ country, category, count: z.number().int().min(0).describe('Delivered messages per month') }))
          .min(1),
        currency,
        phone_numbers: z.number().int().min(1).optional().describe('Business phone numbers sending (default 1)'),
      },
      annotations: readOnly,
    },
    async (a) => respond(() => estimateCost(a.messages, a.currency, a.phone_numbers ?? 1)),
  )

  server.registerTool(
    'rate_changes',
    {
      title: 'WhatsApp rate-card changes',
      description: "What changed on Meta's WhatsApp rate card per quarter, optionally only cards effective after a date.",
      inputSchema: {
        since: z.string().optional().describe('Only cards effective after this date, YYYY-MM-DD'),
        currency,
      },
      annotations: readOnly,
    },
    async (a) => respond(() => rateChanges(a.since, a.currency)),
  )

  return server
}
