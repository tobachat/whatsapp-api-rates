import { data } from './data.js'
import type { Category, CostEstimate, CostInput, Market, Rate } from './types.js'

export type { Category, CostEstimate, CostInput, Market, Rate, RateData } from './types.js'
export { data }

const CATEGORIES: Category[] = ['marketing', 'utility', 'authentication', 'service']

function findMarket(country: string): { m: Market; by: Rate['matched_by'] } {
  const key = country.trim().toUpperCase()
  if (!key) throw new Error('country is required')
  for (const m of data.markets) {
    if (m.market.toUpperCase() === key) return { m, by: m.type }
  }
  for (const m of data.markets) {
    if (m.type === 'country' && m.iso_codes.includes(key)) return { m, by: 'country' }
  }
  for (const m of data.markets) {
    if (m.type === 'region' && m.iso_codes.includes(key)) return { m, by: 'region' }
  }
  // Meta bills every country it does not name under "Other".
  const other = data.markets.find((m) => m.market === 'Other')
  if (!other) throw new Error('rate data has no "Other" market')
  return { m: other, by: 'other' }
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

/** Meta's list rate per delivered message. `country` is an ISO 3166-1 alpha-2 code or a market name. */
export function getRate(country: string, category: Category): Rate {
  if (!CATEGORIES.includes(category)) throw new Error(`unknown category: ${category}`)
  const { m, by } = findMarket(country)
  return {
    market: m.market,
    matched_by: by,
    category,
    rate: m[category],
    currency: data.currency,
    effective_date: data.effective_date,
    source: data.source,
  }
}

/** Every market on the rate card (countries first, then regions). */
export function listMarkets(): Market[] {
  return data.markets.map((m) => ({ ...m, iso_codes: [...m.iso_codes] }))
}

/**
 * Monthly cost at list rates, excl. VAT. The first 1,000 service messages per
 * business phone number per month are free; everything else is billed per message.
 */
export function estimateMonthlyCost(input: CostInput): CostEstimate {
  const phones = input.phoneNumbers ?? 1
  if (!Number.isInteger(phones) || phones < 1) throw new Error('phoneNumbers must be a positive integer')
  const free = data.free_service_per_number * phones
  const lines = {} as CostEstimate['lines']
  let total = 0
  let market = ''
  for (const c of CATEGORIES) {
    const messages = input[c] ?? 0
    if (!Number.isFinite(messages) || messages < 0) throw new Error(`${c} must be a number >= 0`)
    const r = getRate(input.country, c)
    market = r.market
    const billable = c === 'service' ? Math.max(0, messages - free) : messages
    const cost = round(billable * r.rate)
    lines[c] = { messages, billable, rate: r.rate, cost }
    total += cost
  }
  return {
    market,
    currency: data.currency,
    lines,
    total: round(total),
    free_service_messages: free,
    effective_date: data.effective_date,
    source: data.source,
  }
}
